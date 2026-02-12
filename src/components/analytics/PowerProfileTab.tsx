import React, { useEffect, useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, ReferenceLine, Line,
} from 'recharts';
import { Loader2, Zap, Target, AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { supabase } from '../../services/supabase';
import type { WorkoutLog } from '../../services/supabase';
import {
    extractBestEfforts,
    computePowerProfile,
    suggestMaxWatts,
    type PowerProfile,
    type PowerRatio,
    type ProfileGap,
    type TrainingPrescription,
} from '../../utils/powerProfile';
import { formatSplit } from '../../utils/paceCalculator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PowerProfileTabProps {
    baselineWatts: number;
}

// ─── Profile Badge ───────────────────────────────────────────────────────────

const PROFILE_COLORS: Record<string, string> = {
    sprinter: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    diesel: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    threshold_gap: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    balanced: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    insufficient_data: 'text-neutral-400 bg-neutral-400/10 border-neutral-400/30',
};

const PROFILE_LABELS: Record<string, string> = {
    sprinter: 'Sprinter',
    diesel: 'Diesel',
    threshold_gap: 'Threshold Gap',
    balanced: 'Balanced',
    insufficient_data: 'Insufficient Data',
};

const PROFILE_ICONS: Record<string, string> = {
    sprinter: '⚡',
    diesel: '🛢️',
    threshold_gap: '📉',
    balanced: '⚖️',
    insufficient_data: '❓',
};

// ─── Chart Data Helpers ──────────────────────────────────────────────────────

function buildChartData(profile: PowerProfile) {
    return profile.points
        .filter(p => p.distance > 0) // exclude max_watts (distance=0) from chart
        .map(p => ({
            distance: p.distance,
            label: p.label,
            watts: Math.round(p.watts),
            pace: formatSplit(p.pace),
            anchorKey: p.anchorKey,
            // Expected band (if 2k anchor exists)
            expectedLow: profile.anchor2kWatts
                ? Math.round(profile.anchor2kWatts * getExpectedLow(p.anchorKey))
                : undefined,
            expectedHigh: profile.anchor2kWatts
                ? Math.round(profile.anchor2kWatts * getExpectedHigh(p.anchorKey))
                : undefined,
        }));
}

const EXPECTED_MAP: Record<string, { low: number; high: number }> = {
    '1:00': { low: 1.45, high: 1.60 },
    '500m': { low: 1.30, high: 1.40 },
    '1k': { low: 1.15, high: 1.20 },
    '2k': { low: 1.00, high: 1.00 },
    '5k': { low: 0.80, high: 0.85 },
    '6k': { low: 0.75, high: 0.80 },
    '30:00': { low: 0.72, high: 0.78 },
    '10k': { low: 0.70, high: 0.75 },
    'HM': { low: 0.65, high: 0.70 },
    'FM': { low: 0.60, high: 0.65 },
};

function getExpectedLow(anchorKey: string | null): number {
    if (!anchorKey || !EXPECTED_MAP[anchorKey]) return 0;
    return EXPECTED_MAP[anchorKey].low;
}

function getExpectedHigh(anchorKey: string | null): number {
    if (!anchorKey || !EXPECTED_MAP[anchorKey]) return 0;
    return EXPECTED_MAP[anchorKey].high;
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipPayload {
    label: string;
    watts: number;
    pace: string;
    expectedLow?: number;
    expectedHigh?: number;
    anchorKey: string | null;
}

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: Array<{ payload: TooltipPayload }>;
}> = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm shadow-lg">
            <p className="font-semibold text-white">{d.label}</p>
            <p className="text-emerald-400">{d.watts}W &middot; {d.pace}/500m</p>
            {d.expectedLow && d.expectedHigh && (
                <p className="text-neutral-400 text-xs mt-1">
                    Expected: {d.expectedLow}–{d.expectedHigh}W
                </p>
            )}
        </div>
    );
};

// ─── Ratio Row ───────────────────────────────────────────────────────────────

const RatioRow: React.FC<{ ratio: PowerRatio }> = ({ ratio }) => {
    const statusColor = ratio.status === 'above'
        ? 'text-orange-400'
        : ratio.status === 'below'
            ? 'text-red-400'
            : 'text-emerald-400';

    const statusBg = ratio.status === 'above'
        ? 'bg-orange-400/10'
        : ratio.status === 'below'
            ? 'bg-red-400/10'
            : 'bg-emerald-400/10';

    return (
        <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${statusBg}`}>
            <div className="flex items-center gap-3">
                <span className="text-neutral-300 font-medium w-20">{ratio.label}</span>
                <span className="text-white font-mono">{ratio.actualWatts}W</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span className={`font-semibold ${statusColor}`}>
                    {(ratio.actualPercent * 100).toFixed(0)}%
                </span>
                <span className="text-neutral-500">
                    ({(ratio.expectedLow * 100).toFixed(0)}–{(ratio.expectedHigh * 100).toFixed(0)}%)
                </span>
            </div>
        </div>
    );
};

// ─── Gap Card ────────────────────────────────────────────────────────────────

const GapCard: React.FC<{ gap: ProfileGap }> = ({ gap }) => (
    <div className="flex items-start gap-2 bg-neutral-800/50 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div>
            <p className="text-neutral-200 text-sm font-medium">{gap.label}</p>
            <p className="text-neutral-400 text-xs mt-0.5">{gap.message}</p>
        </div>
    </div>
);

// ─── Prescription Card ───────────────────────────────────────────────────────

const PrescriptionCard: React.FC<{ rx: TrainingPrescription }> = ({ rx }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="bg-neutral-800/50 rounded-lg p-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full text-left"
            >
                <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{rx.zone}</span>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
            </button>
            {expanded && (
                <div className="mt-3 space-y-2">
                    <p className="text-neutral-300 text-sm">{rx.rationale}</p>
                    <ul className="space-y-1 mt-2">
                        {rx.suggestedWorkouts.map((w, i) => (
                            <li key={i} className="text-neutral-400 text-sm flex items-center gap-2">
                                <span className="text-emerald-500">→</span> {w}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const PowerProfileTab: React.FC<PowerProfileTabProps> = ({ baselineWatts }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<PowerProfile | null>(null);
    const [maxWattsSuggestion, setMaxWattsSuggestion] = useState<number | null>(null);
    const [showGaps, setShowGaps] = useState(false);

    useEffect(() => {
        const fetchAndCompute = async () => {
            try {
                setLoading(true);

                // Fetch workouts with enough data for power profile
                // We need: id, distance_meters, duration_seconds, duration_minutes, completed_at, raw_data (for intervals + strokes)
                const { data: workouts } = await supabase
                    .from('workout_logs')
                    .select('id, distance_meters, duration_seconds, duration_minutes, completed_at, raw_data, workout_type')
                    .eq('source', 'concept2')
                    .not('distance_meters', 'is', null)
                    .order('completed_at', { ascending: false });

                if (!workouts || workouts.length === 0) {
                    setProfile(computePowerProfile([], baselineWatts || undefined));
                    return;
                }

                // Extract best efforts from all workouts
                const points = extractBestEfforts(workouts as WorkoutLog[]);

                // Check for max watts from stroke data
                const suggestion = suggestMaxWatts(workouts as WorkoutLog[]);
                if (suggestion) {
                    setMaxWattsSuggestion(suggestion.watts);
                }

                // Compute the full profile
                const computed = computePowerProfile(
                    points,
                    baselineWatts || undefined,
                );

                setProfile(computed);
            } catch (err) {
                console.error('Failed to compute power profile:', err);
                setProfile(computePowerProfile([], baselineWatts || undefined));
            } finally {
                setLoading(false);
            }
        };

        fetchAndCompute();
    }, [baselineWatts]);

    const chartData = useMemo(() => {
        if (!profile) return [];
        return buildChartData(profile);
    }, [profile]);

    // ─── Loading ─────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                <span className="ml-3 text-neutral-400">Computing power profile...</span>
            </div>
        );
    }

    if (!profile) return null;

    const hasData = profile.points.length > 0;
    const hasChart = chartData.length >= 2;

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 mt-6">
            {/* Profile Badge + Description */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{PROFILE_ICONS[profile.profileType]}</span>
                        <div>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${PROFILE_COLORS[profile.profileType]}`}>
                                {PROFILE_LABELS[profile.profileType]}
                            </span>
                            {profile.anchor2kWatts && (
                                <p className="text-neutral-400 text-sm mt-1">
                                    2k Anchor: <span className="text-white font-mono">{profile.anchor2kWatts}W</span>
                                    {profile.maxWatts && (
                                        <> &middot; Max: <span className="text-white font-mono">{profile.maxWatts}W</span></>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-neutral-500 text-xs">Completeness</span>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-20 h-2 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.round(profile.dataCompleteness * 100)}%` }}
                                />
                            </div>
                            <span className="text-neutral-400 text-xs">{Math.round(profile.dataCompleteness * 100)}%</span>
                        </div>
                    </div>
                </div>
                <p className="text-neutral-300 text-sm mt-4 leading-relaxed">
                    {profile.profileDescription}
                </p>
                {maxWattsSuggestion && !profile.maxWatts && (
                    <div className="mt-4 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <p className="text-amber-300 text-sm">
                            We detected a peak of <span className="font-mono font-semibold">{maxWattsSuggestion}W</span> in your stroke data.
                            Enter your max watts in Settings to sharpen your profile.
                        </p>
                    </div>
                )}
            </div>

            {/* Power Curve Chart */}
            {hasChart && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        Power Curve
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                                <XAxis
                                    dataKey="label"
                                    stroke="#525252"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                                />
                                <YAxis
                                    stroke="#525252"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                                    label={{ value: 'Watts', angle: -90, position: 'insideLeft', fill: '#737373', fontSize: 12 }}
                                />
                                <Tooltip content={<CustomTooltip />} />

                                {/* Expected range band */}
                                {profile.anchor2kWatts && (
                                    <>
                                        <Area
                                            type="monotone"
                                            dataKey="expectedHigh"
                                            stroke="none"
                                            fill="#10b981"
                                            fillOpacity={0.08}
                                            isAnimationActive={false}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="expectedLow"
                                            stroke="none"
                                            fill="#171717"
                                            fillOpacity={1}
                                            isAnimationActive={false}
                                        />
                                    </>
                                )}

                                {/* Actual power curve */}
                                <Line
                                    type="monotone"
                                    dataKey="watts"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={{ fill: '#10b981', r: 4, strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#10b981', stroke: '#0d9488', strokeWidth: 2 }}
                                    isAnimationActive={true}
                                />

                                {/* 2k reference line */}
                                {profile.anchor2kWatts && (
                                    <ReferenceLine
                                        y={profile.anchor2kWatts}
                                        stroke="#525252"
                                        strokeDasharray="4 4"
                                        label={{ value: `2k: ${profile.anchor2kWatts}W`, fill: '#737373', fontSize: 11, position: 'right' }}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Ratios Table */}
            {profile.ratios.length > 0 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-400" />
                        Power Ratios
                        <span className="text-neutral-500 text-xs font-normal ml-2">% of 2k watts</span>
                    </h3>
                    <div className="space-y-1">
                        {profile.ratios.map(r => (
                            <RatioRow key={r.anchorKey} ratio={r} />
                        ))}
                    </div>
                </div>
            )}

            {/* Prescriptions */}
            {profile.prescriptions.length > 0 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4">Training Recommendations</h3>
                    <div className="space-y-2">
                        {profile.prescriptions.map((rx, i) => (
                            <PrescriptionCard key={i} rx={rx} />
                        ))}
                    </div>
                </div>
            )}

            {/* Data Gaps */}
            {profile.gaps.length > 0 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                    <button
                        onClick={() => setShowGaps(!showGaps)}
                        className="flex items-center justify-between w-full text-left"
                    >
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <Info className="w-4 h-4 text-neutral-400" />
                            Missing Data ({profile.gaps.length} distances)
                        </h3>
                        {showGaps ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                    </button>
                    {showGaps && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                            {profile.gaps.map(g => (
                                <GapCard key={g.anchorKey} gap={g} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!hasData && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-10 text-center">
                    <Zap className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                    <h3 className="text-white font-semibold text-lg">No Power Data Yet</h3>
                    <p className="text-neutral-400 mt-2 max-w-md mx-auto">
                        Sync your Concept2 workouts to build your power profile. A 2k test is the best starting point — it anchors all analysis.
                    </p>
                </div>
            )}
        </div>
    );
};
