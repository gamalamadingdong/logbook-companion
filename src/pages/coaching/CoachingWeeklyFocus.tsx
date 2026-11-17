import { useSearchParams } from 'react-router-dom';
import { getWeekStart } from '../../services/coaching/coachingService';
import { Target } from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { WeeklyFocusCard } from '../../components/coaching/WeeklyFocusCard';
import { EmptyState } from '../../components/ui';
import { useCoachingContext } from '../../hooks/useCoachingContext';

export default function CoachingWeeklyFocus() {
  const context = useCoachingContext();
  const [searchParams] = useSearchParams();
  const queryWeek = searchParams.get('week');
  // Read calendar dates locally; reject JS Date's rollover of impossible dates.
  const queryDate = queryWeek && /^\d{4}-\d{2}-\d{2}$/.test(queryWeek) ? new Date(`${queryWeek}T00:00:00`) : null;
  const calendarDate = queryDate && Number.isFinite(queryDate.getTime())
    ? `${queryDate.getFullYear().toString().padStart(4, '0')}-${String(queryDate.getMonth() + 1).padStart(2, '0')}-${String(queryDate.getDate()).padStart(2, '0')}`
    : null;
  const initialWeekStart = queryDate && calendarDate === queryWeek ? getWeekStart(queryDate) : getWeekStart();
  const selected = context.orgId && context.filterTeamId === null ? null : (context.filterTeamId ?? context.teamId);
  const team = context.teams.find(item => item.team_id === selected);
  const staff = team && (team.role === 'coach' || team.role === 'coxswain');
  return <div>
    <CoachingNav />
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 space-y-6">
    <h1 className="text-xl font-semibold text-content-primary">Weekly focus</h1>
    {context.isLoadingTeam ? <p role="status">Loading team…</p> : !selected ? <EmptyState icon={<Target />} title="Select a team" description="Choose a team above to view its weekly focus, sharing and reflection." /> : !staff ? <EmptyState icon={<Target />} title="Staff access required" description="Choose a team where you coach or cox to view weekly focus." /> : context.userId ? <WeeklyFocusCard key={`${context.userId}:${selected}:${initialWeekStart}`} teamId={selected} userId={context.userId} initialWeekStart={initialWeekStart} /> : null}
    </div>
  </div>;
}
