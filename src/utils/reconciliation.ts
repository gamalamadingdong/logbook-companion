
import { SupabaseClient } from '@supabase/supabase-js';

// Define Source Priority for "Upgrades"
const SOURCE_PRIORITY = {
    'concept2': 3, // GOLD
    'erg_link': 2, // SILVER
    'manual': 1,   // BRONZE
    'unknown': 0
};

export type DataSource = keyof typeof SOURCE_PRIORITY;

interface MatchingCriteria {
    userId: string;
    date: Date;
    distance?: number;
    timeSeconds?: number;
    tolerance: {
        timeSeconds: number; // e.g. 5 seconds (for start time matching)
        distanceMeters: number; // e.g. 10 meters (if dist based)
        durationSeconds: number; // e.g. 2 seconds (if time based)
    };
}

export type WorkoutLogMatch = {
    id: string;
    source: string;
    canonical_name?: string;
};

/**
 * Determines if a new source provides better data quality than the existing source.
 */
export function shouldUpgrade(existingSource: string, newSource: string): boolean {
    const existingScore = SOURCE_PRIORITY[existingSource as DataSource] || 0;
    const newScore = SOURCE_PRIORITY[newSource as DataSource] || 0;
    return newScore >= existingScore;
}

/**
 * Finds a matching workout in the database to reconcile against.
 * Matches based on User + Date (approx) + (Distance OR Duration).
 */
export async function findMatchingWorkout(
    supabase: SupabaseClient,
    criteria: MatchingCriteria
): Promise<WorkoutLogMatch | null> {
    const { userId, date, distance, timeSeconds, tolerance } = criteria;

    // Time window based on tolerance (defaulting to 10m if not set, but criteria usually has it)
    const windowMs = (tolerance.timeSeconds || 600) * 1000;
    const minDate = new Date(date.getTime() - windowMs);
    const maxDate = new Date(date.getTime() + windowMs);

    let query = supabase
        .from('workout_logs')
        .select('id, source, canonical_name, distance_meters, duration_seconds')
        .eq('user_id', userId)
        .gte('completed_at', minDate.toISOString())
        .lte('completed_at', maxDate.toISOString());

    const { data, error } = await query;

    if (error) {
        console.error('Error searching for matching workout:', error);
        return null;
    }

    if (!data || data.length === 0) return null;

    // Refine match in memory based on Distance or Time
    // Refine match in memory based on Distance AND/OR Time
    // We require ALL provided criteria to match if the log has that data.
    const match = data.find(log => {
        let works = true;

        // 1. Check Distance
        if (distance && log.distance_meters) {
            const delta = Math.abs(log.distance_meters - distance);
            if (delta > tolerance.distanceMeters) works = false;
        }

        // 2. Check Duration
        if (works && timeSeconds && log.duration_seconds) {
            const delta = Math.abs(log.duration_seconds - timeSeconds);
            if (delta > tolerance.durationSeconds) works = false;
        }

        return works;
    });

    if (match) {
        return {
            id: match.id,
            source: match.source || 'manual',
            canonical_name: match.canonical_name
        };
    }

    return null;
}
