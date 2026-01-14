
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase URL or Anon Key. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export type WorkoutLog = {
    id: string; // uuid
    user_id: string; // uuid
    workout_name: string;
    workout_type: string;
    completed_at: string; // timestamp
    distance_meters: number;
    duration_minutes: number; // integer? or float?
    average_heart_rate?: number;
    max_heart_rate?: number;
    average_stroke_rate?: number;
    watts?: number; // Added for C2
    calories_burned?: number;
    external_id?: string; // c2 result id
    source: string; // 'concept2'
    raw_data?: any; // full json
}

export interface UserProfile {
    id: string;
    user_id: string;
    email: string;
    display_name?: string;
    skill_level?: string;
    profile_visibility?: string;
    share_workouts?: boolean;
    share_progress?: boolean;
    created_at?: string;
    updated_at?: string;
}

export const upsertWorkout = async (workout: Partial<WorkoutLog>) => {
    // We use external_id as the unique key to prevent duplicates
    const { data, error } = await supabase
        .from('workout_logs')
        .upsert(workout, { onConflict: 'external_id' })
        .select()

    if (error) {
        console.error('Error upserting workout:', error)
        throw error
    }
    return data
}
