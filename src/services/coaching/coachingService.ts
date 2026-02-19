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
  CoachingSession,
  CoachingAthleteNote,
  CoachingErgScore,
  CoachingBoating,
  BoatPosition,
  CoachingWeeklyPlan,
  WeeklyPlanInput,
  GroupAssignment,
  GroupAssignmentInput,
  AssignmentCompletion,
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
  CoachingSession,
  CoachingAthleteNote,
  CoachingErgScore,
  CoachingBoating,
  BoatPosition,
  CoachingWeeklyPlan,
  WeeklyPlanInput,
  GroupAssignment,
  GroupAssignmentInput,
  AssignmentCompletion,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function throwOnError<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

/** Compute display name from first/last */
function toCoachingAthlete(athlete: Athlete): CoachingAthlete {
  return {
    ...athlete,
    name: `${athlete.first_name} ${athlete.last_name}`.trim(),
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
  updates: Partial<Pick<Team, 'name' | 'description'>>
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

/** Regenerate the invite code for a team */
export async function regenerateInviteCode(teamId: string): Promise<string> {
  const newCode = generateInviteCode();
  await supabase
    .from('teams')
    .update({ invite_code: newCode, updated_at: new Date().toISOString() })
    .eq('id', teamId);
  return newCode;
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
  // 1. Find user by email in user_profiles
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (profileErr) throw profileErr;
  if (!profile) throw new Error(`No account found for "${email}". They need to sign up first.`);

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

// ─── Join Team by Invite Code ───────────────────────────────────────────────

/** Look up a team by its invite code */
export async function getTeamByInviteCode(code: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', code.toUpperCase().trim())
    .maybeSingle();

  if (error) throw error;
  return data as Team | null;
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

/** Leave a team (member self-service) */
export async function leaveTeam(memberId: string): Promise<void> {
  throwOnError(
    await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
  );
}

// ─── Athlete Self-Service Queries ───────────────────────────────────────────

/** Get erg scores for a specific athlete (self-service view) */
export async function getMyErgScores(
  userId: string,
  teamId: string
): Promise<CoachingErgScore[]> {
  // Find the athlete record linked to this user
  const { data: athleteLink } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!athleteLink) return [];

  return throwOnError(
    await supabase
      .from('coaching_erg_scores')
      .select('*')
      .eq('team_id', teamId)
      .eq('athlete_id', athleteLink.id)
      .order('date', { ascending: false })
  );
}

/** Get session notes about a specific athlete (self-service view) */
export async function getMySessionNotes(
  userId: string,
  teamId: string,
  limit = 30
): Promise<(CoachingAthleteNote & { session?: CoachingSession })[]> {
  // Find the athlete record linked to this user
  const { data: athleteLink } = await supabase
    .from('athletes')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!athleteLink) return [];

  const notes = throwOnError(
    await supabase
      .from('coaching_athlete_notes')
      .select('*, coaching_sessions(*)')
      .eq('team_id', teamId)
      .eq('athlete_id', athleteLink.id)
      .order('created_at', { ascending: false })
      .limit(limit)
  ) as (CoachingAthleteNote & { coaching_sessions?: CoachingSession })[];

  return notes.map(({ coaching_sessions, ...note }) => ({
    ...note,
    session: coaching_sessions ?? undefined,
  }));
}

// ─── Athletes (unified: athletes + team_athletes) ───────────────────────────

export async function getAthletes(teamId: string): Promise<CoachingAthlete[]> {
  // Query athletes that belong to this team via inner join on team_athletes
  const rows = throwOnError(
    await supabase
      .from('athletes')
      .select('*, team_athletes!inner(team_id, status, squad)')
      .eq('team_athletes.team_id', teamId)
      .eq('team_athletes.status', 'active')
      .order('last_name')
  ) as (Athlete & { team_athletes: TeamAthlete[] })[];

  return rows.map(({ team_athletes, ...athlete }) => ({
    ...toCoachingAthlete(athlete as Athlete),
    squad: team_athletes[0]?.squad ?? null,
  }));
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

export async function createAthlete(
  teamId: string,
  createdBy: string,
  athlete: Pick<Athlete, 'first_name' | 'last_name' | 'grade' | 'experience_level' | 'side' | 'height_cm' | 'weight_kg' | 'notes'>,
  squad?: string | null
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
  throwOnError(
    await supabase
      .from('team_athletes')
      .insert({ team_id: teamId, athlete_id: newAthlete.id, status: 'active', squad: squad ?? null })
      .select()
      .single()
  );

  return { ...toCoachingAthlete(newAthlete), squad: squad ?? null };
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

// ─── Boatings (team-scoped) ─────────────────────────────────────────────────

export async function getBoatings(teamId: string): Promise<CoachingBoating[]> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: false })
  );
}

export async function createBoating(
  teamId: string,
  coachUserId: string,
  boating: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>
): Promise<CoachingBoating> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .insert({ team_id: teamId, coach_user_id: coachUserId, ...boating })
      .select()
      .single()
  );
}

export async function updateBoating(
  id: string,
  updates: Partial<Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>>
): Promise<CoachingBoating> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .update({ ...updates, updated_at: new Date().toISOString() })
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
  opts?: { from?: string; to?: string }
): Promise<GroupAssignment[]> {
  let query = supabase
    .from('group_assignments')
    .select(`
      id, team_id, template_id, scheduled_date, title, instructions,
      created_by, created_at,
      workout_templates!inner ( name, canonical_name, workout_structure, workout_type, training_zone, is_test )
    `)
    .eq('team_id', teamId)
    .order('scheduled_date', { ascending: false });

  if (opts?.from) query = query.gte('scheduled_date', opts.from);
  if (opts?.to) query = query.lte('scheduled_date', opts.to);

  const { data, error } = await query;
  if (error) throw error;

  // Flatten the joined template fields
  return (data ?? []).map((row: Record<string, unknown>) => {
    const tmpl = row.workout_templates as Record<string, unknown> | null;
    return {
      id: row.id as string,
      team_id: row.team_id as string,
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
  date: string
): Promise<GroupAssignment[]> {
  return getGroupAssignments(teamId, { from: date, to: date });
}

/** Create a group assignment and fan out per-athlete rows */
export async function createGroupAssignment(
  input: GroupAssignmentInput,
  athleteIds: string[]
): Promise<GroupAssignment> {
  // 1. Insert the group assignment
  const ga = throwOnError<Record<string, unknown>>(
    await supabase
      .from('group_assignments')
      .insert(input)
      .select()
      .single()
  );

  // 2. Fan out daily_workout_assignments for each athlete
  if (athleteIds.length > 0) {
    const dateObj = new Date(input.scheduled_date + 'T00:00:00');
    const rows = athleteIds.map((athleteId) => ({
      athlete_id: athleteId,
      team_id: input.team_id,
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
    team_id: ga.team_id as string,
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
  assignment: { team_id: string; template_id: string; scheduled_date: string; title?: string | null }
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
    const dateObj = new Date(assignment.scheduled_date + 'T00:00:00');
    const rows = toAdd.map((athleteId) => ({
      athlete_id: athleteId,
      team_id: assignment.team_id,
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
  athletes: CoachingAthlete[]
): Promise<AssignmentCompletion[]> {
  // 1. Get group assignments for the date
  const assignments = await getAssignmentsForDate(teamId, date);
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
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_split_seconds?: number | null;
  result_stroke_rate?: number | null;
  result_intervals?: IntervalResult[] | null;
}

/** Enriched result row joining assignment data with athlete profile (name, squad, weight_kg) */
export interface AssignmentResultRow {
  id: string;
  athlete_id: string;
  athlete_name: string;
  squad?: string | null;
  weight_kg?: number | null;
  completed: boolean;
  completed_at?: string | null;
  result_time_seconds?: number | null;
  result_distance_meters?: number | null;
  result_split_seconds?: number | null;
  result_stroke_rate?: number | null;
  result_intervals?: IntervalResult[] | null;
}

/**
 * Fetch per-athlete results for a group assignment, enriched with athlete
 * name / squad / weight_kg from the athletes + team_athletes tables.
 */
export async function getAssignmentResultsWithAthletes(
  groupAssignmentId: string,
  teamId: string
): Promise<AssignmentResultRow[]> {
  // 1. Fetch all assignment rows for this group
  const { data: rows, error: rowErr } = await supabase
    .from('daily_workout_assignments')
    .select('id, athlete_id, completed, completed_at, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
    .eq('group_assignment_id', groupAssignmentId);
  if (rowErr) throw rowErr;

  // 2. Fetch athletes for the team (includes squad + weight_kg)
  const { data: athleteRows, error: athErr } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, weight_kg, team_athletes!inner(team_id, squad)')
    .eq('team_athletes.team_id', teamId);
  if (athErr) throw athErr;

  // Build lookup map
  type AthleteInfo = { name: string; squad: string | null; weight_kg: number | null };
  const athleteMap = new Map<string, AthleteInfo>();
  for (const a of athleteRows ?? []) {
    const ta = (a.team_athletes as unknown as Array<{ squad: string | null }>)[0];
    const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
    athleteMap.set(a.id as string, { name, squad: ta?.squad ?? null, weight_kg: (a.weight_kg as number | null) ?? null });
  }

  return (rows ?? []).map((row) => {
    const info = athleteMap.get(row.athlete_id as string);
    return {
      id: row.id as string,
      athlete_id: row.athlete_id as string,
      athlete_name: info?.name ?? 'Unknown',
      squad: info?.squad ?? null,
      weight_kg: info?.weight_kg ?? null,
      completed: row.completed as boolean,
      completed_at: row.completed_at as string | null,
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
  const { data, error } = await supabase
    .from('daily_workout_assignments')
    .select('id, athlete_id, completed, completed_at, result_time_seconds, result_distance_meters, result_split_seconds, result_stroke_rate, result_intervals')
    .eq('group_assignment_id', groupAssignmentId);

  if (error) throw error;
  return (data ?? []) as AthleteAssignmentRow[];
}

/** Save results for multiple athletes on one group assignment */
export async function saveAssignmentResults(
  groupAssignmentId: string,
  results: Array<{
    athlete_id: string;
    completed: boolean;
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
    }
    if (r.result_time_seconds !== undefined) updatePayload.result_time_seconds = r.result_time_seconds;
    if (r.result_distance_meters !== undefined) updatePayload.result_distance_meters = r.result_distance_meters;
    if (r.result_split_seconds !== undefined) updatePayload.result_split_seconds = r.result_split_seconds;
    if (r.result_stroke_rate !== undefined) updatePayload.result_stroke_rate = r.result_stroke_rate;
    if (r.result_intervals !== undefined) updatePayload.result_intervals = r.result_intervals;

    const { error } = await supabase
      .from('daily_workout_assignments')
      .update(updatePayload)
      .eq('group_assignment_id', groupAssignmentId)
      .eq('athlete_id', r.athlete_id);

    if (error) throw error;
  }
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
  to: string
): Promise<ComplianceCell[]> {
  const { data, error } = await supabase
    .from('daily_workout_assignments')
    .select('athlete_id, group_assignment_id, completed, result_time_seconds, result_distance_meters, result_split_seconds')
    .eq('team_id', teamId)
    .gte('workout_date', from)
    .lte('workout_date', to);

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
  distance: number;
  bestTime: number;
  bestSplit: number;
  bestWatts: number;
  date: string;
}

/** Get best erg scores per athlete per distance for squad comparison */
export async function getTeamErgComparison(teamId: string): Promise<TeamErgComparison[]> {
  const [scores, athletes] = await Promise.all([
    getErgScores(teamId),
    getAthletes(teamId),
  ]);

  const athleteMap = new Map(athletes.map(a => [a.id, a]));

  // For each athlete × distance, pick the best (fastest) time
  const bestByKey = new Map<string, CoachingErgScore>();
  for (const s of scores) {
    const key = `${s.athlete_id}_${s.distance}`;
    const existing = bestByKey.get(key);
    if (!existing || s.time_seconds < existing.time_seconds) {
      bestByKey.set(key, s);
    }
  }

  const results: TeamErgComparison[] = [];
  for (const s of bestByKey.values()) {
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
    });
  }

  // Sort by distance, then by watts descending (best first)
  results.sort((a, b) => a.distance - b.distance || b.bestWatts - a.bestWatts);
  return results;
}
