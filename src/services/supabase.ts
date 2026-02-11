
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
    canonical_name?: string; // Standardized name (e.g. "5x1500m")
    workout_type: string;
    completed_at: string; // timestamp
    distance_meters: number;
    duration_minutes: number; // integer? or float?
    average_heart_rate?: number;
    max_heart_rate?: number;
    average_stroke_rate?: number;
    watts?: number; // Added for C2
    calories_burned?: number;
    rest_distance_meters?: number; // Added for C2 Rest
    external_id?: string; // c2 result id
    source: string; // 'concept2'
    notes?: string;
    training_zone?: string;
    zone_distribution?: Record<string, number>;
    raw_data?: unknown; // full json

    // Derived/Optional
    duration_seconds?: number;
    avg_split_500m?: number;
}

export interface UserProfile {
    id: string;
    user_id: string;
    email: string;
    display_name?: string;
    personal_records?: Record<string, number>; // Cached PRs (Tracked Only)
    daily_recommendation?: {
        date: string; // ISO Date "YYYY-MM-DD"
        template_id: string;
        reason: string;
        targetPaceRange?: { low: string; high: string };
    };
    skill_level?: string;
    profile_visibility?: string;
    share_workouts?: boolean;
    share_progress?: boolean;
    max_heart_rate?: number;
    resting_heart_rate?: number;
    weight_lbs?: number;
    birth_date?: string;
    benchmark_preferences?: Record<string, { is_tracked: boolean; working_baseline?: string; goal?: number }>;
    preferences?: Record<string, unknown>;
    roles?: string[];
    created_at?: string;
    updated_at?: string;
}


export interface UserGoal {
    id: string;
    user_id: string;
    type: 'weekly_distance' | 'monthly_distance' | 'target_2k_watts' | 'weekly_sessions' | 'weekly_time' | 'benchmark_goal';
    target_value: number;
    metric_key?: string; // e.g. '2000m' or '30:00'
    start_date?: string;
    deadline?: string;
    is_active: boolean;
}

export interface WorkoutTemplate {
    id: string;
    name: string;
    description?: string;
    workout_type: string; // e.g. 'interval', 'time', 'distance'
    training_zone?: 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' | null;
    workout_category?: string; // e.g. 'interval_threshold', 'steady_state'
    pacing_guidance?: string; // e.g. "2k+10"
    difficulty_level?: 'easy' | 'medium' | 'hard' | 'intermediate' | 'advanced' | 'elite' | 'novice';
    tags?: string[];
    usage_count?: number;
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

export const getUserGoals = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

    if (error) throw error;
    return data as UserGoal[];
};

export const saveUserGoal = async (goal: Partial<UserGoal>) => {
    const { data, error } = await supabase
        .from('user_goals')
        .upsert(goal)
        .select();

    if (error) throw error;
    return data[0] as UserGoal;
};

export const getWorkoutTemplates = async () => {
    const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('status', 'published')
        .eq('workout_type', 'erg');

    if (error) {
        console.error('Error fetching templates:', error);
        return [];
    }
    return data as WorkoutTemplate[];
};

