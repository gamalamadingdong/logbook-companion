import { supabase } from './supabase';
import type { C2ResultDetail, C2Stroke } from '../api/concept2.types';
import { calculateCanonicalName } from '../utils/workoutNaming';

export const workoutService = {
    // Fetch recent workouts list (Dashboard)
    getRecentWorkouts: async (limit = 50, page = 0) => {
        const from = page * limit;
        const to = from + limit - 1;

        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('source', 'concept2') // Only C2 logs for now
            .order('completed_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return data.map(log => {
            const raw = log.raw_data;
            // DB is Primary Source
            // Try to use DB canonical name, fallback to calculating it, then fallback to DB workout name
            let canonicalName = log.canonical_name;

            // If missing OR "Unstructured", try to generate from raw (and backfill)
            if ((!canonicalName || canonicalName === 'Unstructured') && raw && raw.workout && raw.workout.intervals) {
                const generated = calculateCanonicalName(raw.workout.intervals);
                // Accept new name if it's better (not Unknown/Unstructured)
                if (generated && generated !== 'Unknown' && generated !== 'Unstructured') {
                    canonicalName = generated;
                    // Fire & Forget update
                    supabase.from('workout_logs').update({ canonical_name: canonicalName }).eq('id', log.id).then();
                }
            }

            // Fallbacks
            if (!canonicalName) {
                if (log.workout_type === 'FixedDistanceSplits' || log.workout_type === 'FixedDistanceNoSplits') canonicalName = `${log.distance_meters}m`;
                else if (log.workout_type === 'FixedTimeSplits' || log.workout_type === 'FixedTimeNoSplits') canonicalName = `${Math.round(log.duration_minutes)}:00`;
                else if (log.workout_type === 'JustRow') canonicalName = 'Just Row';
                else canonicalName = log.workout_name;
            }

            // Format Time from DB duration_seconds
            let timeFormatted = raw?.time_formatted;
            if (!timeFormatted && log.duration_seconds) {
                const totalSeconds = log.duration_seconds;
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = (totalSeconds % 60).toFixed(1);
                timeFormatted = hours > 0
                    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(4, '0')}`
                    : `${minutes}:${seconds.toString().padStart(4, '0')}`;
            }

            return {
                id: log.external_id, // Use C2 ID for compatibility
                db_id: log.id, // Keep internal DB ID accessible
                date: log.completed_at,
                distance: log.distance_meters,
                time: log.duration_seconds ? log.duration_seconds * 10 : (log.duration_minutes * 600),
                time_formatted: timeFormatted || `${log.duration_minutes}m`,
                type: log.workout_type,
                name: canonicalName,
                watts: log.watts,
                stroke_rate: log.average_stroke_rate,
                calories_total: log.calories_burned,
                raw_data: raw
            };
        });
    },

    // Fetch single workout detail (Analysis)
    getWorkoutDetail: async (idOrExternalId: string | number) => {
        const idStr = String(idOrExternalId);
        // Check if UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

        const query = supabase
            .from('workout_logs')
            .select('*');

        if (isUUID) {
            query.eq('id', idStr);
        } else {
            query.eq('external_id', idStr);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        // If we have raw_data, return it (it's the full C2 JSON)
        if (data.raw_data) {
            let canonicalName = data.canonical_name;
            if (!canonicalName && data.raw_data.workout?.intervals) {
                canonicalName = calculateCanonicalName(data.raw_data.workout.intervals);
            }
            // Fallback
            if (!canonicalName) canonicalName = data.workout_name;

            return {
                ...data.raw_data,
                workout_name: canonicalName // Inject Canonical Name for UI consistency
            } as C2ResultDetail;
        }

        // Fallback or migrated data without raw_data (shouldn't happen for new syncs)
        throw new Error("Workout data not found or incomplete in database.");
    },

    // Fetch strokes (Analysis)
    getStrokes: async (idOrExternalId: string | number) => {
        const idStr = String(idOrExternalId);
        // Check if UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

        const query = supabase
            .from('workout_logs')
            .select('raw_data');

        if (isUUID) {
            query.eq('id', idStr);
        } else {
            query.eq('external_id', idStr);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        if (data.raw_data && data.raw_data.strokes) {
            return data.raw_data.strokes as C2Stroke[];
        }


        return [];
    },

    // Fetch Power Buckets (Analysis)
    getPowerBuckets: async (idOrExternalId: string | number) => {
        const idStr = String(idOrExternalId);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

        let workoutId = idStr;

        // If External ID, we need to resolve to Internal ID first (or join)
        // Since buckets are keyed by Internal ID.
        if (!isUUID) {
            const { data, error } = await supabase
                .from('workout_logs')
                .select('id')
                .eq('external_id', idStr)
                .single();
            if (error || !data) return null;
            workoutId = data.id;
        }

        const { data, error } = await supabase
            .from('workout_power_distribution')
            .select('buckets')
            .eq('workout_id', workoutId)
            .single();

        if (error) return null;
        return data.buckets as Record<string, number>;
    },

    // Fetch history of a specific workout type (Progress)
    getWorkoutHistory: async (workoutName: string) => {
        // We use canonical_name now for precise filtering
        // If DB is not fully backfilled, this might miss old records until they are viewed in dashboard.
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('canonical_name', workoutName)
            .order('completed_at', { ascending: true }); // Oldest first for progress chart

        if (error) throw error;

        return data.map(log => ({
            id: log.external_id,
            db_id: log.id,
            date: log.completed_at,
            watts: log.watts,
            distance: log.distance_meters,
            time: log.duration_seconds || (log.duration_minutes * 60),
            avg_split: log.avg_split_500m
        }));
    },

    // Fetch and aggregate power buckets for multiple workouts (Analytics)
    getAggregatedPowerBuckets: async (workoutIds: string[]): Promise<Record<string, number>> => {
        if (workoutIds.length === 0) return {};

        const { data, error } = await supabase
            .from('workout_power_distribution')
            .select('buckets')
            .in('workout_id', workoutIds);

        if (error) {
            console.error('Error fetching aggregated buckets:', error);
            return {};
        }

        // Merge all buckets
        const aggregated: Record<string, number> = {};
        data.forEach(row => {
            if (row.buckets) {
                Object.entries(row.buckets).forEach(([watts, seconds]) => {
                    aggregated[watts] = (aggregated[watts] || 0) + (seconds as number);
                });
            }
        });

        return aggregated;
    },

    // Search Workouts (Comparison Picker)
    searchWorkouts: async (term: string) => {
        // Search by name or distance or type
        // This is a simple LIKE search
        const { data, error } = await supabase
            .from('workout_logs')
            .select('id, external_id, completed_at, workout_name, distance_meters, duration_seconds, duration_minutes, completed_at, canonical_name')
            .or(`workout_name.ilike.%${term}%,canonical_name.ilike.%${term}%`)
            .order('completed_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data.map(log => ({
            id: log.external_id,
            db_id: log.id,
            date: log.completed_at,
            name: log.canonical_name || log.workout_name,
            distance: log.distance_meters,
            time_formatted: log.duration_seconds ? new Date(log.duration_seconds * 1000).toISOString().substr(11, 8) : `${log.duration_minutes}m`
        }));
    },

    // Get "Smart" comparison options (PR, Previous) for a specific workout
    getSimilarWorkouts: async (targetId: string) => {
        // 1. Get Target Workout
        const target = await workoutService.getWorkoutDetail(targetId);
        if (!target) throw new Error("Target workout not found");

        const canonicalName = target.workout_name || '';

        // 2. Get History
        const history = await workoutService.getWorkoutHistory(canonicalName);

        // 3. Find PR (Best Watts implies best pace usually, or lowest time for distance)
        // Sort by Watts Descending (Power PR)
        // Or if Time/Distance type, sort by Splits?
        // Let's use Watts as a universal "Best Effort" proxy for now, or Split.
        const pr = [...history].sort((a, b) => (b.watts || 0) - (a.watts || 0))[0];

        // 4. Find Previous (Most recent before this one)
        // History is sorted by Date Ascending.
        // Find index of target (using db_id or external_id)
        const targetIndex = history.findIndex(h => h.id === target.id || h.db_id === target.id); // target.id from getDetail is external_id?
        // Wait, getDetail returns C2ResultDetail, which doesn't have `id` or `db_id` at top level easily?
        // Actually getDetail returns the spread raw_data + `workout_name`. 
        // We might need to ensure we have the ID to match.

        let previous = null;
        if (targetIndex > 0) {
            previous = history[targetIndex - 1];
        }

        return {
            target,
            pr: pr?.id !== target.id ? pr : null, // Don't suggest itself if it IS the PR
            previous,
            history
        };
    }
};
