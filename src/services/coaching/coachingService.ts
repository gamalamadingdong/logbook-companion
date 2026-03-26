import type { PostgrestError } from '@supabase/supabase-js';
import { format, addDays, parseISO } from 'date-fns';
import { supabase } from '../supabase';
import type {
  Athlete,
  CoachingAthlete,
  TeamAthlete,
  Team,
  TeamMember,
  TeamMemberWithProfile,
  TeamRole,
  PerformanceTier,
  UserTeamInfo,
  CoachingSession,
  CoachingAthleteNote,
  CoachingAthleteCoachNote,
  CoachingErgScore,
  CoachingBoat,
  CoachingBoating,
  CoachingSessionCrew,
  CoachingSessionCrewPosition,
  BoatType,
  BoatPosition,
  CoachingWeeklyPlan,
  WeeklyPlanInput,
  GroupAssignment,
  GroupAssignmentInput,
  AssignmentCompletion,
  Organization,
  OrgRole,
  OrganizationMember,
  CoachingScheduleEvent,
  ScheduleEventType,
} from './types';

// Re-export types for convenience
export type {
  Athlete,
  CoachingAthlete,
  TeamAthlete,
  Team,
  TeamMember,
  TeamMemberWithProfile,
  TeamRole,
  PerformanceTier,
  UserTeamInfo,
  CoachingSession,
  CoachingAthleteNote,
  CoachingAthleteCoachNote,
  CoachingErgScore,
  CoachingBoat,
  CoachingBoating,
  CoachingSessionCrew,
  CoachingSessionCrewPosition,
  BoatType,
  BoatPosition,
  CoachingWeeklyPlan,
  WeeklyPlanInput,
  GroupAssignment,
  GroupAssignmentInput,
  AssignmentCompletion,
  Organization,
  OrgRole,
  OrganizationMember,
  CoachingScheduleEvent,
  ScheduleEventType,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function throwOnError<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

let resultWeightColumnAvailable: boolean | null = null;
let performanceTierColumnAvailable: boolean | null = null;

type SessionCrewRow = Omit<CoachingSessionCrew, 'positions'>;
type SessionCrewPositionInput = Pick<CoachingSessionCrewPosition, 'seat' | 'athlete_name'> &
  Partial<Pick<CoachingSessionCrewPosition, 'athlete_id'>>;

function markResultWeightColumnAvailable(value: boolean): void {
  if (value) {
    if (resultWeightColumnAvailable !== false) {
      resultWeightColumnAvailable = true;
    }
    return;
  }
  resultWeightColumnAvailable = false;
}

export function getResultWeightColumnAvailability(): boolean | null {
  return resultWeightColumnAvailable;
}

function markPerformanceTierColumnAvailable(value: boolean): void {
  if (value) {
    if (performanceTierColumnAvailable !== false) {
      performanceTierColumnAvailable = true;
    }
    return;
  }
  performanceTierColumnAvailable = false;
}

function isMissingPerformanceTierColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  const code = (error.code ?? '').toLowerCase();
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  if (code === 'pgrst204' || code === '42703') {
    return true;
  }
  return message.includes('performance_tier') && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

function isMissingResultWeightColumn(error: PostgrestError | null): boolean {
  if (!error) return false;
  const code = (error.code ?? '').toLowerCase();
  const message = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  if (code === 'pgrst204' || code === '42703') {
    return true;
  }
  return message.includes('result_weight_kg') && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

/** Compute display name from first/last */
function toCoachingAthlete(athlete: Athlete): CoachingAthlete {
  return {
    ...athlete,
    name: `${athlete.first_name} ${athlete.last_name}`.trim(),
  };
}

const teamRolePriority: Record<TeamRole, number> = {
  member: 0,
  coxswain: 1,
  coach: 2,
};

function orgRoleToTeamRole(role: OrgRole): TeamRole {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'coach':
    default:
      return 'coach';
  }
}

async function ensureTeamMemberAthleteLink(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('ensure_team_member_athlete_link', {
    p_team_id: teamId,
    p_user_id: userId,
  });

  if (error) throw error;
}

function resolveOrgName(
  value: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

function mergeUserTeamInfo(
  existing: UserTeamInfo | undefined,
  incoming: UserTeamInfo
): UserTeamInfo {
  if (!existing) return incoming;

  const role = teamRolePriority[incoming.role] > teamRolePriority[existing.role]
    ? incoming.role
    : existing.role;

  return {
    team_id: existing.team_id,
    team_name: existing.team_name !== 'Unnamed Team' ? existing.team_name : incoming.team_name,
    role,
    org_id: existing.org_id ?? incoming.org_id ?? null,
    org_name: existing.org_name ?? incoming.org_name ?? null,
  };
}

// ─── Team Resolution ────────────────────────────────────────────────────────

/** Get the first team_id for a given user (from team_members) */
export async function getTeamForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.team_id;
}

/** Get ALL teams a user belongs to (with team name + role + org info) */
export async function getTeamsForUser(userId: string): Promise<UserTeamInfo[]> {
  const { data: directRows, error: directError } = await supabase
    .from('team_members')
    .select('team_id, role, teams(name, org_id, organizations(name))')
    .eq('user_id', userId)
    .order('joined_at');

  if (directError || !directRows) return [];

  const directTeams = (directRows as unknown as {
    team_id: string;
    role: string;
    teams: {
      name: string;
      org_id: string | null;
      organizations: { name: string } | { name: string }[] | null;
    } | null;
  }[]).map((row) => ({
    team_id: row.team_id,
    team_name: row.teams?.name ?? 'Unnamed Team',
    role: row.role as TeamRole,
    org_id: row.teams?.org_id ?? null,
    org_name: resolveOrgName(row.teams?.organizations),
  }));

  const { data: orgMembershipRows, error: orgMembershipError } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations(name)')
    .eq('user_id', userId);

  if (orgMembershipError || !orgMembershipRows || orgMembershipRows.length === 0) {
    return directTeams;
  }

  const orgAccess = new Map<string, { role: OrgRole; org_name: string | null }>();
  for (const row of orgMembershipRows as unknown as {
    org_id: string;
    role: OrgRole;
    organizations: { name: string } | { name: string }[] | null;
  }[]) {
    orgAccess.set(row.org_id, {
      role: row.role,
      org_name: resolveOrgName(row.organizations),
    });
  }

  const orgIds = [...orgAccess.keys()];
  if (orgIds.length === 0) return directTeams;

  const { data: orgTeamRows, error: orgTeamsError } = await supabase
    .from('teams')
    .select('id, name, org_id')
    .in('org_id', orgIds)
    .order('name');

  if (orgTeamsError || !orgTeamRows) {
    return directTeams;
  }

  const merged = new Map<string, UserTeamInfo>();
  for (const team of directTeams) {
    merged.set(team.team_id, team);
  }

  for (const row of orgTeamRows as { id: string; name: string; org_id: string | null }[]) {
    if (!row.org_id) continue;
    const orgEntry = orgAccess.get(row.org_id);
    if (!orgEntry) continue;

    const nextTeam: UserTeamInfo = {
      team_id: row.id,
      team_name: row.name,
      role: orgRoleToTeamRole(orgEntry.role),
      org_id: row.org_id,
      org_name: orgEntry.org_name,
    };

    merged.set(nextTeam.team_id, mergeUserTeamInfo(merged.get(nextTeam.team_id), nextTeam));
  }

  return Array.from(merged.values()).sort((a, b) => {
    const orgA = a.org_name ?? 'Standalone Teams';
    const orgB = b.org_name ?? 'Standalone Teams';
    return orgA.localeCompare(orgB) || a.team_name.localeCompare(b.team_name);
  });
}

// ─── Team CRUD ──────────────────────────────────────────────────────────────

/** Generate an 8-char alphanumeric invite code */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Get team details by ID */
export async function getTeam(teamId: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (error || !data) return null;
  return data as Team;
}

/** Get full details for many teams by ID */
export async function getTeamsByIds(teamIds: string[]): Promise<Team[]> {
  const ids = [...new Set(teamIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .in('id', ids)
    .order('name');

  if (error || !data) return [];
  return data as Team[];
}

/** Create a new team + add the creator as coach in team_members */
export async function createTeam(
  coachUserId: string,
  team: Pick<Team, 'name'> & Partial<Pick<Team, 'description'>>
): Promise<Team> {
  const inviteCode = generateInviteCode();

  const newTeam = throwOnError(
    await supabase
      .from('teams')
      .insert({
        name: team.name,
        description: team.description ?? null,
        invite_code: inviteCode,
        coach_id: coachUserId,
      })
      .select()
      .single()
  ) as Team;

  // Add the coach as a team member
  throwOnError(
    await supabase
      .from('team_members')
      .insert({
        team_id: newTeam.id,
        user_id: coachUserId,
        role: 'coach',
      })
      .select()
      .single()
  );

  return newTeam;
}

/** Update team name/description */
export async function updateTeam(
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'description' | 'titan_window_size'>>
): Promise<Team> {
  return throwOnError(
    await supabase
      .from('teams')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .select()
      .single()
  ) as Team;
}

/** Get counts of data that would be deleted with a team (for confirmation UI) */
export async function getTeamDataCounts(teamId: string): Promise<{
  athletes: number;
  sessions: number;
  assignments: number;
  boatings: number;
  ergScores: number;
}> {
  const [athletes, sessions, assignments, boatings, ergScores] = await Promise.all([
    supabase.from('team_athletes').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('group_assignments').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('coaching_boatings').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('coaching_erg_scores').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
  ]);
  return {
    athletes: athletes.count ?? 0,
    sessions: sessions.count ?? 0,
    assignments: assignments.count ?? 0,
    boatings: boatings.count ?? 0,
    ergScores: ergScores.count ?? 0,
  };
}

/** Permanently delete a team and all its data (requires ON DELETE CASCADE FKs) */
export async function deleteTeam(teamId: string): Promise<void> {
  throwOnError(
    await supabase.from('teams').delete().eq('id', teamId)
  );
}

/** Regenerate the invite code for a team */
export async function regenerateInviteCode(teamId: string): Promise<string> {
  const newCode = generateInviteCode();
  await supabase
    .from('teams')
    .update({ invite_code: newCode, updated_at: new Date().toISOString() })
    .eq('id', teamId);
  return newCode;
}

// ─── Organization CRUD ──────────────────────────────────────────────────────

/** Create a new organization + add the creator as owner */
export async function createOrganization(
  userId: string,
  org: { name: string; description?: string }
): Promise<Organization> {
  const inviteCode = generateInviteCode();

  const newOrg = throwOnError(
    await supabase
      .from('organizations')
      .insert({
        name: org.name,
        description: org.description ?? null,
        invite_code: inviteCode,
        created_by: userId,
      })
      .select()
      .single()
  ) as Organization;

  // Add the creator as org owner
  throwOnError(
    await supabase
      .from('organization_members')
      .insert({
        org_id: newOrg.id,
        user_id: userId,
        role: 'owner',
      })
      .select()
      .single()
  );

  return newOrg;
}

/** Update an organization's editable fields */
export async function updateOrganization(
  orgId: string,
  updates: { name?: string; description?: string | null; performance_tier_rubric?: Organization['performance_tier_rubric'] }
): Promise<Organization> {
  return throwOnError(
    await supabase
      .from('organizations')
      .update({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.performance_tier_rubric !== undefined ? { performance_tier_rubric: updates.performance_tier_rubric } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)
      .select()
      .single()
  ) as Organization;
}

/** Get all organizations a user belongs to */
export async function getOrganizationsForUser(userId: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', userId)
    .order('joined_at');

  if (error || !data) return [];
  return (data as unknown as { organizations: Organization }[])
    .map((row) => row.organizations)
    .filter(Boolean);
}

/** Look up an organization by its invite code */
export async function getOrgByInviteCode(code: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('invite_code', code.toUpperCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data as Organization | null;
}

/** Join an organization using its invite code */
export async function joinOrgByInviteCode(
  userId: string,
  code: string,
  role: OrgRole = 'coach'
): Promise<{ org: Organization; membership: OrganizationMember }> {
  const org = await getOrgByInviteCode(code);
  if (!org) throw new Error('Invalid organization invite code.');

  // Check if already a member
  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('org_id', org.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) throw new Error('You are already a member of this organization.');

  const membership = throwOnError(
    await supabase
      .from('organization_members')
      .insert({
        org_id: org.id,
        user_id: userId,
        role,
      })
      .select()
      .single()
  ) as OrganizationMember;

  return { org, membership };
}

/** Regenerate the invite code for an organization */
export async function regenerateOrgInviteCode(orgId: string): Promise<string> {
  const newCode = generateInviteCode();
  await supabase
    .from('organizations')
    .update({ invite_code: newCode, updated_at: new Date().toISOString() })
    .eq('id', orgId);
  return newCode;
}

/** Assign a team to an organization */
export async function assignTeamToOrg(teamId: string, orgId: string): Promise<void> {
  throwOnError(
    await supabase
      .from('teams')
      .update({ org_id: orgId, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .select()
      .single()
  );
}

/** Remove a team from its organization (set org_id to null) */
export async function removeTeamFromOrg(teamId: string): Promise<void> {
  throwOnError(
    await supabase
      .from('teams')
      .update({ org_id: null, updated_at: new Date().toISOString() })
      .eq('id', teamId)
      .select()
      .single()
  );
}

/** Get all teams belonging to an organization */
export async function getTeamsForOrg(orgId: string): Promise<Team[]> {
  return throwOnError(
    await supabase
      .from('teams')
      .select('*')
      .eq('org_id', orgId)
      .order('name')
  ) as Team[];
}

/**
 * Get all active athletes across every team in an organization.
 * De-duplicates athletes that belong to multiple teams.
 */
export async function getOrgAthletes(orgId: string): Promise<CoachingAthlete[]> {
  // Get all team IDs for this org
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return [];
  const teamIds = teams.map((t) => t.id);

  let rows: (Athlete & { team_athletes: TeamAthlete[] })[] | null = null;
  let rowErr: PostgrestError | null = null;

  if (performanceTierColumnAvailable !== false) {
    const primary = await supabase
      .from('athletes')
      .select('*, team_athletes!inner(team_id, status, squad, performance_tier)')
      .in('team_athletes.team_id', teamIds)
      .eq('team_athletes.status', 'active')
      .order('last_name');
    rows = primary.data as (Athlete & { team_athletes: TeamAthlete[] })[] | null;
    rowErr = primary.error;
    if (!rowErr) markPerformanceTierColumnAvailable(true);
    if (isMissingPerformanceTierColumn(rowErr)) markPerformanceTierColumnAvailable(false);
  }

  if (performanceTierColumnAvailable === false || rowErr) {
    const fallback = await supabase
      .from('athletes')
      .select('*, team_athletes!inner(team_id, status, squad)')
      .in('team_athletes.team_id', teamIds)
      .eq('team_athletes.status', 'active')
      .order('last_name');
    if (!fallback.error) {
      rows = ((fallback.data as (Athlete & { team_athletes: TeamAthlete[] })[] | null) ?? [])
        .map((r) => ({ ...r, team_athletes: (r.team_athletes ?? []).map((ta) => ({ ...ta, performance_tier: null })) }));
      rowErr = null;
    }
  }

  if (rowErr) throw rowErr;

  // De-duplicate by athlete ID (an athlete may appear on multiple teams within the org)
  const seen = new Set<string>();
  const result: CoachingAthlete[] = [];
  for (const { team_athletes, ...athlete } of rows ?? []) {
    if (seen.has(athlete.id)) continue;
    seen.add(athlete.id);
    result.push({
      ...toCoachingAthlete(athlete as Athlete),
      squad: team_athletes[0]?.squad ?? null,
      performance_tier: (team_athletes[0]?.performance_tier as PerformanceTier | null | undefined) ?? null,
    });
  }
  return result;
}

// ─── Team Members ───────────────────────────────────────────────────────────

/** Get all members of a team with profile info */
export async function getTeamMembers(teamId: string): Promise<TeamMemberWithProfile[]> {
  const rows = throwOnError(
    await supabase
      .from('team_members')
      .select('*, user_profiles(display_name, email)')
      .eq('team_id', teamId)
      .order('joined_at')
  ) as (TeamMember & { user_profiles?: { display_name?: string; email?: string } })[];

  return rows.map(({ user_profiles: profile, ...member }) => ({
    ...member,
    display_name: profile?.display_name ?? profile?.email ?? 'Unknown',
    email: profile?.email ?? null,
  }));
}

/** Update a team member's role */
export async function updateTeamMemberRole(
  memberId: string,
  role: TeamRole
): Promise<void> {
  throwOnError(
    await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single()
  );
}

/** Remove a member from a team */
export async function removeTeamMember(memberId: string): Promise<void> {
  throwOnError(
    await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
  );
}

/** Add a user to a team by their email address. Looks up user_profiles to find the user_id. */
export async function addTeamMemberByEmail(
  teamId: string,
  email: string,
  role: TeamRole = 'member'
): Promise<TeamMemberWithProfile> {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Find user by email in user_profiles
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (profileErr) throw profileErr;
  if (!profile) throw new Error(`No account found for "${normalizedEmail}". They need to sign up first.`);

  // 2. Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', profile.user_id)
    .maybeSingle();

  if (existing) throw new Error(`${profile.display_name ?? email} is already on this team.`);

  // 3. Insert team_members row
  const membership = throwOnError(
    await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: profile.user_id,
        role,
      })
      .select()
      .single()
  ) as TeamMember;

  if (role === 'member') {
    try {
      await ensureTeamMemberAthleteLink(teamId, profile.user_id);
    } catch (error) {
      await supabase
        .from('team_members')
        .delete()
        .eq('id', membership.id);
      throw error;
    }
  }

  return {
    ...membership,
    display_name: profile.display_name ?? email,
    email: profile.email ?? email,
  };
}

/** Send a team invite email via Supabase Edge Function (Resend-backed). */
export async function sendTeamInviteEmail(params: {
  teamId: string;
  recipientEmail: string;
  inviteCode: string;
  teamName: string;
}): Promise<{ id: string | null }> {
  const inviteUrl = `${window.location.origin}/join?code=${encodeURIComponent(params.inviteCode)}`;

  const { data, error } = await supabase.functions.invoke('send-team-invite', {
    body: {
      teamId: params.teamId,
      recipientEmail: params.recipientEmail.trim().toLowerCase(),
      teamName: params.teamName,
      inviteCode: params.inviteCode,
      inviteUrl,
    },
  });

  if (error) {
    const context = (error as { context?: Response }).context;

    if (context) {
      try {
        const payload = (await context.json()) as {
          error?: string;
          providerStatus?: number;
          providerBody?: string;
        };

        console.error('[send-team-invite] Function error payload:', payload);

        const detail = payload.providerBody
          ? ` ${payload.providerBody}`
          : payload.providerStatus
            ? ` (provider status ${payload.providerStatus})`
            : '';

        throw new Error((payload.error || error.message || 'Failed to send invite email.') + detail);
      } catch {
        throw new Error(error.message || 'Failed to send invite email.');
      }
    }

    throw new Error(error.message || 'Failed to send invite email.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    id: data?.id ?? null,
  };
}

// ─── Bulk Coach Invite ──────────────────────────────────────────────────────

export interface InviteCoachResult {
  email: string;
  status: 'created' | 'added' | 'error';
  message?: string;
}

export interface InviteCoachesResponse {
  ok: boolean;
  summary: { created: number; added: number; errors: number; total: number };
  results: InviteCoachResult[];
}

/** Bulk-invite coaches via the invite-coaches edge function */
export async function inviteCoaches(params: {
  teamId: string;
  entries: { email: string; firstName: string; lastName: string }[];
  role: 'coach' | 'coxswain';
  orgId?: string;
}): Promise<InviteCoachesResponse> {
  const { data, error } = await supabase.functions.invoke('invite-coaches', {
    body: {
      teamId: params.teamId,
      entries: params.entries,
      role: params.role,
      orgId: params.orgId || undefined,
    },
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = (await context.json()) as { error?: string };
        throw new Error(payload.error || error.message || 'Failed to invite coaches.');
      } catch {
        throw new Error(error.message || 'Failed to invite coaches.');
      }
    }
    throw new Error(error.message || 'Failed to invite coaches.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as InviteCoachesResponse;
}

// ─── Join Team by Invite Code ───────────────────────────────────────────────

/** Look up a team by its invite code */
export async function getTeamByInviteCode(code: string): Promise<Team | null> {
  const normalizedCode = code.toUpperCase().trim();
  const { data, error } = await supabase.rpc('lookup_team_by_invite_code', {
    p_code: normalizedCode,
  });

  if (error) throw error;

  const row = Array.isArray(data)
    ? (data[0] ?? null)
    : (data ?? null);

  return row as Team | null;
}

/** Join a team using an invite code. Returns the role assigned. */
export async function joinTeamByInviteCode(
  userId: string,
  code: string,
  role: TeamRole = 'member'
): Promise<{ team: Team; membership: TeamMember }> {
  // 1. Find the team
  const team = await getTeamByInviteCode(code);
  if (!team) throw new Error('Invalid invite code. Please check and try again.');

  // 2. Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) throw new Error('You are already a member of this team.');

  // 3. Add as member
  const membership = throwOnError(
    await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role,
      })
      .select()
      .single()
  ) as TeamMember;

  if (role === 'member') {
    try {
      await ensureTeamMemberAthleteLink(team.id, userId);
    } catch (error) {
      await supabase
        .from('team_members')
        .delete()
        .eq('id', membership.id);
      throw error;
    }
  }

  return { team, membership };
}

/** Get current user's team membership info (team + role) */
export async function getMyTeamMembership(
  userId: string
): Promise<{ team: Team; role: TeamRole; memberId: string } | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*, teams(*)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { teams: teamData, ...memberData } = data as TeamMember & { teams: Team };
  return {
    team: teamData,
    role: memberData.role,
    memberId: memberData.id,
  };
}

/** Get all direct team memberships for the current user. */
export async function getMyDirectTeamMemberships(
  userId: string
): Promise<{ team: Team; role: TeamRole; memberId: string }[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, role, joined_at, teams(*)')
    .eq('user_id', userId)
    .order('joined_at');

  if (error || !data) return [];

  return (data as unknown as Array<{
    id: string;
    role: TeamRole;
    teams: Team | Team[] | null;
  }>)
    .flatMap((row) => {
      const team = Array.isArray(row.teams) ? row.teams[0] ?? null : row.teams;
      if (!team) return [];
      return [{
        team,
        role: row.role,
        memberId: row.id,
      }];
    })
    .sort((a, b) => a.team.name.localeCompare(b.team.name));
}

/** Leave a team (member self-service) */
export async function leaveTeam(memberId: string): Promise<void> {
  throwOnError(
    await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
  );
}

function normalizeTeamScope(teamScope: string | string[]): string[] {
  return Array.isArray(teamScope)
    ? [...new Set(teamScope.filter(Boolean))]
    : teamScope
      ? [teamScope]
      : [];
}

// ─── Athlete Self-Service Queries ───────────────────────────────────────────

/** Get erg scores for a specific athlete (self-service view) */
export async function getMyErgScores(
  userId: string,
  teamScope: string | string[]
): Promise<CoachingErgScore[]> {
  const teamIds = normalizeTeamScope(teamScope);
  if (teamIds.length === 0) return [];

  // Find the athlete record linked to this user
  const { data: athleteLink } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!athleteLink) return [];

  const query = supabase
    .from('coaching_erg_scores')
    .select('*')
    .eq('athlete_id', athleteLink.id)
    .order('date', { ascending: false });

  if (teamIds.length === 1) {
    return throwOnError(await query.eq('team_id', teamIds[0]));
  }

  return throwOnError(await query.in('team_id', teamIds));
}

/** Get session notes about a specific athlete (self-service view) */
export async function getMySessionNotes(
  userId: string,
  teamScope: string | string[],
  limit = 30
): Promise<(CoachingAthleteNote & { session?: CoachingSession })[]> {
  const teamIds = normalizeTeamScope(teamScope);
  if (teamIds.length === 0) return [];

  // Find the athlete record linked to this user
  const { data: athleteLink } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!athleteLink) return [];

  const query = supabase
    .from('coaching_athlete_notes')
    .select('*, coaching_sessions(*)')
    .eq('athlete_id', athleteLink.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  const notes = throwOnError(
    teamIds.length === 1
      ? await query.eq('team_id', teamIds[0])
      : await query.in('team_id', teamIds)
  ) as (CoachingAthleteNote & { coaching_sessions?: CoachingSession })[];

  return notes.map(({ coaching_sessions, ...note }) => ({
    ...note,
    session: coaching_sessions ?? undefined,
  }));
}

async function attachCoachAuthorProfiles<T extends { coach_user_id: string }>(
  notes: T[]
): Promise<Array<T & { author_display_name?: string | null; author_email?: string | null }>> {
  const coachIds = [...new Set(notes.map((note) => note.coach_user_id))];
  if (coachIds.length === 0) return notes;

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, email')
    .in('user_id', coachIds);

  const profileMap = new Map((profiles ?? []).map((profile) => [
    profile.user_id as string,
    {
      author_display_name: (profile.display_name as string | null | undefined) ?? (profile.email as string | null | undefined) ?? 'Coach',
      author_email: (profile.email as string | null | undefined) ?? null,
    },
  ]));

  return notes.map((note) => ({
    ...note,
    ...(profileMap.get(note.coach_user_id) ?? { author_display_name: 'Coach', author_email: null }),
  }));
}

/** Get shared coach-feed notes for a specific athlete, newest first. */
export async function getCoachNotesForAthlete(
  athleteId: string,
  limit = 50
): Promise<CoachingAthleteCoachNote[]> {
  const notes = throwOnError(
    await supabase
      .from('coaching_athlete_coach_notes')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as CoachingAthleteCoachNote[];

  return attachCoachAuthorProfiles(notes);
}

/** Append a new shared coach-feed note for an athlete. */
export async function createCoachNote(
  teamId: string,
  coachUserId: string,
  payload: Pick<CoachingAthleteCoachNote, 'athlete_id' | 'note' | 'visible_to_athlete'>
): Promise<CoachingAthleteCoachNote> {
  const inserted = throwOnError(
    await supabase
      .from('coaching_athlete_coach_notes')
      .insert({
        team_id: teamId,
        coach_user_id: coachUserId,
        athlete_id: payload.athlete_id,
        note: payload.note,
        visible_to_athlete: payload.visible_to_athlete,
      })
      .select('*')
      .single()
  ) as CoachingAthleteCoachNote;

  const [withAuthor] = await attachCoachAuthorProfiles([inserted]);
  return withAuthor;
}

/** Get athlete-level coach notes that are visible to the athlete. */
export async function getMyCoachNotes(
  userId: string,
  teamScope: string | string[],
  limit = 50
): Promise<CoachingAthleteCoachNote[]> {
  const teamIds = normalizeTeamScope(teamScope);
  if (teamIds.length === 0) return [];

  const { data: athleteLink } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!athleteLink?.id) return [];

  const query = supabase
    .from('coaching_athlete_coach_notes')
    .select('*')
    .eq('athlete_id', athleteLink.id)
    .eq('visible_to_athlete', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  const notes = throwOnError(
    teamIds.length === 1
      ? await query.eq('team_id', teamIds[0])
      : await query.in('team_id', teamIds)
  ) as CoachingAthleteCoachNote[];

  return attachCoachAuthorProfiles(notes);
}

/** Get coach-note counts for all athletes in a team (or org-wide). Lightweight — no note content. */
export async function getCoachNoteCountsByTeam(
  teamId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .rpc('get_coach_note_counts_by_team', { p_team_id: teamId });

  // Fallback: if RPC doesn't exist, do a client-side query
  if (error) {
    const rows = throwOnError(
      await supabase
        .from('coaching_athlete_coach_notes')
        .select('athlete_id')
        .eq('team_id', teamId)
    ) as { athlete_id: string }[];

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.athlete_id] = (counts[row.athlete_id] ?? 0) + 1;
    }
    return counts;
  }

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { athlete_id: string; count: number }[]) {
    counts[row.athlete_id] = Number(row.count);
  }
  return counts;
}

/** Get coach-note counts across all teams in an org. */
export async function getCoachNoteCountsByOrg(
  orgId: string
): Promise<Record<string, number>> {
  const teams = await getTeamsForOrg(orgId);
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) return {};

  const rows = throwOnError(
    await supabase
      .from('coaching_athlete_coach_notes')
      .select('athlete_id')
      .in('team_id', teamIds)
  ) as { athlete_id: string }[];

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.athlete_id] = (counts[row.athlete_id] ?? 0) + 1;
  }
  return counts;
}

// ─── Athletes (unified: athletes + team_athletes) ───────────────────────────

/** Transfer an athlete from one team to another within the same org.
 *  Updates the existing team_athletes junction row's team_id. */
export async function transferAthlete(
  athleteId: string,
  fromTeamId: string,
  toTeamId: string
): Promise<void> {
  const rows = throwOnError(
    await supabase
      .from('team_athletes')
      .update({ team_id: toTeamId, squad: null, performance_tier: null })
      .eq('athlete_id', athleteId)
      .eq('team_id', fromTeamId)
      .select()
  );
  if (!rows || (rows as unknown[]).length === 0) {
    throw new Error('Transfer failed — athlete not found on the source team');
  }
}

export async function getAthletes(teamId: string): Promise<CoachingAthlete[]> {
  // Query athletes that belong to this team via inner join on team_athletes
  let rows: (Athlete & { team_athletes: TeamAthlete[] })[] | null = null;
  let rowErr: PostgrestError | null = null;

  if (performanceTierColumnAvailable !== false) {
    const primary = await supabase
      .from('athletes')
      .select('*, team_athletes!inner(team_id, status, squad, performance_tier)')
      .eq('team_athletes.team_id', teamId)
      .eq('team_athletes.status', 'active')
      .order('last_name');
    rows = primary.data as (Athlete & { team_athletes: TeamAthlete[] })[] | null;
    rowErr = primary.error;
    if (!rowErr) markPerformanceTierColumnAvailable(true);
    if (isMissingPerformanceTierColumn(rowErr)) markPerformanceTierColumnAvailable(false);
  }

  if (performanceTierColumnAvailable === false || rowErr) {
    const fallback = await supabase
      .from('athletes')
      .select('*, team_athletes!inner(team_id, status, squad)')
      .eq('team_athletes.team_id', teamId)
      .eq('team_athletes.status', 'active')
      .order('last_name');
    if (!fallback.error) {
      rows = ((fallback.data as (Athlete & { team_athletes: TeamAthlete[] })[] | null) ?? [])
        .map((r) => ({ ...r, team_athletes: (r.team_athletes ?? []).map((ta) => ({ ...ta, performance_tier: null })) }));
      rowErr = null;
    }
  }

  if (rowErr) throw rowErr;

  return (rows ?? []).map(({ team_athletes, ...athlete }) => ({
    ...toCoachingAthlete(athlete as Athlete),
    team_id: team_athletes[0]?.team_id ?? undefined,
    squad: team_athletes[0]?.squad ?? null,
    performance_tier: (team_athletes[0]?.performance_tier as PerformanceTier | null | undefined) ?? null,
  }));
}

/** Fetch a single athlete by their athletes.id, regardless of which team they're on. */
export async function getAthleteById(athleteId: string): Promise<CoachingAthlete | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('*, team_athletes(team_id, status, squad, performance_tier)')
    .eq('id', athleteId)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Fallback without performance_tier column
    const fallback = await supabase
      .from('athletes')
      .select('*, team_athletes(team_id, status, squad)')
      .eq('id', athleteId)
      .limit(1)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    const row = fallback.data as Athlete & { team_athletes: TeamAthlete[] };
    const active = row.team_athletes?.find((ta) => ta.status === 'active') ?? row.team_athletes?.[0];
    return {
      ...toCoachingAthlete(row),
      team_id: active?.team_id ?? undefined,
      squad: active?.squad ?? null,
      performance_tier: null,
    };
  }

  if (!data) return null;
  const row = data as Athlete & { team_athletes: TeamAthlete[] };
  const active = row.team_athletes?.find((ta) => ta.status === 'active') ?? row.team_athletes?.[0];
  return {
    ...toCoachingAthlete(row),
    team_id: active?.team_id ?? undefined,
    squad: active?.squad ?? null,
    performance_tier: (active?.performance_tier as PerformanceTier | null | undefined) ?? null,
  };
}

/** Get distinct squad names for a team (for filter dropdowns / autocomplete) */
export async function getTeamSquads(teamId: string): Promise<string[]> {
  const rows = throwOnError(
    await supabase
      .from('team_athletes')
      .select('squad')
      .eq('team_id', teamId)
      .not('squad', 'is', null)
  ) as { squad: string }[];

  return [...new Set(rows.map((r) => r.squad))].sort();
}

/** Get distinct performance tiers for a team */
export async function getTeamPerformanceTiers(teamId: string): Promise<PerformanceTier[]> {
  if (performanceTierColumnAvailable === false) return [];
  const query = await supabase
    .from('team_athletes')
    .select('performance_tier')
    .eq('team_id', teamId)
    .not('performance_tier', 'is', null);
  if (isMissingPerformanceTierColumn(query.error)) {
    markPerformanceTierColumnAvailable(false);
    return [];
  }
  const rows = throwOnError(query) as { performance_tier: PerformanceTier }[];
  markPerformanceTierColumnAvailable(true);

  return [...new Set(rows.map((r) => r.performance_tier))].sort();
}

/** Update an athlete's squad assignment within a team */
export async function updateAthleteSquad(
  teamId: string,
  athleteId: string,
  squad: string | null
): Promise<void> {
  throwOnError(
    await supabase
      .from('team_athletes')
      .update({ squad })
      .eq('team_id', teamId)
      .eq('athlete_id', athleteId)
      .select()
  );
}

/** Update an athlete's performance tier within a team */
export async function updateAthletePerformanceTier(
  teamId: string,
  athleteId: string,
  performanceTier: PerformanceTier | null
): Promise<void> {
  if (performanceTierColumnAvailable === false) {
    throw new Error('Performance tier is unavailable until the latest migration is applied.');
  }
  const result = await supabase
    .from('team_athletes')
    .update({ performance_tier: performanceTier })
    .eq('team_id', teamId)
    .eq('athlete_id', athleteId)
    .select();
  if (isMissingPerformanceTierColumn(result.error)) {
    markPerformanceTierColumnAvailable(false);
    throw new Error('Performance tier is unavailable until the latest migration is applied.');
  }
  throwOnError(result);
  markPerformanceTierColumnAvailable(true);
}

export async function createAthlete(
  teamId: string,
  createdBy: string,
  athlete: Pick<Athlete, 'first_name' | 'last_name' | 'grade' | 'experience_level' | 'side' | 'height_cm' | 'weight_kg' | 'notes'>,
  squad?: string | null,
  performanceTier?: PerformanceTier | null
): Promise<CoachingAthlete> {
  // 1. Insert into athletes
  const newAthlete = throwOnError(
    await supabase
      .from('athletes')
      .insert({ created_by: createdBy, ...athlete })
      .select()
      .single()
  ) as Athlete;

  // 2. Link to team via team_athletes (with optional squad)
  let linkErr: PostgrestError | null = null;
  if (performanceTierColumnAvailable !== false) {
    const linkWithTier = await supabase
      .from('team_athletes')
      .insert({ team_id: teamId, athlete_id: newAthlete.id, status: 'active', squad: squad ?? null, performance_tier: performanceTier ?? null })
      .select()
      .single();
    linkErr = linkWithTier.error;
    if (!linkErr) markPerformanceTierColumnAvailable(true);
    if (isMissingPerformanceTierColumn(linkErr)) markPerformanceTierColumnAvailable(false);
  }
  if (performanceTierColumnAvailable === false || linkErr) {
    const fallback = await supabase
      .from('team_athletes')
      .insert({ team_id: teamId, athlete_id: newAthlete.id, status: 'active', squad: squad ?? null })
      .select()
      .single();
    throwOnError(fallback);
  }

  return { ...toCoachingAthlete(newAthlete), squad: squad ?? null, performance_tier: performanceTier ?? null };
}

export async function updateAthlete(
  id: string,
  updates: Partial<Pick<Athlete, 'first_name' | 'last_name' | 'grade' | 'experience_level' | 'side' | 'height_cm' | 'weight_kg' | 'notes'>>
): Promise<CoachingAthlete> {
  const updated = throwOnError(
    await supabase
      .from('athletes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  ) as Athlete;
  return toCoachingAthlete(updated);
}

export async function deleteAthlete(id: string): Promise<void> {
  // All child rows (team_athletes, coaching_athlete_notes, coaching_erg_scores,
  // daily_workout_assignments) are CASCADE DELETE at the DB level.
  throwOnError(
    await supabase.from('athletes').delete().eq('id', id)
  );
}

// ─── Sessions (team-scoped) ─────────────────────────────────────────────────

export async function getSessions(teamId: string): Promise<CoachingSession[]> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: false })
  );
}

export async function getOrgSessions(orgId: string): Promise<CoachingSession[]> {
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return [];

  const perTeam = await Promise.all(teams.map((team) => getSessions(team.id)));
  return perTeam.flat().sort((a, b) => b.date.localeCompare(a.date));
}

export async function getSessionsByDateRange(
  teamId: string,
  start: string,
  end: string
): Promise<CoachingSession[]> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('team_id', teamId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
  );
}

export async function createSession(
  teamId: string,
  coachUserId: string,
  session: Pick<CoachingSession, 'date' | 'type' | 'focus' | 'general_notes'> & { group_assignment_id?: string | null }
): Promise<CoachingSession> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .insert({ team_id: teamId, coach_user_id: coachUserId, ...session })
      .select()
      .single()
  );
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<CoachingSession, 'date' | 'type' | 'focus' | 'general_notes' | 'group_assignment_id'>>
): Promise<CoachingSession> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  );
}

export async function deleteSession(id: string): Promise<void> {
  await supabase.from('coaching_athlete_notes').delete().eq('session_id', id);
  throwOnError(
    await supabase.from('coaching_sessions').delete().eq('id', id)
  );
}

// ─── Session Crew Snapshots (team-scoped) ─────────────────────────────────────

async function getSessionCrewPositionsByCrewIds(crewIds: string[]): Promise<CoachingSessionCrewPosition[]> {
  if (crewIds.length === 0) return [];

  return throwOnError(
    await supabase
      .from('coaching_session_crew_positions')
      .select('*')
      .in('session_crew_id', crewIds)
      .order('seat', { ascending: false })
  );
}

function attachPositionsToCrews(
  crews: SessionCrewRow[],
  positions: CoachingSessionCrewPosition[],
): CoachingSessionCrew[] {
  const positionsByCrewId = new Map<string, CoachingSessionCrewPosition[]>();

  for (const position of positions) {
    const existing = positionsByCrewId.get(position.session_crew_id) ?? [];
    existing.push(position);
    positionsByCrewId.set(position.session_crew_id, existing);
  }

  return crews.map((crew) => ({
    ...crew,
    positions: positionsByCrewId.get(crew.id) ?? [],
  }));
}

export async function getSessionCrewsForSession(sessionId: string): Promise<CoachingSessionCrew[]> {
  const crews = throwOnError(
    await supabase
      .from('coaching_session_crews')
      .select('*')
      .eq('session_id', sessionId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  ) as SessionCrewRow[];

  const positions = await getSessionCrewPositionsByCrewIds(crews.map((crew) => crew.id));
  return attachPositionsToCrews(crews, positions);
}

export async function getSessionCrewsForSessions(
  teamId: string,
  sessionIds: string[],
): Promise<CoachingSessionCrew[]> {
  if (sessionIds.length === 0) return [];

  const crews = throwOnError(
    await supabase
      .from('coaching_session_crews')
      .select('*')
      .eq('team_id', teamId)
      .in('session_id', sessionIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  ) as SessionCrewRow[];

  const positions = await getSessionCrewPositionsByCrewIds(crews.map((crew) => crew.id));
  return attachPositionsToCrews(crews, positions);
}

export async function createSessionCrew(
  teamId: string,
  coachUserId: string,
  crew: Pick<CoachingSessionCrew, 'session_id' | 'boat_name' | 'boat_type'> &
    Partial<Pick<CoachingSessionCrew, 'boat_id' | 'notes' | 'sort_order' | 'source_boating_id'>> & {
      positions: SessionCrewPositionInput[];
    }
): Promise<CoachingSessionCrew> {
  const createdCrew = throwOnError(
    await supabase
      .from('coaching_session_crews')
      .insert({
        session_id: crew.session_id,
        team_id: teamId,
        coach_user_id: coachUserId,
        boat_id: crew.boat_id ?? null,
        source_boating_id: crew.source_boating_id ?? null,
        boat_name: crew.boat_name,
        boat_type: crew.boat_type,
        notes: crew.notes ?? null,
        sort_order: crew.sort_order ?? 0,
      })
      .select()
      .single()
  ) as SessionCrewRow;

  if (crew.positions.length > 0) {
    throwOnError(
      await supabase
        .from('coaching_session_crew_positions')
        .insert(
          crew.positions.map((position) => ({
            session_crew_id: createdCrew.id,
            team_id: teamId,
            coach_user_id: coachUserId,
            seat: position.seat,
            athlete_id: position.athlete_id ?? null,
            athlete_name: position.athlete_name,
          }))
        )
    );
  }

  return getSessionCrewsForSession(createdCrew.session_id).then((crews) => {
    const savedCrew = crews.find((entry) => entry.id === createdCrew.id);
    if (!savedCrew) {
      throw new Error('Created crew snapshot could not be reloaded.');
    }
    return savedCrew;
  });
}

export async function updateSessionCrew(
  id: string,
  updates: Partial<Pick<CoachingSessionCrew, 'boat_name' | 'boat_type' | 'boat_id' | 'notes' | 'sort_order' | 'source_boating_id'>> & {
    positions?: SessionCrewPositionInput[];
  }
): Promise<CoachingSessionCrew> {
  const existingCrew = throwOnError(
    await supabase
      .from('coaching_session_crews')
      .select('*')
      .eq('id', id)
      .single()
  ) as SessionCrewRow;

  throwOnError(
    await supabase
      .from('coaching_session_crews')
      .update({
        boat_name: updates.boat_name,
        boat_type: updates.boat_type,
        boat_id: updates.boat_id === undefined ? undefined : updates.boat_id ?? null,
        notes: updates.notes === undefined ? undefined : updates.notes ?? null,
        sort_order: updates.sort_order,
        source_boating_id: updates.source_boating_id === undefined ? undefined : updates.source_boating_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  );

  if (updates.positions) {
    throwOnError(
      await supabase
        .from('coaching_session_crew_positions')
        .delete()
        .eq('session_crew_id', id)
    );

    if (updates.positions.length > 0) {
      throwOnError(
        await supabase
          .from('coaching_session_crew_positions')
          .insert(
            updates.positions.map((position) => ({
              session_crew_id: id,
              team_id: existingCrew.team_id,
              coach_user_id: existingCrew.coach_user_id,
              seat: position.seat,
              athlete_id: position.athlete_id ?? null,
              athlete_name: position.athlete_name,
            }))
          )
      );
    }
  }

  return getSessionCrewsForSession(existingCrew.session_id).then((crews) => {
    const savedCrew = crews.find((entry) => entry.id === id);
    if (!savedCrew) {
      throw new Error('Updated crew snapshot could not be reloaded.');
    }
    return savedCrew;
  });
}

export async function deleteSessionCrew(id: string): Promise<void> {
  throwOnError(
    await supabase
      .from('coaching_session_crews')
      .delete()
      .eq('id', id)
  );
}

// ─── Schedule Events (Regattas, etc.) ───────────────────────────────────────

/** Get schedule events for an org within a date range.
 *  Includes multi-day events whose span overlaps the range.
 *  Optionally filters to events that include a specific team. */
export async function getScheduleEvents(
  orgId: string,
  start: string,
  end: string,
  teamId?: string
): Promise<CoachingScheduleEvent[]> {
  // Events where: date <= end AND (end_date >= start OR (end_date IS NULL AND date >= start))
  let query = supabase
    .from('coaching_schedule_events')
    .select('*')
    .eq('org_id', orgId)
    .lte('date', end)
    .or(`end_date.gte.${start},and(end_date.is.null,date.gte.${start})`)
    .order('date');

  if (teamId) {
    query = query.contains('team_ids', [teamId]);
  }

  return throwOnError(await query) as CoachingScheduleEvent[];
}

export async function createScheduleEvent(
  orgId: string,
  coachUserId: string,
  event: Pick<CoachingScheduleEvent, 'date' | 'title' | 'event_type'> &
    Partial<Pick<CoachingScheduleEvent, 'end_date' | 'location' | 'team_ids' | 'notes'>>
): Promise<CoachingScheduleEvent> {
  return throwOnError(
    await supabase
      .from('coaching_schedule_events')
      .insert({
        org_id: orgId,
        coach_user_id: coachUserId,
        date: event.date,
        end_date: event.end_date ?? null,
        title: event.title,
        event_type: event.event_type,
        location: event.location ?? null,
        team_ids: event.team_ids ?? [],
        notes: event.notes ?? null,
      })
      .select()
      .single()
  );
}

export async function updateScheduleEvent(
  id: string,
  updates: Partial<Pick<CoachingScheduleEvent, 'date' | 'end_date' | 'title' | 'event_type' | 'location' | 'team_ids' | 'notes'>>
): Promise<CoachingScheduleEvent> {
  return throwOnError(
    await supabase
      .from('coaching_schedule_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  );
}

export async function deleteScheduleEvent(id: string): Promise<void> {
  throwOnError(
    await supabase.from('coaching_schedule_events').delete().eq('id', id)
  );
}

// ─── Boating ↔ Session Link ────────────────────────────────────────────────

/** Get boatings linked to a specific session */
export async function getBoatingsForSession(sessionId: string): Promise<CoachingBoating[]> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at')
  );
}

// ─── Persistent Boats (team-scoped) ───────────────────────────────────────────

export async function getBoats(teamId: string): Promise<CoachingBoat[]> {
  return throwOnError(
    await supabase
      .from('coaching_boats')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order', { ascending: true })
      .order('boat_name', { ascending: true })
  );
}

export async function getOrgBoats(orgId: string): Promise<CoachingBoat[]> {
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return [];

  const perTeam = await Promise.all(teams.map((team) => getBoats(team.id)));
  return perTeam.flat().sort((a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    a.boat_name.localeCompare(b.boat_name)
  );
}

export async function createBoat(
  teamId: string,
  coachUserId: string,
  boat: Pick<CoachingBoat, 'boat_name' | 'boat_type'> & Partial<Pick<CoachingBoat, 'notes' | 'is_active' | 'sort_order'>>
): Promise<CoachingBoat> {
  return throwOnError(
    await supabase
      .from('coaching_boats')
      .insert({
        team_id: teamId,
        coach_user_id: coachUserId,
        boat_name: boat.boat_name,
        boat_type: boat.boat_type,
        notes: boat.notes ?? null,
        is_active: boat.is_active ?? true,
        sort_order: boat.sort_order ?? 0,
      })
      .select()
      .single()
  );
}

// ─── Athlete Notes ──────────────────────────────────────────────────────────

export async function getNotesForSession(sessionId: string): Promise<CoachingAthleteNote[]> {
  return throwOnError(
    await supabase
      .from('coaching_athlete_notes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at')
  );
}

/** Get all notes for a specific athlete across all sessions, newest first */
export async function getNotesForAthlete(
  athleteId: string,
  limit = 20
): Promise<(CoachingAthleteNote & { session?: CoachingSession })[]> {
  const notes = throwOnError(
    await supabase
      .from('coaching_athlete_notes')
      .select('*, coaching_sessions(*)')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as (CoachingAthleteNote & { coaching_sessions?: CoachingSession })[];

  return notes.map(({ coaching_sessions, ...note }) => ({
    ...note,
    session: coaching_sessions ?? undefined,
  }));
}

export async function createNote(
  teamId: string,
  coachUserId: string,
  note: Pick<CoachingAthleteNote, 'session_id' | 'athlete_id' | 'note'>
): Promise<CoachingAthleteNote> {
  return throwOnError(
    await supabase
      .from('coaching_athlete_notes')
      .insert({ team_id: teamId, coach_user_id: coachUserId, ...note })
      .select()
      .single()
  );
}

export async function updateNote(
  id: string,
  updates: Pick<CoachingAthleteNote, 'note'>
): Promise<CoachingAthleteNote> {
  return throwOnError(
    await supabase
      .from('coaching_athlete_notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  );
}

export async function deleteNote(id: string): Promise<void> {
  throwOnError(
    await supabase.from('coaching_athlete_notes').delete().eq('id', id)
  );
}

// ─── Erg Scores (team-scoped) ───────────────────────────────────────────────

export async function getErgScores(teamId: string): Promise<CoachingErgScore[]> {
  return throwOnError(
    await supabase
      .from('coaching_erg_scores')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: false })
  );
}

export async function getErgScoresForAthlete(
  athleteId: string,
  limit = 5
): Promise<CoachingErgScore[]> {
  return throwOnError(
    await supabase
      .from('coaching_erg_scores')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
      .limit(limit)
  );
}

export async function createErgScore(
  teamId: string,
  coachUserId: string,
  score: Pick<CoachingErgScore, 'athlete_id' | 'date' | 'distance' | 'time_seconds' | 'split_500m' | 'watts' | 'stroke_rate' | 'heart_rate' | 'notes'>
): Promise<CoachingErgScore> {
  return throwOnError(
    await supabase
      .from('coaching_erg_scores')
      .insert({ team_id: teamId, coach_user_id: coachUserId, ...score })
      .select()
      .single()
  );
}

export async function deleteErgScore(id: string): Promise<void> {
  throwOnError(
    await supabase.from('coaching_erg_scores').delete().eq('id', id)
  );
}

export async function updateErgScore(
  id: string,
  updates: Partial<Pick<CoachingErgScore, 'date' | 'distance' | 'time_seconds' | 'split_500m' | 'watts' | 'stroke_rate' | 'heart_rate' | 'notes'>>,
): Promise<void> {
  throwOnError(
    await supabase.from('coaching_erg_scores').update(updates).eq('id', id)
  );
}

// ─── Boatings (team-scoped) ─────────────────────────────────────────────────

export async function getBoatings(teamId: string): Promise<CoachingBoating[]> {
  // Try ordering by sort_order (column may not exist yet before migration)
  const result = await supabase
    .from('coaching_boatings')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
    .order('date', { ascending: false });

  if (result.error) {
    // Fallback: sort_order column doesn't exist yet
    return throwOnError(
      await supabase
        .from('coaching_boatings')
        .select('*')
        .eq('team_id', teamId)
        .order('date', { ascending: false })
    );
  }
  return result.data as CoachingBoating[];
}

export async function getBoatingsByDateRange(
  teamId: string,
  start: string,
  end: string
): Promise<CoachingBoating[]> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .select('*')
      .eq('team_id', teamId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .order('sort_order', { ascending: true })
  );
}

export async function getOrgBoatings(orgId: string): Promise<CoachingBoating[]> {
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return [];

  const perTeam = await Promise.all(
    teams.map((team) => getBoatings(team.id))
  );

  // Merge and sort by sort_order ascending, then date descending
  return perTeam.flat().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || b.date.localeCompare(a.date));
}

export async function createBoating(
  teamId: string,
  coachUserId: string,
  boating: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions'> &
    Partial<Pick<CoachingBoating, 'notes' | 'session_id' | 'boat_id'>>
): Promise<CoachingBoating> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .insert({
        team_id: teamId,
        coach_user_id: coachUserId,
        date: boating.date,
        boat_name: boating.boat_name,
        boat_type: boating.boat_type,
        positions: boating.positions,
        notes: boating.notes ?? null,
        session_id: boating.session_id ?? null,
        boat_id: boating.boat_id ?? null,
      })
      .select()
      .single()
  );
}

export async function updateBoating(
  id: string,
  updates: Partial<Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes' | 'session_id' | 'boat_id'>>
): Promise<CoachingBoating> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .update({
        ...updates,
        notes: updates.notes === undefined ? undefined : updates.notes ?? null,
        session_id: updates.session_id === undefined ? undefined : updates.session_id ?? null,
        boat_id: updates.boat_id === undefined ? undefined : updates.boat_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
  );
}

export async function deleteBoating(id: string): Promise<void> {
  throwOnError(
    await supabase.from('coaching_boatings').delete().eq('id', id)
  );
}

export async function setBoatingActive(id: string, isActive: boolean): Promise<CoachingBoating> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  );
}

export async function updateBoatingSortOrders(orders: { id: string; sort_order: number }[]): Promise<void> {
  // Batch update sort_order for multiple boatings
  await Promise.all(
    orders.map(({ id, sort_order }) =>
      supabase
        .from('coaching_boatings')
        .update({ sort_order, updated_at: new Date().toISOString() })
        .eq('id', id)
    )
  );
}

export async function duplicateBoating(
  teamId: string,
  coachUserId: string,
  source: CoachingBoating
): Promise<CoachingBoating> {
  const today = new Date().toISOString().slice(0, 10);
  return createBoating(teamId, coachUserId, {
    date: today,
    boat_name: source.boat_name,
    boat_type: source.boat_type,
    positions: source.positions,
    notes: `Copied from ${source.date}`,
    boat_id: source.boat_id ?? null,
  });
}

// ─── Weekly Plans ───────────────────────────────────────────────────────────

/** Get the Monday of the week containing the given date */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // roll back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Fetch weekly plan for a specific week (by week_start date) */
export async function getWeeklyPlan(
  teamId: string,
  weekStart: string
): Promise<CoachingWeeklyPlan | null> {
  const { data, error } = await supabase
    .from('coaching_weekly_plans')
    .select('*')
    .eq('team_id', teamId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Upsert a weekly plan (insert or update on team_id + week_start) */
export async function upsertWeeklyPlan(
  input: WeeklyPlanInput
): Promise<CoachingWeeklyPlan> {
  return throwOnError(
    await supabase
      .from('coaching_weekly_plans')
      .upsert(input, { onConflict: 'team_id,week_start' })
      .select()
      .single()
  );
}

/** Delete a weekly plan */
export async function deleteWeeklyPlan(id: string): Promise<void> {
  throwOnError(
    await supabase.from('coaching_weekly_plans').delete().eq('id', id)
  );
}

// ─── Workout Assignments ─────────────────────────────────────────────────────

/** Get all group assignments for a team, optionally filtered by date range */
export async function getGroupAssignments(
  teamId: string,
  opts?: { from?: string; to?: string; orgId?: string }
): Promise<GroupAssignment[]> {
  let query = supabase
    .from('group_assignments')
    .select(`
      id, team_id, org_id, template_id, scheduled_date, title, instructions,
      created_by, created_at,
      workout_templates!inner ( name, canonical_name, workout_structure, workout_type, training_zone, is_test )
    `)
    .order('scheduled_date', { ascending: false });

  if (opts?.orgId) {
    // Org-level: fetch org-wide assignments AND team-scoped ones for ALL org teams
    const orgTeams = await getTeamsForOrg(opts.orgId);
    const orgTeamIds = orgTeams.map((t) => t.id);
    if (orgTeamIds.length > 0) {
      query = query.or(`org_id.eq.${opts.orgId},team_id.in.(${orgTeamIds.join(',')})`);
    } else {
      query = query.or(`org_id.eq.${opts.orgId},team_id.eq.${teamId}`);
    }
  } else {
    query = query.eq('team_id', teamId);
  }

  if (opts?.from) query = query.gte('scheduled_date', opts.from);
  if (opts?.to) query = query.lte('scheduled_date', opts.to);

  const { data, error } = await query;
  if (error) throw error;

  // Flatten the joined template fields
  return (data ?? []).map((row: Record<string, unknown>) => {
    const tmpl = row.workout_templates as Record<string, unknown> | null;
    return {
      id: row.id as string,
      team_id: (row.team_id as string | null) ?? undefined,
      org_id: (row.org_id as string | null) ?? undefined,
      template_id: row.template_id as string,
      scheduled_date: row.scheduled_date as string,
      title: row.title as string | null,
      instructions: row.instructions as string | null,
      created_by: row.created_by as string | null,
      created_at: row.created_at as string,
      template_name: (tmpl?.name as string) ?? undefined,
      canonical_name: (tmpl?.canonical_name as string | null) ?? null,
      workout_structure: (tmpl?.workout_structure as GroupAssignment['workout_structure']) ?? null,
      workout_type: (tmpl?.workout_type as string) ?? undefined,
      training_zone: (tmpl?.training_zone as string | null) ?? null,
      is_test_template: (tmpl?.is_test as boolean) ?? false,
    };
  });
}

/** Get group assignments for a specific date */
export async function getAssignmentsForDate(
  teamId: string,
  date: string,
  orgId?: string
): Promise<GroupAssignment[]> {
  return getGroupAssignments(teamId, { from: date, to: date, orgId });
}

/** Create a group assignment and fan out per-athlete rows.
 *  For org-level assignments (input.org_id set, input.team_id null),
 *  automatically fans out to ALL active athletes across every team in the org.
 */
export async function createGroupAssignment(
  input: GroupAssignmentInput,
  athleteIds: string[]
): Promise<GroupAssignment> {
  // Mutual exclusivity: org_id and team_id must not both be set
  if (input.org_id && input.team_id) {
    throw new Error('Assignment must be either org-wide or team-scoped, not both');
  }

  // 1. Insert the group assignment
  const ga = throwOnError<Record<string, unknown>>(
    await supabase
      .from('group_assignments')
      .insert(input)
      .select()
      .single()
  );

  // 2. Resolve the final athlete list
  //    For org-level assignments, merge provided IDs with all org athletes
  //    and build an athlete→team_id map so each daily row gets the correct team_id
  let finalAthleteIds = athleteIds;
  const athleteTeamMap = new Map<string, string>();

  if (input.org_id && !input.team_id) {
    // Fetch org athletes with their team_id from team_athletes junction
    const orgTeams = await getTeamsForOrg(input.org_id);
    const teamIds = orgTeams.map((t) => t.id);
    if (teamIds.length > 0) {
      const { data: junctionRows } = await supabase
        .from('team_athletes')
        .select('athlete_id, team_id')
        .in('team_id', teamIds)
        .eq('status', 'active');
      for (const row of junctionRows ?? []) {
        // First team wins (de-dup: athlete may be on multiple teams)
        if (!athleteTeamMap.has(row.athlete_id)) {
          athleteTeamMap.set(row.athlete_id, row.team_id);
        }
      }
    }
    const orgAthleteIds = [...athleteTeamMap.keys()];
    // Union of explicitly-provided + org-wide athletes
    finalAthleteIds = [...new Set([...athleteIds, ...orgAthleteIds])];
  }

  // 3. Fan out daily_workout_assignments for each athlete
  if (finalAthleteIds.length > 0) {
    const dateObj = new Date(input.scheduled_date + 'T00:00:00');
    const rows = finalAthleteIds.map((athleteId) => ({
      athlete_id: athleteId,
      // For org assignments, resolve each athlete's actual team_id (RLS requires non-null team_id)
      team_id: athleteTeamMap.get(athleteId) ?? input.team_id ?? null,
      original_template_id: input.template_id,
      workout_date: input.scheduled_date,
      day_of_week: dateObj.getDay(),
      week_number: 0,
      scheduled_workout: { template_id: input.template_id, title: input.title },
      group_assignment_id: ga.id as string,
      completed: false,
    }));

    const { error } = await supabase
      .from('daily_workout_assignments')
      .insert(rows);

    if (error) {
      console.error('Error fanning out athlete assignments:', error);
      // Don't throw — group assignment is created, individual rows are best-effort
    }
  }

  return {
    id: ga.id as string,
    team_id: (ga.team_id as string | null) ?? undefined,
    org_id: (ga.org_id as string | null) ?? undefined,
    template_id: ga.template_id as string,
    scheduled_date: ga.scheduled_date as string,
    title: ga.title as string | null,
    instructions: ga.instructions as string | null,
    created_by: ga.created_by as string | null,
    created_at: ga.created_at as string,
  };
}

/** Delete a group assignment and its per-athlete rows */
export async function deleteGroupAssignment(id: string): Promise<void> {
  // Cascade: remove athlete rows first
  await supabase
    .from('daily_workout_assignments')
    .delete()
    .eq('group_assignment_id', id);

  throwOnError(
    await supabase.from('group_assignments').delete().eq('id', id)
  );
}

/** Update a group assignment (title, instructions, scheduled_date) */
export async function updateGroupAssignment(
  id: string,
  updates: { title?: string | null; instructions?: string | null; scheduled_date?: string }
): Promise<void> {
  throwOnError(
    await supabase
      .from('group_assignments')
      .update(updates)
      .eq('id', id)
  );

  // If date changed, also update the per-athlete rows
  if (updates.scheduled_date) {
    const dateObj = new Date(updates.scheduled_date + 'T00:00:00');
    await supabase
      .from('daily_workout_assignments')
      .update({
        workout_date: updates.scheduled_date,
        day_of_week: dateObj.getDay(),
      })
      .eq('group_assignment_id', id);
  }
}

/**
 * Get the current athlete IDs assigned to a group assignment.
 */
export async function getAssignmentAthleteIds(groupAssignmentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('daily_workout_assignments')
    .select('athlete_id')
    .eq('group_assignment_id', groupAssignmentId);
  if (error) throw error;
  return (data ?? []).map((r) => r.athlete_id as string);
}

/**
 * Sync a group assignment's athlete membership to exactly `newAthleteIds`.
 * - Removes `daily_workout_assignments` rows for athletes no longer in the set
 * - Inserts new rows for athletes not yet in the set
 * Completed rows are left untouched (completion data is preserved).
 */
export async function syncAssignmentAthletes(
  groupAssignmentId: string,
  newAthleteIds: string[],
  assignment: { team_id?: string | null; org_id?: string | null; template_id: string; scheduled_date: string; title?: string | null }
): Promise<void> {
  // Fetch currently assigned athlete IDs
  const { data: existing, error: fetchErr } = await supabase
    .from('daily_workout_assignments')
    .select('id, athlete_id')
    .eq('group_assignment_id', groupAssignmentId);

  if (fetchErr) throw fetchErr;

  const existingMap = new Map<string, string>((existing ?? []).map((r) => [r.athlete_id as string, r.id as string]));
  const newSet = new Set(newAthleteIds);

  // Remove athletes no longer in the set
  const toRemove = [...existingMap.entries()]
    .filter(([athleteId]) => !newSet.has(athleteId))
    .map(([, rowId]) => rowId);

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('daily_workout_assignments')
      .delete()
      .in('id', toRemove);
    if (error) throw error;
  }

  // Insert rows for athletes not yet assigned
  const toAdd = newAthleteIds.filter((id) => !existingMap.has(id));
  if (toAdd.length > 0) {
    // For org assignments, resolve each athlete's actual team_id
    const athleteTeamMap = new Map<string, string>();
    if (assignment.org_id && !assignment.team_id) {
      const orgTeams = await getTeamsForOrg(assignment.org_id);
      const teamIds = orgTeams.map((t) => t.id);
      if (teamIds.length > 0) {
        const { data: junctionRows } = await supabase
          .from('team_athletes')
          .select('athlete_id, team_id')
          .in('team_id', teamIds)
          .eq('status', 'active');
        for (const row of junctionRows ?? []) {
          if (!athleteTeamMap.has(row.athlete_id)) {
            athleteTeamMap.set(row.athlete_id, row.team_id);
          }
        }
      }
    }

    const dateObj = new Date(assignment.scheduled_date + 'T00:00:00');
    const rows = toAdd.map((athleteId) => ({
      athlete_id: athleteId,
      team_id: athleteTeamMap.get(athleteId) ?? assignment.team_id ?? null,
      original_template_id: assignment.template_id,
      workout_date: assignment.scheduled_date,
      day_of_week: dateObj.getDay(),
      week_number: 0,
      scheduled_workout: { template_id: assignment.template_id, title: assignment.title },
      group_assignment_id: groupAssignmentId,
      completed: false,
    }));
    const { error } = await supabase.from('daily_workout_assignments').insert(rows);
    if (error) throw error;
  }
}

/** Get completion status for assignments on a given date */
export async function getAssignmentCompletions(
  teamId: string,
  date: string,
  athletes: CoachingAthlete[],
  orgId?: string
): Promise<AssignmentCompletion[]> {
  // 1. Get group assignments for the date
  const assignments = await getAssignmentsForDate(teamId, date, orgId);
  if (assignments.length === 0) return [];

  // 2. Get all daily_workout_assignments for those group assignment IDs
  const gaIds = assignments.map((a) => a.id);
  const { data: dailyRows, error } = await supabase
    .from('daily_workout_assignments')
    .select('id, athlete_id, group_assignment_id, completed, completed_log_id')
    .in('group_assignment_id', gaIds);

  if (error) throw error;

  // 3. Build completion summary per group assignment
  const athleteMap = new Map(athletes.map((a) => [a.id, a.name]));

  return assignments.map((ga) => {
    const rows = (dailyRows ?? []).filter(
      (r) => r.group_assignment_id === ga.id
    );
    const completedRows = rows.filter((r) => r.completed);
    const missingAthletes = rows
      .filter((r) => !r.completed)
      .map((r) => ({
        id: r.athlete_id,
        name: athleteMap.get(r.athlete_id) ?? 'Unknown',
      }));

    return {
      group_assignment_id: ga.id,
      total: rows.length,
      completed: completedRows.length,
      missing_athletes: missingAthletes,
    };
  });
}

/** Mark an athlete's assignment as completed (manual entry) */
export async function completeAthleteAssignment(
  groupAssignmentId: string,
  athleteId: string,
  workoutLogId?: string
): Promise<void> {
  const { error } = await supabase
    .from('daily_workout_assignments')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      ...(workoutLogId ? { completed_log_id: workoutLogId } : {}),
    })
    .eq('group_assignment_id', groupAssignmentId)
    .eq('athlete_id', athleteId);

  if (error) throw error;
}

/**
 * Guarded auto-link for ErgLink uploads:
 * - Resolves athlete by user_id
 * - Marks assignment complete only if completed_log_id is still null
 * - No-op when metadata is missing or athlete is not linked
 */
export async function autoCompleteAssignmentFromErgLinkLog(params: {
  workoutLogId: string;
  userId: string;
  completedAt: string;
  groupAssignmentId: string;
}): Promise<void> {
  const { workoutLogId, userId, completedAt, groupAssignmentId } = params;

  const { data: athleteLink } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!athleteLink?.id) return;

  const { error } = await supabase
    .from('daily_workout_assignments')
    .update({
      completed: true,
      completed_at: completedAt,
      completed_log_id: workoutLogId,
    })
    .eq('group_assignment_id', groupAssignmentId)
    .eq('athlete_id', athleteLink.id)
    .is('completed_log_id', null);

  if (error) throw error;
}

/** Interval result shape stored in result_intervals JSONB */
export interface IntervalResult {
  rep: number;
  time_seconds?: number | null;
  distance_meters?: number | null;
  split_seconds?: number | null;
  stroke_rate?: number | null;
  /** True when athlete did not finish (or skipped) this rep */
  dnf?: boolean | null;
}

/** Per-athlete assignment row with completion status and results */
export interface AthleteAssignmentRow {
  id: string;
  athlete_id: string;
  completed: boolean;
  completed_at?: string | null;
  result_weight_kg?: number | null;
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_split_seconds?: number | null;
  result_stroke_rate?: number | null;
  result_intervals?: IntervalResult[] | null;
}

/** Add a single athlete to an existing group assignment (late addition). */
export async function addAthleteToAssignment(
  groupAssignmentId: string,
  athleteId: string,
  assignment: { team_id?: string | null; org_id?: string | null; template_id: string; scheduled_date: string; title?: string | null }
): Promise<AthleteAssignmentRow> {
  // Resolve team_id for org-level assignments
  let resolvedTeamId = assignment.team_id ?? null;
  if (assignment.org_id && !resolvedTeamId) {
    const orgTeams = await getTeamsForOrg(assignment.org_id);
    const teamIds = orgTeams.map((t) => t.id);
    if (teamIds.length > 0) {
      const { data: junctionRows } = await supabase
        .from('team_athletes')
        .select('team_id')
        .eq('athlete_id', athleteId)
        .in('team_id', teamIds)
        .eq('status', 'active')
        .limit(1);
      resolvedTeamId = junctionRows?.[0]?.team_id ?? null;
    }
  }

  const dateObj = new Date(assignment.scheduled_date + 'T00:00:00');
  const row = {
    athlete_id: athleteId,
    team_id: resolvedTeamId,
    original_template_id: assignment.template_id,
    workout_date: assignment.scheduled_date,
    day_of_week: dateObj.getDay(),
    week_number: 0,
    scheduled_workout: { template_id: assignment.template_id, title: assignment.title },
    group_assignment_id: groupAssignmentId,
    completed: false,
  };

  const { data, error } = await supabase
    .from('daily_workout_assignments')
    .insert(row)
    .select('id, athlete_id, completed, completed_at, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
    .single();
  if (error) throw error;
  return {
    ...(data as AthleteAssignmentRow),
    result_weight_kg: null,
  };
}

/** Enriched result row joining assignment data with athlete profile (name, squad, weight_kg) */
export interface AssignmentResultRow {
  id: string;
  athlete_id: string;
  athlete_name: string;
  squad?: string | null;
  performance_tier?: PerformanceTier | null;
  team_id?: string | null;
  team_name?: string | null;
  weight_kg?: number | null;
  result_weight_kg?: number | null;
  side?: string | null;
  is_coxswain: boolean; // true if side='coxswain' OR team_members role='coxswain'
  completed: boolean;
  completed_at?: string | null;
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_split_seconds?: number | null;
  result_stroke_rate?: number | null;
  result_intervals?: IntervalResult[] | null;
}

export interface AssignmentResultsShareData {
  shareId: string;
  expiresAt: string;
  assignment: GroupAssignment;
  rows: AssignmentResultRow[];
}

export function buildAssignmentResultsShareUrl(token: string): string {
  return `${window.location.origin}/share/assignment-results/${encodeURIComponent(token)}`;
}

export async function createAssignmentResultsShare(
  groupAssignmentId: string,
  expiresInHours = 168,
): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await supabase.rpc('create_assignment_results_share', {
    p_group_assignment_id: groupAssignmentId,
    p_expires_in_hours: expiresInHours,
  });
  if (error) throw error;

  const payload = data as { token?: string; expires_at?: string } | null;
  const token = payload?.token?.trim();
  const expiresAt = payload?.expires_at?.trim();
  if (!token || !expiresAt) {
    throw new Error('Failed to create private share link');
  }
  return { token, expiresAt };
}

export async function resolveAssignmentResultsShare(
  shareToken: string,
): Promise<AssignmentResultsShareData | null> {
  const { data, error } = await supabase.rpc('resolve_assignment_results_share', {
    p_token: shareToken,
  });
  if (error) throw error;
  if (!data) return null;

  const payload = data as {
    share_id?: string;
    expires_at?: string;
    assignment?: GroupAssignment;
    rows?: AssignmentResultRow[];
  };

  if (!payload.share_id || !payload.expires_at || !payload.assignment || !Array.isArray(payload.rows)) {
    return null;
  }

  return {
    shareId: payload.share_id,
    expiresAt: payload.expires_at,
    assignment: payload.assignment,
    rows: payload.rows,
  };
}

// ─── Team Leaderboard Shares ──────────────────────────────────────────────────

export interface TeamLeaderboardShareData {
  shareId: string;
  expiresAt: string;
  teamName: string | null;
  orgName: string | null;
  filterSquad: string | null;
  filterTier: string | null;
  filterTeamId: string | null;
  assignments: Array<{
    id: string;
    scheduled_date: string;
    title: string | null;
    template_name: string | null;
    canonical_name: string | null;
    is_test: boolean;
  }>;
  results: Array<{
    athlete_id: string;
    athlete_name: string;
    squad: string | null;
    performance_tier: string | null;
    team_id: string | null;
    team_name: string | null;
    weight_kg: number | null;
    side: string | null;
    group_assignment_id: string;
    completed: boolean;
    result_time_seconds: number | null;
    result_distance_meters: number | null;
    result_split_seconds: number | null;
    result_weight_kg: number | null;
    result_intervals: IntervalResult[] | null;
  }>;
}

export async function createTeamLeaderboardShare(
  teamId: string,
  opts?: {
    orgId?: string | null;
    filterSquad?: string | null;
    filterTier?: string | null;
    filterTeamId?: string | null;
    expiresInHours?: number;
  },
): Promise<{ token: string; expiresAt: string }> {
  const { data, error } = await supabase.rpc('create_team_leaderboard_share', {
    p_team_id: teamId,
    p_org_id: opts?.orgId ?? null,
    p_filter_squad: opts?.filterSquad ?? null,
    p_filter_tier: opts?.filterTier ?? null,
    p_filter_team_id: opts?.filterTeamId ?? null,
    p_expires_in_hours: opts?.expiresInHours ?? 168,
  });
  if (error) throw error;

  const payload = data as { token?: string; expires_at?: string } | null;
  const token = payload?.token?.trim();
  const expiresAt = payload?.expires_at?.trim();
  if (!token || !expiresAt) {
    throw new Error('Failed to create private share link');
  }
  return { token, expiresAt };
}

export function buildTeamLeaderboardShareUrl(token: string): string {
  return `${window.location.origin}/share/team-leaderboard/${encodeURIComponent(token)}`;
}

export async function resolveTeamLeaderboardShare(
  shareToken: string,
): Promise<TeamLeaderboardShareData | null> {
  const { data, error } = await supabase.rpc('resolve_team_leaderboard_share', {
    p_token: shareToken,
  });
  if (error) throw error;
  if (!data) return null;

  const payload = data as Record<string, unknown>;
  if (!payload.share_id || !payload.expires_at) return null;

  return {
    shareId: payload.share_id as string,
    expiresAt: payload.expires_at as string,
    teamName: (payload.team_name as string) ?? null,
    orgName: (payload.org_name as string) ?? null,
    filterSquad: (payload.filter_squad as string) ?? null,
    filterTier: (payload.filter_tier as string) ?? null,
    filterTeamId: (payload.filter_team_id as string) ?? null,
    assignments: (payload.assignments as TeamLeaderboardShareData['assignments']) ?? [],
    results: (payload.results as TeamLeaderboardShareData['results']) ?? [],
  };
}

/**
 * Fetch per-athlete results for a group assignment, enriched with athlete
 * name / squad / weight_kg from the athletes + team_athletes tables.
 */
export async function getAssignmentResultsWithAthletes(
  groupAssignmentId: string,
  teamId: string,
  orgId?: string | null
): Promise<AssignmentResultRow[]> {
  // 1. Fetch all assignment rows for this group (include team_id for team mapping)
  let rows: Array<Record<string, unknown>> | null = null;
  let rowErr: PostgrestError | null = null;

  if (resultWeightColumnAvailable !== false) {
    const primaryRowsResult = await supabase
      .from('daily_workout_assignments')
      .select('id, athlete_id, team_id, completed, completed_at, result_weight_kg, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
      .eq('group_assignment_id', groupAssignmentId);
    rows = primaryRowsResult.data as Array<Record<string, unknown>> | null;
    rowErr = primaryRowsResult.error;
    if (!rowErr) {
      markResultWeightColumnAvailable(true);
    }
    if (isMissingResultWeightColumn(rowErr)) {
      markResultWeightColumnAvailable(false);
    }
  }

  if (resultWeightColumnAvailable === false || rowErr) {
    const fallback = await supabase
      .from('daily_workout_assignments')
      .select('id, athlete_id, team_id, completed, completed_at, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
      .eq('group_assignment_id', groupAssignmentId);
    if (!fallback.error) {
      rows = (fallback.data as Array<Record<string, unknown>> | null)?.map((r) => ({ ...r, result_weight_kg: null })) ?? null;
      if (resultWeightColumnAvailable === false) {
        rowErr = null;
      }
      rowErr = null;
    }
  }

  if (rowErr) throw rowErr;

  // 2. Fetch athletes — org-wide if orgId provided, otherwise team-scoped
  let athleteRows: Array<Record<string, unknown>> | null = null;
  let teamLookup = new Map<string, string>(); // team_id → team_name

  if (orgId) {
    // Org-wide: fetch all athletes across all org teams with current team info
    const [orgAthletes, teams] = await Promise.all([
      getOrgAthletesWithTeam(orgId),
      getTeamsForOrg(orgId),
    ]);
    teamLookup = new Map(teams.map((t) => [t.id, t.name]));
    athleteRows = orgAthletes.map((a) => ({
      id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      weight_kg: a.weight_kg,
      side: a.side ?? null,
      user_id: a.user_id ?? null,
      current_team_id: a.team_id ?? null,
      current_team_name: a.team_name ?? null,
      team_athletes: [{ squad: a.squad, performance_tier: a.performance_tier ?? null }],
    }));
  } else {
    let data: Array<Record<string, unknown>> | null = null;
    let athErr: PostgrestError | null = null;
    if (performanceTierColumnAvailable !== false) {
      const primary = await supabase
        .from('athletes')
        .select('id, first_name, last_name, weight_kg, side, user_id, team_athletes!inner(team_id, squad, performance_tier)')
        .eq('team_athletes.team_id', teamId);
      data = primary.data;
      athErr = primary.error;
      if (!athErr) markPerformanceTierColumnAvailable(true);
      if (isMissingPerformanceTierColumn(athErr)) markPerformanceTierColumnAvailable(false);
    }
    if (performanceTierColumnAvailable === false || athErr) {
      const fallback = await supabase
        .from('athletes')
        .select('id, first_name, last_name, weight_kg, side, user_id, team_athletes!inner(team_id, squad)')
        .eq('team_athletes.team_id', teamId);
      if (!fallback.error) {
        data = (fallback.data as Array<Record<string, unknown>> | null)?.map((row) => ({
          ...row,
          team_athletes: ((row.team_athletes as Array<Record<string, unknown>> | undefined) ?? [])
            .map((ta) => ({ ...ta, performance_tier: null })),
        })) ?? null;
        athErr = null;
      }
    }
    if (athErr) throw athErr;
    athleteRows = data;
  }

  // 3. Fetch coxswain-role user_ids from team_members for role-based filtering
  const coxswainUserIds = new Set<string>();
  {
    const teamIds = orgId
      ? Array.from(teamLookup.keys())
      : [teamId];
    for (const tid of teamIds) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', tid)
        .eq('role', 'coxswain');
      members?.forEach((m) => coxswainUserIds.add(m.user_id as string));
    }
  }

  // Build lookup map (use current team from team_athletes, not snapshot from assignment row)
  type AthleteInfo = { name: string; squad: string | null; performance_tier: PerformanceTier | null; weight_kg: number | null; side: string | null; is_coxswain: boolean; current_team_id: string | null; current_team_name: string | null };
  const athleteMap = new Map<string, AthleteInfo>();
  for (const a of athleteRows ?? []) {
    const ta = (a.team_athletes as unknown as Array<{ squad: string | null; performance_tier: PerformanceTier | null }>)[0];
    const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
    const side = (a.side as string | null) ?? null;
    const userId = (a.user_id as string | null) ?? null;
    const is_coxswain = side === 'coxswain' || (userId != null && coxswainUserIds.has(userId));
    const athleteId = a.id as string;
    // For org path: current_team_id is populated from getOrgAthletesWithTeam
    // For team path: current team is the teamId param (all athletes fetched via that team)
    const currentTeamId = (a.current_team_id as string | null) ?? (orgId ? null : teamId);
    const currentTeamName = (a.current_team_name as string | null) ?? (orgId ? null : (teamLookup.get(teamId) ?? null));
    // De-duplicate: keep first seen (athletes may appear on multiple teams in org path)
    if (!athleteMap.has(athleteId)) {
      athleteMap.set(athleteId, {
        name,
        squad: ta?.squad ?? null,
        performance_tier: ta?.performance_tier ?? null,
        weight_kg: (a.weight_kg as number | null) ?? null,
        side,
        is_coxswain,
        current_team_id: currentTeamId,
        current_team_name: currentTeamName,
      });
    }
  }

  return (rows ?? []).map((row) => {
    const info = athleteMap.get(row.athlete_id as string);
    // Use athlete's CURRENT team (from team_athletes), falling back to assignment snapshot
    const currentTeamId = info?.current_team_id ?? (row.team_id as string | null) ?? null;
    return {
      id: row.id as string,
      athlete_id: row.athlete_id as string,
      athlete_name: info?.name ?? 'Unknown',
      squad: info?.squad ?? null,
      performance_tier: info?.performance_tier ?? null,
      team_id: currentTeamId,
      team_name: currentTeamId ? (teamLookup.get(currentTeamId) ?? null) : null,
      weight_kg: info?.weight_kg ?? null,
      side: info?.side ?? null,
      is_coxswain: info?.is_coxswain ?? false,
      completed: row.completed as boolean,
      completed_at: row.completed_at as string | null,
      result_weight_kg: row.result_weight_kg as number | null,
      result_time_seconds: row.result_time_seconds as number | null,
      result_distance_meters: row.result_distance_meters as number | null,
      result_split_seconds: row.result_split_seconds as number | null,
      result_stroke_rate: row.result_stroke_rate as number | null,
      result_intervals: row.result_intervals as IntervalResult[] | null,
    };
  });
}

/** Get per-athlete assignment rows for a group assignment (with results) */
export async function getAthleteAssignmentRows(
  groupAssignmentId: string
): Promise<AthleteAssignmentRow[]> {
  let data: Array<Record<string, unknown>> | null = null;
  let error: PostgrestError | null = null;

  if (resultWeightColumnAvailable !== false) {
    const primaryRowsResult = await supabase
      .from('daily_workout_assignments')
      .select('id, athlete_id, completed, completed_at, result_weight_kg, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
      .eq('group_assignment_id', groupAssignmentId);
    data = primaryRowsResult.data as Array<Record<string, unknown>> | null;
    error = primaryRowsResult.error;
    if (!error) {
      markResultWeightColumnAvailable(true);
    }
    if (isMissingResultWeightColumn(error)) {
      markResultWeightColumnAvailable(false);
    }
  }

  if (resultWeightColumnAvailable === false || error) {
    const fallback = await supabase
      .from('daily_workout_assignments')
      .select('id, athlete_id, completed, completed_at, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
      .eq('group_assignment_id', groupAssignmentId);
    if (!fallback.error) {
      data = (fallback.data as Array<Record<string, unknown>> | null)?.map((r) => ({ ...r, result_weight_kg: null })) ?? null;
      error = null;
    }
  }

  if (error) throw error;
  return (data ?? []) as unknown as AthleteAssignmentRow[];
}

/** Save results for multiple athletes on one group assignment */
export async function saveAssignmentResults(
  groupAssignmentId: string,
  results: Array<{
    athlete_id: string;
    completed: boolean;
    result_weight_kg?: number | null;
    result_time_seconds?: number | null;
    result_distance_meters?: number | null;
    result_split_seconds?: number | null;
    result_stroke_rate?: number | null;
    result_intervals?: IntervalResult[] | null;
  }>
): Promise<void> {
  // Update each row individually (upsert would require PK knowledge)
  for (const r of results) {
    const updatePayload: Record<string, unknown> = {
      completed: r.completed,
    };
    if (r.completed) {
      updatePayload.completed_at = new Date().toISOString();
    } else {
      updatePayload.completed_at = null;
    }
    if (resultWeightColumnAvailable !== false && r.result_weight_kg !== undefined) {
      updatePayload.result_weight_kg = r.result_weight_kg;
    }
    if (r.result_time_seconds !== undefined) updatePayload.result_time_seconds = r.result_time_seconds;
    if (r.result_distance_meters !== undefined) updatePayload.result_distance_meters = r.result_distance_meters;
    if (r.result_split_seconds !== undefined) updatePayload.result_split_seconds = r.result_split_seconds;
    if (r.result_stroke_rate !== undefined) updatePayload.result_stroke_rate = r.result_stroke_rate;
    if (r.result_intervals !== undefined) updatePayload.result_intervals = r.result_intervals;

    let { error } = await supabase
      .from('daily_workout_assignments')
      .update(updatePayload)
      .eq('group_assignment_id', groupAssignmentId)
      .eq('athlete_id', r.athlete_id);

    if (isMissingResultWeightColumn(error) && 'result_weight_kg' in updatePayload) {
      markResultWeightColumnAvailable(false);
      delete updatePayload.result_weight_kg;
      const fallback = await supabase
        .from('daily_workout_assignments')
        .update(updatePayload)
        .eq('group_assignment_id', groupAssignmentId)
        .eq('athlete_id', r.athlete_id);
      error = fallback.error;
    } else if (!error && 'result_weight_kg' in updatePayload) {
      markResultWeightColumnAvailable(true);
    }

    if (error) throw error;
  }

  // Fire-and-forget: compute per-workout titan indexes for this assignment
  computeAndStoreWorkoutTitanIndex(groupAssignmentId).catch(() => {});
}

/**
 * Compute per-workout Titan Index (0–100) for all completed athletes in a
 * group assignment, then write the values back to daily_workout_assignments.
 *
 * Called after saveAssignmentResults. Runs asynchronously — failures are
 * non-fatal (the leaderboard still works, it just won't have stored titan
 * data for this workout until the next score save).
 */
async function computeAndStoreWorkoutTitanIndex(groupAssignmentId: string): Promise<void> {
  // 1. Fetch all completed rows for this assignment
  const cols = resultWeightColumnAvailable !== false
    ? 'athlete_id, team_id, result_split_seconds, result_intervals, result_weight_kg'
    : 'athlete_id, team_id, result_split_seconds, result_intervals';
  const { data: rows, error: fetchErr } = await supabase
    .from('daily_workout_assignments')
    .select(cols)
    .eq('group_assignment_id', groupAssignmentId)
    .eq('completed', true);
  if (fetchErr || !rows || rows.length < 2) return;

  // 2. Fetch athlete weights for those missing result_weight_kg
  const athleteIds = (rows as unknown as Array<Record<string, unknown>>).map((r) => r.athlete_id as string);
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, weight_kg')
    .in('id', athleteIds);
  const weightMap = new Map((athletes ?? []).map((a: { id: string; weight_kg: number | null }) => [a.id, a.weight_kg]));

  // 3. Build per-athlete split + wplb
  const scored: Array<{ athleteId: string; split: number; wplb: number }> = [];
  for (const r of (rows as unknown as Array<Record<string, unknown>>)) {
    const split = calcLeaderboardAvgSplit(r as LeaderboardDailyRow);
    if (split == null || split <= 0) continue;
    const resultWeight = (r.result_weight_kg as number | null) ?? null;
    const athleteWeight = weightMap.get(r.athlete_id as string) ?? null;
    const effectiveWeightKg = (resultWeight && resultWeight > 0) ? resultWeight : (athleteWeight && athleteWeight > 0 ? athleteWeight : null);
    if (!effectiveWeightKg) continue;
    const watts = wattsFromSplit(split);
    const wplb = (watts / effectiveWeightKg) / 2.20462;
    scored.push({ athleteId: r.athlete_id as string, split, wplb });
  }
  if (scored.length < 2) return;

  // 4. Z-score both dimensions
  const splits = scored.map((s) => s.split);
  const wplbs = scored.map((s) => s.wplb);
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const std = (arr: number[], m: number) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  const splitMean = mean(splits); const splitStd = std(splits, splitMean);
  const wplbMean = mean(wplbs); const wplbStd = std(wplbs, wplbMean);

  const rawScores: Array<{ athleteId: string; raw: number }> = [];
  for (const s of scored) {
    const speedZ = splitStd > 0 ? -(s.split - splitMean) / splitStd : 0;
    const effZ = wplbStd > 0 ? (s.wplb - wplbMean) / wplbStd : 0;
    rawScores.push({ athleteId: s.athleteId, raw: (speedZ * TITAN_POWER_WEIGHT) + (effZ * TITAN_EFFICIENCY_WEIGHT) });
  }

  const rawVals = rawScores.map((r) => r.raw);
  const minZ = Math.min(...rawVals); const maxZ = Math.max(...rawVals);
  const range = maxZ - minZ;
  if (range <= 0) return;

  // 5. Write titan_index back to each row
  for (const r of rawScores) {
    const titan = ((r.raw - minZ) / range) * 100;
    await supabase
      .from('daily_workout_assignments')
      .update({ titan_index: Math.round(titan * 10) / 10 })
      .eq('group_assignment_id', groupAssignmentId)
      .eq('athlete_id', r.athleteId);
  }
}

/**
 * Backfill titan_index for all group assignments that have completed rows
 * with NULL titan_index. Returns the number of assignments processed.
 */
export async function backfillTitanIndexes(teamId: string, opts?: { orgId?: string; force?: boolean }): Promise<number> {
  const assignments = await getGroupAssignments(teamId, { orgId: opts?.orgId });
  let processed = 0;
  for (const assignment of assignments) {
    if (opts?.force) {
      await computeAndStoreWorkoutTitanIndex(assignment.id);
      processed++;
      continue;
    }

    const { count } = await supabase
      .from('daily_workout_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('group_assignment_id', assignment.id)
      .eq('completed', true)
      .is('titan_index', null);
    if (count && count > 0) {
      await computeAndStoreWorkoutTitanIndex(assignment.id);
      processed++;
    }
  }
  return processed;
}

/** Compliance grid data: all athletes × all assignments for a date range */
export interface ComplianceCell {
  athlete_id: string;
  group_assignment_id: string;
  completed: boolean;
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_split_seconds?: number | null;
}

export async function getComplianceData(
  teamId: string,
  from: string,
  to: string,
  orgId?: string
): Promise<ComplianceCell[]> {
  let query = supabase
    .from('daily_workout_assignments')
    .select('athlete_id, group_assignment_id, completed, result_time_seconds, result_distance_meters, result_split_seconds')
    .gte('workout_date', from)
    .lte('workout_date', to);

  if (orgId) {
    // For org-level compliance, include rows for any team in the org
    // AND org-wide assignments (team_id is null) scoped to THIS org via group_assignments
    const orgTeams = await getTeamsForOrg(orgId);
    const teamIds = orgTeams.map((t) => t.id);

    // Get org-wide group_assignment IDs to avoid cross-org leakage from team_id.is.null
    const { data: orgAssignments } = await supabase
      .from('group_assignments')
      .select('id')
      .eq('org_id', orgId)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to);
    const orgAssignmentIds = (orgAssignments ?? []).map((a) => a.id);

    // Build filter parts
    const filterParts: string[] = [];
    if (teamIds.length > 0) filterParts.push(`team_id.in.(${teamIds.join(',')})`);
    if (orgAssignmentIds.length > 0) filterParts.push(`group_assignment_id.in.(${orgAssignmentIds.join(',')})`);

    if (filterParts.length === 0) return [];
    query = query.or(filterParts.join(','));
  } else {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ComplianceCell[];
}

/** Bulk-complete multiple athletes for a group assignment */
export async function bulkCompleteAssignment(
  groupAssignmentId: string,
  athleteIds: string[]
): Promise<void> {
  if (athleteIds.length === 0) return;
  const { error } = await supabase
    .from('daily_workout_assignments')
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('group_assignment_id', groupAssignmentId)
    .in('athlete_id', athleteIds);

  if (error) throw error;
}

/** Quick-score an athlete: create erg score + mark assignment complete in one step */
export async function quickScoreAndComplete(
  teamId: string,
  coachUserId: string,
  athleteId: string,
  groupAssignmentId: string,
  score: {
    distance: number;
    time_seconds: number;
    split_500m?: number;
    watts?: number;
    stroke_rate?: number;
    heart_rate?: number;
    notes?: string;
  }
): Promise<void> {
  // 1. Create the erg score
  const ergScore = await createErgScore(teamId, coachUserId, {
    athlete_id: athleteId,
    date: format(new Date(), 'yyyy-MM-dd'),
    ...score,
  });

  // 2. Mark the assignment complete, linking to the erg score
  await completeAthleteAssignment(groupAssignmentId, athleteId, ergScore.id);
}

/** Get assignment history for a specific athlete (most recent first) */
export interface AthleteAssignment {
  id: string;
  group_assignment_id: string;
  workout_date: string;
  completed: boolean;
  completed_at?: string | null;
  is_test: boolean;
  title?: string | null;
  template_name?: string | null;
  canonical_name?: string | null;
  training_zone?: string | null;
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_split_seconds?: number | null;
  result_stroke_rate?: number | null;
}

export async function getAssignmentsForAthlete(
  athleteId: string,
  limit = 30
): Promise<AthleteAssignment[]> {
  const { data, error } = await supabase
    .from('daily_workout_assignments')
    .select(`
      id, group_assignment_id, workout_date, completed, completed_at, is_test,
      result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate,
      group_assignments!inner (
        title, template_id,
        workout_templates ( name, canonical_name, training_zone )
      )
    `)
    .eq('athlete_id', athleteId)
    .order('workout_date', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const ga = row.group_assignments as Record<string, unknown> | null;
    const tmpl = ga?.workout_templates as Record<string, unknown> | null;
    return {
      id: row.id as string,
      group_assignment_id: row.group_assignment_id as string,
      workout_date: row.workout_date as string,
      completed: row.completed as boolean,
      completed_at: row.completed_at as string | null,
      is_test: (row.is_test as boolean) ?? false,
      title: ga?.title as string | null,
      template_name: tmpl?.name as string | null,
      canonical_name: tmpl?.canonical_name as string | null,
      training_zone: tmpl?.training_zone as string | null,
      result_time_seconds: row.result_time_seconds as number | null,
      result_distance_meters: row.result_distance_meters as number | null,
      result_split_seconds: row.result_split_seconds as number | null,
      result_stroke_rate: row.result_stroke_rate as number | null,
    };
  });
}

/** Mark/unmark an assignment as a test. When marking, auto-creates erg score. */
export async function markAssignmentAsTest(
  assignmentId: string,
  isTest: boolean,
  opts?: {
    teamId: string;
    coachUserId: string;
    athleteId: string;
    date: string;
    distance: number;
    time_seconds: number;
    split_500m?: number;
    watts?: number;
    stroke_rate?: number;
  }
): Promise<void> {
  // Toggle the flag
  const { error } = await supabase
    .from('daily_workout_assignments')
    .update({ is_test: isTest })
    .eq('id', assignmentId);
  if (error) throw error;

  // If marking as test and we have result data, create an erg score
  if (isTest && opts) {
    await createErgScore(opts.teamId, opts.coachUserId, {
      athlete_id: opts.athleteId,
      date: opts.date,
      distance: opts.distance,
      time_seconds: opts.time_seconds,
      split_500m: opts.split_500m,
      watts: opts.watts,
      stroke_rate: opts.stroke_rate,
    });
  }
}

/** Get athlete counts for multiple teams in a single query (for hierarchy view) */
export async function getTeamAthleteCounts(teamIds: string[]): Promise<Record<string, number>> {
  if (teamIds.length === 0) return {};
  const { data, error } = await supabase
    .from('team_athletes')
    .select('team_id')
    .in('team_id', teamIds)
    .eq('status', 'active');

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const id of teamIds) counts[id] = 0;
  for (const row of data ?? []) {
    counts[row.team_id] = (counts[row.team_id] || 0) + 1;
  }
  return counts;
}

/** Get high-level team stats for the dashboard card */
export async function getTeamStats(teamId: string): Promise<{
  athleteCount: number;
  squadCount: number;
  weeklyCompletionRate: number | null; // 0-100 or null if no assignments
  sessionsThisWeek: number;
}> {
  const weekStart = getWeekStart(new Date());
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');

  const [athletes, sessions, groupAssignments] = await Promise.all([
    getAthletes(teamId),
    getSessionsByDateRange(teamId, weekStart, weekEnd),
    getGroupAssignments(teamId, { from: weekStart, to: weekEnd }),
  ]);

  // Squad count = distinct non-null squads
  const squads = new Set(athletes.map((a) => a.squad).filter(Boolean));

  // Weekly completion rate — fetch daily rows for this week's assignments
  let weeklyCompletionRate: number | null = null;
  if (groupAssignments.length > 0) {
    const gaIds = groupAssignments.map((a) => a.id);
    const { data: dailyRows } = await supabase
      .from('daily_workout_assignments')
      .select('id, completed')
      .in('group_assignment_id', gaIds);

    const rows = dailyRows ?? [];
    if (rows.length > 0) {
      const completed = rows.filter((r) => r.completed).length;
      weeklyCompletionRate = Math.round((completed / rows.length) * 100);
    }
  }

  return {
    athleteCount: athletes.length,
    squadCount: squads.size,
    weeklyCompletionRate,
    sessionsThisWeek: sessions.length,
  };
}

type LeaderboardDailyRow = {
  group_assignment_id: string;
  athlete_id: string;
  completed: boolean;
  result_split_seconds?: number | null;
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_weight_kg?: number | null;
  result_intervals?: IntervalResult[] | null;
  titan_index?: number | null;
};

function calcLeaderboardAvgSplit(row: LeaderboardDailyRow): number | null {
  if (row.result_intervals && row.result_intervals.length > 0) {
    const repsWithBoth = row.result_intervals.filter(
      (r): r is IntervalResult & { split_seconds: number; distance_meters: number } =>
        typeof r.split_seconds === 'number' && typeof r.distance_meters === 'number' && r.distance_meters > 0
    );
    if (repsWithBoth.length > 0) {
      const totalDist = repsWithBoth.reduce((sum, r) => sum + r.distance_meters, 0);
      const weightedSum = repsWithBoth.reduce((sum, r) => sum + r.split_seconds * r.distance_meters, 0);
      return weightedSum / totalDist;
    }
    const repSplits = row.result_intervals
      .filter((r): r is IntervalResult & { split_seconds: number } => typeof r.split_seconds === 'number')
      .map((r) => r.split_seconds);
    if (repSplits.length > 0) {
      return repSplits.reduce((sum, v) => sum + v, 0) / repSplits.length;
    }
  }
  return row.result_split_seconds ?? null;
}

function wattsFromSplit(splitSeconds: number): number {
  return 2.8 / Math.pow(splitSeconds / 500, 3);
}

export const TITAN_POWER_WEIGHT = 0.5;
export const TITAN_EFFICIENCY_WEIGHT = 0.5;

export interface SeasonLeaderboardEntry {
  athlete_id: string;
  athlete_name: string;
  squad?: string | null;
  performance_tier?: PerformanceTier | null;
  team_id?: string | null;
  team_name?: string | null;
  assignment_count: number;
  avg_raw_rank: number | null;
  avg_wplb_rank: number | null;
  /** Composite: average of raw rank + efficiency rank. Lower is better. */
  composite_rank: number | null;
  trend_raw_rank: number | null;
  /** Per-assignment rank history for trend popover, sorted chronologically */
  rank_history: { date: string; rank: number; totalAthletes: number }[];
  /** Average split time in seconds across all assignments */
  avg_split_seconds: number | null;
  /** Average total time in seconds (for single-distance display, e.g. 2k time) */
  avg_time_seconds: number | null;
  /** True when all assignments were the same distance (show time instead of split) */
  is_single_distance: boolean;
  /** Average watts per pound across all assignments */
  avg_wplb: number | null;
  /** Most recent assignment: split in seconds */
  latest_split_seconds: number | null;
  /** Most recent assignment: total time in seconds */
  latest_time_seconds: number | null;
  /** Most recent assignment: distance in meters */
  latest_distance: number | null;
  /** Most recent assignment: watts per pound */
  latest_wplb: number | null;
  /** Titan Index averaged across the currently selected assignment set. Higher is better. */
  titan_index: number | null;
  /** Per-assignment raw scores for client-side re-ranking when filters change */
  score_history: { assignmentId: string; date: string; label: string; split: number; time: number | null; distance: number | null; wplb: number | null; titan_index: number | null; is_test: boolean }[];
}

/**
 * Season-to-date leaderboard from ALL completed assignments with scores.
 * Lower average rank is better (1 = best). Average ranks may include decimals.
 * Pass `orgId` to include org-level assignments (team_id = null, org_id set).
 */
export async function getSeasonMeasuredLeaderboard(
  teamId: string,
  opts?: { from?: string; to?: string; limit?: number; orgId?: string; titanTestOnly?: boolean }
): Promise<SeasonLeaderboardEntry[]> {
  const titanTestOnly = opts?.titanTestOnly ?? false;
  const assignments = await getGroupAssignments(teamId, { from: opts?.from, to: opts?.to, orgId: opts?.orgId });
  if (assignments.length === 0) return [];

  const assignmentIds = assignments.map((a) => a.id);

  // Load athletes: org-wide if orgId provided, otherwise team-scoped
  const athletes = opts?.orgId
    ? await getOrgAthletesWithTeam(opts.orgId)
    : await getAthletes(teamId);
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  // Query daily_workout_assignments — for org-level assignments, results span
  // multiple teams, so query by group_assignment_id only (not team_id).
  let rows: LeaderboardDailyRow[] | null = null;
  const hasOrgAssignments = assignments.some((a) => a.org_id && !a.team_id);

  if (resultWeightColumnAvailable !== false) {
    let query = supabase
      .from('daily_workout_assignments')
      .select('group_assignment_id, athlete_id, completed, result_split_seconds, result_time_seconds, result_distance_meters, result_weight_kg, result_intervals, titan_index')
      .in('group_assignment_id', assignmentIds);
    if (!hasOrgAssignments) {
      query = query.eq('team_id', teamId);
    }
    const primary = await query;
    if (!primary.error) {
      rows = (primary.data as LeaderboardDailyRow[] | null) ?? [];
      markResultWeightColumnAvailable(true);
    } else if (isMissingResultWeightColumn(primary.error)) {
      markResultWeightColumnAvailable(false);
    }
  }

  if (!rows) {
    let query = supabase
      .from('daily_workout_assignments')
      .select('group_assignment_id, athlete_id, completed, result_split_seconds, result_time_seconds, result_distance_meters, result_intervals, titan_index')
      .in('group_assignment_id', assignmentIds);
    if (!hasOrgAssignments) {
      query = query.eq('team_id', teamId);
    }
    const fallback = await query;
    if (fallback.error) throw fallback.error;
    rows = ((fallback.data as Omit<LeaderboardDailyRow, 'result_weight_kg'>[] | null) ?? [])
      .map((r) => ({ ...r, result_weight_kg: null }));
  }

  const perAthleteRanks = new Map<string, {
    raw: number[]; wplb: number[]; splits: number[]; wplbValues: number[];
    times: number[]; distances: number[]; titanIndexes: number[];
    rawByDate: Array<{ date: string; rank: number; totalAthletes: number }>;
    latest: { split: number | null; time: number | null; distance: number | null; wplb: number | null; date: string };
    scoreHistory: Array<{ assignmentId: string; date: string; label: string; split: number; time: number | null; distance: number | null; wplb: number | null; titan_index: number | null; is_test: boolean }>;
  }>();
  // Assignments are sorted by scheduled_date descending, so the first one processed is most recent.
  for (const assignment of assignments) {
    const perAssignmentRows = (rows ?? [])
      .filter((r) => r.group_assignment_id === assignment.id && r.completed)
      .map((r) => {
        const athlete = athleteMap.get(r.athlete_id);
        const split = calcLeaderboardAvgSplit(r);
        const effectiveWeightKg = (r.result_weight_kg && r.result_weight_kg > 0)
          ? r.result_weight_kg
          : (athlete?.weight_kg && athlete.weight_kg > 0 ? athlete.weight_kg : null);
        const watts = split && split > 0 ? wattsFromSplit(split) : null;
        const wplb = watts != null && effectiveWeightKg ? (watts / effectiveWeightKg) / 2.20462 : null;
        const time = r.result_time_seconds && r.result_time_seconds > 0 ? r.result_time_seconds : null;
        const distance = r.result_distance_meters && r.result_distance_meters > 0 ? r.result_distance_meters : null;
        const titanIdx = typeof r.titan_index === 'number' ? r.titan_index : null;
        return { athleteId: r.athlete_id, split, wplb, time, distance, titanIdx };
      })
      .filter((r) => r.split != null);
    if (perAssignmentRows.length === 0) continue;

    const rawSorted = [...perAssignmentRows].sort((a, b) => (a.split ?? Number.POSITIVE_INFINITY) - (b.split ?? Number.POSITIVE_INFINITY));
    const totalInAssignment = rawSorted.length;
    rawSorted.forEach((row, idx) => {
      const entry = perAthleteRanks.get(row.athleteId) ?? { raw: [], wplb: [], splits: [], wplbValues: [], times: [], distances: [], titanIndexes: [], rawByDate: [], latest: { split: null, time: null, distance: null, wplb: null, date: '' }, scoreHistory: [] };
      entry.raw.push(idx + 1);
      if (row.split != null) entry.splits.push(row.split);
      if (row.time != null) entry.times.push(row.time);
      if (row.distance != null) entry.distances.push(row.distance);
      entry.rawByDate.push({ date: assignment.scheduled_date, rank: idx + 1, totalAthletes: totalInAssignment });
      // Only set latest on first encounter (assignments are DESC by date, so first = most recent)
      if (!entry.latest.date) {
        entry.latest = { split: row.split, time: row.time, distance: row.distance, wplb: row.wplb, date: assignment.scheduled_date };
      }
      if (row.titanIdx != null && (!titanTestOnly || assignment.is_test_template)) entry.titanIndexes.push(row.titanIdx);
      // Track raw scores per assignment for client-side re-ranking
      const assignmentLabel = assignment.title || assignment.template_name || assignment.canonical_name || 'Workout';
      entry.scoreHistory.push({ assignmentId: assignment.id, date: assignment.scheduled_date, label: assignmentLabel, split: row.split!, time: row.time, distance: row.distance, wplb: row.wplb, titan_index: row.titanIdx, is_test: assignment.is_test_template ?? false });
      perAthleteRanks.set(row.athleteId, entry);
    });

    const weighted = perAssignmentRows.filter((r) => r.wplb != null);
    const wplbSorted = [...weighted].sort((a, b) => (b.wplb ?? 0) - (a.wplb ?? 0));
    wplbSorted.forEach((row, idx) => {
      const entry = perAthleteRanks.get(row.athleteId) ?? { raw: [], wplb: [], splits: [], wplbValues: [], times: [], distances: [], titanIndexes: [], rawByDate: [], latest: { split: null, time: null, distance: null, wplb: null, date: '' }, scoreHistory: [] };
      entry.wplb.push(idx + 1);
      if (row.wplb != null) entry.wplbValues.push(row.wplb);
      // Set latest wplb on first encounter (assignments are DESC by date)
      if (row.wplb != null && !entry.latest.wplb) {
        entry.latest.wplb = row.wplb;
      }
      perAthleteRanks.set(row.athleteId, entry);
    });
  }

  const leaderboard = Array.from(perAthleteRanks.entries()).map(([athleteId, ranks]) => {
    const athlete = athleteMap.get(athleteId);
    const sortedTrend = [...ranks.rawByDate].sort((a, b) => a.date.localeCompare(b.date));
    const trend = sortedTrend.length >= 2 ? sortedTrend[sortedTrend.length - 1].rank - sortedTrend[0].rank : null;
    const avgRaw = ranks.raw.length > 0 ? ranks.raw.reduce((sum, v) => sum + v, 0) / ranks.raw.length : null;
    const avgWplb = ranks.wplb.length > 0 ? ranks.wplb.reduce((sum, v) => sum + v, 0) / ranks.wplb.length : null;
    const avgSplit = ranks.splits.length > 0 ? ranks.splits.reduce((sum, v) => sum + v, 0) / ranks.splits.length : null;
    const avgWplbValue = ranks.wplbValues.length > 0 ? ranks.wplbValues.reduce((sum, v) => sum + v, 0) / ranks.wplbValues.length : null;
    const avgTime = ranks.times.length > 0 ? ranks.times.reduce((sum, v) => sum + v, 0) / ranks.times.length : null;
    // Single distance if all recorded distances are the same
    const uniqueDistances = new Set(ranks.distances);
    const isSingleDistance = uniqueDistances.size === 1 && avgTime != null;
    // Composite: average of raw rank + efficiency rank (both available),
    // falls back to whichever is available, or null
    const compositeRaw = avgRaw != null && avgWplb != null
      ? (avgRaw + avgWplb) / 2
      : avgRaw ?? avgWplb ?? null;
    const composite = compositeRaw;
    const titanIndex = ranks.titanIndexes.length > 0
      ? Math.round((ranks.titanIndexes.reduce((s, v) => s + v, 0) / ranks.titanIndexes.length) * 10) / 10
      : null;
    return {
      athlete_id: athleteId,
      athlete_name: athlete?.name ?? 'Unknown',
      squad: athlete?.squad ?? null,
      performance_tier: athlete?.performance_tier ?? null,
      team_id: athlete?.team_id ?? null,
      team_name: athlete?.team_name ?? null,
      assignment_count: ranks.raw.length,
      avg_raw_rank: avgRaw,
      avg_wplb_rank: avgWplb,
      composite_rank: composite,
      trend_raw_rank: trend,
      rank_history: sortedTrend,
      avg_split_seconds: avgSplit,
      avg_time_seconds: avgTime,
      is_single_distance: isSingleDistance,
      avg_wplb: avgWplbValue,
      latest_split_seconds: ranks.latest.split,
      latest_time_seconds: ranks.latest.time,
      latest_distance: ranks.latest.distance,
      latest_wplb: ranks.latest.wplb,
      titan_index: titanIndex,
      score_history: ranks.scoreHistory,
    } as SeasonLeaderboardEntry;
  });

  leaderboard.sort((a, b) => {
    const ac = a.composite_rank ?? Number.POSITIVE_INFINITY;
    const bc = b.composite_rank ?? Number.POSITIVE_INFINITY;
    if (ac !== bc) return ac - bc;
    // Tiebreak: raw rank
    return (a.avg_raw_rank ?? Number.POSITIVE_INFINITY) - (b.avg_raw_rank ?? Number.POSITIVE_INFINITY);
  });

  return opts?.limit ? leaderboard.slice(0, opts.limit) : leaderboard;
}

/**
 * Re-rank a filtered subset of leaderboard entries using their per-assignment raw scores.
 * This recalculates avg_raw_rank, avg_wplb_rank, composite_rank, and rank_history
 * relative to only the athletes in the provided array.
 */
export function rerankLeaderboard(entries: SeasonLeaderboardEntry[]): SeasonLeaderboardEntry[] {
  if (entries.length === 0) return [];

  // Collect all unique assignment IDs from score_history
  const assignmentIds = new Set<string>();
  for (const e of entries) {
    for (const s of e.score_history) assignmentIds.add(s.assignmentId);
  }

  // Per-athlete accumulators
  const perAthlete = new Map<string, { rawRanks: number[]; wplbRanks: number[]; titanScores: Array<{ date: string; value: number }>; rankByDate: Array<{ date: string; rank: number; totalAthletes: number }> }>();
  for (const e of entries) {
    perAthlete.set(e.athlete_id, { rawRanks: [], wplbRanks: [], titanScores: [], rankByDate: [] });
  }

  // For each assignment, rank only the filtered athletes
  for (const assignmentId of assignmentIds) {
    const athleteScores: Array<{ athleteId: string; split: number; wplb: number | null; date: string }> = [];
    for (const e of entries) {
      const s = e.score_history.find((h) => h.assignmentId === assignmentId);
      if (s) athleteScores.push({ athleteId: e.athlete_id, split: s.split, wplb: s.wplb, date: s.date });
    }
    if (athleteScores.length === 0) continue;

    // Raw rank by split (ascending)
    const rawSorted = [...athleteScores].sort((a, b) => a.split - b.split);
    const total = rawSorted.length;
    rawSorted.forEach((row, idx) => {
      const entry = perAthlete.get(row.athleteId)!;
      entry.rawRanks.push(idx + 1);
      entry.rankByDate.push({ date: row.date, rank: idx + 1, totalAthletes: total });
    });

    // Collect titan_index values from score_history for this assignment
    for (const e of entries) {
      const s = e.score_history.find((h) => h.assignmentId === assignmentId);
      if (s?.titan_index != null) {
        perAthlete.get(e.athlete_id)!.titanScores.push({ date: s.date, value: s.titan_index });
      }
    }

    // Wplb rank (descending)
    const withWplb = athleteScores.filter((r) => r.wplb != null);
    const wplbSorted = [...withWplb].sort((a, b) => (b.wplb ?? 0) - (a.wplb ?? 0));
    wplbSorted.forEach((row, idx) => {
      perAthlete.get(row.athleteId)!.wplbRanks.push(idx + 1);
    });
  }

  // Build re-ranked entries
  return entries.map((e) => {
    const ranks = perAthlete.get(e.athlete_id)!;
    const avgRaw = ranks.rawRanks.length > 0 ? ranks.rawRanks.reduce((s, v) => s + v, 0) / ranks.rawRanks.length : null;
    const avgWplb = ranks.wplbRanks.length > 0 ? ranks.wplbRanks.reduce((s, v) => s + v, 0) / ranks.wplbRanks.length : null;
    const compositeRaw = avgRaw != null && avgWplb != null ? (avgRaw + avgWplb) / 2 : avgRaw ?? avgWplb ?? null;
    const composite = compositeRaw;
    const sortedTrend = [...ranks.rankByDate].sort((a, b) => a.date.localeCompare(b.date));
    const trend = sortedTrend.length >= 2 ? sortedTrend[sortedTrend.length - 1].rank - sortedTrend[0].rank : null;
    const visibleTitans = ranks.titanScores.map((score) => score.value);
    const titanIndex = visibleTitans.length > 0
      ? Math.round((visibleTitans.reduce((s, v) => s + v, 0) / visibleTitans.length) * 10) / 10
      : null;
    return {
      ...e,
      assignment_count: ranks.rawRanks.length,
      avg_raw_rank: avgRaw,
      avg_wplb_rank: avgWplb,
      composite_rank: composite,
      trend_raw_rank: trend,
      rank_history: sortedTrend,
      titan_index: titanIndex,
    };
  });
}

// ─── Team Analytics ────────────────────────────────────────────────────────

export interface ZoneDistribution {
  zone: string;
  count: number;
  percentage: number;
}

/** Get training zone distribution across all assignments for a team */
export async function getTeamTrainingZoneDistribution(
  teamId: string,
  opts?: { from?: string; to?: string }
): Promise<{ zones: ZoneDistribution[]; total: number }> {
  let query = supabase
    .from('group_assignments')
    .select('id, workout_templates!inner(training_zone)')
    .eq('team_id', teamId);

  if (opts?.from) query = query.gte('scheduled_date', opts.from);
  if (opts?.to) query = query.lte('scheduled_date', opts.to);

  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const zone = (row.workout_templates as unknown as { training_zone: string | null })?.training_zone ?? 'Unset';
    counts.set(zone, (counts.get(zone) || 0) + 1);
  }

  const total = data?.length ?? 0;
  const order = ['UT2', 'UT1', 'AT', 'TR', 'AN', 'Unset'];
  const zones: ZoneDistribution[] = order
    .filter(z => counts.has(z))
    .map(z => ({
      zone: z,
      count: counts.get(z)!,
      percentage: total > 0 ? Math.round((counts.get(z)! / total) * 100) : 0,
    }));

  return { zones, total };
}

export interface TeamErgComparison {
  athleteId: string;
  athleteName: string;
  squad?: string;
  team_id?: string;
  team_name?: string;
  distance: number;
  bestTime: number;
  bestSplit: number;
  bestWatts: number;
  date: string;
  weightKg?: number | null;
  is_test?: boolean;
  /** Grouping label for the chart selector, e.g. "2k Test · Mar 10" or "2000m" */
  assignmentLabel: string;
  /** group_assignment_id for linking to results page */
  assignmentId?: string;
}

/** Format a date string as short month + day, e.g. "Mar 10" */
function fmtShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface AssignmentRow {
  athlete_id: string;
  result_time_seconds: number;
  result_distance_meters: number;
  result_split_seconds: number | null;
  workout_date: string;
  group_assignment_id: string | null;
  group_assignments: { title: string | null; scheduled_date: string; workout_templates: { name: string; is_test: boolean | null } | null } | null;
}

/** Get erg comparison data per assignment/workout for the chart.
 *  Sources data from completed daily_workout_assignments (with template names)
 *  AND coaching_erg_scores (manual entries, grouped by distance). */
export async function getTeamErgComparison(teamId: string): Promise<TeamErgComparison[]> {
  const [scores, athletes] = await Promise.all([
    getErgScores(teamId),
    getAthletes(teamId),
  ]);

  const athleteMap = new Map(athletes.map(a => [a.id, a]));
  const athleteIds = athletes.map(a => a.id);

  // Load assignment results with template names
  let assignmentRows: AssignmentRow[] = [];
  if (athleteIds.length > 0) {
    const { data, error } = await supabase
      .from('daily_workout_assignments')
      .select('athlete_id, result_time_seconds, result_distance_meters, result_split_seconds, workout_date, group_assignment_id, group_assignments(title, scheduled_date, workout_templates(name, is_test))')
      .in('athlete_id', athleteIds)
      .eq('completed', true)
      .not('result_time_seconds', 'is', null)
      .not('result_distance_meters', 'is', null);
    if (error) console.warn('Failed to load assignment results for erg comparison', error);
    else assignmentRows = (data ?? []) as unknown as AssignmentRow[];
  }

  const results: TeamErgComparison[] = [];

  // ── Assignment results: group by group_assignment_id ──
  // For each assignment, keep each athlete's best result
  const byAssignment = new Map<string, { label: string; rows: AssignmentRow[] }>();
  for (const r of assignmentRows) {
    const distance = Number(r.result_distance_meters);
    const time = Number(r.result_time_seconds);
    if (!distance || !time || distance <= 0 || time <= 0) continue;

    const gaId = r.group_assignment_id ?? `ungrouped_${r.workout_date}`;
    if (!byAssignment.has(gaId)) {
      const ga = r.group_assignments;
      const templateName = ga?.workout_templates?.name ?? ga?.title;
      const date = ga?.scheduled_date ?? r.workout_date;
      const label = templateName ? `${templateName} · ${fmtShortDate(date)}` : `${distance}m · ${fmtShortDate(date)}`;
      byAssignment.set(gaId, { label, rows: [] });
    }
    byAssignment.get(gaId)!.rows.push(r);
  }

  for (const [gaId, { label, rows }] of byAssignment) {
    // Best result per athlete within this assignment
    const bestPerAthlete = new Map<string, AssignmentRow>();
    for (const r of rows) {
      const existing = bestPerAthlete.get(r.athlete_id);
      if (!existing || Number(r.result_time_seconds) < Number(existing.result_time_seconds)) {
        bestPerAthlete.set(r.athlete_id, r);
      }
    }

    const realAssignmentId = gaId.startsWith('ungrouped_') ? undefined : gaId;

    for (const r of bestPerAthlete.values()) {
      const athlete = athleteMap.get(r.athlete_id);
      if (!athlete) continue;
      const distance = Number(r.result_distance_meters);
      const time = Number(r.result_time_seconds);
      const splitSec = r.result_split_seconds ? Number(r.result_split_seconds) : (time / distance) * 500;
      const watts = splitSec > 0 ? 2.80 / Math.pow(splitSec / 500, 3) : 0;
      results.push({
        athleteId: r.athlete_id,
        athleteName: athlete.name,
        squad: athlete.squad ?? undefined,
        distance,
        bestTime: time,
        bestSplit: splitSec,
        bestWatts: watts,
        date: r.workout_date,
        weightKg: athlete.weight_kg ?? null,
        is_test: r.group_assignments?.workout_templates?.is_test ?? false,
        assignmentLabel: label,
        assignmentId: realAssignmentId,
      });
    }
  }

  // ── Manual erg scores: group by distance ──
  const scoresByDistance = new Map<number, typeof scores>();
  for (const s of scores) {
    if (!scoresByDistance.has(s.distance)) scoresByDistance.set(s.distance, []);
    scoresByDistance.get(s.distance)!.push(s);
  }

  for (const [distance, distScores] of scoresByDistance) {
    const label = `${distance}m Erg Scores`;
    // Best per athlete
    const bestPerAthlete = new Map<string, (typeof scores)[0]>();
    for (const s of distScores) {
      const existing = bestPerAthlete.get(s.athlete_id);
      if (!existing || s.time_seconds < existing.time_seconds) {
        bestPerAthlete.set(s.athlete_id, s);
      }
    }

    for (const s of bestPerAthlete.values()) {
      const athlete = athleteMap.get(s.athlete_id);
      if (!athlete) continue;
      const splitSec = s.split_500m ?? (s.time_seconds / s.distance) * 500;
      const watts = s.watts ?? (splitSec > 0 ? 2.80 / Math.pow(splitSec / 500, 3) : 0);
      results.push({
        athleteId: s.athlete_id,
        athleteName: athlete.name,
        squad: athlete.squad ?? undefined,
        distance: s.distance,
        bestTime: s.time_seconds,
        bestSplit: splitSec,
        bestWatts: watts,
        date: s.date,
        weightKg: athlete.weight_kg ?? null,
        is_test: false,
        assignmentLabel: label,
      });
    }
  }

  // Sort by date descending (newest assignment first), then by watts descending
  results.sort((a, b) => b.date.localeCompare(a.date) || b.bestWatts - a.bestWatts);
  return results;
}

// ─── Org-level analytics ────────────────────────────────────────────────────

/**
 * Get erg comparison data across ALL teams in an organization.
 * Each result is tagged with team_id / team_name.
 */
export async function getOrgErgComparison(orgId: string): Promise<TeamErgComparison[]> {
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return [];

  const perTeam = await Promise.all(
    teams.map(async (team) => {
      const data = await getTeamErgComparison(team.id);
      return data.map((d) => ({ ...d, team_id: team.id, team_name: team.name }));
    })
  );

  const results = perTeam.flat();
  results.sort((a, b) => a.distance - b.distance || b.bestWatts - a.bestWatts);
  return results;
}

/**
 * Get training zone distribution across ALL teams in an organization.
 */
export async function getOrgTrainingZoneDistribution(
  orgId: string,
  opts?: { from?: string; to?: string }
): Promise<{ zones: ZoneDistribution[]; total: number }> {
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return { zones: [], total: 0 };

  const perTeam = await Promise.all(
    teams.map((team) =>
      getTeamTrainingZoneDistribution(team.id, opts).catch(() => null)
    )
  );

  // Merge zone counts across teams
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of perTeam) {
    if (!r) continue;
    total += r.total;
    for (const z of r.zones) {
      counts.set(z.zone, (counts.get(z.zone) || 0) + z.count);
    }
  }

  const order = ['UT2', 'UT1', 'AT', 'TR', 'AN', 'Unset'];
  const zones: ZoneDistribution[] = order
    .filter((z) => counts.has(z))
    .map((z) => ({
      zone: z,
      count: counts.get(z)!,
      percentage: total > 0 ? Math.round((counts.get(z)! / total) * 100) : 0,
    }));

  return { zones, total };
}

/**
 * Get all athletes across an organization, each tagged with their team_id / team_name.
 * Athletes in multiple teams will appear once per team.
 */
export async function getOrgAthletesWithTeam(orgId: string): Promise<CoachingAthlete[]> {
  const teams = await getTeamsForOrg(orgId);
  if (teams.length === 0) return [];

  const perTeam = await Promise.all(
    teams.map(async (team) => {
      const athletes = await getAthletes(team.id);
      return athletes.map((a) => ({ ...a, team_id: team.id, team_name: team.name }));
    })
  );

  return perTeam.flat();
}
