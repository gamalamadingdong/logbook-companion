import { supabase } from './supabase';
import type { C2ResultDetail, C2Stroke } from '../api/concept2.types';

export const workoutService = {
    // Fetch recent workouts list (Dashboard)
    getRecentWorkouts: async (limit = 50) => {
        const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('source', 'concept2') // Only C2 logs for now
            .order('completed_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Map DB Shape to UI Shape (C2Result-like)
        return data.map(log => ({
            id: log.external_id, // Use C2 ID for compatibility
            db_id: log.id, // Keep internal DB ID accessible
            date: log.completed_at,
            distance: log.distance_meters,
            time: log.duration_minutes * 600, // min -> deciseconds (approx) - Wait, time is usually stored as seconds in DB? Check Sync logic.
            // Sync Logic: duration_minutes: Math.round(summary.time / 600) -> Minutes.
            // UI expects deciseconds for formatTime? 
            // Actually, for dashboard display: 
            //   WorkoutDetail: time/10 -> seconds.
            //   RecentWorkouts: workout.time / 10 -> seconds.
            //   Sync stores: duration_minutes (Integer). 
            //   Wait, we lose precision if we only store minutes! 27.38 -> 27.
            //   "raw_data" has the full precision. Let's use that if available.
            time_formatted: log.raw_data?.time_formatted || `${log.duration_minutes}m`, // Fallback
            type: log.workout_type,
            watts: log.watts,
            stroke_rate: log.average_stroke_rate,
            calories_total: log.calories_burned
        }));
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
            return data.raw_data as C2ResultDetail;
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
    }
};
