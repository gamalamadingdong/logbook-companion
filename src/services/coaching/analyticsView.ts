import type {
  PerformanceTier,
  SeasonLeaderboardEntry,
  TeamErgComparison,
  TeamLeaderboardShareData,
} from './coachingService';
import { rerankLeaderboard } from './coachingService';

export type AnalyticsRangePreset = '1w' | '4w' | 'season' | 'all';

export const RANGE_PRESET_OPTIONS: Array<{ value: AnalyticsRangePreset; label: string }> = [
  { value: '1w', label: 'Last Week' },
  { value: '4w', label: 'Last 4 Weeks' },
  { value: 'season', label: 'Season' },
  { value: 'all', label: 'All Time' },
];

interface SharedAnalyticsFilterOptions {
  from?: string;
  to?: string;
  testsOnly?: boolean;
  teamId?: string | null;
  squad?: string | null;
  tier?: string | null;
}

function formatDateForQuery(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getAcademicSeasonStart(referenceDate: Date): Date {
  const year = referenceDate.getMonth() >= 7 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  return new Date(year, 7, 1);
}

function wattsFromSplit(splitSec: number): number {
  return 2.8 / Math.pow(splitSec / 500, 3);
}

function calcAvgSplit(
  intervals: Array<{ split_seconds?: number | null; time_seconds?: number | null; distance_meters?: number | null }> | null,
): number | null {
  if (!intervals || intervals.length === 0) return null;
  const valid = intervals.filter((interval) => interval.split_seconds != null && interval.split_seconds > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, interval) => sum + interval.split_seconds!, 0) / valid.length;
}

function buildAssignmentLabel(assignment: TeamLeaderboardShareData['assignments'][number]): string {
  return assignment.title || assignment.template_name || assignment.canonical_name || 'Workout';
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isDateInRange(date: string, opts: SharedAnalyticsFilterOptions): boolean {
  if (opts.from && date < opts.from) return false;
  if (opts.to && date > opts.to) return false;
  return true;
}

function matchesScopedFilters(
  result: TeamLeaderboardShareData['results'][number],
  assignment: TeamLeaderboardShareData['assignments'][number],
  opts: SharedAnalyticsFilterOptions,
): boolean {
  if (opts.testsOnly && !assignment.is_test) return false;
  if (opts.teamId && result.team_id !== opts.teamId) return false;
  if (opts.squad && result.squad !== opts.squad) return false;
  if (opts.tier && result.performance_tier !== opts.tier) return false;
  return true;
}

function computeAssignmentTitanIndexes(
  rows: Array<{ athleteId: string; split: number; wplb: number | null }>,
): Map<string, number | null> {
  const titanByAthlete = new Map<string, number | null>();
  rows.forEach((row) => titanByAthlete.set(row.athleteId, null));

  const eligible = rows.filter((row) => row.wplb != null);
  if (eligible.length < 2) return titanByAthlete;

  const splits = eligible.map((row) => row.split);
  const wplbs = eligible.map((row) => row.wplb!);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const standardDeviation = (values: number[], meanValue: number) => Math.sqrt(values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / values.length);

  const splitMean = mean(splits);
  const splitStd = standardDeviation(splits, splitMean);
  const wplbMean = mean(wplbs);
  const wplbStd = standardDeviation(wplbs, wplbMean);

  if (splitStd <= 0 || wplbStd <= 0) return titanByAthlete;

  const rawScores = eligible.map((row) => ({
    athleteId: row.athleteId,
    value: (-(row.split - splitMean) / splitStd) * 0.7 + (((row.wplb! - wplbMean) / wplbStd) * 0.3),
  }));

  const minValue = Math.min(...rawScores.map((row) => row.value));
  const maxValue = Math.max(...rawScores.map((row) => row.value));
  const range = maxValue - minValue || 1;

  rawScores.forEach((row) => {
    titanByAthlete.set(row.athleteId, ((row.value - minValue) / range) * 100);
  });

  return titanByAthlete;
}

export function getRangeForPreset(
  preset: AnalyticsRangePreset,
  referenceDate: Date,
): { from?: string; to?: string; label: string } {
  const today = formatDateForQuery(referenceDate);

  switch (preset) {
    case '1w':
      return {
        from: formatDateForQuery(addDays(referenceDate, -7)),
        to: today,
        label: 'Last week',
      };
    case '4w':
      return {
        from: formatDateForQuery(addDays(referenceDate, -28)),
        to: today,
        label: 'Last 4 weeks',
      };
    case 'season':
      return {
        from: formatDateForQuery(getAcademicSeasonStart(referenceDate)),
        to: today,
        label: 'Current season',
      };
    case 'all':
    default:
      return { label: 'All time' };
  }
}

export function parseAnalyticsRangePreset(value: string | null | undefined): AnalyticsRangePreset | null {
  if (value === '1w' || value === '4w' || value === 'season' || value === 'all') return value;
  return null;
}

export function formatAnalyticsRank(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(2).replace(/\.0+$|(?<=\.[0-9])0+$/g, '');
}

export function buildLeaderboardFromShare(
  data: TeamLeaderboardShareData,
  opts: SharedAnalyticsFilterOptions = {},
): SeasonLeaderboardEntry[] {
  if (data.assignments.length === 0 || data.results.length === 0) return [];

  const assignments = [...data.assignments]
    .filter((assignment) => isDateInRange(assignment.scheduled_date, opts))
    .filter((assignment) => !opts.testsOnly || assignment.is_test)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  if (assignments.length === 0) return [];

  const groupedResults = new Map<string, TeamLeaderboardShareData['results']>();
  for (const result of data.results) {
    const existing = groupedResults.get(result.group_assignment_id) ?? [];
    existing.push(result);
    groupedResults.set(result.group_assignment_id, existing);
  }

  const perAthlete = new Map<string, {
    athlete_id: string;
    athlete_name: string;
    squad: string | null;
    performance_tier: PerformanceTier | null;
    team_id: string | null;
    team_name: string | null;
    history: SeasonLeaderboardEntry['score_history'];
  }>();

  for (const assignment of assignments) {
    const assignmentRows = (groupedResults.get(assignment.id) ?? [])
      .filter((result) => result.completed)
      .filter((result) => matchesScopedFilters(result, assignment, opts))
      .map((result) => {
        const split = result.result_split_seconds && result.result_split_seconds > 0
          ? result.result_split_seconds
          : calcAvgSplit(result.result_intervals);
        if (!split || split <= 0) return null;

        const weightKg = result.result_weight_kg && result.result_weight_kg > 0
          ? result.result_weight_kg
          : result.weight_kg && result.weight_kg > 0
            ? result.weight_kg
            : null;
        const watts = wattsFromSplit(split);
        const wplb = weightKg ? (watts / weightKg) / 2.20462 : null;
        const distance = result.result_distance_meters && result.result_distance_meters > 0 ? result.result_distance_meters : null;
        const time = result.result_time_seconds && result.result_time_seconds > 0
          ? result.result_time_seconds
          : distance != null
            ? split * (distance / 500)
            : null;

        return {
          athleteId: result.athlete_id,
          athleteName: result.athlete_name,
          squad: result.squad,
          performanceTier: result.performance_tier as PerformanceTier | null,
          teamId: result.team_id,
          teamName: result.team_name,
          split,
          time,
          distance,
          wplb,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    if (assignmentRows.length === 0) continue;

    const titanByAthlete = computeAssignmentTitanIndexes(
      assignmentRows.map((row) => ({ athleteId: row.athleteId, split: row.split, wplb: row.wplb })),
    );

    for (const row of assignmentRows) {
      const existing = perAthlete.get(row.athleteId) ?? {
        athlete_id: row.athleteId,
        athlete_name: row.athleteName,
        squad: row.squad,
        performance_tier: row.performanceTier,
        team_id: row.teamId,
        team_name: row.teamName,
        history: [],
      };

      existing.history.push({
        assignmentId: assignment.id,
        date: assignment.scheduled_date,
        label: buildAssignmentLabel(assignment),
        split: row.split,
        time: row.time,
        distance: row.distance,
        wplb: row.wplb,
        titan_index: titanByAthlete.get(row.athleteId) ?? null,
        is_test: assignment.is_test,
      });

      perAthlete.set(row.athleteId, existing);
    }
  }

  const entries = [...perAthlete.values()].map((athlete) => {
    const history = [...athlete.history].sort((a, b) => b.date.localeCompare(a.date));
    const latest = history[0] ?? null;
    const splitValues = history.map((item) => item.split).filter((value) => Number.isFinite(value));
    const timeValues = history.map((item) => item.time).filter((value): value is number => value != null && Number.isFinite(value));
    const wplbValues = history.map((item) => item.wplb).filter((value): value is number => value != null && Number.isFinite(value));
    const distanceValues = new Set(history.map((item) => item.distance).filter((value): value is number => value != null));

    return {
      athlete_id: athlete.athlete_id,
      athlete_name: athlete.athlete_name,
      squad: athlete.squad,
      performance_tier: athlete.performance_tier,
      team_id: athlete.team_id,
      team_name: athlete.team_name,
      assignment_count: history.length,
      avg_raw_rank: null,
      avg_wplb_rank: null,
      composite_rank: null,
      trend_raw_rank: null,
      rank_history: [],
      avg_split_seconds: splitValues.length > 0 ? splitValues.reduce((sum, value) => sum + value, 0) / splitValues.length : null,
      avg_time_seconds: timeValues.length > 0 ? timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length : null,
      is_single_distance: distanceValues.size === 1 && distanceValues.size > 0,
      avg_wplb: wplbValues.length > 0 ? wplbValues.reduce((sum, value) => sum + value, 0) / wplbValues.length : null,
      latest_split_seconds: latest?.split ?? null,
      latest_time_seconds: latest?.time ?? null,
      latest_distance: latest?.distance ?? null,
      latest_wplb: latest?.wplb ?? null,
      titan_index: null,
      score_history: history,
    } satisfies SeasonLeaderboardEntry;
  });

  return rerankLeaderboard(entries).sort((a, b) => {
    const titanDelta = (b.titan_index ?? Number.NEGATIVE_INFINITY) - (a.titan_index ?? Number.NEGATIVE_INFINITY);
    if (titanDelta !== 0) return titanDelta;
    const compositeDelta = (a.composite_rank ?? Number.POSITIVE_INFINITY) - (b.composite_rank ?? Number.POSITIVE_INFINITY);
    if (compositeDelta !== 0) return compositeDelta;
    return (a.avg_raw_rank ?? Number.POSITIVE_INFINITY) - (b.avg_raw_rank ?? Number.POSITIVE_INFINITY);
  });
}

export function buildErgComparisonFromShare(
  data: TeamLeaderboardShareData,
  opts: SharedAnalyticsFilterOptions = {},
): TeamErgComparison[] {
  if (data.assignments.length === 0 || data.results.length === 0) return [];

  const assignments = [...data.assignments]
    .filter((assignment) => isDateInRange(assignment.scheduled_date, opts))
    .filter((assignment) => !opts.testsOnly || assignment.is_test)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const groupedResults = new Map<string, TeamLeaderboardShareData['results']>();
  for (const result of data.results) {
    const existing = groupedResults.get(result.group_assignment_id) ?? [];
    existing.push(result);
    groupedResults.set(result.group_assignment_id, existing);
  }

  const comparison: TeamErgComparison[] = [];

  for (const assignment of assignments) {
    const assignmentRows = (groupedResults.get(assignment.id) ?? [])
      .filter((result) => result.completed)
      .filter((result) => matchesScopedFilters(result, assignment, opts))
      .map((result) => {
        const split = result.result_split_seconds && result.result_split_seconds > 0
          ? result.result_split_seconds
          : calcAvgSplit(result.result_intervals);
        const distance = result.result_distance_meters && result.result_distance_meters > 0 ? result.result_distance_meters : null;
        if (!split || split <= 0 || distance == null) return null;

        const time = result.result_time_seconds && result.result_time_seconds > 0
          ? result.result_time_seconds
          : split * (distance / 500);
        if (!time || time <= 0) return null;

        const weightKg = result.result_weight_kg && result.result_weight_kg > 0
          ? result.result_weight_kg
          : result.weight_kg && result.weight_kg > 0
            ? result.weight_kg
            : null;

        return {
          athleteId: result.athlete_id,
          athleteName: result.athlete_name,
          squad: result.squad ?? undefined,
          team_id: result.team_id ?? undefined,
          team_name: result.team_name ?? undefined,
          distance,
          bestTime: time,
          bestSplit: split,
          bestWatts: wattsFromSplit(split),
          date: assignment.scheduled_date,
          weightKg,
          is_test: assignment.is_test,
          assignmentLabel: `${buildAssignmentLabel(assignment)} · ${formatShortDate(assignment.scheduled_date)}`,
          assignmentId: assignment.id,
        } satisfies TeamErgComparison;
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const bestPerAthlete = new Map<string, TeamErgComparison>();
    for (const row of assignmentRows) {
      const existing = bestPerAthlete.get(row.athleteId);
      if (!existing || row.bestTime < existing.bestTime) {
        bestPerAthlete.set(row.athleteId, row);
      }
    }

    comparison.push(...bestPerAthlete.values());
  }

  comparison.sort((a, b) => b.date.localeCompare(a.date) || b.bestWatts - a.bestWatts);
  return comparison;
}