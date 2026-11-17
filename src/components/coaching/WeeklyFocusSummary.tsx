import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader } from '../ui';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { getWeeklyPlan, getWeekStart, type CoachingWeeklyPlan } from '../../services/coaching/coachingService';

export interface WeeklyFocusSummaryProps { teamId: string; userId: string }

export function WeeklyFocusSummary(props: WeeklyFocusSummaryProps) {
  return <SummaryContent key={`${props.userId}:${props.teamId}:${getWeekStart()}`} {...props} />;
}
function SummaryContent({ teamId }: WeeklyFocusSummaryProps) {
  const { teams } = useCoachingContext();
  const canEdit = teams.some(team => team.team_id === teamId && team.role === 'coach');
  const [plan, setPlan] = useState<CoachingWeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    getWeeklyPlan(teamId, getWeekStart()).then(data => { if (active) setPlan(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teamId, attempt]);
  return <Card>
    <CardHeader title="Weekly focus" subtitle="Current week" />
    {loading ? <p role="status">Loading weekly focus…</p> : error ? <div>
      <p role="alert">Weekly focus could not be loaded. Check your connection and try again.</p>
      <Button variant="secondary" className="min-h-11 mt-2" onClick={() => setAttempt(value => value + 1)}>Retry weekly focus</Button>
    </div> : plan ? <div className="space-y-2 break-words">
      {plan.theme && <p className="font-medium text-content-primary">{plan.theme}</p>}
      <ul className="list-disc pl-5 text-sm text-content-secondary">{plan.goals.slice(0, 3).map((goal, index) => <li key={index}>{goal}</li>)}</ul>
    </div> : <p className="text-content-muted text-sm">No weekly focus published.</p>}
    <Link className="inline-flex min-h-11 items-center mt-2 text-sm text-accent-coaching-text rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" to="/team-management/weekly-focus">{canEdit ? 'Edit weekly focus' : 'View weekly focus'}</Link>
  </Card>;
}
