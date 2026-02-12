import React, { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { RecentWorkouts } from '../components/RecentWorkouts';
import { GoalProgressWidget } from '../components/analytics/GoalProgressWidget';
import { TrainingSuggestionsWidget } from '../components/analytics/TrainingSuggestionsWidget';
import { Waves, Link as LinkIcon, AlertCircle, RefreshCw } from 'lucide-react';
import { WeekAtAGlanceWidget } from '../components/analytics/WeekAtAGlanceWidget';
import { splitToWatts } from '../utils/zones';
import { useDashboardData } from '../hooks/useDashboardData';
import { SectionError } from '../components/SectionError';

const DashboardSkeleton: React.FC = () => (
    <div className="min-h-screen bg-neutral-900 text-white p-8">
        <div className="max-w-6xl mx-auto space-y-8 mt-6 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 space-y-3">
                    <div className="h-3 w-20 bg-neutral-700 rounded"></div>
                    <div className="h-8 w-48 bg-neutral-700 rounded"></div>
                    <div className="h-3 w-32 bg-neutral-800 rounded"></div>
                </div>
                <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 space-y-3">
                    <div className="h-3 w-24 bg-neutral-700 rounded"></div>
                    <div className="h-10 w-40 bg-neutral-700 rounded"></div>
                </div>
            </div>
            <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 h-56"></div>
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 space-y-4">
                <div className="h-5 w-40 bg-neutral-800 rounded"></div>
                <div className="h-32 bg-neutral-800 rounded"></div>
            </div>
        </div>
    </div>
);

export const Dashboard: React.FC = () => {
    const { user, profile: userProfile, logout, isGuest } = useAuth();
    const {
        statsHistory,
        recentWorkouts,
        userGoals,
        c2Profile,
        totalMeters,
        loading,
        workoutsLoading,
        errors,
        hasErrors,
        retry,
        fetchRecentWorkouts
    } = useDashboardData();

    // Derived state for C2 connection splash
    // Only show if NOT connected AND NO local data (meters = 0) AND not loading AND NOT Guest
    const c2Connected = !!localStorage.getItem('concept2_token');
    const showConnectSplash = !loading && !c2Connected && totalMeters === 0 && recentWorkouts.length === 0 && !isGuest;

    // Pagination Wrapper
    const [page, setPage] = useState(0);
    const LIMIT = 10; // Must match hook internal limit if exposed, or just rely on hook

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchRecentWorkouts(newPage);
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

    if (loading) {
        return <DashboardSkeleton />;
    }

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
                    {/* Disconnected Alert (Partial State) */}
                    {!c2Connected && !showConnectSplash && !isGuest && (
                        <div className="bg-red-900/10 border border-red-900/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-red-200">
                                <AlertCircle size={24} className="text-red-500 shrink-0" />
                                <div>
                                    <h3 className="font-semibold">Concept2 Connection Lost</h3>
                                    <p className="text-sm text-red-200/70">Reconnect to sync new workouts.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleConnect}
                                className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors whitespace-nowrap"
                            >
                                Reconnect
                            </button>
                        </div>
                    )}

                    {hasErrors && (
                        <div className="bg-red-900/10 border border-red-900/30 rounded-2xl p-4 flex items-center gap-3 text-red-200">
                            <AlertCircle size={20} className="text-red-500 shrink-0" />
                            <span className="text-sm flex-1">Some sections couldn't load. Check below for details.</span>
                            <button
                                onClick={retry}
                                className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <RefreshCw size={12} />
                                Retry All
                            </button>
                        </div>
                    )}

                    {/* Top Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 flex flex-col justify-center">
                            <div className="text-neutral-400 text-sm mb-1">Hello,</div>
                            <div className="text-3xl font-bold text-white">{userProfile?.display_name || user?.email?.split('@')[0]}</div>
                            <div className="text-sm text-neutral-500 mt-1">C2: {c2Profile?.username || 'Not Connected'}</div>
                        </div>

                        <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50 flex flex-col justify-center">
                            <div className="text-neutral-400 text-sm mb-1">Lifetime Meters</div>
                            {errors.meters ? (
                                <SectionError message={errors.meters} onRetry={retry} compact />
                            ) : (
                                <div className="text-4xl font-bold text-emerald-400">
                                    {totalMeters.toLocaleString()} <span className="text-lg font-normal text-neutral-500">m</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Week at a Glance */}
                    <div className="mb-8">
                        {errors.history ? (
                            <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
                                <div className="text-neutral-400 text-sm mb-3">Week at a Glance</div>
                                <SectionError message={errors.history} onRetry={retry} />
                            </div>
                        ) : (
                            <WeekAtAGlanceWidget workouts={statsHistory} baselineWatts={derivedBaselineWatts} />
                        )}
                    </div>

                    {user && (
                        <>
                            {errors.goals ? (
                                <div className="bg-neutral-800/50 p-6 rounded-2xl border border-neutral-700/50">
                                    <div className="text-neutral-400 text-sm mb-3">Goal Progress</div>
                                    <SectionError message={errors.goals} onRetry={retry} />
                                </div>
                            ) : (
                                <GoalProgressWidget
                                    userId={user.id}
                                    workouts={recentWorkouts}
                                    initialGoals={userGoals}
                                    initialPRs={isGuest ? [
                                        { label: '2k', pace: 105, date: '', distance: 2000, workoutId: 'mock1', time: 420, shortLabel: '2k', source: 'distance', watts: 302 },
                                        { label: '5k', pace: 114, date: '', distance: 5000, workoutId: 'mock2', time: 1140, shortLabel: '5k', source: 'distance', watts: 237 }
                                    ] : undefined}
                                />
                            )}
                            {/* Check preference, default to true */}
                            {userProfile?.preferences?.show_recommended_workouts !== false && (
                                <TrainingSuggestionsWidget
                                    recentWorkouts={recentWorkouts}
                                    userGoals={userGoals}
                                    userProfile={userProfile}
                                />
                            )}
                        </>
                    )}


                    {/* Recent Workouts List (Paginated) */}
                    {errors.workouts ? (
                        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6">
                            <div className="text-neutral-400 text-sm mb-3">Recent Workouts</div>
                            <SectionError message={errors.workouts} onRetry={() => fetchRecentWorkouts(page)} />
                        </div>
                    ) : (
                        <RecentWorkouts
                            workouts={recentWorkouts}
                            currentPage={page}
                            isLoading={workoutsLoading}
                            hasMore={recentWorkouts.length === LIMIT}
                            onPageChange={handlePageChange}
                        />
                    )}
                </main>
            </div>
        </div>
    );
};
