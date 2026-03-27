// Coaching module types — mirrors Supabase athletes + coaching_* tables
// Unified model: athletes table + team_athletes junction, team-scoped coaching data
import type { PerformanceTierRubricConfig } from '../../utils/performanceTierRubric';

// ─── Organization ───────────────────────────────────────────────────────────

/** A club or program that groups multiple teams/boats */
export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  invite_code: string;
  performance_tier_rubric?: PerformanceTierRubricConfig | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type OrgRole = 'owner' | 'admin' | 'coach';

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
}

// ─── Team ───────────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  invite_code: string;
  coach_id: string;
  max_members: number;
  is_public: boolean;
  org_id?: string | null; // FK → organizations (null for standalone/legacy teams)
  titan_window_size: number; // legacy field from earlier Titan window model; analytics now uses time presets
  created_at: string;
  updated_at: string;
}

export type TeamRole = 'coach' | 'coxswain' | 'member';
export type PerformanceTier = 'pool' | 'developmental' | 'challenger' | 'champion';

/** Lightweight team summary returned by getTeamsForUser */
export interface UserTeamInfo {
  team_id: string;
  team_name: string;
  role: TeamRole;
  org_id?: string | null;
  org_name?: string | null;
}

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
  experience_level?: 'beginner' | 'intermediate' | 'experienced' | 'advanced';
  side?: 'port' | 'starboard' | 'coxswain' | 'both';
  height_cm?: number | null;
  weight_kg?: number | null;
  notes?: string;
  coach_notes?: string | null;
  coach_notes_visible_to_athlete?: boolean;
  created_by: string; // FK → auth.users (coach who created)
  created_at: string;
  updated_at: string;
}

/** Athlete with a computed `name` field for display convenience */
export interface CoachingAthlete extends Athlete {
  name: string; // computed: `${first_name} ${last_name}`.trim()
  squad?: string | null; // from team_athletes junction
  performance_tier?: PerformanceTier | null; // from team_athletes junction
  team_id?: string;   // populated for org-wide queries
  team_name?: string;  // populated for org-wide queries
}

/** Junction row from team_athletes */
export interface TeamAthlete {
  id: string;
  team_id: string;
  athlete_id: string;
  status: 'active' | 'inactive' | 'graduated';
  squad?: string | null;
  performance_tier?: PerformanceTier | null;
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
  group_assignment_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduleEventType = 'regatta' | 'scrimmage' | 'head_race' | 'team_event' | 'off_day';

export interface CoachingScheduleEvent {
  id: string;
  org_id: string;
  coach_user_id: string;
  date: string;
  end_date?: string | null;
  title: string;
  event_type: ScheduleEventType;
  location?: string | null;
  team_ids: string[];
  notes?: string | null;
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

export interface CoachingAthleteCoachNote {
  id: string;
  coach_user_id: string;
  team_id: string;
  athlete_id: string;
  note: string;
  visible_to_athlete: boolean;
  created_at: string;
  updated_at: string;
  author_display_name?: string | null;
  author_email?: string | null;
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

export type BoatType = '8+' | '4+' | '4x' | '2x' | '1x' | '2-' | '4-';

export interface CoachingBoat {
  id: string;
  coach_user_id: string;
  team_id: string;
  boat_name: string;
  boat_type: BoatType;
  notes?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CoachingBoating {
  id: string;
  coach_user_id: string;
  team_id?: string;
  boat_id?: string | null;
  date: string;
  boat_name: string;
  boat_type: BoatType;
  positions: BoatPosition[];
  notes?: string;
  session_id?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CoachingBoatingRaceResult {
  id: string;
  boating_id: string;
  team_id: string;
  coach_user_id: string;
  schedule_event_id?: string | null;
  race_date: string;
  event_name: string;
  distance_meters: number;
  time_seconds: number;
  lineup_signature: string;
  lineup_positions: BoatPosition[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoatPosition {
  seat: number; // 0 = cox, 1 = bow, N = stroke
  athlete_id: string;
  /** Snapshotted at creation time for historical accuracy across transfers */
  athlete_name?: string;
}

export interface CoachingSessionCrewPosition {
  id: string;
  session_crew_id: string;
  team_id: string;
  coach_user_id: string;
  seat: number;
  athlete_id?: string | null;
  athlete_name: string;
  created_at: string;
}

export interface CoachingSessionCrew {
  id: string;
  session_id: string;
  team_id: string;
  coach_user_id: string;
  boat_id?: string | null;
  source_boating_id?: string | null;
  boat_name: string;
  boat_type: BoatType;
  notes?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  positions: CoachingSessionCrewPosition[];
}

import type { WorkoutStructure } from '../../types/workoutStructure.types';

// ─── Weekly Plans ───────────────────────────────────────────────────────────

export interface CoachingWeeklyPlan {
  id: string;
  team_id: string;
  week_start: string; // ISO date — Monday of the target week
  theme?: string | null;
  goals: string[];
  coaching_points: string[];
  drill_examples: string[];
  piece_examples: string[];
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
  goals: string[];
  coaching_points: string[];
  drill_examples: string[];
  piece_examples: string[];
  notes?: string | null;
  reflection?: string | null;
  created_by: string;
}

// ─── Workout Assignments ────────────────────────────────────────────────────

/** A group-level workout assignment: template + date + team or org */
export interface GroupAssignment {
  id: string;
  team_id?: string | null;
  org_id?: string | null;
  template_id: string;
  scheduled_date: string; // ISO date (YYYY-MM-DD)
  title?: string | null;
  instructions?: string | null;
  created_by?: string | null;
  created_at: string;
  // Joined fields (from template)
  template_name?: string;
  canonical_name?: string | null;
  workout_structure?: WorkoutStructure | null;
  workout_type?: string;
  training_zone?: string | null;
  /** Whether the workout template is flagged as a test/benchmark (from template is_test) */
  is_test_template?: boolean;
}

/** Input shape for creating a group assignment */
export interface GroupAssignmentInput {
  team_id?: string | null;
  org_id?: string | null;
  template_id: string;
  scheduled_date: string;
  title?: string | null;
  instructions?: string | null;
  created_by: string;
}

/** Per-athlete assignment row with completion status */
export interface AthleteAssignment {
  id: string;
  athlete_id: string;
  group_assignment_id: string;
  template_id?: string | null;
  scheduled_date: string;
  completed: boolean;
  workout_log_id?: string | null;
  // Joined fields
  athlete_name?: string;
}

/** Completion summary for a group assignment */
export interface AssignmentCompletion {
  group_assignment_id: string;
  total: number;
  completed: number;
  missing_athletes: Array<{ id: string; name: string }>;
}
