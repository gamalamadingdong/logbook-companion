import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Settings, ChevronRight, Activity, ClipboardList, BarChart3 } from 'lucide-react';
import { RowingShellIcon } from '../icons/RowingIcons';

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
  const currentTab = tabs.find((t) => pathname.startsWith(t.path));

  return (
    <div className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500 mb-3">
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
