import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Settings, ChevronRight, ChevronDown, Activity, ClipboardList, BarChart3, LayoutDashboard, History, ShieldCheck, Target } from 'lucide-react';
import clsx from 'clsx';
import { Button, Select } from '../ui';
import { useCoachingContext } from '../../hooks/useCoachingContext';

const primaryLinks = [
  { path: '/team-management', label: 'Overview', icon: LayoutDashboard },
  { path: '/team-management/roster', label: 'Roster', icon: Users },
  { path: '/team-management/schedule', label: 'Schedule', icon: Calendar },
  { path: '/team-management/assignments', label: 'Workouts', icon: ClipboardList },
  { path: '/team-management/analytics', label: 'Analytics', icon: BarChart3 },
];
const toolLinks = [
  { path: '/team-management/weekly-focus', label: 'Weekly focus', icon: Target },
  { path: '/team-management/live', label: 'Live', icon: Activity },
  { path: '/team-management/seasons', label: 'Seasons', icon: History },
  { path: '/team-management/administration', label: 'Administration', icon: ShieldCheck },
];

function CoachingNav() {
  const { pathname } = useLocation();
  const {
    teamId, teams, teamsByOrg,
    switchOrganization, isLoadingTeam,
    orgId, filterTeamId, setFilterTeamId,
  } = useCoachingContext();
  const isRouteActive = (path: string) => pathname === path || (path !== '/team-management' && pathname.startsWith(`${path}/`));
  const canReviewRequests = teams.some(team => team.org_role === 'owner' || team.org_role === 'admin');
  const secondaryLinks = toolLinks.filter(link => link.label !== 'Administration' || canReviewRequests);
  const activeTool = secondaryLinks.find(link => isRouteActive(link.path));
  // A deep-linked secondary page must remain visible even before opening tools.
  const [toolsState, setToolsState] = useState<{ pathname: string; open: boolean } | null>(null);
  const toolsOpen = toolsState?.pathname === pathname ? toolsState.open : Boolean(activeTool);
  const currentLink = [...primaryLinks.slice(1), ...secondaryLinks, { path: '/team-management/settings', label: 'Manage clubs & teams' }].find(link => isRouteActive(link.path));
  const clubTeams = useMemo(() => (
    teamsByOrg.find(group => group.org_id === orgId)?.teams ?? []
  ), [orgId, teamsByOrg]);
  const renderLink = ({ path, label, icon: Icon }: typeof primaryLinks[number]) => {
    const isActive = isRouteActive(path);
    return <Link key={path} to={path} aria-current={isActive ? 'page' : undefined}
      className={clsx('flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        isActive ? 'border-accent-coaching bg-accent-coaching-surface font-semibold text-accent-coaching-text' : 'border-transparent text-content-secondary hover:bg-surface-card hover:text-accent-coaching-text')}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="break-words">{label}</span>
    </Link>;
  };

  return (
    <div className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-1 text-sm text-content-muted mb-3">
        <Link to="/team-management" className="inline-flex min-h-11 items-center hover:text-accent-coaching transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          Team Management
        </Link>
        {currentLink && <>
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-content-secondary">{currentLink.label}</span>
        </>}
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mb-4" aria-busy={isLoadingTeam}>
        {teamsByOrg.length > 1 ? <Select label="Club" aria-label="Club" id="coaching-club" className="min-h-11 sm:min-w-48"
          value={orgId ?? '__standalone__'} disabled={isLoadingTeam || teamsByOrg.length === 0}
          onChange={e => switchOrganization(e.target.value === '__standalone__' ? null : e.target.value)}>
          {teamsByOrg.map(group => <option key={group.org_id ?? '__standalone__'} value={group.org_id ?? '__standalone__'}>{group.org_name}</option>)}
        </Select> : orgId && <div className="sm:pr-4"><p className="text-xs text-content-muted">Club</p><p className="break-words font-medium text-content-primary py-2">{teamsByOrg[0]?.org_name}</p></div>}
        {clubTeams.length > 1 || isLoadingTeam ? <Select label="Team" aria-label="Team" id="coaching-team" className="min-h-11 sm:min-w-48"
          value={filterTeamId ?? (orgId && clubTeams.length > 1 ? '__all__' : teamId)}
          disabled={isLoadingTeam || clubTeams.length === 0}
          onChange={e => setFilterTeamId(e.target.value === '__all__' ? null : e.target.value)}>
          {orgId && clubTeams.length > 1 && <option value="__all__">Club overview · All Teams</option>}
          {clubTeams.map(team => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}
        </Select> : <div><p className="text-xs text-content-muted">Team</p><p className="break-words font-medium text-content-primary py-2">{clubTeams[0]?.team_name ?? 'No team selected'}</p></div>}
        {!isLoadingTeam && (
          <Link
            to="/team-management/settings"
            aria-current={isRouteActive("/team-management/settings") ? "page" : undefined}
            className={clsx("inline-flex min-h-11 self-start items-center gap-1.5 rounded-lg px-2 text-sm transition-colors hover:bg-surface-card hover:text-accent-coaching focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:ml-auto sm:self-end", isRouteActive("/team-management/settings") ? "bg-accent-coaching-surface text-accent-coaching-text font-semibold" : "text-content-muted")}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            Manage clubs &amp; teams
          </Link>
        )}
      </div>

      <nav aria-label="Coaching workspace" className="grid grid-cols-2 gap-1 border-b border-border pb-2 sm:grid-cols-5">
        {primaryLinks.map(renderLink)}
      </nav>
      <div className="py-2">
        <Button variant="ghost" className="min-h-11" aria-expanded={toolsOpen} aria-controls="coaching-tools"
          onClick={() => setToolsState({ pathname, open: !toolsOpen })}>
          Tools &amp; administration
          <ChevronDown className={clsx('h-4 w-4', toolsOpen && 'rotate-180')} aria-hidden="true" />
        </Button>
        {toolsOpen && <nav id="coaching-tools" aria-label="Tools and administration" className="grid grid-cols-2 gap-1 pt-1 sm:flex sm:flex-wrap">
          {secondaryLinks.map(renderLink)}
        </nav>}
      </div>
    </div>
  );
}

export { CoachingNav };
export default CoachingNav;
