import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyDirectTeamMemberships,
  leaveTeam,
} from '../../services/coaching/coachingService';
import type { Team, TeamRole } from '../../services/coaching/types';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TeamInfoEditorList } from '../../components/team/TeamInfoEditorList';
import { toast } from 'sonner';

const ROLE_VARIANT: Record<TeamRole, 'coaching' | 'warning' | 'muted'> = {
  coach: 'coaching',
  coxswain: 'warning',
  member: 'muted',
};

export function MyTeamSettings() {
  const { user } = useAuth();
  const {
    teams,
    isLoadingTeam,
    teamError,
    refreshTeam,
  } = useCoachingContext();
  const [memberships, setMemberships] = useState<Array<{ team: Team; role: TeamRole; memberId: string }>>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaveTargetId, setLeaveTargetId] = useState<string | null>(null);
  const [leavingMemberId, setLeavingMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setMemberships([]);
      setIsLoadingMemberships(false);
      return;
    }

    setIsLoadingMemberships(true);

    getMyDirectTeamMemberships(user.id)
      .then((directMemberships) => {
        setMemberships(directMemberships);
        setError(null);
      })
      .catch(() => setError('Failed to load team memberships.'))
      .finally(() => setIsLoadingMemberships(false));
  }, [user?.id]);

  const handleLeave = async () => {
    if (!leaveTargetId) return;
    setLeavingMemberId(leaveTargetId);
    try {
      await leaveTeam(leaveTargetId);
      const nextMemberships = memberships.filter((membership) => membership.memberId !== leaveTargetId);
      setMemberships(nextMemberships);
      setLeaveTargetId(null);
      await refreshTeam();
      toast.success('Left team successfully');
    } catch {
      toast.error('Failed to leave team');
    } finally {
      setLeavingMemberId(null);
    }
  };

  if (isLoadingTeam || isLoadingMemberships) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (teamError || error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-neutral-300">{teamError ?? error}</p>
          <Link to="/team" className="text-indigo-400 hover:text-indigo-300 text-sm">
            ← Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-neutral-300">You do not have any team access yet.</p>
          <Link to="/team" className="text-indigo-400 hover:text-indigo-300 text-sm">
            ← Back to My Team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumb items={[
          { label: 'My Team', to: '/team' },
          { label: 'Settings' },
        ]} />

        <h1 className="text-2xl font-bold tracking-tight">Team Settings</h1>

        {/* Team Info */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300">Team Info</h2>
          <TeamInfoEditorList teams={teams} onTeamsChanged={refreshTeam} />
        </div>

        {/* Leave Team */}
        <div className="bg-neutral-900/60 border border-red-900/30 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
          <p className="text-xs text-neutral-400">
            Leave actions only apply to your direct team memberships. Team info editing above is independent from the active team selector and always shows all accessible teams.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">
              {memberships.length} direct membership{memberships.length === 1 ? '' : 's'} total
            </Badge>
          </div>

          {memberships.length === 0 ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/30 p-4 text-sm text-neutral-300">
              You do not have any direct memberships to leave right now. Your current access appears to come from a broader org role or another inherited permission path.
            </div>
          ) : (
            <div className="space-y-3">
              {memberships.map((membership) => {
                const isConfirming = leaveTargetId === membership.memberId;
                const isLeaving = leavingMemberId === membership.memberId;
                return (
                  <div
                    key={membership.memberId}
                    className="rounded-lg border border-red-900/30 bg-neutral-950/30 p-4 space-y-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{membership.team.name}</p>
                        <p className="text-xs text-neutral-500">
                          Direct membership · <span className="capitalize">{membership.role}</span>
                        </p>
                      </div>
                      <Badge variant={ROLE_VARIANT[membership.role]} className="capitalize self-start">
                        {membership.role}
                      </Badge>
                    </div>

                    {!isConfirming ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="md"
                        icon={<LogOut className="w-4 h-4" />}
                        onClick={() => setLeaveTargetId(membership.memberId)}
                        className="min-h-11"
                      >
                        Leave {membership.team.name}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-red-300">
                          Leave <span className="font-medium text-white">{membership.team.name}</span>? This removes your direct access to that team.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="danger"
                            size="md"
                            loading={isLeaving}
                            onClick={handleLeave}
                            className="min-h-11"
                          >
                            {isLeaving ? 'Leaving...' : 'Yes, leave team'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => setLeaveTargetId(null)}
                            disabled={isLeaving}
                            className="min-h-11"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
