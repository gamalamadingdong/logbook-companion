import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Save,
  Loader2,
  AlertTriangle,
  TriangleAlert,
  Shield,
  ShieldAlert,
  User,
  Trash2,
  UserPlus,
  Link,
  Mail,
  Building2,
  Plus,
  BarChart3,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Card, EmptyState, Input } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { ClubManagement } from '../../components/coaching/ClubManagement';
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
  updateTeamMemberAdmin,
  canCreateCoachingSpace,
  getOrganizationMembershipsForUser,
  removeTeamMember,
  addTeamMemberByEmail,
  sendTeamInviteEmail,
  getOrganizationsForUser,
  assignTeamToOrg,
  removeTeamFromOrg,
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
  const { userId, teamId, filterTeamId, orgId, isLoadingTeam, refreshTeam, teams, setFilterTeamId, switchTeam } = useCoachingContext();
  const settingsRef = useRef<HTMLDivElement>(null);
  const [manageDestination, setManageDestination] = useState<string | null>(null);
  useEffect(() => {
    if (manageDestination && teamId === manageDestination && filterTeamId === manageDestination) settingsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [manageDestination, teamId, filterTeamId]);
  const [canCreate, setCanCreate] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCanCreate(false);
    canCreateCoachingSpace().then(allowed => { if (!cancelled) setCanCreate(allowed === true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);
  const selectedTeam = teams.find(t => t.team_id === teamId);
  const [clubsVersion, setClubsVersion] = useState(0);
  const clubsChanged = async () => {
    try { await refreshTeam({ throwOnError: true }); }
    finally { setClubsVersion(v => v + 1); }
  };
  return <>
    <CoachingNav />
    <div className="px-4 sm:px-6 pt-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-content-primary">Manage clubs &amp; teams</h1>{canCreate && <RouterLink to="/team-management/setup" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-content-secondary hover:text-accent-coaching focus-visible:outline-2 focus-visible:outline-focus"><Plus className="h-4 w-4" aria-hidden="true" />Add team</RouterLink>}</div>
      <ClubManagement key={userId} userId={userId} onChanged={clubsChanged} teams={teams} isLoadingTeams={isLoadingTeam} onManageTeam={id => {
        const destination = teams.find(team => team.team_id === id);
        if (!destination || destination.is_admin !== true) return;
        if ((destination.org_id ?? null) === orgId) setFilterTeamId(id); else switchTeam(id);
        setManageDestination(id);
        if (teamId === id && filterTeamId === id) settingsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }} />
    </div>
    <div ref={settingsRef}>
    {!isLoadingTeam && (!selectedTeam || (orgId && filterTeamId === null)) ? <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      <EmptyState title="Select a team to manage settings"
        description="Use Manage team in the directory above to change club affiliation, details, invitations and account access. You can also add a team." />
    </div> : !isLoadingTeam && selectedTeam?.is_admin !== true ? <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      <Card padding="lg"><h2 className="text-lg font-semibold text-content-primary">Team settings · {selectedTeam?.team_name ?? 'Selected team'}</h2>
        <p className="mt-2 text-content-secondary">Team administration requires Admin access. Ask a team or club admin to change settings, invitations, staff access or club affiliation.</p>
        <p className="mt-2 text-sm text-content-muted">Coaches can continue managing training and roster operations. Coxswains can edit lineups, practice records and workout results.</p>
      </Card>
    </div> : <SelectedTeamSettings key={`${userId}:${teamId}:${selectedTeam?.is_admin}`} clubsVersion={clubsVersion} onDeleted={clubsChanged} />}
    </div>
  </>;
}

function errorMessage(error: unknown, fallback: string) {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}

function SelectedTeamSettings({ clubsVersion, onDeleted }: { clubsVersion: number; onDeleted: () => Promise<void> }) {
  const { userId, teamId, isLoadingTeam, teams, refreshTeam } = useCoachingContext();
  const selectedTeams = useMemo(() => teams.filter(t => t.team_id === teamId), [teams, teamId]);


  const [team, setTeam] = useState<Team | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [adminSaving, setAdminSaving] = useState<string | null>(null);
  const [clubAdminIds, setClubAdminIds] = useState<string[]>([]);
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
  const deleteLock = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [deleteRefreshFailed, setDeleteRefreshFailed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dataCounts, setDataCounts] = useState<{ athletes: number; sessions: number; assignments: number; boatings: number; ergScores: number } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  
  // Organization
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('none');
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [orgSaveSuccess, setOrgSaveSuccess] = useState(false);
  const [rubricForm, setRubricForm] = useState<RubricFormState>(buildRubricForm(null));
  const [isSavingOrgRubric, setIsSavingOrgRubric] = useState(false);
  const [orgRubricSaveSuccess, setOrgRubricSaveSuccess] = useState(false);

  useEffect(() => {
    if (!teamId || isLoadingTeam) return;

    let cancelled = false;
    Promise.all([getTeam(teamId), getTeamMembers(teamId), userId ? getOrganizationsForUser(userId) : Promise.resolve([]), userId ? getOrganizationMembershipsForUser(userId) : Promise.resolve([])])
      .then(([t, m, userOrgs, orgMemberships]) => {
        if (cancelled) return;
        setTeam(t);
        setMembers(m);
        setOrgs(userOrgs);
        setClubAdminIds(orgMemberships.filter(m => m.role === 'owner' || m.role === 'admin').map(m => m.org_id));
        setSelectedOrgId(t?.org_id ?? 'none');
        const selectedOrg = userOrgs.find((org) => org.id === (t?.org_id ?? ''));
        setRubricForm(buildRubricForm(selectedOrg));
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load team'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
  return () => { cancelled = true; };
  }, [teamId, isLoadingTeam, userId, clubsVersion]);

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

  const handleAdminChange = async (member: TeamMemberWithProfile) => {
    if (adminSaving || member.role !== 'coach' || member.user_id === userId || member.user_id === team?.coach_id) return;
    setAdminSaving(member.id);
    try {
      const isAdmin = member.is_admin !== true;
      await updateTeamMemberAdmin(member.id, isAdmin);
      setMembers(previous => previous.map(m => m.id === member.id ? { ...m, is_admin: isAdmin } : m));
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to change Admin access. Please try again.'); }
    finally { setAdminSaving(null); }
  };

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    const member = members.find(m => m.id === memberId);
    if (!member || member.user_id === team?.coach_id || member.user_id === userId) return;
    try {
      await updateTeamMemberRole(memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole, is_admin: newRole === 'coach' ? m.is_admin : false } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member || member.user_id === team?.coach_id || member.user_id === userId) return;
    try {
      await removeTeamMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setRemovingMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleOrgChange = async (newOrgId: string) => {
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
      setRubricForm(buildRubricForm(selectedOrg));
      setOrgSaveSuccess(true);
      setTimeout(() => setOrgSaveSuccess(false), 2000);
      await refreshTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleRubricInputChange = (squad: SquadKey, field: keyof RubricFormState[SquadKey], value: string) => {
    setRubricForm((prev) => ({
      ...prev,
      [squad]: { ...prev[squad], [field]: value },
    }));
  };

  const handleSaveOrgRubric = async () => {
    if (!clubAdminIds.includes(selectedOrgId)) return;
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

  async function loadDeleteCounts() {
    setIsLoadingCounts(true); setDataCounts(null); setCountsError(null);
    try { setDataCounts(await getTeamDataCounts(teamId)); }
    catch (err) { setCountsError(errorMessage(err, 'Unable to check team data. Please retry.')); }
    finally { setIsLoadingCounts(false); }
  }
  async function refreshAfterDelete() {
    try { await onDeleted(); setDeleteRefreshFailed(false); }
    catch { setDeleteRefreshFailed(true); }
  }
  if (deleted) return <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto"><Card padding="lg"><p role="status" className="text-content-secondary">Team deleted.</p>{deleteRefreshFailed && <div role="alert" className="text-content-secondary">The scope selector could not refresh. <Button variant="secondary" className="min-h-11" onClick={() => void refreshAfterDelete()}>Retry refresh</Button></div>}</Card></div>;
  if (isLoading || isLoadingTeam) {
    return (
      <>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-content-primary">Team settings · {team?.name}</h2>
            <p className="text-content-secondary mt-1">Manage {team?.name ?? 'the selected team'}, its club, invitations, and account access.</p>
          </div>

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
          <TeamInfoEditorList teams={selectedTeams} title="Selected team identity"
            subtitle="Edit the team selected above. Choose another team to manage its details."
            onTeamsChanged={handleTeamInfoChanged} />
        </div>

        {/* Organization */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Team's club
          </h2>
          <p className="text-neutral-400 text-sm">
            Choose an existing club for this team. Use Add club above to create one first.
          </p>

          <div className="flex items-center gap-3">
            <select
              value={selectedOrgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              disabled={isSavingOrg}
              aria-label="Club for this team"
              className="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50"
            >
              <option value="none">No club (standalone)</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {isSavingOrg && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
            {orgSaveSuccess && <Check className="w-4 h-4 text-green-400" />}
          </div>

          {selectedOrgId !== 'none' && clubAdminIds.includes(selectedOrgId) && (
            <div className="border border-neutral-700 rounded-lg p-4 space-y-3 bg-neutral-800/50">
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

          <p className="text-sm text-content-muted">Admin grants team settings and staff management. Team owners and club admins retain access through their existing roles.</p>
          {members.length === 0 ? (
            <p className="text-neutral-500 text-sm py-4 text-center">
              No members yet. Share your invite code to get started.
            </p>
          ) : (
            <div className="divide-y divide-neutral-800">
              {members.map((member) => {
                const isCurrentUser = member.user_id === userId;
                const isOwner = member.user_id === team?.coach_id;
                const cfg = ROLE_CONFIG[member.role];
                const Icon = cfg.icon;

                return (
                  <div key={member.id} className="flex flex-wrap items-center justify-between py-3 gap-4">
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
                      {member.role === 'coach' && <Button variant="secondary" className="min-h-11" aria-label={`Admin access for ${member.display_name}`} aria-pressed={isOwner || member.is_admin === true} disabled={isCurrentUser || isOwner || adminSaving !== null} loading={adminSaving === member.id} onClick={() => void handleAdminChange(member)}>
                        Admin: {isOwner ? 'On (inherited)' : member.is_admin === true ? 'On' : 'Off'}
                      </Button>}
                      {/* Role selector — don't allow self-demotion */}
                      {!isCurrentUser && !isOwner ? (
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
                      {!isCurrentUser && !isOwner && (
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
              Speed Index exists because raw speed and relative power both represent something real. We intentionally blend the two standardized signals 50/50, even though watts already sits downstream of split, because we want the ranking to keep actual speed primary while still giving explicit credit to athletes who produce more power for their size.
            </p>
            <p className="text-xs text-neutral-500 mb-3">
              We are aware that this choice gives raw power more voice than a perfectly “clean” efficiency-only blend would. The relative-power side is currently shown as W/lb on leaderboard surfaces, while other tables may also expose W/kg. That overlap is intentional rather than accidental.
            </p>
            <p className="text-xs text-neutral-500 mb-3">
              The normalization step matters because split and relative power are different kinds of numbers. Using a z-score puts both signals into the same relative language for that workout: how far above or below the group average an athlete performed. Once both are on the same scale, blending them into one readable index is defensible instead of arbitrary.
            </p>

          </div>

          {/* Backfill existing data */}
          <div className="border-t border-neutral-800 pt-3">
            <label className="block text-sm font-medium text-neutral-300 mb-1">Recompute Speed Index</label>
            <p className="text-xs text-neutral-500 mb-2">
              Recalculate Speed Index for historical workouts using the same equal-weight standardized speed-plus-relative-power formula. This is safe to run multiple times.
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
            onClick={() => {
              setShowDeleteConfirm(true); setDeleteConfirmName(''); setDeleteError(null);
              void loadDeleteCounts();
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

      {showDeleteConfirm && team && <Modal open onClose={() => { if (!deleteLock.current) setShowDeleteConfirm(false); }} title="Delete Team Permanently" description="Deleting a team permanently removes its coaching data. Archived season history may prevent deletion.">
        <div className="space-y-4">
          {isLoadingCounts && <p role="status" className="text-content-muted">Checking team data…</p>}
          {countsError && <div role="alert" className="text-content-secondary">{countsError}<Button variant="secondary" className="min-h-11" onClick={() => void loadDeleteCounts()}>Retry preview</Button></div>}
          {dataCounts && <ul className="text-sm text-content-secondary space-y-1"><li>Athletes: {dataCounts.athletes}</li><li>Practice sessions: {dataCounts.sessions}</li><li>Assignments: {dataCounts.assignments}</li><li>Boating lineups: {dataCounts.boatings}</li><li>Erg scores: {dataCounts.ergScores}</li></ul>}
          <Input id="team-delete-confirm" label={`Type ${team.name} to confirm`} value={deleteConfirmName} onChange={event => setDeleteConfirmName(event.target.value)} disabled={isDeleting} className="min-h-11" />
          {deleteError && <p role="alert" className="text-sm text-accent-danger">{deleteError}</p>}
          <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" className="min-h-11" disabled={isDeleting} onClick={() => setShowDeleteConfirm(false)}>Cancel</Button><Button variant="danger" className="min-h-11" loading={isDeleting} disabled={deleteConfirmName !== team.name || isDeleting || isLoadingCounts || !dataCounts || !!countsError} onClick={async () => {
            if (deleteLock.current || isLoadingCounts || !dataCounts || countsError || deleteConfirmName !== team.name) return;
            deleteLock.current = true; setIsDeleting(true); setDeleteError(null);
            try {
              await deleteTeam(teamId); setShowDeleteConfirm(false); setDeleted(true);
              await refreshAfterDelete();
            } catch (err) { setDeleteError(errorMessage(err, 'Failed to delete team. Please retry.')); }
            finally { deleteLock.current = false; setIsDeleting(false); }
          }}>Delete Forever</Button></div>
        </div>
      </Modal>}

      {/* Bulk Coach Invite Modal */}
      {showBulkInvite && team && (
        <BulkCoachInviteModal
          teamId={teamId}
          teamName={team.name}
          orgId={team?.org_id ?? null}
          orgName={orgs.find(org => org.id === selectedOrgId)?.name ?? null}
          onClose={() => setShowBulkInvite(false)}
          onInvited={() => {
            getTeamMembers(teamId).then(setMembers).catch(() => {});
          }}
        />
      )}
    </>
  );
}
