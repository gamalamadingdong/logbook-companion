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
  Building2,
  TriangleAlert,
  Plus,
  BarChart3,
} from 'lucide-react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { TeamInfoEditorList } from '../../components/team/TeamInfoEditorList';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { formatErgTime, getDefaultBenchmarkRubric, parseErgTimeInput, PERFORMANCE_TIER_SQUADS, type SquadKey } from '../../utils/performanceTierRubric';
import {
  getTeam,
  deleteTeam,
  getTeamDataCounts,
  regenerateInviteCode,
  getTeamMembers,
  updateTeamMemberRole,
  removeTeamMember,
  addTeamMemberByEmail,
  sendTeamInviteEmail,
  getOrganizationsForUser,
  assignTeamToOrg,
  removeTeamFromOrg,
  createOrganization,
  updateOrganization,
  backfillTitanIndexes,
} from '../../services/coaching/coachingService';
import type { Team, TeamMemberWithProfile, TeamRole, Organization } from '../../services/coaching/types';
import { BulkCoachInviteModal } from '../../components/coaching/BulkCoachInviteModal';

type RubricFormState = Record<SquadKey, {
  developmentalAbove: string;
  competitorAbove: string;
  challengerAbove: string;
  championAbove: string;
}>;

function buildRubricForm(org: Organization | null | undefined): RubricFormState {
  const defaults = getDefaultBenchmarkRubric();
  const config = org?.performance_tier_rubric ?? {};
  return {
    freshman: {
      developmentalAbove: formatErgTime(config.freshman?.developmentalAbove ?? defaults.freshman.developmentalAbove),
      competitorAbove: formatErgTime(config.freshman?.competitorAbove ?? defaults.freshman.competitorAbove),
      challengerAbove: formatErgTime(config.freshman?.challengerAbove ?? defaults.freshman.challengerAbove),
      championAbove: formatErgTime(config.freshman?.championAbove ?? defaults.freshman.championAbove),
    },
    novice: {
      developmentalAbove: formatErgTime(config.novice?.developmentalAbove ?? defaults.novice.developmentalAbove),
      competitorAbove: formatErgTime(config.novice?.competitorAbove ?? defaults.novice.competitorAbove),
      challengerAbove: formatErgTime(config.novice?.challengerAbove ?? defaults.novice.challengerAbove),
      championAbove: formatErgTime(config.novice?.championAbove ?? defaults.novice.championAbove),
    },
    jv: {
      developmentalAbove: formatErgTime(config.jv?.developmentalAbove ?? defaults.jv.developmentalAbove),
      competitorAbove: formatErgTime(config.jv?.competitorAbove ?? defaults.jv.competitorAbove),
      challengerAbove: formatErgTime(config.jv?.challengerAbove ?? defaults.jv.challengerAbove),
      championAbove: formatErgTime(config.jv?.championAbove ?? defaults.jv.championAbove),
    },
    varsity: {
      developmentalAbove: formatErgTime(config.varsity?.developmentalAbove ?? defaults.varsity.developmentalAbove),
      competitorAbove: formatErgTime(config.varsity?.competitorAbove ?? defaults.varsity.competitorAbove),
      challengerAbove: formatErgTime(config.varsity?.challengerAbove ?? defaults.varsity.challengerAbove),
      championAbove: formatErgTime(config.varsity?.championAbove ?? defaults.varsity.championAbove),
    },
  };
}

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; icon: typeof Shield }> = {
  coach: { label: 'Coach', color: 'text-indigo-400', icon: ShieldAlert },
  coxswain: { label: 'Coxswain', color: 'text-amber-400', icon: Shield },
  member: { label: 'Member', color: 'text-neutral-400', icon: User },
};

export function CoachingSettings() {
  const { userId, teamId, isLoadingTeam, teams, refreshTeam } = useCoachingContext();
  const navigate = useNavigate();

  const [team, setTeam] = useState<Team | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Delete team
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [dataCounts, setDataCounts] = useState<{ athletes: number; sessions: number; assignments: number; boatings: number; ergScores: number } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  
  // Organization
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('none');
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [orgSaveSuccess, setOrgSaveSuccess] = useState(false);
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [editOrgName, setEditOrgName] = useState('');
  const [isSavingOrgName, setIsSavingOrgName] = useState(false);
  const [orgNameSaveSuccess, setOrgNameSaveSuccess] = useState(false);
  const [rubricForm, setRubricForm] = useState<RubricFormState>(buildRubricForm(null));
  const [isSavingOrgRubric, setIsSavingOrgRubric] = useState(false);
  const [orgRubricSaveSuccess, setOrgRubricSaveSuccess] = useState(false);

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;

    Promise.all([getTeam(teamId), getTeamMembers(teamId), userId ? getOrganizationsForUser(userId) : Promise.resolve([])])
      .then(([t, m, userOrgs]) => {
        setTeam(t);
        setMembers(m);
        setOrgs(userOrgs);
        setSelectedOrgId(t?.org_id ?? 'none');
        const selectedOrg = userOrgs.find((org) => org.id === (t?.org_id ?? ''));
        setEditOrgName(selectedOrg?.name ?? '');
        setRubricForm(buildRubricForm(selectedOrg));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load team'))
      .finally(() => setIsLoading(false));
  }, [teamId, isLoadingTeam, userId]);

  const handleTeamInfoChanged = async () => {
    await refreshTeam();
    if (!teamId) return;
    const refreshedTeam = await getTeam(teamId);
    setTeam(refreshedTeam);
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

  const handleOrgChange = async (newOrgId: string) => {
    if (newOrgId === 'new') {
      setShowNewOrgForm(true);
      return;
    }
    setShowNewOrgForm(false);
    if (!teamId) return;
    setIsSavingOrg(true);
    try {
      if (newOrgId === 'none') {
        await removeTeamFromOrg(teamId);
      } else {
        await assignTeamToOrg(teamId, newOrgId);
      }
      setSelectedOrgId(newOrgId);
      setTeam((prev) => prev ? { ...prev, org_id: newOrgId === 'none' ? null : newOrgId } : prev);
      const selectedOrg = orgs.find((o) => o.id === newOrgId);
      setEditOrgName(selectedOrg?.name ?? '');
      setRubricForm(buildRubricForm(selectedOrg));
      setOrgSaveSuccess(true);
      setTimeout(() => setOrgSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleCreateAndAssignOrg = async () => {
    if (!teamId || !userId || !newOrgName.trim()) return;
    setIsSavingOrg(true);
    try {
      const newOrg = await createOrganization(userId, {
        name: newOrgName.trim(),
        description: newOrgDescription.trim() || undefined,
      });
      await assignTeamToOrg(teamId, newOrg.id);
      setOrgs((prev) => [...prev, newOrg]);
      setSelectedOrgId(newOrg.id);
      setTeam((prev) => prev ? { ...prev, org_id: newOrg.id } : prev);
      setEditOrgName(newOrg.name);
      setRubricForm(buildRubricForm(newOrg));
      setShowNewOrgForm(false);
      setNewOrgName('');
      setNewOrgDescription('');
      setOrgSaveSuccess(true);
      setTimeout(() => setOrgSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleSaveOrgName = async () => {
    if (selectedOrgId === 'none' || !editOrgName.trim()) return;
    setIsSavingOrgName(true);
    try {
      const updated = await updateOrganization(selectedOrgId, { name: editOrgName.trim() });
      setOrgs((prev) => prev.map((org) => (org.id === updated.id ? updated : org)));
      setOrgNameSaveSuccess(true);
      setTimeout(() => setOrgNameSaveSuccess(false), 2000);
      await refreshTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization name');
    } finally {
      setIsSavingOrgName(false);
    }
  };

  const handleRubricInputChange = (squad: SquadKey, field: keyof RubricFormState[SquadKey], value: string) => {
    setRubricForm((prev) => ({
      ...prev,
      [squad]: { ...prev[squad], [field]: value },
    }));
  };

  const handleSaveOrgRubric = async () => {
    if (selectedOrgId === 'none') return;
    setIsSavingOrgRubric(true);
    try {
      const parsed = PERFORMANCE_TIER_SQUADS.reduce<Record<SquadKey, { developmentalAbove: number; competitorAbove: number; challengerAbove: number; championAbove: number }>>((acc, squad) => {
        const row = rubricForm[squad];
        const developmentalAbove = parseErgTimeInput(row.developmentalAbove);
        const competitorAbove = parseErgTimeInput(row.competitorAbove);
        const challengerAbove = parseErgTimeInput(row.challengerAbove);
        const championAbove = parseErgTimeInput(row.championAbove);
        if (
          developmentalAbove == null ||
          competitorAbove == null ||
          challengerAbove == null ||
          championAbove == null ||
          !(developmentalAbove > competitorAbove && competitorAbove > challengerAbove && challengerAbove > championAbove)
        ) {
          throw new Error(`Invalid rubric values for ${squad}. Use m:ss and descending cutoffs.`);
        }
        acc[squad] = { developmentalAbove, competitorAbove, challengerAbove, championAbove };
        return acc;
      }, {} as Record<SquadKey, { developmentalAbove: number; competitorAbove: number; challengerAbove: number; championAbove: number }>);

      const updated = await updateOrganization(selectedOrgId, { performance_tier_rubric: parsed });
      setOrgs((prev) => prev.map((org) => (org.id === updated.id ? updated : org)));
      setRubricForm(buildRubricForm(updated));
      setOrgRubricSaveSuccess(true);
      setTimeout(() => setOrgRubricSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save performance rubric');
    } finally {
      setIsSavingOrgRubric(false);
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
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Settings</h1>
            <p className="text-neutral-400 mt-1">Manage this team, or create another one for the same program.</p>
          </div>
          <RouterLink
            to="/team-management/setup"
            className="self-start flex items-center gap-1.5 px-3 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Another Team</span>
          </RouterLink>
        </div>

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
          <TeamInfoEditorList teams={teams} onTeamsChanged={handleTeamInfoChanged} />
        </div>

        {/* Organization */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Organization
          </h2>
          <p className="text-neutral-400 text-sm">
            Assign this team to an organization (club or program) to group it with other teams.
          </p>

          <div className="flex items-center gap-3">
            <select
              value={showNewOrgForm ? 'new' : selectedOrgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              disabled={isSavingOrg}
              aria-label="Organization"
              className="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50"
            >
              <option value="none">No organization (standalone)</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
              <option value="new">+ Create new organization</option>
            </select>
            {isSavingOrg && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
            {orgSaveSuccess && <Check className="w-4 h-4 text-green-400" />}
          </div>

          {selectedOrgId !== 'none' && !showNewOrgForm && (
            <div className="border border-neutral-700 rounded-lg p-4 space-y-3 bg-neutral-800/50">
              <div>
                <label htmlFor="edit-org-name" className="block text-sm font-medium text-neutral-300 mb-1">
                  Organization Name
                </label>
                <input
                  id="edit-org-name"
                  type="text"
                  value={editOrgName}
                  onChange={(e) => setEditOrgName(e.target.value)}
                  minLength={3}
                  maxLength={100}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={handleSaveOrgName}
                disabled={isSavingOrgName || editOrgName.trim().length < 3}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 text-sm"
              >
                {isSavingOrgName ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : orgNameSaveSuccess ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {orgNameSaveSuccess ? 'Saved!' : 'Save Organization Name'}
              </button>

              <div className="pt-3 border-t border-neutral-700 space-y-2">
                <h3 className="text-sm font-semibold text-white">Performance Tier Rubric (2k cutoffs)</h3>
                <p className="text-xs text-neutral-400">Format all fields as m:ss. Slower-to-faster thresholds must descend left to right.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-neutral-400 border-b border-neutral-700">
                        <th className="text-left py-2 pr-2">Squad</th>
                        <th className="text-left py-2 pr-2">Dev cutoff</th>
                        <th className="text-left py-2 pr-2">Competitor cutoff</th>
                        <th className="text-left py-2 pr-2">Challenger cutoff</th>
                        <th className="text-left py-2">Champion cutoff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERFORMANCE_TIER_SQUADS.map((squad) => (
                        <tr key={squad} className="border-b border-neutral-800/70">
                          <td className="py-2 pr-2 text-neutral-200 capitalize">{squad}</td>
                          <td className="py-2 pr-2">
                            <input title={`${squad} developmental cutoff`} aria-label={`${squad} developmental cutoff`} placeholder="7:40" value={rubricForm[squad].developmentalAbove} onChange={(e) => handleRubricInputChange(squad, 'developmentalAbove', e.target.value)} className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white" />
                          </td>
                          <td className="py-2 pr-2">
                            <input title={`${squad} competitor cutoff`} aria-label={`${squad} competitor cutoff`} placeholder="7:10" value={rubricForm[squad].competitorAbove} onChange={(e) => handleRubricInputChange(squad, 'competitorAbove', e.target.value)} className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white" />
                          </td>
                          <td className="py-2 pr-2">
                            <input title={`${squad} challenger cutoff`} aria-label={`${squad} challenger cutoff`} placeholder="6:50" value={rubricForm[squad].challengerAbove} onChange={(e) => handleRubricInputChange(squad, 'challengerAbove', e.target.value)} className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white" />
                          </td>
                          <td className="py-2">
                            <input title={`${squad} champion cutoff`} aria-label={`${squad} champion cutoff`} placeholder="6:30" value={rubricForm[squad].championAbove} onChange={(e) => handleRubricInputChange(squad, 'championAbove', e.target.value)} className="w-20 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-white" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={handleSaveOrgRubric}
                  disabled={isSavingOrgRubric}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 text-sm"
                >
                  {isSavingOrgRubric ? <Loader2 className="w-4 h-4 animate-spin" /> : orgRubricSaveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {orgRubricSaveSuccess ? 'Saved!' : 'Save Rubric'}
                </button>
              </div>
            </div>
          )}

          {showNewOrgForm && (
            <div className="border border-neutral-700 rounded-lg p-4 space-y-3 bg-neutral-800/50">
              <div>
                <label htmlFor="settings-org-name" className="block text-sm font-medium text-neutral-300 mb-1">
                  Organization Name *
                </label>
                <input
                  id="settings-org-name"
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  minLength={3}
                  maxLength={100}
                  placeholder="e.g. City Rowing Club"
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-org-desc" className="block text-sm font-medium text-neutral-300 mb-1">
                  Description
                </label>
                <input
                  id="settings-org-desc"
                  type="text"
                  value={newOrgDescription}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateAndAssignOrg}
                  disabled={isSavingOrg || newOrgName.trim().length < 3}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {isSavingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                  Create & Assign
                </button>
                <button
                  onClick={() => { setShowNewOrgForm(false); setSelectedOrgId(team?.org_id ?? 'none'); }}
                  className="px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
            <button
              onClick={() => setShowBulkInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Coaches
            </button>
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

      {/* ── Analytics Settings ──────────────────────────────────────── */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Analytics</h2>
            <p className="text-neutral-500 text-sm">Configure how performance metrics are calculated</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Leaderboard Time Range</label>
            <p className="text-xs text-neutral-500 mb-2">
              Team Analytics now filters Speed Index and ranking summaries by time range on the page itself. The default view is the last 4 weeks, with presets for last week, current season, and all time.
            </p>
          </div>

          <div className="border-t border-neutral-800 pt-3">
            <label className="block text-sm font-medium text-neutral-300 mb-1">Speed Index Formula</label>
            <p className="text-xs text-neutral-500 mb-3">
              Speed Index exists because raw speed and W/lb both represent something real, but watts already sits downstream of split. The index now treats the two standardized signals as a 50/50 blend so efficiency stays visible without adding a second explicit speed bias on top of the physics already embedded in the power calculation.
            </p>
            <p className="text-xs text-neutral-500 mb-3">
              The normalization step matters because split and W/lb are different kinds of numbers. Using a z-score puts both signals into the same relative language for that workout: how far above or below the group average an athlete performed. Once both are on the same scale, blending them into one readable index is defensible instead of arbitrary.
            </p>

          </div>

          {/* Backfill existing data */}
          <div className="border-t border-neutral-800 pt-3">
            <label className="block text-sm font-medium text-neutral-300 mb-1">Recompute Speed Index</label>
            <p className="text-xs text-neutral-500 mb-2">
              Recalculate Speed Index for historical workouts using the same equal-weight standardized speed-plus-efficiency formula. This is safe to run multiple times.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!teamId) return;
                  setIsBackfilling(true);
                  setBackfillResult(null);
                  try {
                    const count = await backfillTitanIndexes(teamId, { orgId: team?.org_id ?? undefined, force: true });
                    setBackfillResult(count > 0 ? `Done — recomputed ${count} workout${count === 1 ? '' : 's'}` : 'No completed workouts were available to recompute');
                  } catch (err) {
                    setBackfillResult(err instanceof Error ? err.message : 'Backfill failed');
                  } finally {
                    setIsBackfilling(false);
                  }
                }}
                disabled={isBackfilling}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isBackfilling ? 'Computing…' : 'Recompute History'}
              </button>
              {backfillResult && (
                <span className="text-xs text-neutral-400">{backfillResult}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <div className="bg-neutral-900 border border-red-900/40 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-900/30 rounded-lg">
            <TriangleAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
            <p className="text-neutral-500 text-sm">Irreversible actions</p>
          </div>
        </div>

        <div className="border border-red-900/30 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-medium text-sm">Delete this team</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Permanently delete this team and all its data — athletes, sessions, assignments, boatings, and erg scores. This cannot be undone.
            </p>
          </div>
          <button
            onClick={async () => {
              setShowDeleteConfirm(true);
              setDeleteConfirmName('');
              if (!dataCounts) {
                setIsLoadingCounts(true);
                try {
                  const counts = await getTeamDataCounts(teamId);
                  setDataCounts(counts);
                } catch {
                  // non-critical — just won't show counts
                } finally {
                  setIsLoadingCounts(false);
                }
              }
            }}
            className="px-4 py-2 bg-red-900/30 border border-red-800 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors text-sm font-medium whitespace-nowrap"
          >
            Delete Team
          </button>
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

      {/* Delete Team Confirmation Dialog */}
      {showDeleteConfirm && team && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-red-900/40 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Team Permanently</h3>
            </div>

            {/* Data warning */}
            {isLoadingCounts ? (
              <div className="flex items-center gap-2 text-neutral-400 text-sm mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking team data...
              </div>
            ) : dataCounts && (dataCounts.athletes > 0 || dataCounts.sessions > 0 || dataCounts.assignments > 0 || dataCounts.boatings > 0 || dataCounts.ergScores > 0) ? (
              <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm font-medium mb-2">This will permanently delete:</p>
                <ul className="text-red-300/80 text-sm space-y-1">
                  {dataCounts.athletes > 0 && <li>• {dataCounts.athletes} athlete{dataCounts.athletes !== 1 ? 's' : ''} (roster data)</li>}
                  {dataCounts.sessions > 0 && <li>• {dataCounts.sessions} practice session{dataCounts.sessions !== 1 ? 's' : ''}</li>}
                  {dataCounts.assignments > 0 && <li>• {dataCounts.assignments} workout assignment{dataCounts.assignments !== 1 ? 's' : ''}</li>}
                  {dataCounts.boatings > 0 && <li>• {dataCounts.boatings} boating lineup{dataCounts.boatings !== 1 ? 's' : ''}</li>}
                  {dataCounts.ergScores > 0 && <li>• {dataCounts.ergScores} erg score{dataCounts.ergScores !== 1 ? 's' : ''}</li>}
                </ul>
                <p className="text-red-400/70 text-xs mt-2">This data cannot be recovered.</p>
              </div>
            ) : dataCounts ? (
              <p className="text-neutral-400 text-sm mb-4">This team has no coaching data. It's safe to delete.</p>
            ) : null}

            <p className="text-neutral-300 text-sm mb-3">
              Type <span className="font-mono font-semibold text-white bg-neutral-800 px-1.5 py-0.5 rounded">{team.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={team.name}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none mb-4"
              autoFocus
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}
                className="px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmName !== team.name || isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteTeam(teamId);
                    setShowDeleteConfirm(false);
                    // If user has other teams, refresh and go to dashboard; otherwise go to setup
                    if (teams.length > 1) {
                      await refreshTeam();
                      navigate('/team-management');
                    } else {
                      navigate('/team-management/setup');
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete team');
                    setIsDeleting(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Coach Invite Modal */}
      {showBulkInvite && team && (
        <BulkCoachInviteModal
          teamId={teamId}
          teamName={team.name}
          orgId={team?.org_id ?? null}
          orgName={editOrgName || null}
          onClose={() => setShowBulkInvite(false)}
          onInvited={() => {
            getTeamMembers(teamId).then(setMembers).catch(() => {});
          }}
        />
      )}
    </>
  );
}
