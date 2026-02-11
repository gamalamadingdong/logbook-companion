import type { PostgrestError } from '@supabase/supabase-js';
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

// ─── Athletes (unified: athletes + team_athletes) ───────────────────────────

export async function getAthletes(teamId: string): Promise<CoachingAthlete[]> {
  // Query athletes that belong to this team via inner join on team_athletes
  const rows = throwOnError(
    await supabase
      .from('athletes')
      .select('*, team_athletes!inner(team_id, status)')
      .eq('team_athletes.team_id', teamId)
      .eq('team_athletes.status', 'active')
      .order('last_name')
  ) as (Athlete & { team_athletes: TeamAthlete[] })[];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return rows.map(({ team_athletes, ...athlete }) => toCoachingAthlete(athlete as Athlete));
}

export async function createAthlete(
  teamId: string,
  createdBy: string,
  athlete: Pick<Athlete, 'first_name' | 'last_name' | 'grade' | 'experience_level' | 'side' | 'notes'>
): Promise<CoachingAthlete> {
  // 1. Insert into athletes
  const newAthlete = throwOnError(
    await supabase
      .from('athletes')
      .insert({ created_by: createdBy, ...athlete })
      .select()
      .single()
  ) as Athlete;

  // 2. Link to team via team_athletes
  throwOnError(
    await supabase
      .from('team_athletes')
      .insert({ team_id: teamId, athlete_id: newAthlete.id, status: 'active' })
      .select()
      .single()
  );

  return toCoachingAthlete(newAthlete);
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
