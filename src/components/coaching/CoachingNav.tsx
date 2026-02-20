import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Settings, ChevronRight, Activity, ClipboardList, BarChart3, ChevronDown } from 'lucide-react';
import { RowingShellIcon } from '../icons/RowingIcons';
import { useCoachingContext } from '../../hooks/useCoachingContext';

const tabs = [
  { path: '/team-management/roster', label: 'Roster', icon: Users },
  { path: '/team-management/schedule', label: 'Schedule', icon: Calendar },
  { path: '/team-management/assignments', label: 'Assignments', icon: ClipboardList },
  { path: '/team-management/boatings', label: 'Boatings', icon: RowingShellIcon },
  { path: '/team-management/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/team-management/live', label: 'Live', icon: Activity },
  { path: '/team-management/settings', label: 'Settings', icon: Settings },
];

export function CoachingNav() {
  const { pathname } = useLocation();
  const { teamName, teams, teamId, switchTeam } = useCoachingContext();
  const currentTab = tabs.find((t) => pathname.startsWith(t.path));
  const hasMultipleTeams = teams.length > 1;

  return (
    <div className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto">
      {/* Breadcrumb + Team Name */}
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

        {/* Team name / switcher */}
        {teamName && (
          hasMultipleTeams ? (
            <div className="relative">
              <select
                value={teamId}
                onChange={(e) => switchTeam(e.target.value)}
                className="appearance-none bg-neutral-800 border border-neutral-700 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-white cursor-pointer hover:border-neutral-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                aria-label="Switch team"
              >
                {teams.map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
          ) : (
            <span className="text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5">
              {teamName}
            </span>
          )
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-800 -mb-px overflow-x-auto">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive = pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              title={label}
              className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
