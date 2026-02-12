// Coaching module types — mirrors Supabase athletes + coaching_* tables
// Unified model: athletes table + team_athletes junction, team-scoped coaching data

// ─── Team ───────────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  invite_code: string;
  coach_id: string;
  max_members: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type TeamRole = 'coach' | 'coxswain' | 'member';

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
}

/** TeamMember enriched with profile display info */
export interface TeamMemberWithProfile extends TeamMember {
  display_name: string;
  email?: string | null;
}

// ─── Unified Athlete (DB: athletes table) ───────────────────────────────────

/** Raw DB row from the `athletes` table */
export interface Athlete {
  id: string;
  user_id?: string | null; // FK → auth.users (null for non-app athletes)
  first_name: string;
  last_name: string;
  email?: string | null;
  date_of_birth?: string | null;
  grade?: string;
  experience_level?: 'novice' | 'freshman' | 'jv' | 'varsity';
  side?: 'port' | 'starboard' | 'coxswain' | 'both';
  height_cm?: number | null;
  weight_kg?: number | null;
  notes?: string;
  created_by: string; // FK → auth.users (coach who created)
  created_at: string;
  updated_at: string;
}

/** Athlete with a computed `name` field for display convenience */
export interface CoachingAthlete extends Athlete {
  name: string; // computed: `${first_name} ${last_name}`.trim()
}

/** Junction row from team_athletes */
export interface TeamAthlete {
  id: string;
  team_id: string;
  athlete_id: string;
  status: 'active' | 'inactive' | 'graduated';
  joined_at: string;
  left_at?: string | null;
}

// ─── Coaching Tables (now team-scoped) ──────────────────────────────────────

export interface CoachingSession {
  id: string;
  coach_user_id: string;
  team_id?: string;
  date: string; // ISO date
  type: 'water' | 'erg' | 'land' | 'meeting';
  focus?: string;
  general_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CoachingAthleteNote {
  id: string;
  coach_user_id: string;
  team_id?: string;
  session_id: string;
  athlete_id: string;
  note: string;
  created_at: string;
}

export interface CoachingErgScore {
  id: string;
  coach_user_id: string;
  team_id?: string;
  athlete_id: string;
  date: string;
  distance: number;
  time_seconds: number;
  split_500m?: number;
  watts?: number;
  stroke_rate?: number;
  heart_rate?: number;
  notes?: string;
  created_at: string;
}

export interface CoachingBoating {
  id: string;
  coach_user_id: string;
  team_id?: string;
  date: string;
  boat_name: string;
  boat_type: '8+' | '4+' | '4x' | '2x' | '1x' | '2-' | '4-';
  positions: BoatPosition[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BoatPosition {
  seat: number; // 0 = cox, 1 = bow, N = stroke
  athlete_id: string;
}

// ─── Weekly Plans ───────────────────────────────────────────────────────────

export interface CoachingWeeklyPlan {
  id: string;
  team_id: string;
  week_start: string; // ISO date — Monday of the target week
  theme?: string | null;
  focus_points: string[];
  notes?: string | null;
  reflection?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Shape for creating/updating a weekly plan */
export interface WeeklyPlanInput {
  team_id: string;
  week_start: string;
  theme?: string | null;
  focus_points: string[];
  notes?: string | null;
  reflection?: string | null;
  created_by: string;
}
