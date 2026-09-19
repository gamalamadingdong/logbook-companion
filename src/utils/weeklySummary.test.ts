import { describe, expect, it } from 'vitest';
import { summarizeWeeklyLogs } from './weeklySummary';

const log = (completed_at: string, distance_meters: number, rest_distance_meters = 0) => ({
  completed_at,
  distance_meters,
  rest_distance_meters,
});

describe('summarizeWeeklyLogs', () => {
  it('returns zero totals and no streak for empty logs', () => {
    expect(summarizeWeeklyLogs([], '2026-08-05')).toEqual({
      totalDistanceMeters: 0,
      workoutCount: 0,
      streakWeeks: 0,
    });
  });

  it('summarizes workouts in the reference Monday-start week', () => {
    expect(
      summarizeWeeklyLogs(
        [
          log('2026-08-03T08:00:00Z', 5000),
          log('2026-08-05T08:00:00Z', 3000),
          log('2026-08-09T08:00:00Z', 2000),
          log('2026-08-10T08:00:00Z', 9000),
        ],
        '2026-08-05',
      ),
    ).toEqual({
      totalDistanceMeters: 10000,
      workoutCount: 3,
      streakWeeks: 1,
    });
  });

  it('includes measured recovery distance in weekly training volume', () => {
    expect(
      summarizeWeeklyLogs(
        [log('2026-08-05T08:00:00Z', 1000, 400)],
        '2026-08-05',
      ),
    ).toMatchObject({ totalDistanceMeters: 1400 });
  });

  it('counts consecutive active prior weeks in the streak', () => {
    expect(
      summarizeWeeklyLogs(
        [
          log('2026-08-05T08:00:00Z', 4000),
          log('2026-07-30T08:00:00Z', 3000),
          log('2026-07-20T08:00:00Z', 2000),
          log('2026-07-13T08:00:00Z', 1000),
        ],
        '2026-08-05',
      ),
    ).toMatchObject({ streakWeeks: 4 });
  });

  it('stops the streak at the first empty prior week', () => {
    expect(
      summarizeWeeklyLogs(
        [log('2026-08-05T08:00:00Z', 4000), log('2026-07-20T08:00:00Z', 2000)],
        '2026-08-05',
      ),
    ).toMatchObject({ streakWeeks: 1 });
  });
});
