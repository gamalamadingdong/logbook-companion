import { useEffect, useState } from 'react';
import { Button, Card, CardHeader } from '../ui';
import { getDashboardRoster, type DashboardScope, type getDashboardWorkouts } from '../../services/coaching/teamDashboardService';
import type { CoachingSession, UserTeamInfo } from '../../services/coaching/types';

interface ClubTeamOverviewProps {
  teams: UserTeamInfo[];
  scope: DashboardScope;
  practices: CoachingSession[] | null;
  workouts: Awaited<ReturnType<typeof getDashboardWorkouts>> | null;
  onOpenTeam: (teamId: string) => void;
}

/** All Teams summary. Shared workouts stay in the main Today workout list. */
export function ClubTeamOverview({ teams, scope, practices, workouts, onOpenTeam }: ClubTeamOverviewProps) {
  const staffTeams = [...new Map(teams.filter(team => scope.teamIds.includes(team.team_id)
    && (team.org_id ?? null) === scope.orgId
    && (team.role === 'coach' || team.role === 'coxswain')).map(team => [team.team_id, team])).values()];
  if (staffTeams.length <= 1) return null;

  // Remount rows on any scope change so an old roster is never displayed while
  // replacement reads are pending. The dashboard also keys this component by account.
  const scopeKey = JSON.stringify([scope.orgId, scope.date, [...new Set(scope.teamIds)].sort(), staffTeams.map(team => team.team_id).sort()]);
  return <Card>
    <CardHeader title="Club overview" subtitle="Today's activity by team. Shared club workouts are listed above." />
    <ul className="space-y-3">
      {staffTeams.map(team => <TeamOverviewRow
        key={`${scopeKey}:${team.team_id}`}
        team={team}
        orgId={scope.orgId}
        date={scope.date}
        practiceCount={practices === null ? null : new Set(practices.filter(practice => practice.team_id === team.team_id && practice.date === scope.date).map(practice => practice.id)).size}
        workoutCount={workouts === null ? null : new Set(workouts.filter(({ assignment }) => assignment.team_id === team.team_id
          && assignment.scheduled_date === scope.date && (!assignment.org_id || assignment.org_id === scope.orgId)).map(({ assignment }) => assignment.id)).size}
        onOpenTeam={onOpenTeam}
      />)}
    </ul>
  </Card>;
}

interface TeamOverviewRowProps {
  team: UserTeamInfo;
  orgId: string | null;
  date: string;
  practiceCount: number | null;
  workoutCount: number | null;
  onOpenTeam: (teamId: string) => void;
}

function TeamOverviewRow({ team, orgId, date, practiceCount, workoutCount, onOpenTeam }: TeamOverviewRowProps) {
  const teamId = team.team_id;
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getDashboardRoster({ teamIds: [teamId], orgId, date })
      .then(roster => { if (!cancelled) setRosterCount(roster.length); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [teamId, orgId, date, attempt]);

  function retry() {
    setFailed(false);
    setRosterCount(null);
    setAttempt(value => value + 1);
  }

  return <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 space-y-2">
      <h4 className="break-words font-medium text-content-primary">{team.team_name}</h4>
      <dl className="grid grid-cols-1 gap-2 text-sm text-content-secondary sm:grid-cols-3 sm:gap-5">
        <div><dt className="text-xs text-content-muted">Active roster</dt><dd aria-live="polite">{failed ? 'Unavailable' : rosterCount ?? 'Loading…'}</dd></div>
        <div><dt className="text-xs text-content-muted">Practices today</dt><dd>{practiceCount ?? 'Unavailable'}</dd></div>
        <div><dt className="text-xs text-content-muted">Team workouts today</dt><dd>{workoutCount ?? 'Unavailable'}</dd></div>
      </dl>
      {failed && <div className="text-sm text-content-secondary">
        <p role="status">Could not load this team's active roster.</p>
        <Button variant="ghost" className="min-h-11" aria-label={`Retry roster for ${team.team_name}`} onClick={retry}>Retry roster</Button>
      </div>}
    </div>
    <Button variant="secondary" className="min-h-11 shrink-0" aria-label={`Open team ${team.team_name}`} onClick={() => onOpenTeam(teamId)}>Open team</Button>
  </li>;
}
