import { supabase } from '../services/supabase';
import { calculatePRs, PR_DISTANCES, BENCHMARK_PATTERNS, formatTime, formatPace, formatRest, calculateCanonicalName, calculateWatts, formatWatts } from './prCalculator';
import type { PRRecord } from './prCalculator';

export type { PRRecord };
export { PR_DISTANCES, BENCHMARK_PATTERNS, formatTime, formatPace, formatRest, calculateCanonicalName, calculateWatts, formatWatts };

/**
 * Fetch all PRs for a user
 */
export async function fetchUserPRs(userId: string): Promise<PRRecord[]> {
    // 1. Fetch all workouts with raw_data
    const { data: workouts, error } = await supabase
        .from('workout_logs')
        .select('id, completed_at, distance_meters, duration_seconds, duration_minutes, workout_name, workout_type, avg_split_500m, raw_data')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

    if (error || !workouts) {
        console.error('Error fetching workouts for PRs:', error);
        return [];
    }

    return calculatePRs(workouts);
}
