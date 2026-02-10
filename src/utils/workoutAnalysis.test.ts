import { describe, it, expect } from 'vitest';
import { detectWarmupCooldown } from './workoutAnalysis';
import type { C2Interval } from '../api/concept2.types';

/**
 * Helper: build a C2Interval with sensible defaults.
 * Times are in deciseconds (C2 convention): 6000 = 10:00.
 * Distances are in meters.
 */
function makeInterval(
    overrides: Partial<C2Interval> & { type: string }
): C2Interval {
    return {
        distance: 0,
        time: 0,
        stroke_rate: 24,
        ...overrides
    } as C2Interval;
}

// ─── Convenience builders ──────────────────────────────────────────────────

/** Steady time piece, e.g. a 10:00 warmup */
function timePiece(minutes: number, opts?: Partial<C2Interval>): C2Interval {
    return makeInterval({
        type: 'time',
        time: minutes * 60 * 10, // min → deciseconds
        distance: minutes * 250, // rough distance filler
        ...opts
    });
}

/** Distance interval, e.g. 500m with optional rest */
function distInterval(meters: number, restSec = 0, opts?: Partial<C2Interval>): C2Interval {
    return makeInterval({
        type: 'distance',
        distance: meters,
        time: Math.round(meters * 2.1), // ~2:05 pace, doesn't matter
        rest_time: restSec * 10, // seconds → deciseconds
        ...opts
    });
}

/** Time interval, e.g. 3:00 work pieces with rest.
 *  Distance varies slightly per call (like real rowing) so calculateCanonicalName
 *  correctly identifies these as time-based, not distance-based.
 */
let _timeIntervalSeed = 0;
function timeInterval(minutes: number, restSec = 0, opts?: Partial<C2Interval>): C2Interval {
    _timeIntervalSeed += 1;
    return makeInterval({
        type: 'time',
        time: minutes * 60 * 10,
        distance: minutes * 250 + (_timeIntervalSeed % 7) * 3, // slight variance
        rest_time: restSec * 10,
        ...opts
    });
}


// ─── Tests ─────────────────────────────────────────────────────────────────

describe('detectWarmupCooldown', () => {

    // ── Positive detections ────────────────────────────────────────────

    describe('classic warmup + work + cooldown', () => {
        it('detects 10:00 warmup + 8x500m + 5:00 cooldown', () => {
            const intervals: C2Interval[] = [
                timePiece(10),                      // warmup
                distInterval(500, 60),              // 500m w/ 1:00r
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),               // last rep, no rest
                timePiece(5),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([9]);
            expect(result.mainIndices).toHaveLength(8);
            expect(result.mainCanonicalName).toBe('8x500m/1:00r');
            expect(result.suggestedRWN).toContain('[w]');
            expect(result.suggestedRWN).toContain('[c]');
            expect(result.suggestedRWN).toContain('8x500m/1:00r');
            expect(result.description).toContain('warmup');
            expect(result.description).toContain('cooldown');
        });

        it('detects 2000m warmup + 4x1000m + 2000m cooldown', () => {
            const intervals: C2Interval[] = [
                distInterval(2000),                 // warmup
                distInterval(1000, 120),            // 1000m w/ 2:00r
                distInterval(1000, 120),
                distInterval(1000, 120),
                distInterval(1000, 0),
                distInterval(2000),                 // cooldown
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([5]);
            expect(result.mainIndices).toHaveLength(4);
            expect(result.mainCanonicalName).toBe('4x1000m/2:00r');
        });
    });

    describe('warmup only (no cooldown)', () => {
        it('detects 10:00 warmup + 4x500m', () => {
            const intervals: C2Interval[] = [
                timePiece(10),                      // warmup
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([]);
            expect(result.mainIndices).toHaveLength(4);
            expect(result.mainCanonicalName).toBe('4x500m/1:00r');
        });

        it('detects 2000m warmup + 6x500m (distance warmup before distance intervals)', () => {
            const intervals: C2Interval[] = [
                distInterval(2000),                 // warmup — different distance
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.mainIndices).toHaveLength(6);
            expect(result.mainCanonicalName).toBe('6x500m/1:00r');
        });
    });

    describe('cooldown only (no warmup)', () => {
        it('detects 4x500m + 5:00 cooldown', () => {
            const intervals: C2Interval[] = [
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
                timePiece(5),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.cooldownIndices).toEqual([4]);
            expect(result.warmupIndices).toEqual([]);
            expect(result.mainIndices).toHaveLength(4);
            expect(result.mainCanonicalName).toBe('4x500m/1:00r');
        });
    });

    // ── Negative detections (should NOT flag) ──────────────────────────

    describe('uniform workouts — no warmup/cooldown', () => {
        it('returns detected=false for pure 8x500m (no bookends)', () => {
            const intervals: C2Interval[] = Array(8).fill(null).map(() =>
                distInterval(500, 60)
            );
            // last rep no rest
            intervals[7] = distInterval(500, 0);

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for 4x2000m (all same distance)', () => {
            const intervals: C2Interval[] = [
                distInterval(2000, 180),
                distInterval(2000, 180),
                distInterval(2000, 180),
                distInterval(2000, 0),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for single 5000m piece', () => {
            const intervals: C2Interval[] = [
                distInterval(5000),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for 2 identical intervals (too few for main block + bookend)', () => {
            const intervals: C2Interval[] = [
                distInterval(500, 60),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });
    });

    describe('genuinely variable workouts — should not flag as warmup/cooldown', () => {
        it('returns detected=false for a descending ladder (2000/1500/1000/500)', () => {
            const intervals: C2Interval[] = [
                distInterval(2000, 120),
                distInterval(1500, 120),
                distInterval(1000, 60),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for a pyramid (500/1000/1500/1000/500)', () => {
            const intervals: C2Interval[] = [
                distInterval(500, 60),
                distInterval(1000, 90),
                distInterval(1500, 120),
                distInterval(1000, 90),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);
            // The middle block (1000, 1500, 1000) is NOT uniform, so should be false
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for mixed time/distance variable workout', () => {
            const intervals: C2Interval[] = [
                timeInterval(5),
                distInterval(1000),
                timeInterval(3),
                distInterval(500),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for C2 Speed Pyramid (100/200/300/400/500/400/300/200/100)', () => {
            const intervals: C2Interval[] = [
                distInterval(100, 30),
                distInterval(200, 30),
                distInterval(300, 30),
                distInterval(400, 30),
                distInterval(500, 30),
                distInterval(400, 30),
                distInterval(300, 30),
                distInterval(200, 30),
                distInterval(100, 0),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for Speed Pyramid WITH warmup/cooldown', () => {
            const intervals: C2Interval[] = [
                timePiece(10),                      // warmup
                distInterval(100, 30),
                distInterval(200, 30),
                distInterval(300, 30),
                distInterval(400, 30),
                distInterval(500, 30),
                distInterval(400, 30),
                distInterval(300, 30),
                distInterval(200, 30),
                distInterval(100, 0),
                timePiece(5),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for Pete Plan ladder (3000/2500/2000)', () => {
            const intervals: C2Interval[] = [
                distInterval(3000, 300),
                distInterval(2500, 300),
                distInterval(2000, 0),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for Pete Plan ladder WITH warmup/cooldown', () => {
            const intervals: C2Interval[] = [
                timePiece(10),                      // warmup
                distInterval(3000, 300),
                distInterval(2500, 300),
                distInterval(2000, 0),
                timePiece(5),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });
    });

    // ── Edge cases ─────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('returns detected=false for empty intervals', () => {
            const result = detectWarmupCooldown([]);
            expect(result.detected).toBe(false);
        });

        it('handles minimum detectable case: warmup + 2 identical + cooldown', () => {
            const intervals: C2Interval[] = [
                timePiece(5),                       // warmup
                distInterval(500, 60),              // work
                distInterval(500, 0),               // work
                timePiece(3),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([3]);
            expect(result.mainIndices).toHaveLength(2);
            expect(result.mainCanonicalName).toBe('2x500m/1:00r');
        });

        it('handles minimum warmup-only case: warmup + 2 identical', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(500, 60),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([]);
            expect(result.mainIndices).toHaveLength(2);
        });

        it('filters out rest-type intervals', () => {
            const intervals: C2Interval[] = [
                timePiece(10),                      // warmup
                makeInterval({ type: 'rest', time: 600, distance: 0 }), // explicit rest
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
                makeInterval({ type: 'rest', time: 600, distance: 0 }), // explicit rest
                timePiece(5),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            // Should detect through the rest intervals
            expect(result.mainCanonicalName).toContain('500m');
        });

        it('prefers warmup+cooldown detection over warmup-only when both match', () => {
            // 10:00 warmup + 4x500m + 5:00 cooldown
            // Could match warmup-only (treating cooldown as just another interval)
            // Should prefer the full warmup+cooldown detection
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices.length).toBeGreaterThan(0);
            expect(result.cooldownIndices.length).toBeGreaterThan(0);
        });
    });

    // ── RWN output format ──────────────────────────────────────────────

    describe('suggested RWN formatting', () => {
        it('formats time-based warmup/cooldown correctly', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.suggestedRWN).toBe('[w]10:00 + 4x500m/1:00r + [c]5:00');
        });

        it('formats distance-based warmup correctly', () => {
            const intervals: C2Interval[] = [
                distInterval(2000),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.suggestedRWN).toBe('[w]2000m + 4x500m/1:00r');
        });

        it('formats cooldown-only correctly', () => {
            const intervals: C2Interval[] = [
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 60),
                distInterval(500, 0),
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.suggestedRWN).toBe('4x500m/1:00r + [c]5:00');
        });
    });

    // ── Single-piece detection (standard distance/time) ────────────────

    describe('single standard piece with warmup/cooldown', () => {
        it('detects 20:00 warmup + 500m test + 5:00 cooldown (warmup longer than test)', () => {
            const intervals: C2Interval[] = [
                timePiece(20),                      // long warmup — longer than 500m piece
                distInterval(500),                  // 500m max effort
                timePiece(5),                       // cooldown
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([2]);
            expect(result.mainCanonicalName).toBe('500m');
            expect(result.suggestedRWN).toBe('[w]20:00 + 500m + [c]5:00');
        });

        it('detects 10:00 warmup + 6000m piece + 5:00 cooldown', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(6000),
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.mainCanonicalName).toBe('6000m');
            expect(result.suggestedRWN).toBe('[w]10:00 + 6000m + [c]5:00');
        });

        it('detects 15:00 warmup + 5000m piece (no cooldown)', () => {
            const intervals: C2Interval[] = [
                timePiece(15),
                distInterval(5000),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([]);
            expect(result.mainCanonicalName).toBe('5000m');
        });

        it('detects 10000m piece + 10:00 cooldown (no warmup)', () => {
            const intervals: C2Interval[] = [
                distInterval(10000),
                timePiece(10),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([]);
            expect(result.cooldownIndices).toEqual([1]);
            expect(result.mainCanonicalName).toBe('10000m');
        });

        it('detects standard time piece: 2000m warmup + 30:00 test + 1000m cooldown', () => {
            const intervals: C2Interval[] = [
                distInterval(2000),
                timePiece(30),                      // 30:00 standard test time
                distInterval(1000),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.mainCanonicalName).toBe('30:00');
        });

        it('detects half marathon with warmup', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(21097),                // half marathon
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.mainCanonicalName).toBe('21097m');
        });
    });

    describe('single piece — should NOT detect', () => {
        it('returns detected=false for non-standard distance (e.g. 3500m)', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(3500),                 // not a standard test distance
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false for non-standard time (e.g. 15:00)', () => {
            // 15:00 is not in STANDARD_TEST_TIMES (excluded because common warmup)
            const intervals: C2Interval[] = [
                distInterval(2000),
                timePiece(15),                      // 15:00 not standard test
                distInterval(1000),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('returns detected=false when all three are the same (e.g. 3x2000m)', () => {
            // Even though 2000m is standard, bookends are identical → uniform workout
            const intervals: C2Interval[] = [
                distInterval(2000),
                distInterval(2000),
                distInterval(2000),
            ];

            const result = detectWarmupCooldown(intervals);
            // tryDetection won't match (need ≥2 main + different bookend)
            // trySinglePieceDetection won't match (bookends don't differ)
            expect(result.detected).toBe(false);
        });
    });

    // ── Real-world-ish scenarios ───────────────────────────────────────

    describe('realistic rowing scenarios', () => {
        it('detects 10:00 warmup + 6x3:00/1:00r + 5:00 cooldown (time intervals)', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                timeInterval(3, 60),
                timeInterval(3, 60),
                timeInterval(3, 60),
                timeInterval(3, 60),
                timeInterval(3, 60),
                timeInterval(3, 0),
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);

            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([7]);
            expect(result.mainIndices).toHaveLength(6);
            expect(result.mainCanonicalName).toBe('6x3:00/1:00r');
        });

        it('does NOT detect uniform 3x10:00 as having warmup/cooldown', () => {
            const intervals: C2Interval[] = [
                timePiece(10, { rest_time: 1200 }),
                timePiece(10, { rest_time: 1200 }),
                timePiece(10, { rest_time: 0 }),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(false);
        });

        it('detects 10:00 + 2000m + 5:00 as warmup/test/cooldown (2000m is standard test distance)', () => {
            const intervals: C2Interval[] = [
                timePiece(10),
                distInterval(2000),
                timePiece(5),
            ];

            const result = detectWarmupCooldown(intervals);
            expect(result.detected).toBe(true);
            expect(result.warmupIndices).toEqual([0]);
            expect(result.cooldownIndices).toEqual([2]);
            expect(result.mainCanonicalName).toBe('2000m');
            expect(result.suggestedRWN).toContain('[w]');
            expect(result.suggestedRWN).toContain('[c]');
            expect(result.suggestedRWN).toContain('2000m');
        });
    });
});
