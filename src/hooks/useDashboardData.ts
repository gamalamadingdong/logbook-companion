import { useState, useEffect } from 'react';
import { supabase, getUserGoals, type UserGoal } from '../services/supabase';
import { useAuth } from './useAuth';
import { workoutService } from '../services/workoutService';
import { getProfile } from '../api/concept2';
import { DEMO_WORKOUTS, GUEST_PROFILE } from '../data/demoData';

export const useDashboardData = () => {
    const { user, isGuest } = useAuth();

    // State
    const [statsHistory, setStatsHistory] = useState<any[]>([]);
    const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
    const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
    const [c2Profile, setC2Profile] = useState<any>(null);
    const [totalMeters, setTotalMeters] = useState(0);
    const [loading, setLoading] = useState(true);
    const [workoutsLoading, setWorkoutsLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        async function loadData() {
            setLoading(true);

            if (isGuest) {
                // --- GUEST MODE ---
                await new Promise(r => setTimeout(r, 600)); // Network simulation

                // 1. History (All Demo Workouts)
                // Map to shape needed by widgets
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
            try {
                // Parallel Fetch
                const [logsParams, goals, historyData] = await Promise.all([
                    supabase.from('workout_logs').select('distance_meters').eq('user_id', user.id),
                    getUserGoals(user.id),
                    supabase.from('workout_logs')
                        .select('id, completed_at, distance_meters, duration_seconds, duration_minutes, watts, avg_split_500m')
                        .eq('user_id', user.id)
                        .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                ]);

                if (!logsParams.error && logsParams.data) {
                    const total = logsParams.data.reduce((sum, log) => sum + (log.distance_meters || 0), 0);
                    setTotalMeters(total);
                }

                if (goals) setUserGoals(goals);
                if (historyData.data) setStatsHistory(historyData.data);

                // Initial Workouts Fetch
                await fetchRecentWorkoutsReal(0);

                // C2 Profile (If connected)
                if (localStorage.getItem('concept2_token')) {
                    getProfile().then(setC2Profile).catch(() => { });
                }

            } catch (err) {
                console.error("Dashboard Load Error", err);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [user, isGuest]);

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
        try {
            const data = await workoutService.getRecentWorkouts(10, page);
            setRecentWorkouts(data);
        } finally {
            setWorkoutsLoading(false);
        }
    }

    return {
        statsHistory,
        recentWorkouts,
        userGoals,
        c2Profile,
        totalMeters,
        loading,
        workoutsLoading,
        fetchRecentWorkouts
    };
};
