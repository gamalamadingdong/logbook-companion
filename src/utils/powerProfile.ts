/**
 * Power Profile Engine
 *
 * Computes a power-duration profile from synced workout data.
 * See kb/physiology/power-duration-curve.md for the sports science background.
 *
 * Data flow:
 *   WorkoutLog[] → extractBestEfforts() → PowerCurvePoint[]
 *   PowerCurvePoint[] → computePowerProfile() → PowerProfile
 */

import { calculateWattsFromSplit, calculateSplitFromWatts } from './paceCalculator';
import { PR_DISTANCES, TIME_BASED_TESTS } from './prCalculator';
import type { C2ResultDetail } from '../api/concept2.types';
import type { WorkoutLog } from '../services/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PowerCurvePoint {
    distance: number;           // meters actually covered
    watts: number;
    pace: number;               // seconds per 500m
    date: string;
    workoutId: string;
    source: 'whole_workout' | 'interval_split' | 'interval_session' | 'time_test' | 'manual';
    label: string;              // e.g. "2k", "1:00 Test", "Max Watts"
    anchorKey: string | null;   // maps to standard anchor (e.g. "2k", "HM"), null if non-standard
}

export interface PowerRatio {
    anchorKey: string;
    label: string;
    actualWatts: number;
    actualPercent: number;        // % of 2k watts (1.0 = 100%)
    expectedLow: number;          // expected range low (as ratio)
    expectedHigh: number;         // expected range high (as ratio)
    status: 'above' | 'within' | 'below';
}

export type ProfileType = 'sprinter' | 'diesel' | 'threshold_gap' | 'balanced' | 'insufficient_data';

export interface ProfileGap {
    anchorKey: string;
    label: string;
    message: string;
}

export interface TrainingPrescription {
    zone: string;
    rationale: string;
    suggestedWorkouts: string[];
}

export interface PowerProfile {
    points: PowerCurvePoint[];
    anchor2kWatts: number | null;
    ratios: PowerRatio[];
    profileType: ProfileType;
    profileDescription: string;
    gaps: ProfileGap[];
    prescriptions: TrainingPrescription[];
    maxWatts: number | null;
    dataCompleteness: number;     // 0–1 (fraction of 11 anchors with data)
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Expected ratios of watts at each anchor relative to 2k watts. */
const EXPECTED_RATIOS: Record<string, { low: number; high: number; label: string }> = {
    'max_watts': { low: 2.00, high: 2.50, label: 'Max Watts' },
    '1:00':      { low: 1.45, high: 1.60, label: '1:00 Test' },
    '500m':      { low: 1.30, high: 1.40, label: '500m' },
    '1k':        { low: 1.15, high: 1.20, label: '1,000m' },
    '2k':        { low: 1.00, high: 1.00, label: '2,000m' },
    '5k':        { low: 0.80, high: 0.85, label: '5,000m' },
    '6k':        { low: 0.75, high: 0.80, label: '6,000m' },
    '30:00':     { low: 0.72, high: 0.78, label: '30:00 Test' },
    '10k':       { low: 0.70, high: 0.75, label: '10,000m' },
    'HM':        { low: 0.65, high: 0.70, label: 'Half Marathon' },
    'FM':        { low: 0.60, high: 0.65, label: 'Marathon' },
};

/** All anchor keys in order from shortest to longest effort. */
const ANCHOR_ORDER = [
    'max_watts', '1:00', '500m', '1k', '2k', '5k', '6k', '30:00', '10k', 'HM', 'FM'
];

/** Map from PR_DISTANCES shortLabel to anchor key. */
const DISTANCE_TO_ANCHOR: Record<number, string> = {
    500: '500m',
    1000: '1k',
    2000: '2k',
    5000: '5k',
    6000: '6k',
    10000: '10k',
    21097: 'HM',
    42195: 'FM',
};

const SHORT_ANCHORS = ['max_watts', '1:00', '500m', '1k'];
const LONG_ANCHORS = ['5k', '6k', '30:00', '10k', 'HM', 'FM'];
const MID_ANCHORS = ['5k', '6k'];

/**
 * Determine if a workout is an interval workout (NOT a single continuous effort).
 *
 * Uses canonical_name as the primary signal because it's computed from actual
 * interval data during sync and is the most reliable indicator of workout structure:
 *   - "2x1000m/9:55r" → interval (has Nx prefix)
 *   - "5000m" → continuous (no prefix)
 *   - "30:00" → continuous
 *   - "v500/1000/1500m" → variable interval
 *   - "3 x (5 x 500m)" → block interval
 *
 * Falls back to workout_name (which holds the C2 workout_type string due to
 * column swap in DB) if canonical_name is missing.
 */
function isIntervalWorkout(workout: { canonical_name?: string; workout_name?: string }): boolean {
    const canonical = workout.canonical_name;
    if (canonical) {
        // Multi-rep patterns: "2x1000m", "3x10:00/3:00r", "4 x (5 x 500m)", "2x 500m/1000m"
        if (/^\d+\s*x\s*/i.test(canonical)) return true;
        // Variable intervals: "v500/1000/1500m"
        if (/^v\d/i.test(canonical)) return true;
        // Explicit block structure with parens
        if (canonical.includes('(') && canonical.includes(')')) return true;
        // If canonical_name exists and none matched → continuous piece
        return false;
    }

    // Fallback: check C2 workout_type in workout_name column
    const workoutName = workout.workout_name;
    if (workoutName && workoutName.includes('Interval')) return true;

    return false;
}

/** Gap suggestion messages */
const GAP_MESSAGES: Record<string, string> = {
    'max_watts': 'Enter your max watts manually (Settings → Power Profile) or do a few all-out strokes and note the peak.',
    '1:00': 'Do a 1-minute all-out test to measure your anaerobic power.',
    '500m': 'Row a standalone 500m test or an 8×500m to capture your sprint profile.',
    '1k': 'Row a 1k test to fill in your anaerobic capacity.',
    '5k': 'Row a standalone 5k to understand your threshold.',
    '6k': 'Do a 6k test to measure your threshold endurance.',
    '30:00': 'Do a 30-minute test — a standard C2 benchmark for aerobic power.',
    '10k': 'Try a 10k to understand your aerobic endurance ceiling.',
    'HM': 'Row a half marathon to measure your aerobic base.',
    'FM': 'Row a marathon to see your endurance economy. (No rush...)',
};

// ─── Extraction ──────────────────────────────────────────────────────────────

/**
 * Extract the best power data point for every standard distance + time test,
 * plus all non-standard workout distances.
 */
export function extractBestEfforts(
    workouts: WorkoutLog[],
    manualMaxWatts?: number | null,
): PowerCurvePoint[] {
    // Best effort per anchor key
    const bestByAnchor = new Map<string, PowerCurvePoint>();
    // Best efforts at non-anchor distances (keyed by distance rounded to nearest 100m)
    const bestByDistance = new Map<number, PowerCurvePoint>();

    for (const workout of workouts) {
        const totalDistance = workout.distance_meters;
        const totalTime = workout.duration_seconds
            ?? (workout.duration_minutes ? workout.duration_minutes * 60 : 0);
        const workoutDate = workout.completed_at;
        const workoutId = workout.id;

        if (!totalDistance || !totalTime || totalTime <= 0) continue;

        const pace = (totalTime / totalDistance) * 500;
        if (pace < 50 || pace > 300) continue; // filter impossible data

        const watts = calculateWattsFromSplit(pace);

        // Interval workouts (e.g. 2x1000m, 3x10:00, VariableInterval) have total metrics
        // that are the SUM of all intervals — NOT a single continuous effort.
        // A 2x1000m has distance_meters=2000 but is NOT a 2k test.
        // For intervals, skip whole-workout matching (A, B, C) and only use
        // individual interval splits (D).
        //
        // Uses canonical_name as primary signal (e.g. "2x1000m/9:55r" → interval),
        // falls back to workout_name (C2 workout_type) if canonical_name is missing.
        const isInterval = isIntervalWorkout(workout);

        if (!isInterval) {
            // --- A. Check standard distances (continuous workouts only) ---
            let matchedAnchor: string | null = null;
            for (const stdDist of PR_DISTANCES) {
                if (Math.abs(totalDistance - stdDist.meters) / stdDist.meters < 0.01) {
                    const anchorKey = DISTANCE_TO_ANCHOR[stdDist.meters];
                    if (anchorKey) {
                        matchedAnchor = anchorKey;
                        updateBest(bestByAnchor, anchorKey, {
                            distance: totalDistance,
                            watts,
                            pace,
                            date: workoutDate,
                            workoutId,
                            source: 'whole_workout',
                            label: stdDist.label,
                            anchorKey,
                        });
                    }
                    break;
                }
            }

            // --- B. Check time-based tests (continuous workouts only) ---
            for (const test of TIME_BASED_TESTS) {
                const tolerance = test.seconds <= 60 ? 5 : 30; // ±5s for 1min, ±30s for 30min
                if (Math.abs(totalTime - test.seconds) <= tolerance) {
                    updateBest(bestByAnchor, test.shortLabel, {
                        distance: totalDistance,
                        watts,
                        pace,
                        date: workoutDate,
                        workoutId,
                        source: 'time_test',
                        label: test.label,
                        anchorKey: test.shortLabel,
                    });
                }
            }

            // --- C. Non-standard distance (continuous workouts only) ---
            if (!matchedAnchor) {
                const bucketKey = Math.round(totalDistance / 100) * 100;
                const existing = bestByDistance.get(bucketKey);
                if (!existing || watts > existing.watts) {
                    bestByDistance.set(bucketKey, {
                        distance: totalDistance,
                        watts,
                        pace,
                        date: workoutDate,
                        workoutId,
                        source: 'whole_workout',
                        label: `${Math.round(totalDistance)}m`,
                        anchorKey: null,
                    });
                }
            }
        }

        // --- D. Interval split analysis (all workouts — but only fires when raw_data has intervals) ---
        const rawData = parseRawData(workout.raw_data);
        if (rawData) {
            const intervals = rawData.workout?.intervals ?? [];
            for (const interval of intervals) {
                if (interval.type === 'rest' || !interval.distance || !interval.time) continue;

                const splitTimeSeconds = interval.time / 10; // C2 stores in deciseconds
                const splitPace = (splitTimeSeconds / interval.distance) * 500;
                if (splitPace < 50 || splitPace > 300) continue;

                const splitWatts = calculateWattsFromSplit(splitPace);

                // Check if this interval matches a standard distance
                for (const stdDist of PR_DISTANCES) {
                    if (Math.abs(interval.distance - stdDist.meters) < 5) {
                        const anchorKey = DISTANCE_TO_ANCHOR[stdDist.meters];
                        if (anchorKey) {
                            updateBest(bestByAnchor, anchorKey, {
                                distance: interval.distance,
                                watts: splitWatts,
                                pace: splitPace,
                                date: workoutDate,
                                workoutId,
                                source: 'interval_split',
                                label: stdDist.label,
                                anchorKey,
                            });
                        }
                        break;
                    }
                }
            }
        }
    }

    // Add manual max watts if provided
    if (manualMaxWatts && manualMaxWatts > 0) {
        const pace = calculateSplitFromWatts(manualMaxWatts);
        bestByAnchor.set('max_watts', {
            distance: 0,
            watts: manualMaxWatts,
            pace,
            date: '',
            workoutId: '',
            source: 'manual',
            label: 'Max Watts',
            anchorKey: 'max_watts',
        });
    }

    // Combine: anchor points + non-standard distances
    const points: PowerCurvePoint[] = [
        ...bestByAnchor.values(),
        ...bestByDistance.values(),
    ];

    // Sort by distance ascending (max_watts at 0 will be first)
    points.sort((a, b) => a.distance - b.distance);

    return points;
}

// ─── Profile Computation ─────────────────────────────────────────────────────

/**
 * Compute the full power profile from best efforts.
 */
export function computePowerProfile(
    points: PowerCurvePoint[],
    fallback2kWatts?: number,
): PowerProfile {
    // Find 2k anchor
    const twoKPoint = points.find(p => p.anchorKey === '2k');
    const anchor2kWatts = twoKPoint?.watts ?? fallback2kWatts ?? null;

    if (!anchor2kWatts || anchor2kWatts <= 0) {
        return {
            points,
            anchor2kWatts: null,
            ratios: [],
            profileType: 'insufficient_data',
            profileDescription: 'Row a 2k test to unlock your Power Profile. The 2k is the universal anchor in rowing — all analysis starts there.',
            gaps: [],
            prescriptions: [],
            maxWatts: points.find(p => p.anchorKey === 'max_watts')?.watts ?? null,
            dataCompleteness: 0,
        };
    }

    // Build anchor map for quick lookup
    const anchorMap = new Map<string, PowerCurvePoint>();
    for (const pt of points) {
        if (pt.anchorKey) {
            anchorMap.set(pt.anchorKey, pt);
        }
    }

    // Compute ratios
    const ratios: PowerRatio[] = [];
    for (const key of ANCHOR_ORDER) {
        if (key === '2k') continue; // skip anchor itself
        const pt = anchorMap.get(key);
        const expected = EXPECTED_RATIOS[key];
        if (!pt || !expected) continue;

        const actualRatio = pt.watts / anchor2kWatts;

        let status: 'above' | 'within' | 'below';
        if (actualRatio > expected.high) {
            status = 'above';
        } else if (actualRatio < expected.low) {
            status = 'below';
        } else {
            status = 'within';
        }

        ratios.push({
            anchorKey: key,
            label: expected.label,
            actualWatts: pt.watts,
            actualPercent: actualRatio,
            expectedLow: expected.low,
            expectedHigh: expected.high,
            status,
        });
    }

    // Classify profile
    const { type: profileType, description: profileDescription } = classifyProfile(ratios);

    // Detect gaps (anchors with no data, excluding 2k which is the anchor)
    const gaps: ProfileGap[] = [];
    for (const key of ANCHOR_ORDER) {
        if (key === '2k') continue;
        if (!anchorMap.has(key)) {
            const expected = EXPECTED_RATIOS[key];
            const message = GAP_MESSAGES[key] ?? `Complete a ${expected?.label ?? key} test to fill this gap.`;
            gaps.push({
                anchorKey: key,
                label: expected?.label ?? key,
                message,
            });
        }
    }

    // Data completeness: 2k counts + all others
    const totalAnchors = ANCHOR_ORDER.length; // 11
    const filledAnchors = ANCHOR_ORDER.filter(k => anchorMap.has(k)).length;
    const dataCompleteness = filledAnchors / totalAnchors;

    // Generate prescriptions
    const prescriptions = generatePrescriptions(profileType, ratios, gaps);

    const maxWattsPoint = anchorMap.get('max_watts');

    return {
        points,
        anchor2kWatts,
        ratios,
        profileType,
        profileDescription,
        gaps,
        prescriptions,
        maxWatts: maxWattsPoint?.watts ?? null,
        dataCompleteness,
    };
}

// ─── Classification ──────────────────────────────────────────────────────────

function classifyProfile(ratios: PowerRatio[]): { type: ProfileType; description: string } {
    if (ratios.length < 3) {
        return {
            type: 'insufficient_data',
            description: 'Not enough data points to classify your profile yet. Keep testing at different distances to build a complete picture.',
        };
    }

    const shortAbove = ratios.filter(r => SHORT_ANCHORS.includes(r.anchorKey) && r.status === 'above').length;
    const shortBelow = ratios.filter(r => SHORT_ANCHORS.includes(r.anchorKey) && r.status === 'below').length;
    const longAbove = ratios.filter(r => LONG_ANCHORS.includes(r.anchorKey) && r.status === 'above').length;
    const longBelow = ratios.filter(r => LONG_ANCHORS.includes(r.anchorKey) && r.status === 'below').length;
    const midBelow = ratios.filter(r => MID_ANCHORS.includes(r.anchorKey) && r.status === 'below').length;

    // Sprinter: strong short, weak long
    if (shortAbove >= 2 && longBelow >= 2) {
        return {
            type: 'sprinter',
            description: 'Your sprint and short-distance power is a strength — you produce more watts relative to your 2k than expected. ' +
                'However, your longer efforts fall below typical ratios, suggesting your aerobic base hasn\'t kept pace with your anaerobic system. ' +
                'Your 2k is likely limited by fading in the back half. Building aerobic volume (UT2) will raise your floor and unlock your 2k potential.',
        };
    }

    // Diesel: strong long, weak short
    if (longAbove >= 2 && shortBelow >= 2) {
        return {
            type: 'diesel',
            description: 'You\'re an endurance machine — your long-distance watts hold up better than expected relative to your 2k. ' +
                'Your sprint power is the limiter. You probably negative-split well but lose ground in the opening 500m. ' +
                'Adding sprint intervals and power work (AN zone) will raise your top-end without sacrificing your strong aerobic base.',
        };
    }

    // Threshold gap: mid-range dip
    if (midBelow >= 2 && (shortAbove >= 1 || longAbove >= 1)) {
        return {
            type: 'threshold_gap',
            description: 'You have both top-end power and an endurance base, but your threshold capacity — the ability to sustain hard efforts in the 15–25 minute range — is the weak link. ' +
                'Your lactate clearance may be limiting 5k and 6k performance. ' +
                'Targeted threshold intervals (AT zone: 4×2000m, 3×10min) will close this gap and likely improve your 2k as well.',
        };
    }

    // Balanced
    return {
        type: 'balanced',
        description: 'Your power profile is well-balanced — no single energy system is dramatically stronger or weaker than expected. ' +
            'You\'re developing evenly across all distances. To continue improving, target the distance where you\'re weakest relative to expected ratios, or focus on race-specific distances.',
    };
}

// ─── Prescriptions ───────────────────────────────────────────────────────────

function generatePrescriptions(
    profileType: ProfileType,
    ratios: PowerRatio[],
    gaps: ProfileGap[],
): TrainingPrescription[] {
    const prescriptions: TrainingPrescription[] = [];

    // If many gaps, suggest test days
    if (gaps.length >= 5) {
        prescriptions.push({
            zone: 'Testing',
            rationale: `You're missing data at ${gaps.length} anchor distances. More test pieces will sharpen your profile and make training recommendations more accurate.`,
            suggestedWorkouts: gaps.slice(0, 3).map(g => g.message),
        });
    }

    switch (profileType) {
        case 'sprinter':
            prescriptions.push({
                zone: 'UT2',
                rationale: 'Your aerobic base is the primary limiter. Building volume at low intensity raises your endurance floor and improves lactate clearance — which directly benefits the back half of your 2k.',
                suggestedWorkouts: [
                    '60–90 min steady state (UT2 pace)',
                    '3 × 20:00 / 3:00r at UT2',
                    '40:00 continuous at 2k+25s',
                ],
            });
            prescriptions.push({
                zone: 'UT1',
                rationale: 'Once UT2 volume is established (2–3 weeks), add UT1 sessions to bridge the gap between easy aerobic and threshold.',
                suggestedWorkouts: [
                    '4 × 15:00 / 2:00r at UT1',
                    '3 × 20:00 / 3:00r at 2k+15–18s',
                ],
            });
            break;

        case 'diesel':
            prescriptions.push({
                zone: 'AN',
                rationale: 'Your top-end power needs development. Short, maximal-effort intervals build neuromuscular recruitment and anaerobic capacity — exactly what you need for race starts and sprint finishes.',
                suggestedWorkouts: [
                    '8 × 500m / 3:00r (all-out)',
                    '10 × 1:00 / 1:00r (max effort)',
                    'Race start practice: 20 strokes at max',
                ],
            });
            prescriptions.push({
                zone: 'TR',
                rationale: 'Transport zone intervals bridge the gap between your strong base and your developing top-end.',
                suggestedWorkouts: [
                    '6 × 500m / 2:00r at 2k pace',
                    '5 × 1500m / 3:00r at 2k+2–5s',
                ],
            });
            break;

        case 'threshold_gap':
            prescriptions.push({
                zone: 'AT',
                rationale: 'Your threshold capacity is the bottleneck. AT intervals improve lactate clearance and the ability to sustain hard efforts for 15–30 minutes. This is the biggest bang-for-buck training zone for your profile.',
                suggestedWorkouts: [
                    '4 × 2000m / 3:00r at AT pace (~6k pace)',
                    '3 × 10:00 / 3:00r at 2k+8–10s',
                    '5k time trial (test + training)',
                ],
            });
            break;

        case 'balanced': {
            // Find the weakest ratio
            const weakest = ratios
                .filter(r => r.anchorKey !== '2k')
                .sort((a, b) => {
                    const aMid = (a.expectedLow + a.expectedHigh) / 2;
                    const bMid = (b.expectedLow + b.expectedHigh) / 2;
                    return (a.actualPercent - aMid) - (b.actualPercent - bMid);
                })[0];

            if (weakest) {
                const zone = SHORT_ANCHORS.includes(weakest.anchorKey) ? 'AN/TR'
                    : MID_ANCHORS.includes(weakest.anchorKey) ? 'AT'
                    : 'UT2/UT1';
                prescriptions.push({
                    zone,
                    rationale: `Your profile is balanced, but ${weakest.label} is your weakest relative to expected ratios. Targeting this distance will give you the biggest marginal gain.`,
                    suggestedWorkouts: [
                        `Focus training at or near ${weakest.label} distance`,
                        'Maintain overall training distribution',
                    ],
                });
            }
            break;
        }

        case 'insufficient_data':
            prescriptions.push({
                zone: 'Testing',
                rationale: 'Complete more test pieces at standard distances to build your profile. Start with a 2k if you haven\'t done one recently.',
                suggestedWorkouts: [
                    '2k test (the anchor for everything)',
                    '6k test (threshold benchmark)',
                    '500m test or 8×500m (sprint benchmark)',
                ],
            });
            break;
    }

    return prescriptions;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Update a best-effort map if the new point has higher watts. */
function updateBest(
    map: Map<string, PowerCurvePoint>,
    key: string,
    point: PowerCurvePoint,
): void {
    const existing = map.get(key);
    if (!existing || point.watts > existing.watts) {
        map.set(key, point);
    }
}

/** Safely parse raw_data field (may be JSON string or object). */
function parseRawData(raw: unknown): C2ResultDetail | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as C2ResultDetail; } catch { return null; }
    }
    return raw as C2ResultDetail;
}

/**
 * Suggest max watts from stroke data across all workouts.
 * Scans for the single highest stroke power value.
 */
export function suggestMaxWatts(workouts: WorkoutLog[]): { watts: number; date: string; workoutId: string } | null {
    let best: { watts: number; date: string; workoutId: string } | null = null;

    for (const workout of workouts) {
        const rawData = parseRawData(workout.raw_data);
        if (!rawData?.strokes) continue;

        for (const stroke of rawData.strokes) {
            let strokeWatts = 0;
            if (stroke.watts) {
                strokeWatts = stroke.watts;
            } else if (stroke.p) {
                if (stroke.p > 300) {
                    // Deciseconds → seconds → watts
                    strokeWatts = calculateWattsFromSplit(stroke.p / 10);
                } else {
                    strokeWatts = stroke.p;
                }
            }

            if (strokeWatts > 0 && (!best || strokeWatts > best.watts)) {
                best = {
                    watts: Math.round(strokeWatts),
                    date: workout.completed_at,
                    workoutId: workout.id,
                };
            }
        }
    }

    return best;
}
