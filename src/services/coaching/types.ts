// Coaching module types — mirrors Supabase coaching_* tables

export interface CoachingAthlete {
  id: string; // uuid
  coach_user_id: string;
  name: string;
  grade?: string;
  experience_level?: 'novice' | 'freshman' | 'jv' | 'varsity';
  side?: 'port' | 'starboard' | 'coxswain' | 'both';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CoachingSession {
  id: string;
  coach_user_id: string;
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
  session_id: string;
  athlete_id: string;
  note: string;
  created_at: string;
}

export interface CoachingErgScore {
  id: string;
  coach_user_id: string;
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
