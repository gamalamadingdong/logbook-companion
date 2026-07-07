import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Trophy,
  FileText,
  CalendarDays,
  Settings,
  Loader2,
  AlertTriangle,
  Shield,
  ShieldAlert,
  User,
} from 'lucide-react';
import type { TeamRole } from '../../services/coaching/types';
import { useScopedTeamScope } from '../../hooks/useScopedTeamScope';
import { Badge } from '../../components/ui/Badge';

const ROLE_DISPLAY: Record<TeamRole, { label: string; color: string; icon: typeof Shield; description: string }> = {
  coach: { label: 'Coach', color: 'text-indigo-400', icon: ShieldAlert, description: 'Full team management access' },
  coxswain: { label: 'Coxswain', color: 'text-amber-400', icon: Shield, description: 'View team data + add/edit scores' },
  member: { label: 'Member', color: 'text-neutral-400', icon: User, description: 'View your scores and notes' },
};

export function MyTeamDashboard() {
  const navigate = useNavigate();
  const {
    activeTeam,
    scopedTeams,
    scopeLabel,
    isOrgWideScope,
    isLoadingTeam,
  } = useScopedTeamScope();
  const [error, setError] = useState<string | null>(null);

  if (isLoadingTeam) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Not on a team — show join prompt
  if (!activeTeam && scopedTeams.length === 0) {
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

  const scopedRoles = scopedTeams.map((team) => team.role);
  const role = scopedRoles.includes('coach')
    ? 'coach'
    : scopedRoles.includes('coxswain')
      ? 'coxswain'
      : 'member';
  const roleConfig = ROLE_DISPLAY[role];
  const RoleIcon = roleConfig.icon;
  const headline = isOrgWideScope
    ? activeTeam?.org_name ?? 'All Teams'
    : scopedTeams[0]?.team_name ?? activeTeam?.team_name ?? 'My Team';
  const subhead = isOrgWideScope
    ? 'You are viewing the full All Teams scope from your current organization filter.'
    : scopedTeams[0]?.org_name ?? scopeLabel;

  const sections = [
    { path: '/team/scores', label: 'My Erg Scores', icon: Trophy, description: 'View your test results & progress in the current scope' },
    { path: '/team/notes', label: 'My Session Notes', icon: FileText, description: 'Notes from your coaches in the current scope' },
    { path: '/team/training-block', label: '12-week Training Block', icon: CalendarDays, description: 'Review your plan versus logged sessions in this cycle' },
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
              <h1 className="text-2xl font-bold text-white">{headline}</h1>
              <p className="text-neutral-400 text-sm mt-0.5">{subhead}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.color}`} />
                <span className={`text-sm font-medium ${roleConfig.color}`}>
                  {roleConfig.label}
                </span>
                <span className="text-neutral-500 text-xs">
                  — {roleConfig.description}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant={isOrgWideScope ? 'coaching' : 'info'} dot>
                  {isOrgWideScope ? 'All Teams scope' : 'Single team scope'}
                </Badge>
                <Badge variant="muted">
                  {scopedTeams.length} team{scopedTeams.length === 1 ? '' : 's'} in scope
                </Badge>
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

      {/* Team access */}
      <div className="border-t border-neutral-800 pt-6 mt-8">
        <button
          onClick={() => navigate('/team/settings')}
          className="text-sm text-neutral-500 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          Manage team access in Settings
        </button>
      </div>
    </div>
  );
}
