import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Users, Calendar, Loader2, Trophy, Activity, ClipboardList, CheckCircle2, XCircle } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { RowingShellIcon } from '../../components/icons/RowingIcons';
import { WeeklyFocusCard } from '../../components/coaching/WeeklyFocusCard';
import {
  getAssignmentsForDate,
  getAssignmentCompletions,
  getAthletes,
  type GroupAssignment,
  type AssignmentCompletion,
  type CoachingAthlete,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';

const sections = [
  { path: '/coaching/roster', label: 'Roster', icon: Users, description: 'Manage athletes' },
  { path: '/coaching/schedule', label: 'Schedule & Log', icon: Calendar, description: 'Calendar, sessions & notes' },
  { path: '/coaching/assignments', label: 'Assignments', icon: ClipboardList, description: 'Assign & track workouts' },
  { path: '/coaching/ergs', label: 'Erg Scores', icon: Trophy, description: 'Test results' },
  { path: '/coaching/boatings', label: 'Boatings', icon: RowingShellIcon, description: 'Lineups' },
  { path: '/coaching/live', label: 'Live Sessions', icon: Activity, description: 'Real-time monitoring' },
];

export const CoachDashboard: React.FC = () => {
  const { hasTeam, isLoadingTeam, teamId, userId } = useCoachingContext();

  const [todayAssignments, setTodayAssignments] = useState<GroupAssignment[]>([]);
  const [completions, setCompletions] = useState<AssignmentCompletion[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    Promise.all([
      getAssignmentsForDate(teamId, todayStr),
      getAthletes(teamId).then((athletes: CoachingAthlete[]) =>
        getAssignmentCompletions(teamId, todayStr, athletes)
      ),
    ])
      .then(([asgn, comps]) => {
        setTodayAssignments(asgn);
        setCompletions(comps);
      })
      .catch(() => { /* non-critical dashboard card */ })
      .finally(() => setTodayLoading(false));
  }, [teamId]);

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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Coaching</h1>
        <p className="text-neutral-400 mt-1">Manage your team, schedule, and lineups.</p>
      </div>

      {/* Weekly Focus */}
      {teamId && (
        <div className="mb-6">
          <WeeklyFocusCard teamId={teamId} userId={userId} />
        </div>
      )}

      {/* Today's Workouts Card */}
      {!todayLoading && todayAssignments.length > 0 && (
        <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-neutral-100">Today&apos;s Workouts</h2>
            </div>
            <Link
              to="/coaching/assignments"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              View all →
            </Link>
          </div>
          {todayAssignments.map((a) => {
            const comp = completions.find((c) => c.group_assignment_id === a.id);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-neutral-200 truncate">
                    {a.title || a.template_name || 'Workout'}
                  </div>
                  {a.training_zone && (
                    <span className="text-xs text-emerald-400">{a.training_zone}</span>
                  )}
                  {a.canonical_name && (
                    <span className="text-xs text-neutral-500 ml-2 font-mono">{a.canonical_name}</span>
                  )}
                  {a.instructions && (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">{a.instructions}</p>
                  )}
                </div>
                {comp && (
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {comp.completed === comp.total ? (
                      <span className="flex items-center gap-1 text-sm text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        All done
                      </span>
                    ) : (
                      <Link
                        to="/coaching/roster"
                        className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
                      >
                        <XCircle className="w-4 h-4" />
                        {comp.completed}/{comp.total}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
