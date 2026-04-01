import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Loader2, BarChart3, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, Share2, Check } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getAthletes,
  getTeamErgComparison,
  getTeamTrainingZoneDistribution,
  getOrgErgComparison,
  getOrgTrainingZoneDistribution,
  getOrgAthletesWithTeam,
  getTeamsForOrg,
  getSeasonMeasuredLeaderboard,
  rerankLeaderboard,
  getErgScores,
  getGroupAssignments,
  getComplianceData,
  type CoachingAthlete,
  type TeamErgComparison,
  type ZoneDistribution,
  type SeasonLeaderboardEntry,
  type GroupAssignment,
  type ComplianceCell,
  createTeamLeaderboardShare,
  buildTeamLeaderboardShareUrl,
} from '../../services/coaching/coachingService';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { ErgComparisonChart } from '../../components/coaching/ErgComparisonChart';
import { TrainingZoneDonut } from '../../components/coaching/TrainingZoneDonut';
import { RankOverTimeChart } from '../../components/coaching/RankOverTimeChart';
import { ComplianceTrendChart } from '../../components/coaching/ComplianceTrendChart';
import { buildBest2kByAthlete, deriveBenchmarkTier, TIER_SORT_ORDER, type PerformanceTierRubricConfig } from '../../utils/performanceTierRubric';
import { getOrganizationsForUser } from '../../services/coaching/coachingService';
import { formatSplit } from '../../utils/paceCalculator';
import {
  type AnalyticsRangePreset,
  RANGE_PRESET_OPTIONS,
  formatAnalyticsRank,
  getRangeForPreset,
} from '../../services/coaching/analyticsView';

const SEGMENT_WRAP_CLASS = 'flex items-center gap-1.5 shrink-0 rounded-lg border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700/60 dark:bg-neutral-900/70';
const INACTIVE_SEGMENT_CLASS = 'bg-transparent text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';

export function TeamAnalytics() {
  const { userId, teamId, orgId, isLoadingTeam, teamError, filterTeamId } = useCoachingContext();

  type LeaderboardSortField =
    | 'titan_index'
    | 'avg_raw_rank'
    | 'avg_wplb_rank'
    | 'latest_split_seconds'
    | 'assignment_count';

  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [ergComparison, setErgComparison] = useState<TeamErgComparison[]>([]);
  const [zoneDistribution, setZoneDistribution] = useState<{ zones: ZoneDistribution[]; total: number } | null>(null);
  const [seasonLeaderboard, setSeasonLeaderboard] = useState<SeasonLeaderboardEntry[]>([]);
  const [complianceAssignments, setComplianceAssignments] = useState<GroupAssignment[]>([]);
  const [complianceCells, setComplianceCells] = useState<ComplianceCell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [squadFilter, setSquadFilter] = useState<string | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<string | 'all'>('all');
  const [best2kByAthlete, setBest2kByAthlete] = useState<Record<string, number>>({});
  const [orgRubric, setOrgRubric] = useState<PerformanceTierRubricConfig | null>(null);
  const [lbSortField, setLbSortField] = useState<LeaderboardSortField>('titan_index');
  const [lbSortAsc, setLbSortAsc] = useState(false);
  const [lbPage, setLbPage] = useState(0);
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'copied'>('idle');
  const [titanTestOnly, setTitanTestOnly] = useState(false);
  const [timeRangePreset, setTimeRangePreset] = useState<AnalyticsRangePreset>('4w');
  const [analyticsTab, setAnalyticsTab] = useState<'leaderboard' | 'erg-comparison'>('leaderboard');
  const [qualifyEnabled, setQualifyEnabled] = useState(true);
  const [referenceDate] = useState(() => new Date());
  const LB_PAGE_SIZE = 20;
  const QUALIFY_MIN_PCT = 0.5; // 50% of total workouts required to qualify

  const isOrg = !!orgId;
  // The effective team ID for single-team queries (2k benchmarks)
  const effectiveTeamId = filterTeamId ?? teamId;
  const selectedRange = useMemo(() => getRangeForPreset(timeRangePreset, referenceDate), [timeRangePreset, referenceDate]);

  const loadData = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      if (isOrg && orgId) {
        // Always fetch org-wide data; client-filter by filterTeamId
        const [, loadedAthletes, ergData, zoneDist, leaderboard, cAssign, cCells] = await Promise.all([
          getTeamsForOrg(orgId),
          getOrgAthletesWithTeam(orgId),
          getOrgErgComparison(orgId).catch(() => [] as TeamErgComparison[]),
          getOrgTrainingZoneDistribution(orgId, { from: selectedRange.from, to: selectedRange.to }).catch(() => null),
          getSeasonMeasuredLeaderboard(teamId, { orgId, from: selectedRange.from, to: selectedRange.to }).catch(() => [] as SeasonLeaderboardEntry[]),
          getGroupAssignments(teamId, { from: selectedRange.from, to: selectedRange.to, orgId }).catch(() => [] as GroupAssignment[]),
          getComplianceData(teamId, selectedRange.from ?? '2000-01-01', selectedRange.to ?? '2099-12-31', orgId).catch(() => [] as ComplianceCell[]),
        ]);
        setAthletes(loadedAthletes.filter((a) => a.side !== 'coxswain'));
        setErgComparison(ergData);
        setZoneDistribution(zoneDist);
        setSeasonLeaderboard(leaderboard);
        setComplianceAssignments(cAssign);
        setComplianceCells(cCells);
      } else {
        // Non-org: single team only
        const [loadedAthletes, ergData, zoneDist, leaderboard, cAssign, cCells] = await Promise.all([
          getAthletes(teamId),
          getTeamErgComparison(teamId).catch(() => [] as TeamErgComparison[]),
          getTeamTrainingZoneDistribution(teamId, { from: selectedRange.from, to: selectedRange.to }).catch(() => null),
          getSeasonMeasuredLeaderboard(teamId, { from: selectedRange.from, to: selectedRange.to }).catch(() => [] as SeasonLeaderboardEntry[]),
          getGroupAssignments(teamId, { from: selectedRange.from, to: selectedRange.to }).catch(() => [] as GroupAssignment[]),
          getComplianceData(teamId, selectedRange.from ?? '2000-01-01', selectedRange.to ?? '2099-12-31').catch(() => [] as ComplianceCell[]),
        ]);
        setAthletes(loadedAthletes.filter((a) => a.side !== 'coxswain'));
        setErgComparison(ergData);
        setZoneDistribution(zoneDist);
        setSeasonLeaderboard(leaderboard);
        setComplianceAssignments(cAssign);
        setComplianceCells(cCells);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [teamId, orgId, isOrg, selectedRange.from, selectedRange.to]);

  useEffect(() => {
    if (!isLoadingTeam) loadData();
  }, [isLoadingTeam, loadData]);

  // Load org rubric
  useEffect(() => {
    if (!userId || !orgId) { setOrgRubric(null); return; }
    getOrganizationsForUser(userId)
      .then((orgs) => {
        const org = orgs.find((o) => o.id === orgId);
        setOrgRubric(org?.performance_tier_rubric ?? null);
      })
      .catch(() => setOrgRubric(null));
  }, [userId, orgId]);

  // Load 2k benchmarks
  useEffect(() => {
    if (!effectiveTeamId) return;
    getErgScores(effectiveTeamId)
      .then((scores) => setBest2kByAthlete(buildBest2kByAthlete(scores)))
      .catch(() => {});
  }, [effectiveTeamId]);

  // Reset filters when org/team changes
  useEffect(() => { setSquadFilter('all'); setTierFilter('all'); }, [orgId, filterTeamId]);

  // Client-filter by team when a specific team is selected in CoachingNav
  const teamFilteredErgData = useMemo(() => {
    if (!filterTeamId) return ergComparison;
    return ergComparison.filter((e) => e.team_id === filterTeamId);
  }, [ergComparison, filterTeamId]);

  const teamFilteredAthletes = useMemo(() => {
    if (!filterTeamId) return athletes;
    return athletes.filter((a) => a.team_id === filterTeamId);
  }, [athletes, filterTeamId]);

  const teamFilteredLeaderboard = useMemo(() => {
    if (!filterTeamId) return seasonLeaderboard;
    return seasonLeaderboard.filter((e) => e.team_id === filterTeamId);
  }, [seasonLeaderboard, filterTeamId]);

  const filteredComplianceAssignments = useMemo(() => {
    if (!filterTeamId) return complianceAssignments;
    return complianceAssignments.filter((a) => a.team_id === filterTeamId || a.org_id);
  }, [complianceAssignments, filterTeamId]);

  // Squads available within the current team filter
  const squads = useMemo(
    () => [...new Set(teamFilteredAthletes.map((a) => a.squad).filter((s): s is string => !!s))].sort(),
    [teamFilteredAthletes]
  );

  // Reset squad filter when team filter changes and squad no longer exists
  useEffect(() => {
    if (squadFilter !== 'all' && !squads.includes(squadFilter)) {
      setSquadFilter('all');
    }
  }, [squads, squadFilter]);

  // Compute effective tier per athlete
  const effectiveTierByAthlete = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const a of teamFilteredAthletes) {
      const best2k = best2kByAthlete[a.id] ?? null;
      const benchmarkTier = deriveBenchmarkTier(a.squad ?? null, best2k, orgRubric);
      map[a.id] = benchmarkTier ?? a.performance_tier ?? null;
    }
    return map;
  }, [teamFilteredAthletes, best2kByAthlete, orgRubric]);

  // Distinct tiers present
  const activeTiers = useMemo(() => {
    const tierSet = new Set<string>();
    for (const tier of Object.values(effectiveTierByAthlete)) {
      if (tier) tierSet.add(tier);
    }
    return [...tierSet].sort((a, b) => (TIER_SORT_ORDER[a] ?? 99) - (TIER_SORT_ORDER[b] ?? 99));
  }, [effectiveTierByAthlete]);

  // Reset tier filter when tier no longer exists
  useEffect(() => {
    if (tierFilter !== 'all' && !activeTiers.includes(tierFilter)) {
      setTierFilter('all');
    }
  }, [activeTiers, tierFilter]);

  const filteredErgData = useMemo(() => {
    let data = teamFilteredErgData;
    const from = selectedRange.from;
    const to = selectedRange.to;
    if (from) data = data.filter((entry) => entry.date >= from);
    if (to) data = data.filter((entry) => entry.date <= to);
    if (titanTestOnly) data = data.filter((entry) => entry.is_test);
    if (squadFilter !== 'all') data = data.filter((entry) => entry.squad === squadFilter);
    if (tierFilter !== 'all') {
      const athleteIdsInTier = new Set(
        teamFilteredAthletes.filter((a) => effectiveTierByAthlete[a.id] === tierFilter).map((a) => a.id)
      );
      data = data.filter((e) => athleteIdsInTier.has(e.athleteId));
    }
    return data;
  }, [teamFilteredErgData, selectedRange.from, selectedRange.to, titanTestOnly, squadFilter, tierFilter, teamFilteredAthletes, effectiveTierByAthlete]);

  const filteredAthletes = useMemo(() => {
    let result = squadFilter === 'all' ? teamFilteredAthletes : teamFilteredAthletes.filter((a) => a.squad === squadFilter);
    if (tierFilter !== 'all') {
      result = result.filter((a) => effectiveTierByAthlete[a.id] === tierFilter);
    }
    return result;
  }, [teamFilteredAthletes, squadFilter, tierFilter, effectiveTierByAthlete]);

  // Apply squad + tier filters to leaderboard (same as erg data)
  const filteredLeaderboard = useMemo(() => {
    let data = teamFilteredLeaderboard;
    if (squadFilter !== 'all') {
      data = data.filter((e) => e.squad === squadFilter);
    }
    if (tierFilter !== 'all') {
      const athleteIdsInTier = new Set(
        teamFilteredAthletes.filter((a) => effectiveTierByAthlete[a.id] === tierFilter).map((a) => a.id)
      );
      data = data.filter((e) => athleteIdsInTier.has(e.athlete_id));
    }
    // Re-rank within the filtered group so ranks are relative to visible athletes
    // Apply whenever any filter narrows the set (team, squad, or tier)
    const isFiltered = !!filterTeamId || squadFilter !== 'all' || tierFilter !== 'all';
    return isFiltered ? rerankLeaderboard(data) : data;
  }, [teamFilteredLeaderboard, squadFilter, tierFilter, teamFilteredAthletes, effectiveTierByAthlete, filterTeamId]);

  // Recompute all ranks when test-only toggle is active
  const leaderboardWithTitan = useMemo(() => {
    if (!titanTestOnly) return filteredLeaderboard; // use server-computed (all workouts)
    // Filter score_history to tests only, then re-rank everything from that subset
    const testFiltered = filteredLeaderboard.map((entry) => ({
      ...entry,
      score_history: entry.score_history.filter((h) => h.is_test),
    }));
    // Remove athletes with no test scores
    const withTests = testFiltered.filter((e) => e.score_history.length > 0);
    // Re-rank speed, efficiency, composite, and titan from test-only data
    return rerankLeaderboard(withTests);
  }, [filteredLeaderboard, titanTestOnly]);

  // Minimum-workout qualification: require >= 50% of available assignments
  const totalAssignments = useMemo(() => {
    if (leaderboardWithTitan.length === 0) return 0;
    return Math.max(...leaderboardWithTitan.map((e) => e.assignment_count));
  }, [leaderboardWithTitan]);
  const qualifyMinCount = Math.ceil(totalAssignments * QUALIFY_MIN_PCT);
  const qualifiedLeaderboard = useMemo(() => {
    if (!qualifyEnabled || titanTestOnly || totalAssignments < 2) return leaderboardWithTitan;
    return leaderboardWithTitan.filter((e) => e.assignment_count >= qualifyMinCount);
  }, [leaderboardWithTitan, qualifyEnabled, titanTestOnly, totalAssignments, qualifyMinCount]);
  const disqualifiedCount = leaderboardWithTitan.length - qualifiedLeaderboard.length;

  // Sorted leaderboard (from filtered data with Speed Index)
  const sortedLeaderboard = useMemo(() => {
    const sorted = [...qualifiedLeaderboard].sort((a, b) => {
      if (lbSortField === 'titan_index') {
        // Higher is better, default descending
        const av = a.titan_index ?? -Infinity;
        const bv = b.titan_index ?? -Infinity;
        return lbSortAsc ? av - bv : bv - av;
      }
      if (lbSortField === 'latest_split_seconds') {
        const av = a.latest_split_seconds ?? Number.POSITIVE_INFINITY;
        const bv = b.latest_split_seconds ?? Number.POSITIVE_INFINITY;
        return lbSortAsc ? av - bv : bv - av;
      }
      if (lbSortField === 'assignment_count') {
        const av = a.assignment_count;
        const bv = b.assignment_count;
        return lbSortAsc ? av - bv : bv - av;
      }
      // avg_raw_rank, avg_wplb_rank — lower is better, including decimal averages
      const av = a[lbSortField] ?? Number.POSITIVE_INFINITY;
      const bv = b[lbSortField] ?? Number.POSITIVE_INFINITY;
      return lbSortAsc ? av - bv : bv - av;
    });
    return sorted;
  }, [qualifiedLeaderboard, lbSortField, lbSortAsc]);

  const lbTotalPages = Math.max(1, Math.ceil(sortedLeaderboard.length / LB_PAGE_SIZE));
  const pagedLeaderboard = sortedLeaderboard.slice(lbPage * LB_PAGE_SIZE, (lbPage + 1) * LB_PAGE_SIZE);

  // Reset page when data or sort changes
  useEffect(() => { setLbPage(0); }, [lbSortField, lbSortAsc, qualifiedLeaderboard]);

  const toggleLbSort = (field: typeof lbSortField) => {
    if (lbSortField === field) {
      setLbSortAsc((prev) => !prev);
    } else {
      setLbSortField(field);
      // Speed Index and workout count: higher is better → default descending.
      // Power rank, efficiency rank, and split: lower is better → default ascending.
      setLbSortAsc(!(field === 'titan_index' || field === 'assignment_count'));
    }
  };

  const LbSortIcon = ({ field }: { field: typeof lbSortField }) => {
    if (lbSortField !== field) return <ChevronsUpDown className="w-3 h-3 inline ml-1 text-neutral-300" />;
    return lbSortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-1 text-indigo-400" />
      : <ChevronDown className="w-3 h-3 inline ml-1 text-indigo-400" />;
  };

  const hasZoneData = zoneDistribution && zoneDistribution.total > 0;
  const showZoneChart = hasZoneData && !titanTestOnly;
  const hasErgData = filteredErgData.length > 0;
  const hasLeaderboardData = sortedLeaderboard.length > 0;
  const hasComplianceData = filteredComplianceAssignments.length > 0;
  const hasAnyData = hasZoneData || hasErgData || hasLeaderboardData || hasComplianceData;
  const hasChartData = showZoneChart || hasErgData || hasLeaderboardData || hasComplianceData;
  const leaderboardLeader = sortedLeaderboard[0] ?? null;

  const leaderboardSummary = useMemo(() => {
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

    const workloadLeader = sortedLeaderboard.reduce<SeasonLeaderboardEntry | null>((best, entry) => {
      if (!best) return entry;
      return entry.assignment_count > best.assignment_count ? entry : best;
    }, null);

    return {
      averageTitan,
      fastestAverageSplit,
      workloadLeader,
    };
  }, [sortedLeaderboard]);


  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <CoachingNav />
      <div className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
            {isOrg ? 'Organization Analytics' : 'Team Analytics'}
          </h1>
          <p className="text-neutral-400 mt-1">Performance data and training insights</p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        )}

        {/* Error */}
        {(error || teamError) && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
            {error || teamError}
            {error && (
              <button onClick={() => { setError(null); loadData(); }} className="ml-3 underline hover:text-red-300">
                Retry
              </button>
            )}
          </div>
        )}

        {/* No data */}
        {!isLoading && !error && !hasAnyData && (
          <EmptyState
            icon={<BarChart3 className="w-8 h-8" />}
            title="Not enough data"
            description="Analytics will appear once athletes have completed assignments."
          />
        )}

        {!isLoading && !error && hasAnyData && (
          <div className="space-y-3">
            {/* Compact filter bar */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Time range */}
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

                {/* Workout mode */}
                <div className={SEGMENT_WRAP_CLASS}>
                  <button
                    onClick={() => setTitanTestOnly(false)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${!titanTestOnly ? 'bg-indigo-600 text-white shadow-sm' : INACTIVE_SEGMENT_CLASS}`}
                  >All Workouts</button>
                  <button
                    onClick={() => setTitanTestOnly(true)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${titanTestOnly ? 'bg-indigo-600 text-white shadow-sm' : INACTIVE_SEGMENT_CLASS}`}
                  >Tests Only</button>
                </div>

                {/* Squad filter */}
                {squads.length > 0 && (
                  <select
                    value={squadFilter}
                    onChange={(e) => setSquadFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-[11px] font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    aria-label="Filter by squad"
                  >
                    <option value="all">All Squads</option>
                    {squads.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}

                {/* Tier filter */}
                {activeTiers.length > 1 && (
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-[11px] font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    aria-label="Filter by performance tier"
                  >
                    <option value="all">All Tiers</option>
                    {activeTiers.map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                )}

                {/* Minimum workout qualification toggle */}
                {!titanTestOnly && totalAssignments >= 2 && (
                  <label className="flex items-center gap-1.5 text-[11px] text-neutral-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={qualifyEnabled}
                      onChange={(e) => setQualifyEnabled(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-800 text-indigo-500 focus:ring-indigo-500"
                    />
                    Min {qualifyMinCount}/{totalAssignments} workouts
                  </label>
                )}

              </div>
            </div>

            {/* Lens indicator + summary strip */}
            <div className="flex flex-col gap-1.5 px-1">
              <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${titanTestOnly ? 'bg-amber-500/10 border border-amber-500/25 text-amber-300' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-300'}`}>
                <span className="font-semibold text-white">{titanTestOnly ? '⚡ Erg Test Lens' : `Consistency Lens · ${selectedRange.label}`}</span>
                <span className="ml-1.5 text-[11px]">
                  {titanTestOnly
                    ? '— Showing only scored erg tests. Best for comparing benchmark performance.'
                    : `— All scored workouts in the selected window. Best for spotting athletes who hold quality over time.`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-neutral-400">
                <span><span className="font-semibold text-white">{filteredAthletes.length}</span> athletes</span>
                {leaderboardLeader?.titan_index != null && (
                  <span>Leader: <span className="font-semibold text-white">{leaderboardLeader.athlete_name}</span> <span className="text-indigo-400">{leaderboardLeader.titan_index.toFixed(1)}</span></span>
                )}
                {leaderboardSummary.averageTitan != null && (
                  <span>Avg SI: <span className="font-semibold text-white">{leaderboardSummary.averageTitan.toFixed(1)}</span></span>
                )}
                {leaderboardSummary.fastestAverageSplit?.avg_split_seconds != null && (
                  <span>Fastest avg: <span className="font-semibold text-white">{formatSplit(leaderboardSummary.fastestAverageSplit.avg_split_seconds)}</span></span>
                )}
                {disqualifiedCount > 0 && (
                  <span className="text-neutral-500">{disqualifiedCount} below min — hidden</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab switcher + Share */}
        {!isLoading && (hasLeaderboardData || hasErgData) && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-100 p-1 w-fit dark:border-neutral-700/60 dark:bg-neutral-900/70">
              <button
                onClick={() => setAnalyticsTab('leaderboard')}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                  analyticsTab === 'leaderboard'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : INACTIVE_SEGMENT_CLASS
                }`}
              >
                Leaderboard
              </button>
              {hasErgData && (
                <button
                  onClick={() => setAnalyticsTab('erg-comparison')}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                    analyticsTab === 'erg-comparison'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : INACTIVE_SEGMENT_CLASS
                  }`}
                >
                  Individual Workout Detail
                </button>
              )}
            </div>
            {analyticsTab === 'leaderboard' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (shareStatus !== 'idle') return;
                    setShareStatus('loading');
                    try {
                      const { token } = await createTeamLeaderboardShare(teamId!, {
                        orgId,
                        filterSquad: squadFilter !== 'all' ? squadFilter : null,
                        filterTier: tierFilter !== 'all' ? tierFilter : null,
                        filterTeamId: filterTeamId ?? null,
                      });
                      const url = new URL(buildTeamLeaderboardShareUrl(token));
                      url.searchParams.set('range', timeRangePreset);
                      if (titanTestOnly) {
                        url.searchParams.set('tests', '1');
                      }
                      await navigator.clipboard.writeText(url.toString());
                      setShareStatus('copied');
                      setTimeout(() => setShareStatus('idle'), 2500);
                    } catch {
                      setShareStatus('idle');
                    }
                  }}
                  disabled={shareStatus === 'loading'}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50"
                >
                  {shareStatus === 'copied' ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                  {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'loading' ? '…' : 'Private Link'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard — full width */}
        {!isLoading && hasLeaderboardData && analyticsTab === 'leaderboard' && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-100 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/95 dark:text-neutral-200">
                    <th className="text-left py-3 pr-2 pl-3 w-12">#</th>
                    <th className="text-left py-3 pr-2 min-w-[140px] md:min-w-[220px]">Athlete</th>
                    <th className="text-center py-3 px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleLbSort('titan_index')}>
                      Speed Index<LbSortIcon field="titan_index" />
                    </th>
                    <th className="hidden md:table-cell text-center py-3 px-2 cursor-pointer select-none" onClick={() => toggleLbSort('avg_raw_rank')}>
                      <div>Power Rank<LbSortIcon field="avg_raw_rank" /></div>
                      <div className="mt-0.5 text-[10px] font-medium normal-case text-neutral-500 dark:text-neutral-400">Lower is better</div>
                    </th>
                    <th className="hidden md:table-cell text-center py-3 px-2 cursor-pointer select-none" onClick={() => toggleLbSort('avg_wplb_rank')}>
                      <div>Efficiency Rank<LbSortIcon field="avg_wplb_rank" /></div>
                      <div className="mt-0.5 text-[10px] font-medium normal-case text-neutral-500 dark:text-neutral-400">Lower is better</div>
                    </th>
                    <th className="text-center py-3 px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleLbSort('latest_split_seconds')}>
                      Last Workout Split <LbSortIcon field="latest_split_seconds" />
                    </th>
                    <th className="hidden md:table-cell text-center py-3 px-3 cursor-pointer select-none w-24 whitespace-nowrap" onClick={() => toggleLbSort('assignment_count')}>
                      <span title="Workouts"># Workouts</span>
                      <LbSortIcon field="assignment_count" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLeaderboard.map((row, idx) => {
                    const isExpanded = expandedAthleteId === row.athlete_id;
                    const recentHistory = row.score_history.slice(0, 5); // already newest-first from service
                    const latestWorkout = row.score_history[0] ?? null;
                    const globalRank = lbPage * LB_PAGE_SIZE + idx + 1;
                    const isBreakpointRow = idx > 0 && idx % 8 === 0;
                    return (
                      <Fragment key={row.athlete_id}>
                        {isBreakpointRow && (
                          <tr aria-hidden="true">
                            <td colSpan={7} className="px-3 py-2">
                              <div className="h-2 rounded-full border border-neutral-300 bg-neutral-100 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-none" />
                            </td>
                          </tr>
                        )}
                        <tr className={`border-b border-neutral-200 transition-colors dark:border-neutral-800/50 ${isExpanded ? 'bg-neutral-100 dark:bg-neutral-800/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/20'}`}>
                          <td className="py-3 pr-2 pl-3 align-top text-neutral-500 dark:text-neutral-500">
                            <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${globalRank <= 3 ? 'border border-neutral-300 bg-neutral-200 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white' : 'text-neutral-500 dark:text-neutral-500'}`}>
                              {globalRank}
                            </span>
                          </td>
                          <td className="py-3 pr-2 align-top">
                            <button
                              type="button"
                              onClick={() => setExpandedAthleteId(isExpanded ? null : row.athlete_id)}
                              className="flex w-full items-start gap-2 text-left"
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} recent workouts for ${row.athlete_name}`}
                            >
                              <ChevronRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform dark:text-neutral-600 ${isExpanded ? 'rotate-90' : ''}`} />
                              <div className="min-w-0">
                                <div className="font-medium text-neutral-950 dark:text-white">{row.athlete_name}</div>
                                <div className="text-[11px] text-neutral-500 dark:text-neutral-500">
                                  {[row.squad, row.performance_tier].filter(Boolean).join(' · ') || 'No squad or tier'}
                                </div>
                                <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">{isExpanded ? 'Hide recent scored work' : 'View recent scored work and rank breakdown'}</div>
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-mono font-semibold text-neutral-950 dark:text-white">{row.titan_index != null ? row.titan_index.toFixed(1) : '—'}</div>
                            <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">#{formatAnalyticsRank(row.composite_rank)} composite rank</div>
                          </td>
                          <td className="hidden md:table-cell py-3 px-2 text-center align-top">
                            <div className="font-mono text-neutral-700 dark:text-neutral-300">#{formatAnalyticsRank(row.avg_raw_rank)}</div>
                          </td>
                          <td className="hidden md:table-cell py-3 px-2 text-center align-top">
                            <div className="font-mono text-neutral-700 dark:text-neutral-300">#{formatAnalyticsRank(row.avg_wplb_rank)}</div>
                          </td>
                          <td className="py-3 px-2 text-center align-top">
                            <div className="font-mono text-neutral-700 dark:text-neutral-300">{row.latest_split_seconds != null ? formatSplit(row.latest_split_seconds) : '—'}</div>
                            <div className="mx-auto mt-1 max-w-[180px] truncate text-[11px] text-neutral-500 dark:text-neutral-500" title={latestWorkout?.label ?? 'No recent workout'}>
                              {latestWorkout?.label ?? 'No recent workout'}
                            </div>
                          </td>
                          <td className="hidden md:table-cell py-3 px-3 text-center align-top">
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
                                  <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">50% speed · 50% relative power (W/lb here)</div>
                                </div>
                              </div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-500">Recent scored workouts (newest first)</div>
                              <div className="overflow-x-auto">
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
                                  {recentHistory.map((h) => (
                                    <tr key={h.assignmentId} className="border-t border-neutral-200 text-neutral-600 dark:border-neutral-800/30 dark:text-neutral-400">
                                      <td className="py-1 pr-2">
                                        <a
                                          href={`/team-management/assignments/${h.assignmentId}/results`}
                                          className="text-indigo-400 hover:text-indigo-300 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {h.label}
                                        </a>
                                      </td>
                                      <td className="py-1 px-2 text-neutral-500 dark:text-neutral-500">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                      <td className="py-1 px-2 text-right font-mono">{formatSplit(h.split)}</td>
                                      <td className="py-1 px-2 text-right font-mono">{h.time != null ? formatLeaderboardTime(h.time) : '—'}</td>
                                      <td className="py-1 pl-2 text-right font-mono">{h.wplb != null ? h.wplb.toFixed(2) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
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
                </tbody>
              </table>
              {lbTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between px-3 pb-3 text-xs text-neutral-500 dark:text-neutral-500">
                  <span>Page {lbPage + 1} of {lbTotalPages} ({sortedLeaderboard.length} athletes)</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLbPage((p) => Math.max(0, p - 1))}
                      disabled={lbPage === 0}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >Prev</button>
                    <button
                      onClick={() => setLbPage((p) => Math.min(lbTotalPages - 1, p + 1))}
                      disabled={lbPage >= lbTotalPages - 1}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >Next</button>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Erg Comparison — tab content */}
        {!isLoading && hasErgData && analyticsTab === 'erg-comparison' && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none">
            <ErgComparisonChart data={filteredErgData} />
          </div>
        )}

        {/* Charts */}
        {!isLoading && hasChartData && (
          <div className="space-y-6">
            {/* Workout Compliance Trend */}
            {filteredComplianceAssignments.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none">
                <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-4">Workout Compliance</h3>
                <ComplianceTrendChart
                  assignments={filteredComplianceAssignments}
                  cells={complianceCells}
                  athleteCount={teamFilteredAthletes.length}
                />
              </div>
            )}
            {/* Training Zone Distribution */}
            {showZoneChart && (
              <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 dark:shadow-none max-w-lg">
                <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-4">Training Zone Distribution</h3>
                <TrainingZoneDonut
                  zones={zoneDistribution!.zones.flatMap(z =>
                    Array.from({ length: z.count }, () => z.zone === 'Unset' ? null : z.zone)
                  )}
                />
              </div>
            )}
            {/* Rank Over Time Chart */}
            {hasLeaderboardData && (
              <RankOverTimeChart leaderboard={leaderboardWithTitan} />
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/** Format total seconds as M:SS.t (e.g. 6:46.2) for leaderboard display */
function formatLeaderboardTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(1)}`;
}


