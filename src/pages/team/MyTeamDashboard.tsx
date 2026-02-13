import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Trophy,
  FileText,
  Settings,
  Loader2,
  AlertTriangle,
  LogOut,
  Shield,
  ShieldAlert,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMyTeamMembership,
  leaveTeam,
} from '../../services/coaching/coachingService';
import type { Team, TeamRole } from '../../services/coaching/types';

const ROLE_DISPLAY: Record<TeamRole, { label: string; color: string; icon: typeof Shield; description: string }> = {
  coach: { label: 'Coach', color: 'text-indigo-400', icon: ShieldAlert, description: 'Full team management access' },
  coxswain: { label: 'Coxswain', color: 'text-amber-400', icon: Shield, description: 'View team data + add/edit scores' },
  member: { label: 'Member', color: 'text-neutral-400', icon: User, description: 'View your scores and notes' },
};

export function MyTeamDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [role, setRole] = useState<TeamRole>('member');
  const [memberId, setMemberId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    getMyTeamMembership(user.id)
      .then((result) => {
        if (result) {
          setTeam(result.team);
          setRole(result.role);
          setMemberId(result.memberId);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load team'))
      .finally(() => setIsLoading(false));
  }, [user?.id]);

  const handleLeave = async () => {
    if (!memberId) return;
    setIsLeaving(true);
    try {
      await leaveTeam(memberId);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave team');
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Not on a team — show join prompt
  if (!team) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
            <Users className="w-8 h-8 text-neutral-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">No Team Yet</h1>
          <p className="text-neutral-400 mb-6">
            Ask your coach for an invite code to join their team.
          </p>
          <Link
            to="/join"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium"
          >
            <Users className="w-4 h-4" />
            Join a Team
          </Link>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_DISPLAY[role];
  const RoleIcon = roleConfig.icon;

  const sections = [
    { path: '/team/scores', label: 'My Erg Scores', icon: Trophy, description: 'View your test results & progress' },
    { path: '/team/notes', label: 'My Session Notes', icon: FileText, description: 'Notes from your coaches' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto underline hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      {/* Team Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{team.name}</h1>
              {team.description && (
                <p className="text-neutral-400 text-sm mt-0.5">{team.description}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2">
                <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.color}`} />
                <span className={`text-sm font-medium ${roleConfig.color}`}>
                  {roleConfig.label}
                </span>
                <span className="text-neutral-500 text-xs">
                  — {roleConfig.description}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/team/settings')}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {sections.map(({ path, label, icon: Icon, description }) => (
          <Link
            key={path}
            to={path}
            className="flex items-center gap-4 p-5 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-emerald-500/50 hover:bg-neutral-800/50 transition-all group"
          >
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Icon size={24} />
            </div>
            <div>
              <div className="text-white font-semibold">{label}</div>
              <div className="text-neutral-500 text-sm">{description}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Leave Team */}
      <div className="border-t border-neutral-800 pt-6 mt-8">
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="text-sm text-neutral-500 hover:text-red-400 transition-colors inline-flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave Team
        </button>
      </div>

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Leave Team</h3>
            </div>
            <p className="text-neutral-300 mb-1">
              Leave <span className="font-medium text-white">{team.name}</span>?
            </p>
            <p className="text-neutral-500 text-sm mb-6">
              You can rejoin later using a new invite code from your coach.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                disabled={isLeaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isLeaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Leave Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
