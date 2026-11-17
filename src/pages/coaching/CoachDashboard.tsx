import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { ClubTeamOverview } from '../../components/coaching/ClubTeamOverview';
import { DashboardEvents, DashboardSeason } from '../../components/coaching/DashboardContext';
import { WeeklyFocusSummary } from '../../components/coaching/WeeklyFocusSummary';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { getDashboardPractices, getDashboardRoster, getDashboardWorkouts, type DashboardScope } from '../../services/coaching/teamDashboardService';

const actionClass = 'inline-flex min-h-11 items-center text-sm font-medium text-accent-coaching hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';

/** Each section retries independently. Cleanup prevents an obsolete request from updating a new scope. */
function useDashboardSection<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; failed: boolean }>({ data: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, failed: false });
    load().then(data => { if (!cancelled) setState({ data, failed: false }); })
      .catch(() => { if (!cancelled) setState({ data: null, failed: true }); });
    return () => { cancelled = true; };
  }, [load, attempt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}

function SectionContent<T>({ section, name, children }: {
  section: ReturnType<typeof useDashboardSection<T>>; name: string; children: (data: T) => ReactNode;
}) {
  if (section.failed) return <div role="alert" className="space-y-2 py-3">
    <p className="text-sm text-content-secondary">Unable to load {name}. Check your connection and retry.</p>
    <Button variant="secondary" className="min-h-11" onClick={section.retry}>Retry {name}</Button>
  </div>;
  if (section.data === null) return <p role="status" className="flex items-center gap-2 py-5 text-sm text-content-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading {name}…</p>;
  return children(section.data);
}

function TodayOverview({ scope, selectedTeamId, userId }: { scope: DashboardScope; selectedTeamId: string | null; userId: string }) {
  const { teams, switchTeam } = useCoachingContext();
  const loadPractices = useCallback(() => getDashboardPractices(scope), [scope]);
  const loadWorkouts = useCallback(() => getDashboardWorkouts(scope), [scope]);
  const loadRoster = useCallback(() => getDashboardRoster(scope), [scope]);
  const practices = useDashboardSection(loadPractices);
  const workouts = useDashboardSection(loadWorkouts);
  const roster = useDashboardSection(loadRoster);
  const teamName = (id?: string | null) => teams.find(team => team.team_id === id)?.team_name;

  return <div className="space-y-6">
    {selectedTeamId && <DashboardSeason teamId={selectedTeamId} />}
    <DashboardEvents scope={scope} />
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Practices" subtitle="Today's practice records. Open one for attendance and lineups."
          action={<Link to="/team-management/schedule" className={actionClass}>Schedule</Link>} />
        <SectionContent section={practices} name="practices">{sessions => sessions.length === 0
          ? <EmptyState title="No practices today" description="Open Schedule to review upcoming training." />
          : <ul className="space-y-3">{sessions.map(session => <li key={session.id} className="rounded-lg bg-surface-secondary p-3">
            <p className="break-words font-medium text-content-primary">{session.focus || `${session.type.charAt(0).toUpperCase()}${session.type.slice(1)} practice`}</p>
            <p className="mt-1 text-xs text-content-muted">{[teamName(session.team_id), session.type].filter(Boolean).join(' · ')}</p>
            <Link className={actionClass} to={`/team-management/schedule?date=${session.date}&sessionId=${session.id}`}
              onClick={() => { if (session.team_id) switchTeam(session.team_id); }}>Open practice</Link>
          </li>)}</ul>}
        </SectionContent>
      </Card>
      <Card>
        <CardHeader title="Workouts" subtitle="Completion for the selected roster. Shared results may include other club teams."
          action={<Link to="/team-management/assignments" className={actionClass}>All workouts</Link>} />
        <SectionContent section={workouts} name="workouts">{rows => rows.length === 0
          ? <EmptyState title="No workouts today" description="Open Workouts to review upcoming assignments." />
          : <ul className="space-y-3">{rows.map(({ assignment, completed, total }) => <li key={assignment.id} className="rounded-lg bg-surface-secondary p-3">
            <p className="break-words font-medium text-content-primary">{assignment.title || assignment.template_name || 'Workout'}</p>
            <p className="mt-1 text-xs text-content-muted">{!assignment.team_id && assignment.org_id ? 'Shared club workout' : teamName(assignment.team_id)}</p>
            {(assignment.training_zone || assignment.canonical_name) && <p className="mt-1 break-words text-xs text-content-muted">{[assignment.training_zone, assignment.canonical_name].filter(Boolean).join(' · ')}</p>}
            <p className="mt-2 text-sm text-content-secondary">{total === 0 ? 'No athletes assigned in this roster' : `${completed}/${total} recorded complete`}</p>
            {total > completed && <p className="mt-1 text-xs text-content-muted">{total - completed} not recorded complete</p>}
            <Link className={actionClass} to={`/team-management/assignments/${assignment.id}/results`}
              onClick={() => { if (assignment.team_id) switchTeam(assignment.team_id); }}>View results</Link>
          </li>)}</ul>}
        </SectionContent>
      </Card>
    </div>
    {!selectedTeamId && <ClubTeamOverview teams={teams} scope={scope} practices={practices.data} workouts={workouts.data} onOpenTeam={switchTeam} />}
    <Card>
      <SectionContent section={roster} name="roster">{athletes => <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/team-management/roster" className={actionClass}>{athletes.length} {athletes.length === 1 ? 'athlete' : 'athletes'} · Open roster</Link>
        <Link to="/team-management/analytics" className={actionClass}>Performance analytics</Link>
      </div>}</SectionContent>
    </Card>
    {selectedTeamId && <section aria-label="This week's focus"><WeeklyFocusSummary teamId={selectedTeamId} userId={userId} /></section>}

  </div>;
}

export function CoachDashboard() {
  const { hasTeam, isLoadingTeam, teamId, orgId, userId, teams, filterTeamId } = useCoachingContext();
  const selectedTeamId = orgId && filterTeamId === null ? null : filterTeamId ?? teamId;
  const teamIds = useMemo(() => teams.filter(team => (team.role === 'coach' || team.role === 'coxswain') &&
    (selectedTeamId ? team.team_id === selectedTeamId : team.org_id === orgId)).map(team => team.team_id), [selectedTeamId, teams, orgId]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const scope = useMemo<DashboardScope>(() => ({ teamIds, orgId, date: today }), [teamIds, orgId, today]);


  if (isLoadingTeam || hasTeam === null) return <div role="status" className="p-6 text-content-muted">Loading coaching workspace…</div>;
  if (!hasTeam) return <Navigate to="/team-management/setup" replace />;
  return <>
    <CoachingNav />
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-semibold text-content-primary">Today</h1></div>
        <p className="text-sm text-content-muted"><time dateTime={today}>{format(new Date(), 'EEEE, MMMM d')}</time></p>
      </header>
      {teamIds.length === 0 ? <EmptyState title="Staff access required" description="Select a team where you are a coach or coxswain to view its training dashboard." /> : <TodayOverview key={`${userId}:${orgId}:${selectedTeamId ?? 'all'}:${teamIds.join(',')}:${today}`} scope={scope} selectedTeamId={selectedTeamId} userId={userId} />}
    </div>
  </>;
}
