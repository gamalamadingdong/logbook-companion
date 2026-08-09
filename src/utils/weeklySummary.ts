export type WeeklyLog = {
  completed_at: string;
  distance_meters: number;
};

export type WeeklySummary = {
  totalDistanceMeters: number;
  workoutCount: number;
  streakWeeks: number;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const millisecondsPerWeek = 7 * millisecondsPerDay;

function mondayStart(date: Date): number {
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return start - daysSinceMonday * millisecondsPerDay;
}

export function summarizeWeeklyLogs(
  logs: readonly WeeklyLog[],
  referenceDate: string | Date,
): WeeklySummary {
  const referenceWeek = mondayStart(
    typeof referenceDate === 'string' ? new Date(`${referenceDate}T00:00:00Z`) : referenceDate,
  );
  const activeWeeks = new Set<number>();
  let totalDistanceMeters = 0;
  let workoutCount = 0;

  for (const workout of logs) {
    const week = mondayStart(new Date(workout.completed_at));
    activeWeeks.add(week);

    if (week === referenceWeek) {
      totalDistanceMeters += workout.distance_meters;
      workoutCount += 1;
    }
  }

  let streakWeeks = 0;
  for (let week = referenceWeek; activeWeeks.has(week); week -= millisecondsPerWeek) {
    streakWeeks += 1;
  }

  return { totalDistanceMeters, workoutCount, streakWeeks };
}
