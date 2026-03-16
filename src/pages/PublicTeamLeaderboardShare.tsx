import { useState, useEffect, useMemo, Fragment } from 'react';
import { Loader2, ChevronRight, Trophy, ChevronUp, ChevronDown, ChevronsUpDown, Gauge, Users } from 'lucide-react';
import {
  resolveTeamLeaderboardShare,
  type SeasonLeaderboardEntry,
} from '../services/coaching/coachingService';
import { ErgComparisonChart } from '../components/coaching/ErgComparisonChart';
import { RankOverTimeChart } from '../components/coaching/RankOverTimeChart';
import {
  type AnalyticsRangePreset,
  RANGE_PRESET_OPTIONS,
  buildErgComparisonFromShare,
  buildLeaderboardFromShare,
  formatAnalyticsRank,
  getRangeForPreset,
  parseAnalyticsRangePreset,
} from '../services/coaching/analyticsView';
import { formatSplit } from '../utils/paceCalculator';

type LeaderboardSortField = 'titan_index' | 'avg_raw_rank' | 'avg_wplb_rank' | 'latest_split_seconds' | 'assignment_count';

const INFO_PILL_CLASS = 'rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-950/80 dark:text-neutral-300 dark:shadow-none';
const SEGMENT_WRAP_CLASS = 'flex items-center gap-1.5 shrink-0 rounded-lg border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700/60 dark:bg-neutral-900/70';
const INACTIVE_SEGMENT_CLASS = 'bg-transparent text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';
const LB_PAGE_SIZE = 20;

function formatLeaderboardTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(1)}`;
}

export function PublicTeamLeaderboardShare() {
  const shareToken = window.location.pathname.split('/').pop() ?? null;
  const initialSearch = useMemo(() => new URLSearchParams(window.location.search), []);
  const [referenceDate] = useState(() => new Date());
  const [timeRangePreset, setTimeRangePreset] = useState<AnalyticsRangePreset>(() => parseAnalyticsRangePreset(initialSearch.get('range')) ?? '4w');
  const [testsOnly, setTestsOnly] = useState(() => initialSearch.get('tests') === '1');
  const [isLoading, setIsLoading] = useState(true);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof resolveTeamLeaderboardShare>>>(null);
  const [isInvalid, setIsInvalid] = useState(false);
  const [sortField, setSortField] = useState<LeaderboardSortField>('titan_index');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lbPage, setLbPage] = useState(0);
  const [teamFilter, setTeamFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shareToken) {
        setIsInvalid(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await resolveTeamLeaderboardShare(shareToken);
        if (cancelled) return;

        if (!data) {
          setIsInvalid(true);
          setPayload(null);
        } else {
          setPayload(data);
          setIsInvalid(false);
          if (data.filterTeamId) setTeamFilter(data.filterTeamId);
        }
      } catch {
        if (!cancelled) {
          setIsInvalid(true);
          setPayload(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const selectedRange = useMemo(() => getRangeForPreset(timeRangePreset, referenceDate), [timeRangePreset, referenceDate]);
  const activeTeamId = payload?.filterTeamId ?? (teamFilter !== 'all' ? teamFilter : null);

  const leaderboard = useMemo(() => {
    if (!payload) return [];
    return buildLeaderboardFromShare(payload, {
      from: selectedRange.from,
      to: selectedRange.to,
      testsOnly,
      teamId: activeTeamId,
      squad: payload.filterSquad,
      tier: payload.filterTier,
    });
  }, [payload, selectedRange.from, selectedRange.to, testsOnly, activeTeamId]);

  const ergComparison = useMemo(() => {
    if (!payload) return [];
    return buildErgComparisonFromShare(payload, {
      from: selectedRange.from,
      to: selectedRange.to,
      testsOnly,
      teamId: activeTeamId,
      squad: payload.filterSquad,
      tier: payload.filterTier,
    });
  }, [payload, selectedRange.from, selectedRange.to, testsOnly, activeTeamId]);

  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard].sort((a, b) => {
      if (sortField === 'titan_index') {
        const av = a.titan_index ?? Number.NEGATIVE_INFINITY;
        const bv = b.titan_index ?? Number.NEGATIVE_INFINITY;
        return sortAsc ? av - bv : bv - av;
      }
      if (sortField === 'latest_split_seconds') {
        const av = a.latest_split_seconds ?? Number.POSITIVE_INFINITY;
        const bv = b.latest_split_seconds ?? Number.POSITIVE_INFINITY;
        return sortAsc ? av - bv : bv - av;
      }
      if (sortField === 'assignment_count') {
        const av = a.assignment_count;
        const bv = b.assignment_count;
        return sortAsc ? av - bv : bv - av;
      }

      const av = a[sortField] ?? Number.POSITIVE_INFINITY;
      const bv = b[sortField] ?? Number.POSITIVE_INFINITY;
      return sortAsc ? av - bv : bv - av;
    });

    return sorted;
  }, [leaderboard, sortField, sortAsc]);

  const teamOptions = useMemo(() => {
    if (!payload || payload.filterTeamId) return [];
    const options = new Map<string, string>();
    payload.results.forEach((result) => {
      if (result.team_id && result.team_name) options.set(result.team_id, result.team_name);
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [payload]);

  const summary = useMemo(() => {
    const titanValues = sortedLeaderboard
      .map((entry) => entry.titan_index)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const averageTitan = titanValues.length > 0
      ? titanValues.reduce((sum, value) => sum + value, 0) / titanValues.length
      : null;
    const fastestAverageSplit = sortedLeaderboard.reduce<SeasonLeaderboardEntry | null>((best, entry) => {
      if (entry.avg_split_seconds == null) return best;
      if (best?.avg_split_seconds == null) return entry;
      return entry.avg_split_seconds < best.avg_split_seconds ? entry : best;
    }, null);

    return {
      leader: sortedLeaderboard[0] ?? null,
      averageTitan,
      fastestAverageSplit,
    };
  }, [sortedLeaderboard]);

  const lbTotalPages = Math.max(1, Math.ceil(sortedLeaderboard.length / LB_PAGE_SIZE));
  const pagedLeaderboard = sortedLeaderboard.slice(lbPage * LB_PAGE_SIZE, (lbPage + 1) * LB_PAGE_SIZE);
  const hasLeaderboardData = sortedLeaderboard.length > 0;
  const hasErgData = ergComparison.length > 0;
  const heading = payload ? [payload.orgName, payload.teamName].filter(Boolean).join(' · ') : 'Season Leaderboard';
  const currentScopeLabel = payload?.filterTeamId ? 'Selected team' : payload?.orgName ? 'Organization' : 'Current team';
  const currentModeLabel = testsOnly ? 'Tests only' : 'All workouts';

  useEffect(() => {
    setLbPage(0);
    setExpandedId(null);
  }, [sortField, sortAsc, sortedLeaderboard]);

  const toggleLbSort = (field: LeaderboardSortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(!(field === 'titan_index' || field === 'assignment_count'));
    }
  };

  const SortIcon = ({ field }: { field: LeaderboardSortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 inline ml-1 text-neutral-500" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-1 text-indigo-400" />
      : <ChevronDown className="w-3 h-3 inline ml-1 text-indigo-400" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (isInvalid || !payload) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-200 mb-2">Link expired or invalid</h1>
          <p className="text-sm text-neutral-500">This share link may have expired. Ask the coach for a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <Trophy className="w-4 h-4" /> Season Leaderboard
            </div>
            <h1 className="text-2xl font-bold text-white">{heading}</h1>
            <p className="text-sm text-neutral-400 mt-1">Shared coaching analytics view</p>
          </div>

          {teamOptions.length > 1 && (
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filter leaderboard by team"
              className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Teams</option>
              {teamOptions.map(([teamId, teamName]) => (
                <option key={teamId} value={teamId}>{teamName}</option>
              ))}
            </select>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={INFO_PILL_CLASS}>{selectedRange.label}</span>
              <span className={INFO_PILL_CLASS}>{currentScopeLabel}</span>
              <span className={INFO_PILL_CLASS}>{currentModeLabel}</span>
              <span className={INFO_PILL_CLASS}>Squad: {payload.filterSquad ?? 'All'}</span>
              <span className={INFO_PILL_CLASS}>Tier: {payload.filterTier ?? 'All'}</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className={SEGMENT_WRAP_CLASS}>
                {RANGE_PRESET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeRangePreset(option.value)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${timeRangePreset === option.value ? 'bg-indigo-600 text-white shadow-sm' : INACTIVE_SEGMENT_CLASS}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className={SEGMENT_WRAP_CLASS}>
                <button
                  type="button"
                  onClick={() => setTestsOnly(false)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${!testsOnly ? 'bg-indigo-600 text-white shadow-sm' : INACTIVE_SEGMENT_CLASS}`}
                >
                  All Workouts
                </button>
                <button
                  type="button"
                  onClick={() => setTestsOnly(true)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${testsOnly ? 'bg-indigo-600 text-white shadow-sm' : INACTIVE_SEGMENT_CLASS}`}
                >
                  Tests Only
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              <Users className="w-4 h-4 text-indigo-400" />
              Visible athletes
            </div>
            <div className="mt-3 text-3xl font-semibold text-neutral-950 dark:text-white">{sortedLeaderboard.length}</div>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-500">Athletes currently included in this shared leaderboard and chart view.</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              <Trophy className="w-4 h-4 text-amber-400" />
              Current leader
            </div>
            <div className="mt-3 text-lg font-semibold text-neutral-950 dark:text-white">{summary.leader?.athlete_name ?? '—'}</div>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-500">
              {summary.leader?.titan_index != null
                ? `Speed Index ${summary.leader.titan_index.toFixed(1)} across the selected ${selectedRange.label.toLowerCase()}`
                : 'No Speed Index data yet.'}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
              <Gauge className="w-4 h-4 text-emerald-400" />
              Group snapshot
            </div>
            <div className="mt-3 text-lg font-semibold text-neutral-950 dark:text-white">
              {summary.averageTitan != null ? summary.averageTitan.toFixed(1) : '—'}
              <span className="ml-2 text-sm font-medium text-neutral-500 dark:text-neutral-500">avg Speed Index</span>
            </div>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-500">
              {summary.fastestAverageSplit?.avg_split_seconds != null
                ? `Fastest average split: ${formatSplit(summary.fastestAverageSplit.avg_split_seconds)}`
                : 'Waiting for enough scored work to summarize.'}
            </p>
          </div>
        </div>

        {hasLeaderboardData && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <div className="mb-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-700/40 dark:bg-neutral-800/50">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
                    <span className="font-semibold">{testsOnly ? 'Erg test lens' : 'Season lens'}</span>
                    {testsOnly
                      ? ' isolates scored tests so you can see who performs best when the workout is explicitly a benchmark.'
                      : ` keeps scored assignments from the selected ${selectedRange.label.toLowerCase()} in play so you can spot athletes who hold quality over time, not just on one big piece.`}
                  </p>
                  <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-500">
                    Speed Index is a fixed 70/30 blend of speed and W/lb, averaged across the selected time range. Higher is better.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-200">
                    <th className="text-left py-3 pr-2 pl-3 w-12">#</th>
                    <th className="text-left py-3 pr-2 min-w-[220px]">Athlete</th>
                    <th className="text-center py-3 px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleLbSort('titan_index')}>
                      Speed Index<SortIcon field="titan_index" />
                    </th>
                    <th className="text-center py-3 px-2 cursor-pointer select-none" onClick={() => toggleLbSort('avg_raw_rank')}>
                      <div>Power Rank<SortIcon field="avg_raw_rank" /></div>
                      <div className="mt-0.5 text-[10px] font-medium normal-case text-neutral-500 dark:text-neutral-400">Lower is better</div>
                    </th>
                    <th className="text-center py-3 px-2 cursor-pointer select-none" onClick={() => toggleLbSort('avg_wplb_rank')}>
                      <div>Efficiency Rank<SortIcon field="avg_wplb_rank" /></div>
                      <div className="mt-0.5 text-[10px] font-medium normal-case text-neutral-500 dark:text-neutral-400">Lower is better</div>
                    </th>
                    <th className="text-center py-3 px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleLbSort('latest_split_seconds')}>
                      Last Workout Split <SortIcon field="latest_split_seconds" />
                    </th>
                    <th className="text-center py-3 px-3 cursor-pointer select-none w-24 whitespace-nowrap" onClick={() => toggleLbSort('assignment_count')}>
                      <span title="Workouts"># Workouts</span>
                      <SortIcon field="assignment_count" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLeaderboard.map((row, idx) => {
                    const isExpanded = expandedId === row.athlete_id;
                    const recentHistory = row.score_history.slice(0, 5);
                    const latestWorkout = row.score_history[0] ?? null;
                    const globalRank = lbPage * LB_PAGE_SIZE + idx + 1;
                    const isBreakpointRow = idx > 0 && idx % 8 === 0;

                    return (
                      <Fragment key={row.athlete_id}>
                        <tr className={`border-b border-neutral-200 transition-colors dark:border-neutral-800/50 ${isBreakpointRow ? 'border-t-2 border-t-neutral-300 dark:border-t-neutral-700/80' : ''} ${isExpanded ? 'bg-neutral-100 dark:bg-neutral-800/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/20'}`}>
                          <td className="py-3 pr-2 pl-3 align-top text-neutral-500 dark:text-neutral-500">
                            <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${globalRank <= 3 ? 'border border-neutral-300 bg-neutral-200 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white' : 'text-neutral-500 dark:text-neutral-500'}`}>
                              {globalRank}
                            </span>
                          </td>
                          <td className="py-3 pr-2 align-top">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : row.athlete_id)}
                              className="flex w-full items-start gap-2 text-left"
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} recent workouts for ${row.athlete_name}`}
                            >
                              <ChevronRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform dark:text-neutral-600 ${isExpanded ? 'rotate-90' : ''}`} />
                              <div className="min-w-0">
                                <div className="font-medium text-neutral-950 dark:text-white">{row.athlete_name}</div>
                                <div className="text-[11px] text-neutral-500 dark:text-neutral-500">
                                  {[row.team_name, row.squad, row.performance_tier].filter(Boolean).join(' · ') || 'No squad or tier'}
                                </div>
                                <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">{isExpanded ? 'Hide recent scored work' : 'View recent scored work and rank breakdown'}</div>
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-mono font-semibold text-neutral-950 dark:text-white">{row.titan_index != null ? row.titan_index.toFixed(1) : '—'}</div>
                            <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">#{formatAnalyticsRank(row.composite_rank)} composite rank</div>
                          </td>
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-mono text-neutral-700 dark:text-neutral-300">#{formatAnalyticsRank(row.avg_raw_rank)}</div>
                          </td>
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-mono text-neutral-700 dark:text-neutral-300">#{formatAnalyticsRank(row.avg_wplb_rank)}</div>
                          </td>
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-mono text-neutral-700 dark:text-neutral-300">{row.latest_split_seconds != null ? formatSplit(row.latest_split_seconds) : '—'}</div>
                            <div className="mx-auto mt-1 max-w-[180px] truncate text-[11px] text-neutral-500 dark:text-neutral-500" title={latestWorkout?.label ?? 'No recent workout'}>
                              {latestWorkout?.label ?? 'No recent workout'}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center align-top">
                            <div className="font-mono text-neutral-800 dark:text-neutral-200">{row.assignment_count}</div>
                            <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">scored</div>
                          </td>
                        </tr>
                        {isExpanded && recentHistory.length > 0 && (
                          <tr className="bg-neutral-50 dark:bg-neutral-800/20">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
                                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700/50 dark:bg-neutral-900/60">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">Composite rank</div>
                                  <div className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">#{formatAnalyticsRank(row.composite_rank)}</div>
                                </div>
                                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700/50 dark:bg-neutral-900/60">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">Power rank</div>
                                  <div className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">#{formatAnalyticsRank(row.avg_raw_rank)}</div>
                                </div>
                                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700/50 dark:bg-neutral-900/60">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">Efficiency rank</div>
                                  <div className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">#{formatAnalyticsRank(row.avg_wplb_rank)}</div>
                                </div>
                                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700/50 dark:bg-neutral-900/60">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">Speed Index basis</div>
                                  <div className="mt-1 text-sm font-medium text-neutral-950 dark:text-white">{selectedRange.label}</div>
                                  <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">70% speed · 30% W/lb</div>
                                </div>
                              </div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-500">Recent scored workouts (newest first)</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-neutral-600 dark:text-neutral-600">
                                    <th className="text-left py-1 pr-2">Workout</th>
                                    <th className="text-left py-1 px-2">Date</th>
                                    <th className="text-right py-1 px-2">Split</th>
                                    <th className="text-right py-1 px-2">Time</th>
                                    <th className="text-right py-1 pl-2">Efficiency</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recentHistory.map((history) => (
                                    <tr key={history.assignmentId} className="border-t border-neutral-200 text-neutral-600 dark:border-neutral-800/30 dark:text-neutral-400">
                                      <td className="py-1 pr-2 text-neutral-700 dark:text-neutral-300">{history.label}</td>
                                      <td className="py-1 px-2 text-neutral-500 dark:text-neutral-500">{new Date(history.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                      <td className="py-1 px-2 text-right font-mono">{formatSplit(history.split)}</td>
                                      <td className="py-1 px-2 text-right font-mono">{history.time != null ? formatLeaderboardTime(history.time) : '—'}</td>
                                      <td className="py-1 pl-2 text-right font-mono">{history.wplb != null ? history.wplb.toFixed(2) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                        {isExpanded && recentHistory.length === 0 && (
                          <tr className="bg-neutral-50 dark:bg-neutral-800/20">
                            <td colSpan={7} className="px-4 py-3 text-xs italic text-neutral-500 dark:text-neutral-500">No workout history available</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {sortedLeaderboard.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No athletes with scores in this view.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {lbTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between px-1 text-xs text-neutral-500 dark:text-neutral-500">
                  <span>Page {lbPage + 1} of {lbTotalPages} ({sortedLeaderboard.length} athletes)</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLbPage((page) => Math.max(0, page - 1))}
                      disabled={lbPage === 0}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setLbPage((page) => Math.min(lbTotalPages - 1, page + 1))}
                      disabled={lbPage >= lbTotalPages - 1}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(hasLeaderboardData || hasErgData) && (
          <div className="space-y-6">
            {hasLeaderboardData && <RankOverTimeChart leaderboard={leaderboard} />}
            {hasErgData && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-sm font-medium text-neutral-400 mb-4">Erg Comparison</h3>
                <ErgComparisonChart data={ergComparison} showResultsLink={false} />
              </div>
            )}
          </div>
        )}

        <div className="text-center text-[11px] text-neutral-600">
          Powered by <a href="https://log.train-better.app" className="text-indigo-500 hover:text-indigo-400">ReadyAll</a>
          {payload.expiresAt && (
            <> · Expires {new Date(payload.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
          )}
        </div>
      </div>
    </div>
  );
}