import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Settings, ChevronRight, Activity, ClipboardList, BarChart3, ChevronsRight, LayoutDashboard, History } from 'lucide-react';
import { Select } from '../ui';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { getTeamStats, getTeamAthleteCounts } from '../../services/coaching/coachingService';

const tabs = [
  { path: '/team-management' as const, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/team-management/roster' as const, label: 'Roster', icon: Users, exact: false },
  { path: '/team-management/seasons' as const, label: 'Seasons', icon: History, exact: false },
  { path: '/team-management/schedule' as const, label: 'Schedule', icon: Calendar, exact: false },
  { path: '/team-management/assignments' as const, label: 'Team Workouts', icon: ClipboardList, exact: false },
  { path: '/team-management/analytics' as const, label: 'Analytics', icon: BarChart3, exact: false },
  { path: '/team-management/live' as const, label: 'Live', icon: Activity, exact: false },
  { path: '/team-management/settings' as const, label: 'Settings', icon: Settings, exact: false },
];

function CoachingNav() {
  const { pathname } = useLocation();
  const {
    teamId, teamsByOrg,
    switchOrganization, isLoadingTeam,
    orgId, filterTeamId, setFilterTeamId,
  } = useCoachingContext();
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const currentTab = tabs.find((t) => !t.exact && pathname.startsWith(t.path));

  const clubTeams = useMemo(() => (
    teamsByOrg.find(group => group.org_id === orgId)?.teams ?? []
  ), [orgId, teamsByOrg]);
  const orgTeams = useMemo(() => orgId ? clubTeams : [], [orgId, clubTeams]);

  useEffect(() => {
    const effectiveTeamId = filterTeamId ?? teamId;
    let cancelled = false;
    const loadRosterCount = async () => {
      if (!effectiveTeamId && !orgId) {
        setRosterCount(null);
        return;
      }

      if (filterTeamId === null && orgId && orgTeams.length > 0) {
        try {
          const counts = await getTeamAthleteCounts(orgTeams.map((team) => team.team_id));
          if (!cancelled) setRosterCount(Object.values(counts).reduce((total, count) => total + count, 0));
        } catch {
          if (!cancelled) setRosterCount(null);
        }
        return;
      }

      if (effectiveTeamId) {
        try {
          const stats = await getTeamStats(effectiveTeamId);
          if (!cancelled) setRosterCount(stats.athleteCount);
        } catch {
          if (!cancelled) setRosterCount(null);
        }
      }
    };

    void loadRosterCount();
    return () => { cancelled = true; };
  }, [teamId, filterTeamId, orgId, orgTeams]);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    const updateHint = () => {
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      const hasOverflow = maxScrollLeft > 2;
      const atRightEdge = el.scrollLeft >= maxScrollLeft - 2;
      setShowScrollHint(hasOverflow && !atRightEdge);
    };

    const raf = requestAnimationFrame(updateHint);
    el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [pathname, rosterCount, teamId]);

  return (
    <div className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-1 text-sm text-content-muted mb-3">
        <Link to="/team-management" className="hover:text-accent-coaching transition-colors">
          Team Management
        </Link>
        {currentTab && <>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-content-secondary">{currentTab.label}</span>
        </>}
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mb-4" aria-busy={isLoadingTeam}>
        {teamsByOrg.length > 1 ? <Select label="Club" aria-label="Club" id="coaching-club" className="min-h-11 sm:min-w-48"
          value={orgId ?? '__standalone__'} disabled={isLoadingTeam || teamsByOrg.length === 0}
          onChange={e => switchOrganization(e.target.value === '__standalone__' ? null : e.target.value)}>
          {teamsByOrg.map(group => <option key={group.org_id ?? '__standalone__'} value={group.org_id ?? '__standalone__'}>{group.org_name}</option>)}
        </Select> : orgId && <div className="sm:pr-4"><p className="text-xs text-content-muted">Club</p><p className="font-medium text-content-primary py-2">{teamsByOrg[0]?.org_name}</p></div>}
        {clubTeams.length > 1 || isLoadingTeam ? <Select label="Team" aria-label="Team" id="coaching-team" className="min-h-11 sm:min-w-48"
          value={filterTeamId ?? (orgId && clubTeams.length > 1 ? '__all__' : teamId)}
          disabled={isLoadingTeam || clubTeams.length === 0}
          onChange={e => setFilterTeamId(e.target.value === '__all__' ? null : e.target.value)}>
          {orgId && clubTeams.length > 1 && <option value="__all__">Club overview · All Teams</option>}
          {clubTeams.map(team => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}
        </Select> : <div><p className="text-xs text-content-muted">Team</p><p className="font-medium text-content-primary py-2">{clubTeams[0]?.team_name ?? 'No team selected'}</p></div>}
        {!isLoadingTeam && clubTeams.length > 0 && (
          <Link
            to="/team-management/settings"
            className="inline-flex min-h-11 self-start items-center gap-1.5 rounded-lg px-2 text-sm text-content-muted transition-colors hover:bg-surface-card hover:text-accent-coaching focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:ml-auto sm:self-end"
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            Manage clubs &amp; teams
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="relative">
        <div ref={tabsRef} role="tablist" aria-label="Team management sections" className="flex gap-1 border-b border-neutral-800 -mb-px overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(({ path, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === path : pathname.startsWith(path);
            const isRoster = path === '/team-management/roster';
            return (
              <Link
                key={path}
                to={path}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {isRoster && rosterCount !== null && (
                  <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-semibold ${
                    isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-neutral-700 text-neutral-300'
                  }`}>
                    {rosterCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        {showScrollHint && (
          <ChevronsRight className="sm:hidden pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500/80" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

export { CoachingNav };
export default CoachingNav;
