import { CoachingNav } from '../../components/coaching/CoachingNav';
import { PendingCoachingRequests } from '../../components/coaching/PendingCoachingRequests';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCoachingContext } from '../../hooks/useCoachingContext';

export function CoachingAdministration() {
  const { teams, userId } = useCoachingContext();
  const canReviewRequests = teams.some(team => team.org_role === 'owner' || team.org_role === 'admin');
  return <><CoachingNav /><div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
    <header><h1 className="text-2xl font-semibold text-content-primary">Administration</h1>
      <p className="mt-2 text-sm text-content-secondary">Review coaching account access requests. These requests apply across your account, independently of the selected club or team.</p></header>
    {canReviewRequests ? <PendingCoachingRequests key={userId} /> : <EmptyState title="Administrator access required" description="Club owners and administrators can review coaching access requests." />}
  </div></>;
}
