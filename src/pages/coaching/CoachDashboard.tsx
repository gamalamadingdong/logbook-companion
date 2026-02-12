import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Users, Calendar, Loader2 } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { ErgIcon, RowingShellIcon, CoxboxIcon } from '../../components/icons/RowingIcons';

const sections = [
  { path: '/coaching/roster', label: 'Roster', icon: Users, description: 'Manage athletes' },
  { path: '/coaching/schedule', label: 'Schedule & Log', icon: Calendar, description: 'Calendar, sessions & notes' },
  { path: '/coaching/ergs', label: 'Erg Scores', icon: ErgIcon, description: 'Test results' },
  { path: '/coaching/boatings', label: 'Boatings', icon: RowingShellIcon, description: 'Lineups' },
  { path: '/coaching/live', label: 'Live Sessions', icon: CoxboxIcon, description: 'Real-time monitoring' },
];

export const CoachDashboard: React.FC = () => {
  const { hasTeam, isLoadingTeam } = useCoachingContext();

  if (isLoadingTeam) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  // No team yet — send to onboarding
  if (hasTeam === false) {
    return <Navigate to="/coaching/setup" replace />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Coaching</h1>
        <p className="text-neutral-400 mt-1">Manage your team, schedule, and lineups.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ path, label, icon: Icon, description }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-4 p-5 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-indigo-500/50 hover:bg-neutral-800/50 transition-all group"
          >
            <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              <Icon size={24} />
            </div>
            <div>
              <div className="text-white font-semibold">{label}</div>
              <div className="text-neutral-500 text-sm">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
