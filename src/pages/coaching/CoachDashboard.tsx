import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { WeeklyFocusCard } from '../../components/coaching/WeeklyFocusCard';
import { PendingCoachingRequests } from '../../components/coaching/PendingCoachingRequests';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  getAssignmentsForDate, getAssignmentCompletions, getAthletes, getTeamStats,
  getSeasonMeasuredLeaderboard,
  type GroupAssignment, type AssignmentCompletion, type SeasonLeaderboardEntry,
} from '../../services/coaching/coachingService';

type TeamStats = Awaited<ReturnType<typeof getTeamStats>>;
interface OverviewData {
  stats: TeamStats;
  assignments: GroupAssignment[];
  completions: AssignmentCompletion[];
  leaderboard: SeasonLeaderboardEntry[];
}
interface OverviewProps {
  teamIds: string[];
  selectedTeamId: string | null;
  orgId: string | null;
  userId: string;
}
const actionClass = 'inline-flex min-h-11 items-center text-sm font-medium text-accent-coaching hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';

function DashboardOverview({ teamIds, selectedTeamId, orgId, userId }: OverviewProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const today = format(new Date(), 'yyyy-MM-dd');
    async function load() {
      try {
        const results = await Promise.all(teamIds.map(async teamId => {
          const [assignments, athletes, stats] = await Promise.all([
            getAssignmentsForDate(teamId, today, orgId ?? undefined),
            getAthletes(teamId), getTeamStats(teamId),
          ]);
          const completions = await getAssignmentCompletions(teamId, today, athletes, orgId ?? undefined);
          return { assignments, athletes, stats, completions };
        }));
        const leaderboard = selectedTeamId
          ? await getSeasonMeasuredLeaderboard(selectedTeamId, { limit: 5, orgId: orgId ?? undefined })
          : [];
        if (cancelled) return;
        // Club assignments appear in each team's response. Their completion summaries
        // already include every assigned athlete, so retain each summary once.
        const assignments = [...new Map(results.flatMap(r => r.assignments).map(a => [a.id, a])).values()];
        const completions = [...new Map(results.flatMap(r => r.completions).map(c => [c.group_assignment_id, c])).values()];
        const stats = selectedTeamId ? results[0].stats : {
          athleteCount: new Set(results.flatMap(r => r.athletes.map(a => a.id))).size,
          squadCount: results.reduce((sum, r) => sum + r.stats.squadCount, 0),
          sessionsThisWeek: results.reduce((sum, r) => sum + r.stats.sessionsThisWeek, 0),
          weeklyCompletionRate: null,
        };
        setData({ stats, assignments, completions, leaderboard });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [teamIds, selectedTeamId, orgId, attempt]);

  if (failed) return (
    <Card>
      <div role="alert">
        <EmptyState title="Unable to load this overview"
          description="Check your connection and try again. No dashboard totals are available until loading succeeds."
          action={<Button variant="secondary" className="min-h-11" onClick={() => { setFailed(false); setData(null); setAttempt(value => value + 1); }}>Retry</Button>} />
      </div>
    </Card>
  );
  if (!data) return <div role="status" className="flex items-center gap-2 py-10 text-content-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Loading overview…</div>;

  const stats = [
    { label: 'Athletes', value: data.stats.athleteCount, link: '/team-management/roster' },
    { label: 'Squads', value: data.stats.squadCount },
    { label: 'Sessions this week', value: data.stats.sessionsThisWeek, link: '/team-management/schedule' },
    selectedTeamId
      ? { label: 'Weekly completion', value: data.stats.weeklyCompletionRate === null ? '—' : `${data.stats.weeklyCompletionRate}%`, detail: data.stats.weeklyCompletionRate === null ? 'No completion data this week' : undefined }
      : { label: 'Teams', value: teamIds.length },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(stat => <Card key={stat.label} data-stat={stat.label}>
          <div className="text-2xl font-semibold text-content-primary">{stat.value}</div>
          {stat.link ? <Link to={stat.link} className={actionClass}>{stat.label}</Link> : <div className="mt-2 text-sm text-content-secondary">{stat.label}</div>}
          {stat.detail && <p className="mt-1 text-xs text-content-muted">{stat.detail}</p>}
        </Card>)}
      </div>
      <Card>
        <CardHeader title="Today's Workouts" subtitle="Completion across each workout's assigned athletes."
          action={<Link to="/team-management/assignments" className={actionClass}>View all</Link>} />
        {data.assignments.length === 0
          ? <EmptyState title="No workouts scheduled for today." description="Open Workouts to plan your next session." />
          : <div className="space-y-3">{data.assignments.map(assignment => {
            const completion = data.completions.find(c => c.group_assignment_id === assignment.id);
            return <div key={assignment.id} className="flex flex-col gap-2 rounded-lg bg-surface-secondary p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium text-content-primary">{assignment.title || assignment.template_name || 'Workout'}</p>
                {(assignment.training_zone || assignment.canonical_name) && <p className="mt-1 break-words text-xs text-content-muted">{[assignment.training_zone, assignment.canonical_name].filter(Boolean).join(' · ')}</p>}
                {assignment.instructions && <p className="mt-1 break-words text-sm text-content-secondary">{assignment.instructions}</p>}
              </div>
              <p className="shrink-0 text-sm text-content-secondary">{completion
                ? completion.total === 0 ? 'No athletes assigned' : `${completion.completed}/${completion.total} complete`
                : 'Completion unavailable'}</p>
            </div>;
          })}</div>}
      </Card>
      {selectedTeamId && <>
        <WeeklyFocusCard teamId={selectedTeamId} userId={userId} />
        <Card>
          <CardHeader title="Season Leaderboard" subtitle="Speed Index preview for this team."
            action={<Link to="/team-management/analytics" className={actionClass}>Analytics</Link>} />
          {data.leaderboard.length === 0
            ? <EmptyState title="No completed workouts with scores yet." />
            : <ol className="space-y-2">{data.leaderboard.map((athlete, index) => <li key={athlete.athlete_id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-secondary p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-content-primary">{index + 1}. {athlete.athlete_name}</p>
                <p className="mt-1 text-xs text-content-muted">{[athlete.squad, athlete.performance_tier].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="shrink-0 text-right"><p className="text-xs text-content-muted">Speed Index</p><p className="font-mono text-content-primary">{athlete.titan_index?.toFixed(1) ?? '—'}</p></div>
            </li>)}</ol>}
        </Card>
      </>}
    </div>
  );
}

export function CoachDashboard() {
  const { hasTeam, isLoadingTeam, teamId, orgId, userId, teamName, teams, teamsByOrg, filterTeamId } = useCoachingContext();
  const selectedTeamId = orgId && filterTeamId === null ? null : filterTeamId ?? teamId;
  const teamIds = useMemo(() => selectedTeamId ? [selectedTeamId] : teams.filter(team => team.org_id === orgId).map(team => team.team_id), [selectedTeamId, teams, orgId]);
  const clubName = teams.find(team => team.org_id === orgId)?.org_name ?? teamsByOrg.find(group => group.org_id === orgId)?.org_name ?? 'Club';
  const scopeName = selectedTeamId ? teams.find(team => team.team_id === selectedTeamId)?.team_name ?? teamName : `${clubName} · All Teams`;

  if (isLoadingTeam || hasTeam === null) return <div role="status" className="p-6 text-content-muted">Loading coaching workspace…</div>;
  if (!hasTeam) return <Navigate to="/team-management/setup" replace />;
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
    <CoachingNav />
    <header className="mb-6 mt-6"><h1 className="text-2xl font-semibold text-content-primary">Dashboard</h1><p className="mt-1 text-sm text-content-secondary">{scopeName}</p></header>
    <DashboardOverview key={`${userId}:${orgId}:${selectedTeamId ?? 'all'}:${teamIds.join(',')}`} teamIds={teamIds} selectedTeamId={selectedTeamId} orgId={orgId} userId={userId} />
    <div className="mt-6"><PendingCoachingRequests /></div>
  </div>;
}
