import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { getScheduleEvents } from '../../services/coaching/coachingService';
import { listTeamSeasons } from '../../services/coaching/teamSeasonService';
import type { DashboardScope } from '../../services/coaching/teamDashboardService';

function useContextRead<T>(load: () => Promise<T>) {
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
const linkClass = 'inline-flex min-h-11 items-center text-sm font-medium text-accent-coaching hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';

export function DashboardEvents({ scope }: { scope: DashboardScope }) {
  const load = useCallback(async () => {
    if (!scope.orgId) return [];
    const events = await getScheduleEvents(scope.orgId, scope.date, scope.date);
    return [...new Map(events.filter(event => event.org_id === scope.orgId && event.date <= scope.date &&
      (event.end_date || event.date) >= scope.date &&
      (event.team_ids.length === 0 || event.team_ids.some(id => scope.teamIds.includes(id))))
      .map(event => [event.id, event])).values()];
  }, [scope]);
  const events = useContextRead(load);
  if (!scope.orgId) return null;
  return <Card><CardHeader title="Events today" />
    {events.failed ? <div role="alert"><p className="text-sm text-content-secondary">Unable to load events.</p><Button variant="secondary" className="min-h-11" onClick={events.retry}>Retry events</Button></div>
      : events.data === null ? <p role="status" className="text-sm text-content-muted">Loading events…</p>
        : events.data.length === 0 ? <p className="text-sm text-content-muted">No events today.</p>
          : <ul className="space-y-3">{events.data.map(event => <li key={event.id} className="rounded-lg bg-surface-secondary p-3">
            <p className="break-words font-medium text-content-primary">{event.title}</p>
            {event.location && <p className="mt-1 break-words text-sm text-content-muted">{event.location}</p>}
            <Link to={`/team-management/schedule?date=${scope.date}`} className={linkClass}>Open in Schedule</Link>
          </li>)}</ul>}
  </Card>;
}

export function DashboardSeason({ teamId }: { teamId: string }) {
  const load = useCallback(async () => (await listTeamSeasons(teamId)).find(season => season.team_id === teamId && season.status === 'active') ?? null, [teamId]);
  // Wrap the result to distinguish no active season from a pending read.
  const wrappedLoad = useCallback(async () => ({ season: await load() }), [load]);
  const state = useContextRead(wrappedLoad);
  return <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-surface-secondary px-4 py-2 text-sm text-content-secondary">
    {state.failed ? <div role="alert" className="flex flex-wrap items-center gap-2">Unable to load roster season.<Button variant="secondary" className="min-h-11" onClick={state.retry}>Retry roster season</Button></div>
      : state.data === null ? <span role="status">Loading roster season…</span>
        : <span>{state.data.season ? `Roster season · ${state.data.season.name}` : 'No active roster season'}</span>}
    <Link className={linkClass} to="/team-management/seasons">Roster history</Link>
  </div>;
}
