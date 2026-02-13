import type { PostgrestError } from '@supabase/supabase-js';
import { format } from 'date-fns';
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
  AthleteAssignment,
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
  AthleteAssignment,
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
  athlete: Pick<Athlete, 'first_name' | 'last_name' | 'grade' | 'experience_level' | 'side' | 'notes'>,
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
  updates: Partial<Pick<Athlete, 'first_name' | 'last_name' | 'grade' | 'experience_level' | 'side' | 'notes'>>
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
  // Cascade: delete notes and erg scores referencing this athlete
  await supabase.from('coaching_athlete_notes').delete().eq('athlete_id', id);
  await supabase.from('coaching_erg_scores').delete().eq('athlete_id', id);
  // team_athletes cascade-deletes via FK
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
  session: Pick<CoachingSession, 'date' | 'type' | 'focus' | 'general_notes'>
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
  updates: Partial<Pick<CoachingSession, 'date' | 'type' | 'focus' | 'general_notes'>>
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
      workout_templates!inner ( name, canonical_name, workout_type, training_zone )
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
      workout_type: (tmpl?.workout_type as string) ?? undefined,
      training_zone: (tmpl?.training_zone as string | null) ?? null,
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
