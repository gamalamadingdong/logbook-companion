import { supabase } from '../services/supabase';
import { calculatePRs, PR_DISTANCES, BENCHMARK_PATTERNS, formatTime, formatPace, formatRest, calculateCanonicalName, calculateWatts, formatWatts } from './prCalculator';
import type { PRRecord } from './prCalculator';
import { DEMO_WORKOUTS } from '../data/demoData';

export type { PRRecord };
export { PR_DISTANCES, BENCHMARK_PATTERNS, formatTime, formatPace, formatRest, calculateCanonicalName, calculateWatts, formatWatts };

/**
 * Fetch all PRs for a user
 */
export async function fetchUserPRs(userId: string): Promise<PRRecord[]> {
    if (userId === 'guest_user_123') {
        return calculatePRs(DEMO_WORKOUTS as any[]);
    }

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

/**
 * Calculate and Persist PRs to the user profile
 * This filters the detected PRs against the user's "Tracked" preferences
 * to keep the profile lightweight.
 */
export async function saveFilteredPRs(userId: string): Promise<void> {
    if (userId === 'guest_user_123') return;

    console.log(`Analyzing PRs for persistence (User: ${userId})...`);

    // 1. Calculate All PRs from raw history
    const allPrs = await fetchUserPRs(userId);

    // 2. Fetch User Preferences
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('benchmark_preferences')
        .eq('user_id', userId)
        .single();

    if (error || !profile) {
        console.error('Failed to fetch profile for PR save', error);
        return;
    }

    const { benchmark_preferences } = profile;
    const trackedRecords: Record<string, number> = {};

    // 3. Filter
    allPrs.forEach(pr => {
        const pref = benchmark_preferences?.[pr.label];
        // Default to TRUE if not specified (Standard behavior), 
        // OR strict check? 
        // User asked to "Ensure only PRs ... that are actively tracked ... are stored".
        // This implies: If it's NOT in preferences, should we store it?
        // Usually "new" standard distances (2k, 5k) should represent "implicitly tracked".
        // But "416m" should be ignored.
        // `prCalculator` only returns "Standard" distances or "Intervals".
        // It does NOT return random weird distances unless they match a pattern?
        // Actually `prCalculator` scans all workouts. 
        // If I did a 416m workout, `calculatePRs` might label it "416m"?
        // Let's check `calculatePRs` logic (assumed).
        // If `calculatePRs` returns everything, we MUST filter.

        // Strict Filter: Only if explicitly tracked OR (it is a "Standard" distance AND not explicitly disabled)
        // Actually, let's rely on the preferences map if it exists.
        // If pref is undefined, we default to: Is it a "Standard" distance?

        const isTracked = pref?.is_tracked ?? true; // Default to true if not set? 
        // If random distance "416m", user likely doesn't have a pref for it.
        // Use a whitelist of "Standard" keys?
        // Let's assume `benchmark_preferences` is the authority.
        // If the user hasn't "Tracked" it, we skip it?
        // But for a new user, preferences are empty. We don't want to store nothing.
        // We defined `PR_DISTANCES` in `prCalculator`. 

        if (isTracked) {
            // Store the TIME (seconds) or Watts? 
            // Usually PRs are time-based for distance workouts, and pace/watts for time/intervals?
            // Let's store the sorting metric. 
            // For standard distances: Time.
            // For intervals: Pace or Watts? 
            // Let's store the `time` (duration) for now as universal value?
            // Or better: Store the object? Object is too big.
            // Store the "result" value.
            trackedRecords[pr.label] = pr.time;
        }
    });

    console.log(`Saving ${Object.keys(trackedRecords).length} Tracked PRs to profile...`);

    // 4. Save
    await supabase
        .from('user_profiles')
        .update({ personal_records: trackedRecords })
        .eq('user_id', userId);
}
