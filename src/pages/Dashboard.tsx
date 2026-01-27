import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProfile } from '../api/concept2';
import { RecentWorkouts } from '../components/RecentWorkouts';
import { GoalProgressWidget } from '../components/analytics/GoalProgressWidget';
import { TrainingSuggestionsWidget } from '../components/analytics/TrainingSuggestionsWidget';
import { workoutService } from '../services/workoutService';
import { getUserGoals, type UserGoal } from '../services/supabase';
import { Waves, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../services/supabase';
import { WeekAtAGlanceWidget } from '../components/analytics/WeekAtAGlanceWidget';
import { splitToWatts } from '../utils/zones';

export const Dashboard: React.FC = () => {
    const { user, profile: userProfile, logout } = useAuth();
    const [c2Profile, setC2Profile] = useState<any>(null);
    const [totalMeters, setTotalMeters] = useState(0);
    const [loading, setLoading] = useState(true);
    const [c2Connected, setC2Connected] = useState(!!localStorage.getItem('concept2_token'));

    // Hoisted Data State
    const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
    const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
    const [statsHistory, setStatsHistory] = useState<any[]>([]); // For WeekAtAGlance (~30 days)

    // Pagination State
    const [page, setPage] = useState(0);
    const [workoutsLoading, setWorkoutsLoading] = useState(true);
    const LIMIT = 10;

    useEffect(() => {
        // Parallel Data Loading
        async function loadDashboardData() {
            setLoading(true);

            // Guard: If logging out (user is null), stop.
            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Fetch Local DB Data (Fast, Non-Blocking)
            if (user) {
                // Meters & Goals
                Promise.all([
                    supabase.from('workout_logs').select('distance_meters').eq('user_id', user.id),
                    getUserGoals(user.id),
                    // Fetch last 30 days for Week Glance (Lightweight)
                    supabase.from('workout_logs')
                        .select('id, completed_at, distance_meters, duration_seconds, duration_minutes, watts, avg_split_500m')
                        .eq('user_id', user.id)
                        .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                ]).then(([logsParams, goals, historyData]) => {
                    // Meters
                    if (!logsParams.error && logsParams.data) {
                        const total = logsParams.data.reduce((sum, log) => sum + (log.distance_meters || 0), 0);
                        setTotalMeters(total);
                    }
                    // Goals
                    if (goals) setUserGoals(goals);
                    // History
                    if (historyData.data) setStatsHistory(historyData.data);
                }).catch(e => console.error("DB Load Error", e));
            }

            // 2. Fetch Workouts (Pagination Aware)
            fetchWorkouts(0);

            // 3. Fetch C2 Profile (Slow, External)
            if (c2Connected) {
                getProfile().then(data => {
                    setC2Profile(data);
                }).catch((error: any) => {
                    if (error.response?.status === 401) {
                        setC2Connected(false);
                        localStorage.removeItem('concept2_token');
                    }
                }).finally(() => {
                    // We don't block main loading on C2 anymore, but we can unset global loading if we want Strict Mode
                    // Actually, let's just turn off main loading immediately after DB fetch kicks off
                });
            }

            setLoading(false); // Immediate render of skeleton/empty state while data pops in
        }

        loadDashboardData();
    }, [c2Connected, user]);

    const fetchWorkouts = async (pageIndex: number) => {
        setWorkoutsLoading(true);
        try {
            const data = await workoutService.getRecentWorkouts(LIMIT, pageIndex);
            setRecentWorkouts(data);
            setPage(pageIndex);
        } catch (err) {
            console.error("Failed to fetch workouts", err);
        } finally {
            setWorkoutsLoading(false);
        }
    };

    const handleConnect = () => {
        const client_id = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
        const redirect_uri = `${window.location.origin}/callback`;
        const scope = 'user:read,results:read';
        const url = `https://log.concept2.com/oauth/authorize?client_id=${client_id}&scope=${scope}&response_type=code&redirect_uri=${redirect_uri}`;
        window.location.href = url;
    };

    // Derive Baseline Watts for Zones
    // 1. PR (Best 2k)
    // 2. Goal (Target 2k)
    // 3. Default (200W ~ 2:00/500m)
    const derivedBaselineWatts = useMemo(() => {
        // Priority 1: Actual 2k PR
        if (userProfile?.personal_records?.['2k']) {
            const timeSeconds = userProfile.personal_records['2k'];
            const pace = timeSeconds / 4; // 2000m / 500m = 4 segments
            return Math.round(splitToWatts(pace));
        }

        // Priority 2: Active Goal
        const wattGoal = userGoals.find(g => g.type === 'target_2k_watts' && g.is_active);
        if (wattGoal) {
            return wattGoal.target_value;
        }

        return 200;
    }, [userProfile, userGoals]);

    // Derived Logic for New User Splash status
    // Only show if NOT connected AND NO local data (meters = 0) AND not loading
    const showConnectSplash = !loading && !c2Connected && totalMeters === 0 && recentWorkouts.length === 0;

    if (showConnectSplash) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white p-8 flex flex-col items-center justify-center">
                <div className="max-w-md text-center space-y-8">
                    <div className="flex justify-center">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500">
                            <Waves size={48} />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold">Welcome, {user?.email?.split('@')[0]}!</h1>
                    <p className="text-neutral-400">
                        To see your stats, you need to connect your Concept2 logbook account.
                    </p>

                    <button
                        onClick={handleConnect}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                    >
                        <LinkIcon size={20} />
                        Connect Concept2 Logbook
                    </button>

                    <button onClick={() => logout()} className="text-neutral-500 hover:text-white text-sm">
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <main className="space-y-8 mt-6">
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 flex flex-col justify-center">
                            <div className="text-neutral-400 text-sm mb-1">Hello,</div>
                            <div className="text-3xl font-bold text-white">{userProfile?.display_name || user?.email?.split('@')[0]}</div>
                            <div className="text-sm text-neutral-500 mt-1">C2: {c2Profile?.username || 'Not Connected'}</div>
                        </div>

                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 flex flex-col justify-center">
                            <div className="text-neutral-400 text-sm mb-1">Lifetime Meters</div>
                            <div className="text-4xl font-bold text-emerald-400">
                                {totalMeters.toLocaleString()} <span className="text-lg font-normal text-neutral-500">m</span>
                            </div>
                        </div>
                    </div>

                    {/* Week at a Glance */}
                    <div className="mb-8">
                        <WeekAtAGlanceWidget workouts={statsHistory} baselineWatts={derivedBaselineWatts} />
                    </div>

                    {/* Goals & Recommendations */}
                    {user && (
                        <>
                            <GoalProgressWidget userId={user.id} workouts={recentWorkouts} />
                            <TrainingSuggestionsWidget
                                recentWorkouts={recentWorkouts}
                                userGoals={userGoals}
                                userProfile={userProfile}
                            />
                        </>
                    )}


                    {/* Recent Workouts List (Paginated) */}
                    {/* Render even if no profile, but need user ID for legacy or just consistency */}
                    <RecentWorkouts
                        workouts={recentWorkouts}
                        currentPage={page}
                        isLoading={workoutsLoading}
                        hasMore={recentWorkouts.length === LIMIT}
                        onPageChange={fetchWorkouts}
                    />
                </main>
            </div>
        </div>
    );
};
