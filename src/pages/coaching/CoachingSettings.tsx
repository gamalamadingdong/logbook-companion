import { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Save,
  Loader2,
  AlertTriangle,
  Shield,
  ShieldAlert,
  User,
  Trash2,
  UserPlus,
  Link,
  Mail,
} from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import {
  getTeam,
  updateTeam,
  regenerateInviteCode,
  getTeamMembers,
  updateTeamMemberRole,
  removeTeamMember,
  addTeamMemberByEmail,
  sendTeamInviteEmail,
} from '../../services/coaching/coachingService';
import type { Team, TeamMemberWithProfile, TeamRole } from '../../services/coaching/types';

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; icon: typeof Shield }> = {
  coach: { label: 'Coach', color: 'text-indigo-400', icon: ShieldAlert },
  coxswain: { label: 'Coxswain', color: 'text-amber-400', icon: Shield },
  member: { label: 'Member', color: 'text-neutral-400', icon: User },
};

export function CoachingSettings() {
  const { userId, teamId, isLoadingTeam } = useCoachingContext();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Invite code
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Member removal
  const [removingMember, setRemovingMember] = useState<TeamMemberWithProfile | null>(null);

  // Add member by email
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<TeamRole>('member');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [sendInviteError, setSendInviteError] = useState<string | null>(null);
  const [sendInviteSuccess, setSendInviteSuccess] = useState<string | null>(null);

  // Invite link copy
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;

    Promise.all([getTeam(teamId), getTeamMembers(teamId)])
      .then(([t, m]) => {
        setTeam(t);
        setMembers(m);
        setEditName(t?.name ?? '');
        setEditDescription(t?.description ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load team'))
      .finally(() => setIsLoading(false));
  }, [teamId, isLoadingTeam]);

  const handleSaveTeam = async () => {
    if (!teamId || !editName.trim()) return;
    setIsSaving(true);
    try {
      const updated = await updateTeam(teamId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setTeam(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!team?.invite_code) return;
    await navigator.clipboard.writeText(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!teamId) return;
    setIsRegenerating(true);
    try {
      const newCode = await regenerateInviteCode(teamId);
      setTeam((prev) => (prev ? { ...prev, invite_code: newCode } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate code');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!team?.invite_code) return;
    const url = `${window.location.origin}/join?code=${team.invite_code}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleAddMember = async () => {
    if (!teamId || !addEmail.trim()) return;
    setIsAddingMember(true);
    setAddMemberError(null);
    setAddMemberSuccess(null);
    setSendInviteError(null);
    setSendInviteSuccess(null);
    try {
      const newMember = await addTeamMemberByEmail(teamId, addEmail.trim(), addRole);
      setMembers((prev) => [...prev, newMember]);
      setAddMemberSuccess(`Added ${newMember.display_name} as ${ROLE_CONFIG[addRole].label}`);
      setAddEmail('');
      setAddRole('member');
      setTimeout(() => setAddMemberSuccess(null), 3000);
    } catch (err) {
      setAddMemberError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleSendInvite = async () => {
    if (!teamId || !team?.invite_code || !team.name || !addEmail.trim()) return;

    setIsSendingInvite(true);
    setSendInviteError(null);
    setSendInviteSuccess(null);
    setAddMemberError(null);

    try {
      await sendTeamInviteEmail({
        teamId,
        recipientEmail: addEmail.trim(),
        inviteCode: team.invite_code,
        teamName: team.name,
      });
      setSendInviteSuccess(`Invite sent to ${addEmail.trim()}.`);
      setTimeout(() => setSendInviteSuccess(null), 4000);
    } catch (err) {
      setSendInviteError(err instanceof Error ? err.message : 'Failed to send invite email');
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    try {
      await updateTeamMemberRole(memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeTeamMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setRemovingMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  if (isLoading || isLoadingTeam) {
    return (
      <>
        <CoachingNav />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <CoachingNav />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white">Team Settings</h1>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto underline hover:text-red-300">
              Dismiss
            </button>
          </div>
        )}

        {/* Team Info */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Team Info</h2>

          <div>
            <label htmlFor="team-name" className="block text-sm font-medium text-neutral-300 mb-1">
              Team Name
            </label>
            <input
              id="team-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              minLength={3}
              maxLength={100}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="team-desc" className="block text-sm font-medium text-neutral-300 mb-1">
              Description
            </label>
            <textarea
              id="team-desc"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <button
            onClick={handleSaveTeam}
            disabled={isSaving || editName.trim().length < 3}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Invite Code */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Invite Code</h2>
          <p className="text-neutral-400 text-sm">
            Share this code with team members so they can join your team.
          </p>

          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg font-mono text-xl text-white tracking-widest text-center select-all">
              {team?.invite_code ?? '--------'}
            </div>
            <button
              onClick={handleCopyCode}
              className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-neutral-400" />
              )}
            </button>
            <button
              onClick={handleRegenerateCode}
              disabled={isRegenerating}
              className="p-3 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
              title="Generate new code (invalidates old one)"
            >
              <RefreshCw className={`w-5 h-5 text-neutral-400 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyInviteLink}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors text-sm text-neutral-300"
            >
              {linkCopied ? (
                <><Check className="w-4 h-4 text-green-400" /> Link Copied!</>
              ) : (
                <><Link className="w-4 h-4" /> Copy Invite Link</>
              )}
            </button>
            <span className="text-neutral-600 text-xs">Share a direct link instead of the code</span>
          </div>
          <p className="text-neutral-500 text-xs">
            Regenerating the code will invalidate the old one. Anyone who already joined will remain on the team.
          </p>
        </div>

        {/* Add Member by Email */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Add Member</h2>
          <p className="text-neutral-400 text-sm">
            Add someone who already has an account, or send an invite email for self-join.
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="add-email" className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
              <input
                id="add-email"
                type="email"
                value={addEmail}
                onChange={(e) => {
                  setAddEmail(e.target.value);
                  setAddMemberError(null);
                  setSendInviteError(null);
                }}
                placeholder="coach@example.com"
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="w-36">
              <label htmlFor="add-role" className="block text-sm font-medium text-neutral-300 mb-1">Role</label>
              <select
                id="add-role"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as TeamRole)}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="member">Athlete</option>
                <option value="coxswain">Coxswain</option>
                <option value="coach">Coach</option>
              </select>
            </div>
            <button
              onClick={handleAddMember}
              disabled={isAddingMember || isSendingInvite || !addEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 h-[42px]"
            >
              {isAddingMember ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add
            </button>
            <button
              onClick={handleSendInvite}
              disabled={isAddingMember || isSendingInvite || !addEmail.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50 h-[42px]"
            >
              {isSendingInvite ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Email Invite
            </button>
          </div>
          {addMemberError && (
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {addMemberError}
            </p>
          )}
          {addMemberSuccess && (
            <p className="text-green-400 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {addMemberSuccess}
            </p>
          )}
          {sendInviteError && (
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {sendInviteError}
            </p>
          )}
          {sendInviteSuccess && (
            <p className="text-green-400 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {sendInviteSuccess}
            </p>
          )}
        </div>

        {/* Members */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Team Members
              <span className="text-neutral-500 text-sm font-normal ml-2">
                ({members.length})
              </span>
            </h2>
          </div>

          {members.length === 0 ? (
            <p className="text-neutral-500 text-sm py-4 text-center">
              No members yet. Share your invite code to get started.
            </p>
          ) : (
            <div className="divide-y divide-neutral-800">
              {members.map((member) => {
                const isCurrentUser = member.user_id === userId;
                const cfg = ROLE_CONFIG[member.role];
                const Icon = cfg.icon;

                return (
                  <div key={member.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {member.display_name}
                          {isCurrentUser && (
                            <span className="text-neutral-500 text-xs ml-1.5">(you)</span>
                          )}
                        </p>
                        {member.email && (
                          <p className="text-neutral-500 text-xs truncate">{member.email}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role selector — don't allow self-demotion */}
                      {!isCurrentUser ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as TeamRole)}
                          aria-label={`Role for ${member.display_name}`}
                          className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="coxswain">Coxswain</option>
                          <option value="coach">Coach</option>
                        </select>
                      ) : (
                        <span className={`text-sm ${cfg.color}`}>{cfg.label}</span>
                      )}

                      {/* Remove — can't remove yourself */}
                      {!isCurrentUser && (
                        <button
                          onClick={() => setRemovingMember(member)}
                          className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
                          title="Remove from team"
                        >
                          <Trash2 className="w-4 h-4 text-neutral-500 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Remove Member Confirmation Dialog */}
      {removingMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Remove Member</h3>
            </div>
            <p className="text-neutral-300 mb-1">
              Remove <span className="font-medium text-white">{removingMember.display_name}</span> from the team?
            </p>
            <p className="text-neutral-500 text-sm mb-6">
              They can rejoin using the invite code.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemovingMember(null)}
                className="px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveMember(removingMember.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
