import { useState, useEffect, useCallback } from 'react';
import { supabase, getUserGoals, type UserGoal } from '../services/supabase';
import { useAuth } from './useAuth';
import { workoutService } from '../services/workoutService';
import { getProfile } from '../api/concept2';
import { DEMO_WORKOUTS, GUEST_PROFILE } from '../data/demoData';

/** Per-section error tracking */
export interface DashboardErrors {
    meters: string | null;
    goals: string | null;
    history: string | null;
    workouts: string | null;
    profile: string | null;
}

const NO_ERRORS: DashboardErrors = { meters: null, goals: null, history: null, workouts: null, profile: null };

export const useDashboardData = () => {
    const { user, isGuest, tokensReady } = useAuth();

    // State
    const [statsHistory, setStatsHistory] = useState<any[]>([]);
    const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
    const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
    const [c2Profile, setC2Profile] = useState<any>(null);
    const [totalMeters, setTotalMeters] = useState(0);
    const [loading, setLoading] = useState(true);
    const [workoutsLoading, setWorkoutsLoading] = useState(false);
    const [errors, setErrors] = useState<DashboardErrors>(NO_ERRORS);

    const loadData = useCallback(async () => {
        setLoading(true);
        setErrors(NO_ERRORS);

        if (isGuest) {
            // --- GUEST MODE ---
            await new Promise(r => setTimeout(r, 600)); // Network simulation

            // 1. History (All Demo Workouts)
            setStatsHistory(DEMO_WORKOUTS.map(w => ({
                id: w.id,
                completed_at: w.completed_at,
                distance_meters: w.distance_meters,
                duration_seconds: w.duration_seconds,
                duration_minutes: w.duration_minutes,
                watts: w.watts,
                avg_split_500m: w.duration_seconds ? ((w.duration_seconds / w.distance_meters) * 500) : 0
            })));

            // 2. Recent Workouts (First Page)
            setRecentWorkouts(DEMO_WORKOUTS.slice(0, 5).map(w => ({
                id: w.external_id,
                db_id: w.id,
                date: w.completed_at,
                distance: w.distance_meters,
                time: w.duration_seconds * 10, // deciseconds
                type: w.workout_type,
                name: w.canonical_name,
                watts: w.watts,
                stroke_rate: w.average_stroke_rate,
                raw_data: w.raw_data
            })));

            // 3. User Goals (Mock)
            setUserGoals([
                { id: 'g1', user_id: 'guest', type: 'weekly_distance', target_value: 50000, start_date: '', deadline: '', is_active: true },
                { id: 'g2', user_id: 'guest', type: 'target_2k_watts', target_value: 250, start_date: '', deadline: '', is_active: true }
            ]);

            // 4. Profile & Meters
            setC2Profile({ username: GUEST_PROFILE.display_name, weight: 85 });
            const total = DEMO_WORKOUTS.reduce((sum, w) => sum + w.distance_meters, 0);
            setTotalMeters(total);

            setLoading(false);
            return;
        }

        if (!user) {
            setLoading(false);
            return;
        }

        // --- REAL MODE ---
        // Each section fetches independently so one failure doesn't block others
        const sectionErrors: DashboardErrors = { ...NO_ERRORS };

        // 1. Total meters
        try {
            const { data, error: metersErr } = await supabase
                .from('workout_logs')
                .select('distance_meters')
                .eq('user_id', user.id);

            if (metersErr) {
                sectionErrors.meters = 'Unable to load lifetime meters.';
            } else if (data) {
                setTotalMeters(data.reduce((sum, log) => sum + (log.distance_meters || 0), 0));
            }
        } catch {
            sectionErrors.meters = 'Unable to load lifetime meters.';
        }

        // 2. Goals
        try {
            const goals = await getUserGoals(user.id);
            if (goals) setUserGoals(goals);
        } catch {
            sectionErrors.goals = 'Unable to load goals.';
        }

        // 3. Stats history (last 30 days)
        try {
            const { data, error: histErr } = await supabase
                .from('workout_logs')
                .select('id, completed_at, distance_meters, duration_seconds, duration_minutes, watts, avg_split_500m')
                .eq('user_id', user.id)
                .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

            if (histErr) {
                sectionErrors.history = 'Unable to load weekly stats.';
            } else if (data) {
                setStatsHistory(data);
            }
        } catch {
            sectionErrors.history = 'Unable to load weekly stats.';
        }

        // 4. Recent workouts
        try {
            await fetchRecentWorkoutsReal(0);
        } catch {
            sectionErrors.workouts = 'Unable to load recent workouts.';
        }

        // 5. C2 Profile (non-critical)
        if (tokensReady && localStorage.getItem('concept2_token')) {
            try {
                const profile = await getProfile();
                setC2Profile(profile);
            } catch {
                sectionErrors.profile = 'Unable to load Concept2 profile.';
            }
        }

        setErrors(sectionErrors);
        setLoading(false);
    }, [user, isGuest, tokensReady]);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Pagination Helper
    const fetchRecentWorkouts = async (page: number) => {
        if (isGuest) {
            setWorkoutsLoading(true);
            await new Promise(r => setTimeout(r, 400));

            const start = page * 5;
            const end = start + 5;
            const slice = DEMO_WORKOUTS.slice(start, end).map(w => ({
                id: w.external_id,
                db_id: w.id,
                date: w.completed_at,
                distance: w.distance_meters,
                time: w.duration_seconds * 10,
                type: w.workout_type,
                name: w.canonical_name,
                watts: w.watts,
                stroke_rate: w.average_stroke_rate,
                raw_data: w.raw_data
            }));

            // Append or replace? Dashboard replaces.
            setRecentWorkouts(slice);
            setWorkoutsLoading(false);
        } else {
            await fetchRecentWorkoutsReal(page);
        }
    };

    const fetchRecentWorkoutsReal = async (page: number) => {
        setWorkoutsLoading(true);
        setErrors(prev => ({ ...prev, workouts: null }));
        try {
            const data = await workoutService.getRecentWorkouts(10, page);
            setRecentWorkouts(data);
        } catch (err) {
            console.error('Failed to load recent workouts', err);
            setErrors(prev => ({ ...prev, workouts: 'Unable to load recent workouts.' }));
        } finally {
            setWorkoutsLoading(false);
        }
    }

    /** Whether any section has an error */
    const hasErrors = Object.values(errors).some(Boolean);

    return {
        statsHistory,
        recentWorkouts,
        userGoals,
        c2Profile,
        totalMeters,
        loading,
        workoutsLoading,
        errors,
        hasErrors,
        retry: loadData,
        fetchRecentWorkouts
    };
};
