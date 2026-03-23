import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Settings, ChevronRight, Activity, ClipboardList, BarChart3, ChevronDown, ChevronsRight, Building2, LayoutDashboard } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { getTeamStats, getTeamAthleteCounts } from '../../services/coaching/coachingService';

const tabs = [
  { path: '/team-management' as const, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/team-management/roster' as const, label: 'Roster', icon: Users, exact: false },
  { path: '/team-management/schedule' as const, label: 'Schedule', icon: Calendar, exact: false },
  { path: '/team-management/assignments' as const, label: 'Team Workouts', icon: ClipboardList, exact: false },
  { path: '/team-management/analytics' as const, label: 'Analytics', icon: BarChart3, exact: false },
  { path: '/team-management/live' as const, label: 'Live', icon: Activity, exact: false },
  { path: '/team-management/settings' as const, label: 'Settings', icon: Settings, exact: false },
];

function CoachingNav() {
  const { pathname } = useLocation();
  const {
    teamName, teamId, teamsByOrg, activeTeam,
    switchTeam, isLoadingTeam,
    orgId, filterTeamId, setFilterTeamId,
  } = useCoachingContext();
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const currentTab = tabs.find((t) => !t.exact && pathname.startsWith(t.path));
  const orgName = activeTeam?.org_name ?? null;

  // Teams in the current org (for the filter pills)
  const orgTeams = useMemo(() => (
    orgId
      ? teamsByOrg.find((g) => g.org_id === orgId)?.teams ?? []
      : []
  ), [orgId, teamsByOrg]);
  const showFilterPills = orgTeams.length > 1;

  // Does this coach belong to multiple orgs? If so, show the org switcher dropdown
  const multipleOrgs = teamsByOrg.filter((g) => g.org_id !== null).length > 1
    || (teamsByOrg.some((g) => g.org_id !== null) && teamsByOrg.some((g) => g.org_id === null));

  useEffect(() => {
    const effectiveTeamId = filterTeamId ?? teamId;
    const loadRosterCount = async () => {
      if (!effectiveTeamId && !orgId) {
        setRosterCount(null);
        return;
      }

      if (filterTeamId === null && orgId && orgTeams.length > 0) {
        try {
          const counts = await getTeamAthleteCounts(orgTeams.map((team) => team.team_id));
          setRosterCount(Object.values(counts).reduce((total, count) => total + count, 0));
        } catch {
          setRosterCount(null);
        }
        return;
      }

      if (effectiveTeamId) {
        try {
          const stats = await getTeamStats(effectiveTeamId);
          setRosterCount(stats.athleteCount);
        } catch {
          setRosterCount(null);
        }
      }
    };

    void loadRosterCount();
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
      {/* Breadcrumb + Org/Team context */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 text-sm text-neutral-500">
          <Link to="/team-management" className="hover:text-indigo-400 transition-colors">
            Team Management
          </Link>
          {currentTab && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-neutral-300">{currentTab.label}</span>
            </>
          )}
        </div>

        {/* Org label + org-switcher (only when coach spans multiple orgs) */}
        <div className="flex items-center gap-2">
          {orgName && !multipleOrgs && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400">
              <Building2 className="w-3.5 h-3.5" />
              {orgName}
            </span>
          )}

          {/* Multi-org coach: dropdown to pick org/team (rare, but supported) */}
          {multipleOrgs && (
            <div className="relative">
              <select
                value={teamId}
                onChange={(e) => switchTeam(e.target.value)}
                className="appearance-none bg-neutral-800 border border-neutral-700 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-white cursor-pointer hover:border-neutral-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                aria-label="Switch organization"
              >
                {teamsByOrg.map((group) => (
                  <optgroup key={group.org_id ?? '_standalone'} label={group.org_name}>
                    {group.teams.map((t) => (
                      <option key={t.team_id} value={t.team_id}>
                        {t.team_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
          )}

          {/* Single-team, no org: static label */}
          {!multipleOrgs && !showFilterPills && teamName && (
            <span className="text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5">
              {teamName}
            </span>
          )}

          {isLoadingTeam && (
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Team filter pills (org coaches with multiple teams) */}
      {showFilterPills && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-xs font-medium text-neutral-500 uppercase tracking-wider mr-1">Filter:</span>
          <button
            onClick={() => setFilterTeamId(null)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filterTeamId === null
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
            }`}
          >
            All Teams
          </button>
          {orgTeams.map((t) => (
            <button
              key={t.team_id}
              onClick={() => setFilterTeamId(t.team_id)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterTeamId === t.team_id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              }`}
            >
              {t.team_name}
            </button>
          ))}
        </div>
      )}

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
                <span className="hidden sm:inline">{label}</span>
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
