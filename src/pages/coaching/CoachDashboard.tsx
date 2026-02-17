import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Users, Calendar, Loader2, Activity, ClipboardList, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { RowingShellIcon } from '../../components/icons/RowingIcons';
import { WeeklyFocusCard } from '../../components/coaching/WeeklyFocusCard';
import {
  getAssignmentsForDate,
  getAssignmentCompletions,
  getAthletes,
  getTeamStats,
  type GroupAssignment,
  type AssignmentCompletion,
  type CoachingAthlete,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';

const sections = [
  { path: '/team-management/roster', label: 'Roster', icon: Users, description: 'Manage athletes' },
  { path: '/team-management/schedule', label: 'Schedule & Log', icon: Calendar, description: 'Calendar, sessions & notes' },
  { path: '/team-management/assignments', label: 'Assignments', icon: ClipboardList, description: 'Assign & track workouts' },
  { path: '/team-management/boatings', label: 'Boatings', icon: RowingShellIcon, description: 'Lineups' },
  { path: '/team-management/analytics', label: 'Analytics', icon: BarChart3, description: 'Charts & performance data' },
  { path: '/team-management/live', label: 'Live Sessions', icon: Activity, description: 'Real-time monitoring' },
];

export const CoachDashboard: React.FC = () => {
  const { hasTeam, isLoadingTeam, teamId, userId } = useCoachingContext();

  const [todayAssignments, setTodayAssignments] = useState<GroupAssignment[]>([]);
  const [completions, setCompletions] = useState<AssignmentCompletion[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<{
    athleteCount: number;
    squadCount: number;
    weeklyCompletionRate: number | null;
    sessionsThisWeek: number;
  } | null>(null);

  useEffect(() => {
    if (!teamId) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    Promise.all([
      getAssignmentsForDate(teamId, todayStr),
      getAthletes(teamId).then((athletes: CoachingAthlete[]) =>
        getAssignmentCompletions(teamId, todayStr, athletes)
      ),
      getTeamStats(teamId),
    ])
      .then(([asgn, comps, stats]) => {
        setTodayAssignments(asgn);
        setCompletions(comps);
        setTeamStats(stats);
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
    return <Navigate to="/team-management/setup" replace />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Team Management</h1>
        <p className="text-neutral-400 mt-1">Manage your team, schedule, and lineups.</p>
      </div>

      {/* Section Navigation */}
      <div className="mb-6 bg-neutral-900 border border-neutral-800 rounded-xl p-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors whitespace-nowrap"
            >
              <Icon className="w-4 h-4 text-indigo-400" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Weekly Focus */}
      {teamId && (
        <div className="mb-6">
          <WeeklyFocusCard teamId={teamId} userId={userId} />
        </div>
      )}

      {/* Team Stats */}
      {teamStats && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{teamStats.athleteCount}</div>
            <div className="text-xs text-neutral-500 mt-1 flex items-center justify-center gap-1">
              <Users className="w-3 h-3" />
              Athletes
            </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{teamStats.squadCount}</div>
            <div className="text-xs text-neutral-500 mt-1">Squads</div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{teamStats.sessionsThisWeek}</div>
            <div className="text-xs text-neutral-500 mt-1 flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3" />
              Sessions this week
            </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
            {teamStats.weeklyCompletionRate !== null ? (
              <>
                <div className={`text-2xl font-bold ${
                  teamStats.weeklyCompletionRate >= 80 ? 'text-green-400' :
                  teamStats.weeklyCompletionRate >= 50 ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {teamStats.weeklyCompletionRate}%
                </div>
                <div className="text-xs text-neutral-500 mt-1 flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3" />
                  Weekly completion
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-neutral-600">—</div>
                <div className="text-xs text-neutral-500 mt-1">No assignments</div>
              </>
            )}
          </div>
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
              to="/team-management/assignments"
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
                        to="/team-management/roster"
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

    </div>
  );
};
