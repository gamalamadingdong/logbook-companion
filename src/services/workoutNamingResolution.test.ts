import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: { from: vi.fn() } }));
vi.mock('./supabase', () => ({ supabase: db }));
import { workoutService } from './workoutService';

const continuousLog = {
  id: 'workout-1', user_id: 'user-1', external_id: '123', source: 'concept2',
  workout_name: 'FixedDistanceSplits', canonical_name: '6x500m', manual_rwn: null as string | null,
  completed_at: '2026-11-06', distance_meters: 3000, duration_seconds: 815.9,
  raw_data: { workout_type: 'FixedDistanceSplits', distance: 3000, time: 8159,
    workout: { splits: Array.from({ length: 6 }, () => ({ distance: 500, time: 1360 })) } },
};

function serveLog(log = continuousLog) {
  const query = {
    select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [log], error: null }),
    single: vi.fn().mockResolvedValue({ data: log, error: null }),
  };
  db.from.mockReturnValue(query);
  return query;
}

describe('stored Concept2 workout name resolution', () => {
  beforeEach(() => db.from.mockReset());

  it('corrects a stale history label without rewriting raw splits or requiring a DB write', async () => {
    serveLog();
    const [result] = await workoutService.getRecentWorkouts();
    expect(result.name).toBe('3000m');
    expect(result.raw_data).toEqual(continuousLog.raw_data);
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it('corrects a stale detail label while retaining split data', async () => {
    serveLog();
    const result = await workoutService.getWorkoutDetail('123');
    expect(result.workout_name).toBe('3000m');
    expect(result.workout?.splits).toHaveLength(6);
  });

  it('keeps a manual RWN override ahead of the continuous recording mode', async () => {
    serveLog({ ...continuousLog, manual_rwn: '3x1000m/1:00r' });
    const [result] = await workoutService.getRecentWorkouts();
    expect(result.name).toBe('3x1000m/1:00r');
    expect((await workoutService.getWorkoutDetail('123')).workout_name).toBe('3x1000m/1:00r');
  });

  it('retains a real interval workout name', async () => {
    serveLog({ ...continuousLog, workout_name: 'FixedDistanceInterval', canonical_name: '5x1500m/5:00r',
      raw_data: { ...continuousLog.raw_data, workout_type: 'FixedDistanceInterval' } });
    expect((await workoutService.getRecentWorkouts())[0].name).toBe('5x1500m/5:00r');
    expect((await workoutService.getWorkoutDetail('123')).workout_name).toBe('5x1500m/5:00r');
  });

  it('uses exact fixed time in history and detail', async () => {
    serveLog({ ...continuousLog, workout_name: 'FixedTimeSplits', canonical_name: '6x5:00', duration_seconds: 1800,
      raw_data: { ...continuousLog.raw_data, workout_type: 'FixedTimeSplits', time: 18000 } });
    expect((await workoutService.getRecentWorkouts())[0].name).toBe('30:00');
    expect((await workoutService.getWorkoutDetail('123')).workout_name).toBe('30:00');
  });
});
