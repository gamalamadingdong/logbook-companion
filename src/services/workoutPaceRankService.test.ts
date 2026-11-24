// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { loadWorkoutPaceRank } from './workoutPaceRankService';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }));

const continuous = {
    id: 'current', workout_type: 'rower', source: 'concept2', manual_rwn: null,
    distance_meters: 2000, duration_seconds: 400, duration_minutes: null,
    raw_workout_type: 'FixedDistanceSplits', raw_intervals: null, raw_time: null, raw_distance: null,
};

function history(current: object, pages: object[][]) {
    const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: current, error: null }),
        then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({ data: pages.shift() ?? [], error: null }).then(resolve);
        },
    };
    mocks.from.mockReturnValue(query);
    return query;
}

const options = {
    userId: 'owner', workoutId: 'current', workPace: 100, mainIndices: null, signal: new AbortController().signal,
};

describe('work pace versus workout history', () => {
    it('compares the same owner’s complete RowErg history by pace and reports 95th percentile for second place', async () => {
        const attempts = Array.from({ length: 20 }, (_, i) => ({
            ...continuous, id: String(i), duration_seconds: i === 0 ? 398.8 : 416,
        }));
        const query = history(continuous, [[...attempts, { ...continuous, id: 'other-workout', distance_meters: 1000 },
            { ...continuous, id: 'other-equipment', workout_type: 'skierg' },
            { ...continuous, id: 'missing-pace', duration_seconds: null }]]);
        expect(await loadWorkoutPaceRank(options)).toEqual({
            rank: 2, attemptCount: 21, percentile: 95, tied: false, secondsOffBest: 0.3,
        });
        expect(query.eq.mock.calls.filter(([field]) => field === 'user_id')).toEqual([['user_id', 'owner'], ['user_id', 'owner']]);
        expect(query.neq).toHaveBeenCalledWith('id', 'current');
        expect(query.abortSignal).toHaveBeenCalledWith(options.signal);
    });

    it('matches interval formats by every rep and rest, and ranks the selected main work only', async () => {
        const interval = (distance: number, time: number, rest_time: number) => ({ type: 'distance', distance, time, rest_time });
        const current = {
            ...continuous, raw_workout_type: 'VariableInterval', raw_intervals: [interval(1000, 3000, 600), interval(500, 1000, 600), interval(500, 1000, 0)],
        };
        history(current, [[
            { ...current, id: 'faster-main', raw_intervals: [interval(1000, 3500, 600), interval(500, 970, 600), interval(500, 970, 0)] },
            { ...current, id: 'different-rest', raw_intervals: [interval(1000, 3000, 600), interval(500, 1000, 900), interval(500, 1000, 0)] },
            { ...current, id: 'pace-tie', raw_intervals: [interval(1000, 2600, 600), interval(500, 1000, 600), interval(500, 1000, 0)] },
            { ...current, id: 'invalid-rep', raw_intervals: [interval(1000, 3000, 600), interval(500, 0, 600), interval(500, 2000, 0)] },
        ]]);
        expect(await loadWorkoutPaceRank({ ...options, mainIndices: [1, 2] })).toEqual({
            rank: 2, attemptCount: 3, percentile: null, tied: true, secondsOffBest: 3,
        });
    });

    it('follows the history cursor and ranks ties at displayed precision', async () => {
        const first = Array.from({ length: 250 }, (_, i) => ({
            ...continuous, id: String(i).padStart(3, '0'), duration_seconds: 400.1,
        }));
        const query = history(continuous, [first, [{ ...continuous, id: '999', duration_seconds: 399.9 }]]);
        const rank = await loadWorkoutPaceRank(options);
        expect(rank).toMatchObject({ rank: 1, attemptCount: 252, tied: true, secondsOffBest: 0 });
        expect(query.gt).toHaveBeenCalledWith('id', '249');
    });

    it('compares fixed-time workouts by pace, including a legacy minute duration', async () => {
        const current = { ...continuous, raw_workout_type: 'FixedTimeSplits', duration_seconds: 1200, distance_meters: 6000 };
        history(current, [[{ ...current, id: 'longer', distance_meters: 6200, duration_seconds: null, duration_minutes: 20 }]]);
        expect(await loadWorkoutPaceRank(options)).toMatchObject({ rank: 2, attemptCount: 2, percentile: null });
    });

    it('withholds a ranking when the score and the displayed Work Pace measure different work', async () => {
        const query = history(continuous, []);
        expect(await loadWorkoutPaceRank({ ...options, workPace: 99 })).toBeNull();
        expect(query.neq).not.toHaveBeenCalled();
    });
});
