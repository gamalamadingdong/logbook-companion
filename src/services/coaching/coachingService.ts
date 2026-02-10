import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type {
  CoachingAthlete,
  CoachingSession,
  CoachingAthleteNote,
  CoachingErgScore,
  CoachingBoating,
  BoatPosition,
} from './types';

// Re-export types for convenience
export type {
  CoachingAthlete,
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

// ─── Athletes ───────────────────────────────────────────────────────────────

export async function getAthletes(coachUserId: string): Promise<CoachingAthlete[]> {
  return throwOnError(
    await supabase
      .from('coaching_athletes')
      .select('*')
      .eq('coach_user_id', coachUserId)
      .order('name')
  );
}

export async function createAthlete(
  coachUserId: string,
  athlete: Pick<CoachingAthlete, 'name' | 'grade' | 'experience_level' | 'side' | 'notes'>
): Promise<CoachingAthlete> {
  return throwOnError(
    await supabase
      .from('coaching_athletes')
      .insert({ coach_user_id: coachUserId, ...athlete })
      .select()
      .single()
  );
}

export async function updateAthlete(
  id: string,
  updates: Partial<Pick<CoachingAthlete, 'name' | 'grade' | 'experience_level' | 'side' | 'notes'>>
): Promise<CoachingAthlete> {
  return throwOnError(
    await supabase
      .from('coaching_athletes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
  );
}

export async function deleteAthlete(id: string): Promise<void> {
  // Cascade: delete athlete notes and erg scores for this athlete
  await supabase.from('coaching_athlete_notes').delete().eq('athlete_id', id);
  await supabase.from('coaching_erg_scores').delete().eq('athlete_id', id);
  throwOnError(
    await supabase.from('coaching_athletes').delete().eq('id', id)
  );
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export async function getSessions(coachUserId: string): Promise<CoachingSession[]> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('coach_user_id', coachUserId)
      .order('date', { ascending: false })
  );
}

export async function getSessionsByDateRange(
  coachUserId: string,
  start: string,
  end: string
): Promise<CoachingSession[]> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('coach_user_id', coachUserId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
  );
}

export async function createSession(
  coachUserId: string,
  session: Pick<CoachingSession, 'date' | 'type' | 'focus' | 'general_notes'>
): Promise<CoachingSession> {
  return throwOnError(
    await supabase
      .from('coaching_sessions')
      .insert({ coach_user_id: coachUserId, ...session })
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

export async function createNote(
  coachUserId: string,
  note: Pick<CoachingAthleteNote, 'session_id' | 'athlete_id' | 'note'>
): Promise<CoachingAthleteNote> {
  return throwOnError(
    await supabase
      .from('coaching_athlete_notes')
      .insert({ coach_user_id: coachUserId, ...note })
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

// ─── Erg Scores ─────────────────────────────────────────────────────────────

export async function getErgScores(coachUserId: string): Promise<CoachingErgScore[]> {
  return throwOnError(
    await supabase
      .from('coaching_erg_scores')
      .select('*')
      .eq('coach_user_id', coachUserId)
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
  coachUserId: string,
  score: Pick<CoachingErgScore, 'athlete_id' | 'date' | 'distance' | 'time_seconds' | 'split_500m' | 'watts' | 'stroke_rate' | 'heart_rate' | 'notes'>
): Promise<CoachingErgScore> {
  return throwOnError(
    await supabase
      .from('coaching_erg_scores')
      .insert({ coach_user_id: coachUserId, ...score })
      .select()
      .single()
  );
}

export async function deleteErgScore(id: string): Promise<void> {
  throwOnError(
    await supabase.from('coaching_erg_scores').delete().eq('id', id)
  );
}

// ─── Boatings ───────────────────────────────────────────────────────────────

export async function getBoatings(coachUserId: string): Promise<CoachingBoating[]> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .select('*')
      .eq('coach_user_id', coachUserId)
      .order('date', { ascending: false })
  );
}

export async function createBoating(
  coachUserId: string,
  boating: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>
): Promise<CoachingBoating> {
  return throwOnError(
    await supabase
      .from('coaching_boatings')
      .insert({ coach_user_id: coachUserId, ...boating })
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
  coachUserId: string,
  source: CoachingBoating
): Promise<CoachingBoating> {
  const today = new Date().toISOString().slice(0, 10);
  return createBoating(coachUserId, {
    date: today,
    boat_name: source.boat_name,
    boat_type: source.boat_type,
    positions: source.positions,
    notes: `Copied from ${source.date}`,
  });
}
