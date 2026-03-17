import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Users, Calendar, Loader2, Activity, ClipboardList, CheckCircle2, XCircle, Plus, Building2, ChevronDown, ChevronRight, Shield, Search } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { RowingShellIcon } from '../../components/icons/RowingIcons';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { WeeklyFocusCard } from '../../components/coaching/WeeklyFocusCard';
import { PendingCoachingRequests } from '../../components/coaching/PendingCoachingRequests';
import {
  getAssignmentsForDate,
  getAssignmentCompletions,
  getAthletes,
  getSessions,
  getBoatings,
  getGroupAssignments,
  getTeamStats,
  getSeasonMeasuredLeaderboard,
  getTeamAthleteCounts,
  getOrgAthletesWithTeam,
  getErgScores,
  getOrganizationsForUser,
  updateAthlete,
  updateAthletePerformanceTier,
  updateAthleteSquad,
  type GroupAssignment,
  type AssignmentCompletion,
  type CoachingAthlete,
  type SeasonLeaderboardEntry,
} from '../../services/coaching/coachingService';
import type { OrgTeamGroup } from '../../contexts/coachingContextDef';
import type { CoachingBoating, CoachingSession, UserTeamInfo, TeamRole } from '../../services/coaching/types';
import { format } from 'date-fns';
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from '../../utils/unitConversion';
import { benchmarkCriteriaIndicator, benchmarkTierBadgeClass, benchmarkTierLabel, buildBest2kByAthlete, deriveBenchmarkTier, formatErgTime, type PerformanceTierRubricConfig } from '../../utils/performanceTierRubric';
import { useMeasurementUnits } from '../../hooks/useMeasurementUnits';
import { toast } from 'sonner';

type OrgSessionRow = CoachingSession & { team_name: string };
type OrgAssignmentRow = GroupAssignment & { team_name: string };
type OrgBoatingRow = CoachingBoating & { team_name: string };
type OrgEditableField = 'first_name' | 'last_name' | 'grade' | 'side' | 'experience_level' | 'squad' | 'performance_tier' | 'height_cm' | 'weight_kg';

const experienceLevelLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  experienced: 'Experienced',
  advanced: 'Advanced',
};

const performanceTierLabel: Record<string, string> = {
  pool: 'Pool',
  developmental: 'Developmental',
  challenger: 'Challenger',
  champion: 'Champion',
};

function roleBadge(role: TeamRole) {
  switch (role) {
    case 'coach':
      return <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300"><Shield className="w-2.5 h-2.5" />Coach</span>;
    case 'coxswain':
      return <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Coxswain</span>;
    case 'member':
      return <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-600/40 text-neutral-400">Member</span>;
    default:
      return null;
  }
}

function athleteEditorLabel(athleteName: string, fieldLabel: string): string {
  return `${fieldLabel} for ${athleteName}`;
}

/* ── Org Card ─────────────────────────────────────────────── */

interface OrgCardProps {
  group: OrgTeamGroup;
  activeTeamId: string;
  athleteCounts: Record<string, number>;
  onSelectTeam: (teamId: string) => void;
  onOpenTeam: (teamId: string) => void;
}

const OrgCard: React.FC<OrgCardProps> = ({ group, activeTeamId, athleteCounts, onSelectTeam, onOpenTeam }) => {
  const [expanded, setExpanded] = useState(true);
  const isOrg = group.org_id !== null;
  const totalAthletes = group.teams.reduce((sum, t) => sum + (athleteCounts[t.team_id] ?? 0), 0);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Org Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 hover:bg-neutral-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOrg ? (
            <Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
          ) : (
            <Users className="w-5 h-5 text-neutral-500 shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{group.org_name}</h2>
            <p className="text-xs text-neutral-500">
              {group.teams.length} {group.teams.length === 1 ? 'team' : 'teams'} · {totalAthletes} {totalAthletes === 1 ? 'athlete' : 'athletes'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-neutral-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {/* Team Rows */}
      {expanded && (
        <div className="border-t border-neutral-800">
          {group.teams.map((team: UserTeamInfo) => {
            const isActive = team.team_id === activeTeamId;
            const count = athleteCounts[team.team_id] ?? 0;
            return (
              <button
                type="button"
                key={team.team_id}
                onClick={() => {
                  onSelectTeam(team.team_id);
                  onOpenTeam(team.team_id);
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 sm:px-5 transition-colors text-left ${
                  isActive
                    ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                    : 'hover:bg-neutral-800/40 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${isActive ? 'text-white' : 'text-neutral-200'}`}>
                        {team.team_name}
                      </span>
                      {isActive && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {roleBadge(team.role)}
                      <span className="text-xs text-neutral-500">
                        {count} {count === 1 ? 'athlete' : 'athletes'}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-neutral-600'}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Main Dashboard ───────────────────────────────────────── */

export const CoachDashboard: React.FC = () => {
  const { hasTeam, isLoadingTeam, teamId, orgId, userId, teamName, teams, teamsByOrg, switchTeam, filterTeamId } = useCoachingContext();
  const navigate = useNavigate();
  const units = useMeasurementUnits();
  const isImperial = units === 'imperial';

  const [todayAssignments, setTodayAssignments] = useState<GroupAssignment[]>([]);
  const [completions, setCompletions] = useState<AssignmentCompletion[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<{
    athleteCount: number;
    squadCount: number;
    weeklyCompletionRate: number | null;
    sessionsThisWeek: number;
  } | null>(null);
  const [athleteCounts, setAthleteCounts] = useState<Record<string, number>>({});
  const [orgRoster, setOrgRoster] = useState<CoachingAthlete[]>([]);
  const [orgRosterLoading, setOrgRosterLoading] = useState(false);
  const [showOrgRoster, setShowOrgRoster] = useState(false);
  const [orgSectionsOpen, setOrgSectionsOpen] = useState(true);
  const [teamHierarchyOpen, setTeamHierarchyOpen] = useState(false);
  const [orgRosterSearch, setOrgRosterSearch] = useState('');
  const [orgDataLoading, setOrgDataLoading] = useState(false);
  const [orgSessions, setOrgSessions] = useState<OrgSessionRow[]>([]);
  const [orgAssignments, setOrgAssignments] = useState<OrgAssignmentRow[]>([]);
  const [orgBoatings, setOrgBoatings] = useState<OrgBoatingRow[]>([]);
  const [orgBest2kByAthlete, setOrgBest2kByAthlete] = useState<Record<string, number>>({});
  const [orgRubric, setOrgRubric] = useState<PerformanceTierRubricConfig | null>(null);
  const [seasonLeaderboard, setSeasonLeaderboard] = useState<SeasonLeaderboardEntry[]>([]);
  const [editingCell, setEditingCell] = useState<{ athleteId: string; field: OrgEditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editValue2, setEditValue2] = useState('');
  const [savingCell, setSavingCell] = useState(false);

  // All team IDs for batch athlete count fetch
  const allTeamIds = useMemo(() => teams.map((t) => t.team_id), [teams]);
  const orgTeams = useMemo(
    () => (orgId ? teams.filter((team) => team.org_id === orgId) : []),
    [orgId, teams]
  );
  const currentOrgName = useMemo(() => {
    if (!orgId) return null;
    const fromTeam = teams.find((team) => team.org_id === orgId)?.org_name;
    if (fromTeam) return fromTeam;
    const fromGroup = teamsByOrg.find((group) => group.org_id === orgId)?.org_name;
    return fromGroup ?? 'Organization';
  }, [orgId, teams, teamsByOrg]);
  const teamIdByName = useMemo(() => new Map(teams.map((team) => [team.team_name, team.team_id])), [teams]);

  // The "view" team: when a filter pill is selected, show that team. Otherwise fall back to active team.
  const viewTeamId = filterTeamId ?? teamId;
  const isOrgWideView = filterTeamId === null && orgTeams.length > 1;
  const viewTeamName = isOrgWideView
    ? `${currentOrgName ?? 'Organization'} — All Teams`
    : (teams.find((t) => t.team_id === viewTeamId)?.team_name ?? teamName);

  const handleOpenTeam = useCallback((nextTeamId: string) => {
    switchTeam(nextTeamId);
    navigate('/team-management/roster');
  }, [navigate, switchTeam]);

  // Fetch athlete counts for all teams (single batch query)
  useEffect(() => {
    if (allTeamIds.length === 0) return;
    getTeamAthleteCounts(allTeamIds)
      .then(setAthleteCounts)
      .catch(() => { /* non-critical */ });
  }, [allTeamIds]);

  useEffect(() => {
    if (!userId || !orgId) {
      setOrgRubric(null);
      return;
    }
    getOrganizationsForUser(userId)
      .then((organizations) => {
        const org = organizations.find((o) => o.id === orgId);
        setOrgRubric(org?.performance_tier_rubric ?? null);
      })
      .catch(() => setOrgRubric(null));
  }, [userId, orgId]);

  // Compute org groups with named orgs first, standalone last
  const sortedOrgGroups = useMemo(() => {
    const named = teamsByOrg.filter((g) => g.org_id !== null);
    const standalone = teamsByOrg.filter((g) => g.org_id === null);
    return [...named, ...standalone];
  }, [teamsByOrg]);

  // Fetch org roster when panel is opened
  useEffect(() => {
    if (!showOrgRoster || orgRoster.length > 0) return;
    if (!orgId && !teamId) return;
    setOrgRosterLoading(true);
    const load = orgId
      ? Promise.all([
          getOrgAthletesWithTeam(orgId),
          Promise.all(orgTeams.map((team) => getErgScores(team.team_id))).then((byTeam) => byTeam.flat()),
        ]).then(([athletes, scores]) => ({ athletes, best2k: buildBest2kByAthlete(scores) }))
      : Promise.all([getAthletes(teamId), getErgScores(teamId)]).then(([athletes, scores]) => ({ athletes, best2k: buildBest2kByAthlete(scores) }));
    load
      .then(({ athletes, best2k }) => {
        setOrgRoster(athletes);
        setOrgBest2kByAthlete(best2k);
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setOrgRosterLoading(false));
  }, [showOrgRoster, orgRoster.length, orgId, teamId, orgTeams]);

  // Group org roster by team name, with search filter
  const groupedOrgRoster = useMemo(() => {
    const q = orgRosterSearch.toLowerCase().trim();
    const filtered = q
      ? orgRoster.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.squad && a.squad.toLowerCase().includes(q)) ||
            (a.team_name && a.team_name.toLowerCase().includes(q)) ||
            (a.side && a.side.toLowerCase().includes(q))
        )
      : orgRoster;

    const groups = new Map<string, CoachingAthlete[]>();
    for (const a of filtered) {
      const key = a.team_name ?? teamName ?? 'Team';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return groups;
  }, [orgRoster, orgRosterSearch, teamName]);

  const filteredOrgRosterCount = useMemo(
    () => [...groupedOrgRoster.values()].reduce((sum, arr) => sum + arr.length, 0),
    [groupedOrgRoster]
  );

  const startEditingCell = useCallback((athlete: CoachingAthlete, field: OrgEditableField) => {
    setEditingCell({ athleteId: athlete.id, field });
    setEditValue('');
    setEditValue2('');
    if (field === 'height_cm') {
      if (athlete.height_cm == null) return;
      if (isImperial) {
        const { feet, inches } = cmToFtIn(athlete.height_cm);
        setEditValue(String(feet));
        setEditValue2(String(inches));
      } else {
        setEditValue(String(athlete.height_cm));
      }
      return;
    }
    if (field === 'weight_kg') {
      if (athlete.weight_kg == null) return;
      setEditValue(String(isImperial ? kgToLbs(athlete.weight_kg) : athlete.weight_kg));
      return;
    }
    const raw = athlete[field];
    setEditValue(raw == null ? '' : String(raw));
  }, [isImperial]);

  const isEditingCell = useCallback((athleteId: string, field: OrgEditableField) => (
    editingCell?.athleteId === athleteId && editingCell?.field === field
  ), [editingCell]);

  const commitEditingCell = useCallback(async (valueOverride?: string) => {
    if (!editingCell || savingCell) return;
    const athlete = orgRoster.find((a) => a.id === editingCell.athleteId);
    if (!athlete) return;
    const field = editingCell.field;
    const resolvedValue = valueOverride ?? editValue;
    const resolvedTeamId = athlete.team_id ?? (athlete.team_name ? teamIdByName.get(athlete.team_name) : null);
    const nextOrgRoster = [...orgRoster];
    const idx = nextOrgRoster.findIndex((a) => a.id === athlete.id);
    if (idx < 0) return;

    try {
      setSavingCell(true);
      if (field === 'squad') {
        if (!resolvedTeamId) throw new Error('Unable to resolve team for squad update.');
        const squad = resolvedValue.trim() || null;
        nextOrgRoster[idx] = { ...nextOrgRoster[idx], squad };
        setOrgRoster(nextOrgRoster);
        await updateAthleteSquad(resolvedTeamId, athlete.id, squad);
      } else if (field === 'performance_tier') {
        if (!resolvedTeamId) throw new Error('Unable to resolve team for tier update.');
        const tier = (resolvedValue.trim() || null) as CoachingAthlete['performance_tier'];
        nextOrgRoster[idx] = { ...nextOrgRoster[idx], performance_tier: tier };
        setOrgRoster(nextOrgRoster);
        await updateAthletePerformanceTier(resolvedTeamId, athlete.id, tier ?? null);
      } else if (field === 'height_cm') {
        const height_cm = isImperial
          ? ((resolvedValue || editValue2) ? ftInToCm(Number(resolvedValue) || 0, Number(editValue2) || 0) : null)
          : (resolvedValue ? Number(resolvedValue) : null);
        nextOrgRoster[idx] = { ...nextOrgRoster[idx], height_cm };
        setOrgRoster(nextOrgRoster);
        await updateAthlete(athlete.id, { height_cm: height_cm ?? null });
      } else if (field === 'weight_kg') {
        const weight_kg = resolvedValue ? (isImperial ? lbsToKg(Number(resolvedValue)) : Number(resolvedValue)) : null;
        nextOrgRoster[idx] = { ...nextOrgRoster[idx], weight_kg };
        setOrgRoster(nextOrgRoster);
        await updateAthlete(athlete.id, { weight_kg: weight_kg ?? null });
      } else {
        const value = resolvedValue.trim();
        const normalized = value || (field === 'first_name' ? athlete.first_name : field === 'last_name' ? athlete.last_name : undefined);
        const updates = { [field]: normalized } as Partial<Pick<CoachingAthlete, 'first_name' | 'last_name' | 'grade' | 'side' | 'experience_level'>>;
        nextOrgRoster[idx] = {
          ...nextOrgRoster[idx],
          [field]: normalized,
          name: `${field === 'first_name' ? normalized : nextOrgRoster[idx].first_name} ${field === 'last_name' ? normalized : nextOrgRoster[idx].last_name}`.trim(),
        };
        setOrgRoster(nextOrgRoster);
        await updateAthlete(athlete.id, updates);
      }
      setEditingCell(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save athlete update');
      setOrgRoster((prev) => prev.map((a) => (a.id === athlete.id ? athlete : a)));
    } finally {
      setSavingCell(false);
    }
  }, [editingCell, editValue, editValue2, isImperial, orgRoster, savingCell, teamIdByName]);

  const groupedOrgSessions = useMemo(() => {
    const groups = new Map<string, OrgSessionRow[]>();
    for (const row of orgSessions) {
      const key = row.team_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return groups;
  }, [orgSessions]);

  const groupedOrgAssignments = useMemo(() => {
    const groups = new Map<string, OrgAssignmentRow[]>();
    for (const row of orgAssignments) {
      const key = row.team_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return groups;
  }, [orgAssignments]);

  const groupedOrgBoatings = useMemo(() => {
    const groups = new Map<string, OrgBoatingRow[]>();
    for (const row of orgBoatings) {
      const key = row.team_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return groups;
  }, [orgBoatings]);

  useEffect(() => {
    if (!viewTeamId && !orgId) return;

    // Reset state so stale data from previous team doesn't linger
    setTodayLoading(true);
    setTodayAssignments([]);
    setCompletions([]);
    setTeamStats(null);
    setSeasonLeaderboard([]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    if (isOrgWideView && orgId && orgTeams.length > 0) {
      // Org-wide: aggregate across all teams
      Promise.all(
        orgTeams.map(async (team) => {
          const [asgn, athletes] = await Promise.all([
            getAssignmentsForDate(team.team_id, todayStr, orgId),
            getAthletes(team.team_id),
          ]);
          const comps = await getAssignmentCompletions(team.team_id, todayStr, athletes, orgId);
          const stats = await getTeamStats(team.team_id);
          const lb = await getSeasonMeasuredLeaderboard(team.team_id, { limit: 10, orgId });
          return { asgn, comps, stats, lb };
        })
      )
        .then((results) => {
          // Merge assignments (deduplicate by id for org-wide ones)
          const seenIds = new Set<string>();
          const mergedAsgn: GroupAssignment[] = [];
          for (const r of results) {
            for (const a of r.asgn) {
              if (!seenIds.has(a.id)) { seenIds.add(a.id); mergedAsgn.push(a); }
            }
          }
          setTodayAssignments(mergedAsgn);

          // Merge completions
          const seenCompIds = new Set<string>();
          const mergedComps: AssignmentCompletion[] = [];
          for (const r of results) {
            for (const c of r.comps) {
              const key = `${c.group_assignment_id}`;
              if (!seenCompIds.has(key)) { seenCompIds.add(key); mergedComps.push(c); }
            }
          }
          setCompletions(mergedComps);

          // Aggregate stats
          const aggStats = results.reduce(
            (acc, r) => {
              if (!r.stats) return acc;
              return {
                athleteCount: acc.athleteCount + r.stats.athleteCount,
                squadCount: acc.squadCount + r.stats.squadCount,
                sessionsThisWeek: acc.sessionsThisWeek + r.stats.sessionsThisWeek,
                weeklyCompletionRate: null as number | null,
              };
            },
            { athleteCount: 0, squadCount: 0, sessionsThisWeek: 0, weeklyCompletionRate: null as number | null }
          );
          // Average completion rates
          const rates = results.map((r) => r.stats?.weeklyCompletionRate).filter((r): r is number => r != null);
          aggStats.weeklyCompletionRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
          setTeamStats(aggStats);

          // Merge + re-sort leaderboard by composite rank (take top 5)
          const allLb = results.flatMap((r) => r.lb);
          const lbMap = new Map<string, SeasonLeaderboardEntry>();
          for (const entry of allLb) {
            if (!lbMap.has(entry.athlete_id) || (entry.composite_rank ?? 999) < (lbMap.get(entry.athlete_id)!.composite_rank ?? 999)) {
              lbMap.set(entry.athlete_id, entry);
            }
          }
          const mergedLb = [...lbMap.values()].sort((a, b) => (a.composite_rank ?? 999) - (b.composite_rank ?? 999)).slice(0, 5);
          setSeasonLeaderboard(mergedLb);
        })
        .catch(() => { /* non-critical dashboard card */ })
        .finally(() => setTodayLoading(false));
    } else if (viewTeamId) {
      // Single team view
      Promise.all([
        getAssignmentsForDate(viewTeamId, todayStr, orgId ?? undefined),
        getAthletes(viewTeamId).then((athletes: CoachingAthlete[]) =>
          getAssignmentCompletions(viewTeamId, todayStr, athletes, orgId ?? undefined)
        ),
        getTeamStats(viewTeamId),
        getSeasonMeasuredLeaderboard(viewTeamId, { limit: 5, orgId: orgId ?? undefined }),
      ])
        .then(([asgn, comps, stats, leaderboard]) => {
          setTodayAssignments(asgn);
          setCompletions(comps);
          setTeamStats(stats);
          setSeasonLeaderboard(leaderboard);
        })
        .catch(() => { /* non-critical dashboard card */ })
        .finally(() => setTodayLoading(false));
    } else {
      setTodayLoading(false);
    }
  }, [viewTeamId, orgId, isOrgWideView, orgTeams]);

  useEffect(() => {
    if (!orgId || orgTeams.length === 0) {
      setOrgSessions([]);
      setOrgAssignments([]);
      setOrgBoatings([]);
      return;
    }

    let cancelled = false;
    setOrgDataLoading(true);

    Promise.all(
      orgTeams.map(async (team) => {
        const [sessions, assignments, boatings] = await Promise.all([
          getSessions(team.team_id),
          getGroupAssignments(team.team_id, { orgId }),
          getBoatings(team.team_id),
        ]);
        return { teamName: team.team_name, sessions, assignments, boatings };
      })
    )
      .then((rows) => {
        if (cancelled) return;

        const assignmentSeen = new Set<string>();
        const mergedAssignments: OrgAssignmentRow[] = [];

        for (const row of rows) {
          for (const assignment of row.assignments) {
            if (assignmentSeen.has(assignment.id)) continue;
            assignmentSeen.add(assignment.id);
            mergedAssignments.push({
              ...assignment,
              team_name: assignment.team_id ? row.teamName : `${currentOrgName ?? 'Organization'}-wide`,
            });
          }
        }

        setOrgSessions(
          rows
            .flatMap((row) => row.sessions.map((session) => ({ ...session, team_name: row.teamName })))
            .sort((a, b) => b.date.localeCompare(a.date))
        );
        setOrgAssignments(
          mergedAssignments.sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
        );
        setOrgBoatings(
          rows
            .flatMap((row) => row.boatings.map((boating) => ({ ...boating, team_name: row.teamName })))
            .sort((a, b) => b.date.localeCompare(a.date))
        );
      })
      .catch(() => {
        if (cancelled) return;
        setOrgSessions([]);
        setOrgAssignments([]);
        setOrgBoatings([]);
      })
      .finally(() => {
        if (!cancelled) setOrgDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentOrgName, orgId, orgTeams]);

  if (isLoadingTeam) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  // No team yet — send to onboarding
  if (hasTeam === false) {
    return <Navigate to="/team-management/setup" replace />;
  }

  return (
    <>
      <CoachingNav />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* ── Page Header ──────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-neutral-400 mt-1">Your organizations, teams, and coaching tools.</p>
            </div>
            <Link
              to="/team-management/setup"
              className="self-start flex items-center gap-1.5 px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Team</span>
            </Link>
          </div>
        </div>

      {/* ── Active Team Section ───────────────────────────── */}
      {teamId && (
        <>
          {orgId && (
            <div className="mb-8">
              <button
                onClick={() => setOrgSectionsOpen((v) => !v)}
                className="w-full flex items-center gap-2 mb-4 text-left group"
              >
                {orgSectionsOpen
                  ? <ChevronDown className="w-4 h-4 text-neutral-500" />
                  : <ChevronRight className="w-4 h-4 text-neutral-500" />}
                <span className="text-sm font-semibold uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors">
                  {currentOrgName} Overview
                </span>
                <div className="h-px flex-1 bg-neutral-800" />
              </button>
              {orgSectionsOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Schedule summary card */}
                <Link to="/team-management/schedule" className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Schedule</h3>
                    <Calendar className="w-4 h-4 text-neutral-600 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  {orgDataLoading ? (
                    <div className="flex items-center gap-2 text-neutral-500 text-xs"><Loader2 className="w-4 h-4 animate-spin" /><span>Loading schedule…</span></div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-white">{[...groupedOrgSessions.values()].reduce((n, r) => n + r.length, 0)}</div>
                      <p className="text-xs text-neutral-500 mt-1">sessions this week · {groupedOrgSessions.size} team{groupedOrgSessions.size !== 1 ? 's' : ''}</p>
                    </>
                  )}
                </Link>

                {/* Assignments summary card */}
                <Link to="/team-management/assignments" className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Team Workouts</h3>
                    <ClipboardList className="w-4 h-4 text-neutral-600 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  {orgDataLoading ? (
                    <div className="flex items-center gap-2 text-neutral-500 text-xs"><Loader2 className="w-4 h-4 animate-spin" /><span>Loading workouts…</span></div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-white">{[...groupedOrgAssignments.values()].reduce((n, r) => n + r.length, 0)}</div>
                      <p className="text-xs text-neutral-500 mt-1">workouts · {groupedOrgAssignments.size} team{groupedOrgAssignments.size !== 1 ? 's' : ''}</p>
                    </>
                  )}
                </Link>

                {/* Boatings summary card */}
                <Link to="/team-management/boatings" className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Boatings</h3>
                    <RowingShellIcon className="w-4 h-4 text-neutral-600 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  {orgDataLoading ? (
                    <div className="flex items-center gap-2 text-neutral-500 text-xs"><Loader2 className="w-4 h-4 animate-spin" /><span>Loading boatings…</span></div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-white">{[...groupedOrgBoatings.values()].reduce((n, r) => n + r.length, 0)}</div>
                      <p className="text-xs text-neutral-500 mt-1">boatings · {groupedOrgBoatings.size} team{groupedOrgBoatings.size !== 1 ? 's' : ''}</p>
                    </>
                  )}
                </Link>
              </div>
              )}
            </div>
          )}

          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 shrink-0">
              {viewTeamName} — Quick View
            </span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          {/* Weekly Focus */}
          <div className="mb-6">
            <WeeklyFocusCard teamId={viewTeamId || teamId} userId={userId} />
          </div>

          {/* Team Stats */}
          {teamStats && (
            <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{teamStats.athleteCount}</div>
                <div className="text-xs text-neutral-500 mt-1 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" />
                  Athletes
                </div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{teamStats.squadCount}</div>
                <div className="text-xs text-neutral-500 mt-1">Squads</div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{teamStats.sessionsThisWeek}</div>
                <div className="text-xs text-neutral-500 mt-1 flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Sessions this week
                </div>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
                {teamStats.weeklyCompletionRate !== null ? (
                  <>
                    <div className={`text-2xl font-bold ${
                      teamStats.weeklyCompletionRate >= 80 ? 'text-green-400' :
                      teamStats.weeklyCompletionRate >= 50 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {teamStats.weeklyCompletionRate}%
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 flex items-center justify-center gap-1">
                      <Activity className="w-3 h-3" />
                      Weekly completion
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-neutral-600">—</div>
                    <div className="text-xs text-neutral-500 mt-1">No workouts</div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-300">Season Leaderboard</h3>
                  <p className="mt-1 text-[11px] text-neutral-500">Lead with Speed Index here, then open Analytics for rank breakdown and recent workout context.</p>
                </div>
                <Link to="/team-management/analytics" className="text-xs text-indigo-400 hover:text-indigo-300">Open Analytics →</Link>
              </div>
              {seasonLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {seasonLeaderboard.map((row, idx) => {
                  return (
                    <div key={row.athlete_id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${idx < 3 ? 'bg-neutral-800 text-white border border-neutral-700' : 'bg-neutral-900 text-neutral-300 border border-neutral-800'}`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-neutral-100 truncate">{row.athlete_name}</div>
                          <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
                            {[row.squad, row.performance_tier].filter(Boolean).join(' · ') || 'No squad or tier'}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Speed Index</div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-white">{row.titan_index != null ? row.titan_index.toFixed(1) : '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <p className="text-sm text-neutral-500">No completed workouts with scores yet.</p>
              )}
            </div>

          {/* Today's Workouts Card */}
          {!todayLoading && (
            <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-neutral-100">Today&apos;s Workouts</h2>
                </div>
                <Link
                  to="/team-management/assignments"
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  View all →
                </Link>
              </div>
              {todayAssignments.length > 0 ? (
                todayAssignments.map((a) => {
                  const comp = completions.find((c) => c.group_assignment_id === a.id);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-200 truncate">
                          {a.title || a.template_name || 'Workout'}
                        </div>
                        {a.training_zone && (
                          <span className="text-xs text-emerald-400">{a.training_zone}</span>
                        )}
                        {a.canonical_name && (
                          <span className="text-xs text-neutral-500 ml-2 font-mono">{a.canonical_name}</span>
                        )}
                        {a.instructions && (
                          <p className="text-xs text-neutral-500 mt-0.5 truncate">{a.instructions}</p>
                        )}
                      </div>
                      {comp && (
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          {comp.completed === comp.total ? (
                            <span className="flex items-center gap-1 text-sm text-green-400">
                              <CheckCircle2 className="w-4 h-4" />
                              All done
                            </span>
                          ) : (
                            <Link
                              to="/team-management/roster"
                              className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
                            >
                              <XCircle className="w-4 h-4" />
                              {comp.completed}/{comp.total}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-neutral-500">No workouts scheduled for today.</p>
              )}
            </div>
          )}
        </>
      )}


        {/* ── Org Roster Table ──────────────────────────────── */}
      <div id="org-roster" className="mb-8 scroll-mt-24">
        <button
          type="button"
          onClick={() => setShowOrgRoster((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:bg-neutral-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white">
                {orgId ? `${currentOrgName} Roster` : 'Team Roster'}
              </h2>
              <p className="text-xs text-neutral-500">
                {orgRoster.length > 0
                  ? `${orgRoster.length} athlete${orgRoster.length !== 1 ? 's' : ''} across all teams`
                  : 'View all athletes in one table'}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-neutral-500">
            {showOrgRoster ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {showOrgRoster && (
          <div className="mt-2 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-neutral-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={orgRosterSearch}
                  onChange={(e) => setOrgRosterSearch(e.target.value)}
                  aria-label="Search roster"
                  title="Search roster"
                  placeholder="Search by name, squad, team, or side…"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              {orgRosterSearch && (
                <p className="text-xs text-neutral-500 mt-1.5 px-1">
                  {filteredOrgRosterCount} result{filteredOrgRosterCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {orgRosterLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            ) : orgRoster.length === 0 ? (
              <div className="py-10 text-center text-neutral-500 text-sm">No athletes found</div>
            ) : (
              <div className="divide-y divide-neutral-800">
                {[...groupedOrgRoster.entries()].map(([groupTeamName, athletes]) => (
                  <div key={groupTeamName}>
                    {/* Team sub-header — only when org-level with multiple teams */}
                    {orgId && groupedOrgRoster.size > 1 && (
                      <div className="px-4 py-2 bg-neutral-800/50 text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{groupTeamName}</span>
                        <span className="text-neutral-500 font-normal normal-case">
                          {athletes.length} athlete{athletes.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-neutral-500 uppercase tracking-wider bg-neutral-900/50">
                        <tr>
                          <th className="px-3 py-2 text-left">First</th>
                          <th className="px-3 py-2 text-left">Last</th>
                          <th className="px-3 py-2 text-left">Squad</th>
                          <th className="px-3 py-2 text-left">Grade</th>
                          <th className="px-3 py-2 text-left">Side</th>
                          <th className="px-3 py-2 text-left">Experience</th>
                          <th className="px-3 py-2 text-left">Tier</th>
                          <th className="px-3 py-2 text-left">{isImperial ? "Height (ft')" : 'Height (cm)'}</th>
                          <th className="px-3 py-2 text-left">{isImperial ? 'Weight (lb)' : 'Weight (kg)'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/50">
                        {athletes.map((a) => (
                          <tr key={`${a.id}-${groupTeamName}`} className="hover:bg-neutral-800/30 transition-colors">
                            <td className="px-3 py-2.5 text-white font-medium cursor-pointer" onClick={() => startEditingCell(a, 'first_name')}>
                              {isEditingCell(a.id, 'first_name') ? (
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => commitEditingCell()}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void commitEditingCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                  aria-label={athleteEditorLabel(a.name, 'First name')}
                                  title={athleteEditorLabel(a.name, 'First name')}
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                />
                              ) : (a.first_name || '—')}
                            </td>
                            <td className="px-3 py-2.5 text-white font-medium cursor-pointer" onClick={() => startEditingCell(a, 'last_name')}>
                              {isEditingCell(a.id, 'last_name') ? (
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => commitEditingCell()}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void commitEditingCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                  aria-label={athleteEditorLabel(a.name, 'Last name')}
                                  title={athleteEditorLabel(a.name, 'Last name')}
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                />
                              ) : (a.last_name || '—')}
                            </td>
                            <td className="px-3 py-2.5 cursor-pointer" onClick={() => startEditingCell(a, 'squad')}>
                              {isEditingCell(a.id, 'squad') ? (
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => commitEditingCell()}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void commitEditingCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                  aria-label={athleteEditorLabel(a.name, 'Squad')}
                                  title={athleteEditorLabel(a.name, 'Squad')}
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                />
                              ) : a.squad ? (
                                <span className="inline-block px-2 py-0.5 text-xs font-medium bg-indigo-500/10 text-indigo-400 rounded-full">{a.squad}</span>
                              ) : <span className="text-neutral-600">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-neutral-300 cursor-pointer" onClick={() => startEditingCell(a, 'grade')}>
                              {isEditingCell(a.id, 'grade') ? (
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => commitEditingCell()}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void commitEditingCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                  aria-label={athleteEditorLabel(a.name, 'Grade')}
                                  title={athleteEditorLabel(a.name, 'Grade')}
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                />
                              ) : (a.grade || '—')}
                            </td>
                            <td className="px-3 py-2.5 text-neutral-300 cursor-pointer capitalize" onClick={() => startEditingCell(a, 'side')}>
                              {isEditingCell(a.id, 'side') ? (
                                <select
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => { setEditValue(e.target.value); commitEditingCell(e.target.value); }}
                                  onBlur={() => commitEditingCell()}
                                  aria-label={athleteEditorLabel(a.name, 'Side')}
                                  title={athleteEditorLabel(a.name, 'Side')}
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                >
                                  <option value="">—</option>
                                  <option value="port">Port</option>
                                  <option value="starboard">Starboard</option>
                                  <option value="both">Both</option>
                                  <option value="coxswain">Coxswain</option>
                                </select>
                              ) : (a.side || '—')}
                            </td>
                            <td className="px-3 py-2.5 cursor-pointer" onClick={() => startEditingCell(a, 'experience_level')}>
                              {isEditingCell(a.id, 'experience_level') ? (
                                <select
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => { setEditValue(e.target.value); commitEditingCell(e.target.value); }}
                                  onBlur={() => commitEditingCell()}
                                  aria-label={athleteEditorLabel(a.name, 'Experience level')}
                                  title={athleteEditorLabel(a.name, 'Experience level')}
                                  className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                >
                                  <option value="">—</option>
                                  <option value="beginner">Beginner</option>
                                  <option value="intermediate">Intermediate</option>
                                  <option value="experienced">Experienced</option>
                                  <option value="advanced">Advanced</option>
                                </select>
                              ) : (
                                <span className="text-neutral-300">{a.experience_level ? experienceLevelLabel[a.experience_level] : '—'}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="space-y-1">
                                {(() => {
                                  const best2k = orgBest2kByAthlete[a.id] ?? null;
                                  const benchmarkTier = deriveBenchmarkTier(a.squad ?? null, best2k, orgRubric);
                                  const criteria = benchmarkCriteriaIndicator(a.squad ?? null, best2k, 0.02, orgRubric);
                                  if (!benchmarkTier && !a.performance_tier && best2k == null) return <span className="text-neutral-300">—</span>;
                                  return (
                                    <>
                                      {benchmarkTier ? (
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${benchmarkTierBadgeClass(benchmarkTier)}`}>
                                          {benchmarkTierLabel(benchmarkTier)}
                                        </span>
                                      ) : (
                                        <span className="text-neutral-300">
                                          {a.performance_tier ? performanceTierLabel[a.performance_tier] : 'Needs squad mapping'}
                                        </span>
                                      )}
                                      {best2k != null && <div className="text-[10px] text-neutral-500">Best 2k: {formatErgTime(best2k)}</div>}
                                      {criteria && <div className={`text-[10px] ${criteria.className}`}>{criteria.text}</div>}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-neutral-300 cursor-pointer" onClick={() => startEditingCell(a, 'height_cm')}>
                              {isEditingCell(a.id, 'height_cm') ? (
                                isImperial ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      autoFocus
                                      type="number"
                                      min={0}
                                      max={8}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={() => commitEditingCell()}
                                      aria-label={athleteEditorLabel(a.name, 'Height feet')}
                                      title={athleteEditorLabel(a.name, 'Height feet')}
                                      className="w-12 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                    />
                                    <span className="text-neutral-500">ft</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={11}
                                      value={editValue2}
                                      onChange={(e) => setEditValue2(e.target.value)}
                                      onBlur={() => commitEditingCell()}
                                      aria-label={athleteEditorLabel(a.name, 'Height inches')}
                                      title={athleteEditorLabel(a.name, 'Height inches')}
                                      className="w-12 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                    />
                                    <span className="text-neutral-500">in</span>
                                  </div>
                                ) : (
                                  <input
                                    autoFocus
                                    type="number"
                                    min={0}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => commitEditingCell()}
                                    onKeyDown={(e) => { if (e.key === 'Enter') void commitEditingCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                    aria-label={athleteEditorLabel(a.name, 'Height in centimeters')}
                                    title={athleteEditorLabel(a.name, 'Height in centimeters')}
                                    className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                  />
                                )
                              ) : (
                                a.height_cm != null ? (isImperial ? cmToFtIn(a.height_cm).display : `${a.height_cm} cm`) : '—'
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-neutral-300 cursor-pointer" onClick={() => startEditingCell(a, 'weight_kg')}>
                              {isEditingCell(a.id, 'weight_kg') ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min={0}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => commitEditingCell()}
                                  onKeyDown={(e) => { if (e.key === 'Enter') void commitEditingCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                  aria-label={athleteEditorLabel(a.name, isImperial ? 'Weight in pounds' : 'Weight in kilograms')}
                                  title={athleteEditorLabel(a.name, isImperial ? 'Weight in pounds' : 'Weight in kilograms')}
                                  className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-white"
                                />
                              ) : (
                                a.weight_kg != null ? (isImperial ? `${kgToLbs(a.weight_kg)} lb` : `${a.weight_kg} kg`) : '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Org / Team Hierarchy ──────────────────────────── */}
      <div className="mb-8 space-y-4">
        <button
          onClick={() => setTeamHierarchyOpen((v) => !v)}
          className="w-full flex items-center gap-2 text-left group"
        >
          {teamHierarchyOpen
            ? <ChevronDown className="w-4 h-4 text-neutral-500" />
            : <ChevronRight className="w-4 h-4 text-neutral-500" />}
          <span className="text-sm font-semibold uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {orgId ? `${currentOrgName} & Teams` : 'Organizations & Teams'}
          </span>
          <div className="h-px flex-1 bg-neutral-800" />
        </button>
        {teamHierarchyOpen && sortedOrgGroups.map((group) => (
          <OrgCard
            key={group.org_id ?? '__standalone'}
            group={group}
            activeTeamId={teamId}
            athleteCounts={athleteCounts}
            onSelectTeam={switchTeam}
            onOpenTeam={handleOpenTeam}
          />
        ))}
      </div>

      {/* ── Coaching Access Requests (admin) ──── */}
      <div className="mt-8">
        <PendingCoachingRequests />
      </div>
    </div>
    </>
  );
};

