import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase, getUserGoals } from '../services/supabase';
import type { UserGoal } from '../services/supabase';
import { BaselineInput } from '../components/analytics/BaselineInput';
import { ZonePaceTrendChart } from '../components/analytics/ZonePaceTrendChart';
import { PRList } from '../components/analytics/PRList';
import { classifyWorkout, ZONES, aggregateBucketsByZone, calculateZoneDistribution } from '../utils/zones';
import type { TrainingZone } from '../utils/zones';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, Line } from 'recharts';
import { Activity, Ruler, Calendar, TrendingUp, TrendingDown, Minus, CalendarCheck } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { WeeklyReport } from '../components/analytics/WeeklyReport';
import { SteadyStateAnalysis } from '../components/analytics/SteadyStateAnalysis';
import { PowerProfileTab } from '../components/analytics/PowerProfileTab';

import { useAuth } from '../hooks/useAuth';
import { getUserBaseline2kWatts } from '../utils/paceCalculator';
import { workoutService } from '../services/workoutService';
import { DEMO_WORKOUTS, GUEST_USER_GOALS } from '../data/demoData';
import { getLinearRegressionStats } from '../utils/math';
import { ROWING_12_WEEK_TEMPLATE } from '../data/rowingTrainingBlockTemplate';
import { summarizeWeekProgress } from '../utils/trainingBlockCalculations';
import {
    formatTrainingBlockWeekRange,
    getNearestTrainingBlockDay,
    getTrainingBlockWeekDaysForDate,
    readTrainingBlockActive,
} from '../utils/trainingBlockStatus';
import type { TrainingBlockActualLogEvent } from '../types/trainingBlock.types';

import { GoalProgressWidget } from '../components/analytics/GoalProgressWidget';
import { SplitVarianceChart } from '../components/analytics/SplitVarianceChart';
import { WkgProgressChart } from '../components/analytics/WkgProgressChart';

type TimeRangePreset = 'thisMonth' | 'lastMonth' | 'ytd' | '3m' | '6m' | '1y' | 'all' | 'custom';

const REST_COLOR = '#737373';

const getWorkoutElapsedSeconds = (workout: any) => workout.duration_seconds || (workout.duration_minutes ? workout.duration_minutes * 60 : 0);

const getEffectiveZoneDistribution = (workout: any, baselineWatts: number): Record<TrainingZone, number> | null => {
    if (workout.zone_distribution && Object.keys(workout.zone_distribution).length > 0) {
        return workout.zone_distribution as Record<TrainingZone, number>;
    }

    if (workout.raw_data && baselineWatts > 0) {
        const computed = calculateZoneDistribution(workout.raw_data, baselineWatts);
        const total = Object.values(computed).reduce((sum, seconds) => sum + seconds, 0);
        if (total > 0) {
            return computed;
        }
    }

    return null;
};

const getWorkoutWorkSeconds = (workout: any, baselineWatts: number) => {
    const distribution = getEffectiveZoneDistribution(workout, baselineWatts);
    if (distribution) {
        return (Object.values(distribution) as number[]).reduce((sum, seconds) => sum + seconds, 0);
    }

    return getWorkoutElapsedSeconds(workout);
};

const AnalyticsSkeleton: React.FC = () => (
    <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans pb-24" aria-busy="true" role="status">
        <span className="sr-only">Loading analytics…</span>
        <div className="max-w-6xl mx-auto space-y-8 animate-pulse">
            <div className="flex space-x-6 border-b border-neutral-800">
                <div className="h-6 w-24 bg-neutral-800 rounded"></div>
                <div className="h-6 w-40 bg-neutral-800 rounded"></div>
                <div className="h-6 w-32 bg-neutral-800 rounded"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <div className="h-4 w-24 bg-neutral-800 rounded"></div>
                    <div className="h-8 w-32 bg-neutral-800 rounded"></div>
                    <div className="h-3 w-20 bg-neutral-800 rounded"></div>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <div className="h-4 w-28 bg-neutral-800 rounded"></div>
                    <div className="h-10 w-40 bg-neutral-800 rounded"></div>
                    <div className="h-3 w-24 bg-neutral-800 rounded"></div>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <div className="h-4 w-32 bg-neutral-800 rounded"></div>
                    <div className="h-8 w-24 bg-neutral-800 rounded"></div>
                    <div className="h-3 w-20 bg-neutral-800 rounded"></div>
                </div>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl h-80"></div>
        </div>
    </div>
);

export const Analytics: React.FC = () => {
    const { profile, loading: authLoading, isGuest } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'steadystate' | 'powerprofile'>('overview');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [goals, setGoals] = useState<UserGoal[]>([]); // Added state for goals
    const [baselineWatts, setBaselineWatts] = useState(0);
    const [timeRange, setTimeRange] = useState<TimeRangePreset>('6m');
    const [zoneFilter, setZoneFilter] = useState<string>('all');
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

    const fetchData = async () => {
        setLoading(true);

        if (isGuest) {
            setUserId('guest_user_123');
            setGoals(GUEST_USER_GOALS);
            setBaselineWatts(202);
            setWorkouts(DEMO_WORKOUTS);
            setLoading(false);
            return;
        }

        if (!profile?.user_id) return;
        setUserId(profile.user_id);

        // Fetch Active Goals
        const activeGoals = await getUserGoals(profile.user_id);
        const userGoals = activeGoals ? activeGoals.filter(g => g.is_active) : [];
        setGoals(userGoals);

        // 1. Determine Baseline Watts
        const bWatts = await getUserBaseline2kWatts(profile.user_id, supabase);
        setBaselineWatts(bWatts);

        // 2. Get Workouts (ALL TIME)
        const { data: logs } = await supabase
            .from('workout_logs')
            .select('id, completed_at, training_zone, distance_meters, rest_distance_meters, duration_minutes, duration_seconds, watts, workout_type, zone_distribution, workout_name, avg_split_500m, raw_data')
            .order('completed_at', { ascending: true }); // Oldest first for charts

        // Extract intervals from raw_data for SplitVarianceChart
        const logsWithIntervals = (logs || []).map((log: any) => {
            const rawIntervals = log.raw_data?.workout?.intervals;
            if (Array.isArray(rawIntervals)) {
                log.intervals = rawIntervals
                    .filter((i: any) => i.time > 0 && i.distance > 0)
                    .map((i: any) => ({
                        split_seconds: 500 * (i.time / 10) / i.distance,
                        distance_meters: i.distance,
                    }));
            }
            return log;
        });

        setWorkouts(logsWithIntervals);
        setLoading(false);
    };

    useEffect(() => {
        if (!authLoading && (profile || isGuest)) {
            fetchData();
        }
    }, [authLoading, profile, isGuest]);

    // Filter Logic
    const filteredWorkouts = useMemo(() => {
        let result = workouts;

        // 1. Time Range Filter
        if (timeRange !== 'all') {
            const now = new Date();
            let startDate: Date;
            let endDate: Date = now;

            if (timeRange === 'custom' && customStartDate && customEndDate) {
                startDate = customStartDate;
                endDate = customEndDate;
            } else if (timeRange === 'thisMonth') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (timeRange === 'lastMonth') {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
            } else if (timeRange === 'ytd') {
                startDate = new Date(now.getFullYear(), 0, 1);
            } else if (timeRange === '3m') {
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 3);
            } else if (timeRange === '6m') {
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 6);
            } else if (timeRange === '1y') {
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
            } else {
                // Should not happen if 'all' is handled first, but fallback
                startDate = new Date(0);
            }

            result = result.filter(w => {
                const d = new Date(w.completed_at);
                return d >= startDate && d <= endDate;
            });
        }

        // 2. Zone Filter
        if (zoneFilter !== 'all') {
            result = result.filter(w => {
                // Determine zone logic (try to reuse component logic or simplify)
                let watts = w.watts;
                if (!watts && w.avg_split_500m) {
                    watts = 2.8 / Math.pow(w.avg_split_500m / 500, 3);
                }
                // Determine duration for fallback
                const duration = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);
                if (!watts && w.distance_meters && duration > 0) {
                    const split = 500 * (duration / w.distance_meters);
                    watts = 2.8 / Math.pow(split / 500, 3);
                }

                if (!watts) return false;

                const zId = classifyWorkout(watts, baselineWatts);
                return zId === zoneFilter;
            });
        }

        return result;
    }, [workouts, timeRange, customStartDate, customEndDate, zoneFilter, baselineWatts]);


    // --- Calculations ---
    // Fetch aggregated power buckets for filtered workouts
    const [aggregatedBuckets, setAggregatedBuckets] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchBuckets = async () => {
            if (filteredWorkouts.length === 0) {
                setAggregatedBuckets({});
                return;
            }
            const workoutIds = filteredWorkouts.map(w => w.id);
            const buckets = await workoutService.getAggregatedPowerBuckets(workoutIds);
            setAggregatedBuckets(buckets);
        };
        fetchBuckets();
    }, [filteredWorkouts]);

    const dataByZone = useMemo(() => {
        if (!baselineWatts || Object.keys(aggregatedBuckets).length === 0) return [];

        // Use power buckets to calculate zone distribution
        const zoneData = aggregateBucketsByZone(aggregatedBuckets, baselineWatts);

        // Convert to chart format (minutes instead of seconds)
        return zoneData.map(z => ({
            name: z.zone,
            value: Math.round(z.seconds / 60), // seconds -> minutes
            color: z.color
        }));
    }, [aggregatedBuckets, baselineWatts]);

    const [volumeMetric, setVolumeMetric] = useState<'hours' | 'distance'>('hours');

    // Calculate Trend Line for Weekly Volume
    const weeklyVolume = useMemo(() => {
        // Aggregate by Week (ISO Week)
        const weeks: Record<string, any> = {};

        filteredWorkouts.forEach(w => {
            const date = new Date(w.completed_at);
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            const key = monday.toISOString().split('T')[0];

            if (!weeks[key]) {
                weeks[key] = {
                    date: key,
                    UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0, REST: 0, total: 0, workTotal: 0,
                    dist_UT2: 0, dist_UT1: 0, dist_AT: 0, dist_TR: 0, dist_AN: 0, dist_REST: 0, totalDist: 0, workTotalDist: 0,
                };
            }

            const elapsedSeconds = getWorkoutElapsedSeconds(w);
            const workDistance = w.distance_meters || 0;
            const restDistance = w.rest_distance_meters || 0;
            let usedDistribution = false;

            const effectiveDistribution = getEffectiveZoneDistribution(w, baselineWatts);
            if (effectiveDistribution) {
                const dist = effectiveDistribution;
                const totalWorkSeconds = (Object.values(dist) as number[]).reduce((a, b) => a + b, 0);

                if (totalWorkSeconds > 10) {
                    (Object.keys(dist) as TrainingZone[]).forEach(z => {
                        const ratio = dist[z] / totalWorkSeconds;

                        const hours = dist[z] / 3600;
                        weeks[key][z] += hours;
                        weeks[key].workTotal += hours;

                        const distance = workDistance * ratio;
                        weeks[key][`dist_${z}`] += distance;
                        weeks[key].workTotalDist += distance;
                    });

                    const restSeconds = Math.max(elapsedSeconds - totalWorkSeconds, 0);
                    weeks[key].REST += restSeconds / 3600;
                    weeks[key].dist_REST += restDistance;
                    weeks[key].total += (elapsedSeconds > 0 ? elapsedSeconds : totalWorkSeconds) / 3600;
                    weeks[key].totalDist += workDistance + restDistance;
                    usedDistribution = true;
                }
            }

            if (!usedDistribution) {
                let watts = w.watts;

                if (!watts && w.avg_split_500m) {
                    watts = 2.8 / Math.pow(w.avg_split_500m / 500, 3);
                }

                if (!watts && w.distance_meters && elapsedSeconds > 0) {
                    const split = 500 * (elapsedSeconds / w.distance_meters);
                    watts = 2.8 / Math.pow(split / 500, 3);
                }
                const zone = classifyWorkout(watts || 0, baselineWatts);

                const hours = elapsedSeconds / 3600;
                weeks[key][zone] += hours;
                weeks[key].workTotal += hours;
                weeks[key].total += hours;

                weeks[key][`dist_${zone}`] += workDistance;
                weeks[key].workTotalDist += workDistance;
                weeks[key].dist_REST += restDistance;
                weeks[key].totalDist += workDistance + restDistance;
            }
        });

        // Convert to array and sort
        const chartData = Object.values(weeks).sort((a: any, b: any) => a.date.localeCompare(b.date));

        // --- Calculate Trend Line (Merged) ---
        if (chartData.length >= 2) {
            const points = chartData.map((w: any) => ({
                x: new Date(w.date).getTime(),
                y: volumeMetric === 'hours' ? w.total : w.totalDist
            }));

            const stats = getLinearRegressionStats(points);
            if (stats) {
                chartData.forEach((w: any) => {
                    const x = new Date(w.date).getTime();
                    w.trendValue = stats.slope * x + stats.intercept;
                });
            }
        }

        return chartData;
    }, [filteredWorkouts, baselineWatts, volumeMetric]);

    // Calculate Trend Metrics for Weekly Volume
    const volumeTrendMetrics = useMemo(() => {
        if (weeklyVolume.length < 2) return null;

        const points = weeklyVolume.map(w => ({
            x: new Date(w.date).getTime(),
            y: volumeMetric === 'hours' ? w.total : w.totalDist
        }));

        const stats = getLinearRegressionStats(points);
        if (!stats) return null;

        // Convert slope (units/ms) to units/week
        // slope is units/ms.
        // week = 1000 * 60 * 60 * 24 * 7 = 604800000 ms
        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        const valPerWeek = stats.slope * msPerWeek;

        const isImproving = valPerWeek > 0; // More volume is generally "improving" or increasing

        return {
            changePerWeek: valPerWeek,
            isImproving
        };
    }, [weeklyVolume, volumeMetric]);

    const totalDistance = filteredWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0) + (w.rest_distance_meters || 0), 0);
    const totalTimeSeconds = filteredWorkouts.reduce((sum, w) => sum + getWorkoutElapsedSeconds(w), 0);
    const totalWorkSeconds = filteredWorkouts.reduce((sum, w) => sum + getWorkoutWorkSeconds(w, baselineWatts), 0);

    const [isTrainingBlockActive] = useState(() => readTrainingBlockActive(true));
    const trainingBlockNow = useMemo(() => new Date(), []);
    const trainingBlockDay = useMemo(() => getNearestTrainingBlockDay(ROWING_12_WEEK_TEMPLATE, trainingBlockNow), [trainingBlockNow]);
    const trainingBlockWeekDays = useMemo(() => getTrainingBlockWeekDaysForDate(ROWING_12_WEEK_TEMPLATE, trainingBlockNow), [trainingBlockNow]);
    const trainingBlockWeekSummary = useMemo(() => {
        if (!trainingBlockDay) return null;
        const events: TrainingBlockActualLogEvent[] = workouts.map((workout) => ({
            workout_id: String(workout.id),
            date: workout.completed_at,
            source: workout.source === 'manual' ? 'manual' : 'concept2',
            distance_meters: workout.distance_meters ?? null,
            duration_seconds: workout.duration_seconds ?? (workout.duration_minutes ? Math.round(workout.duration_minutes * 60) : null),
            workout_name: workout.workout_name ?? workout.canonical_name ?? null,
            canonical_name: workout.canonical_name ?? null,
            manual_rwn: workout.manual_rwn ?? null,
            workout_type: workout.workout_type ?? null,
        }));
        return summarizeWeekProgress(ROWING_12_WEEK_TEMPLATE, events)
            .find((week) => week.week_number === trainingBlockDay.week_number) ?? null;
    }, [workouts, trainingBlockDay]);
    const trainingBlockCoverage = trainingBlockWeekSummary
        ? Math.min(100, Math.round(trainingBlockWeekSummary.target_coverage_ratio * 100))
        : 0;

    if (loading) {
        return <AnalyticsSkeleton />;
    }

    if (workouts.length === 0) {
        return (
            <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans pb-24">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400">
                            <Activity size={32} />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold">No workouts yet</h2>
                    <p className="text-neutral-400">
                        Sync your Concept2 logbook to start tracking analytics and personal records.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 font-sans pb-24">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Tabs */}
                <div className="flex space-x-6 border-b border-neutral-800">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 px-1 text-lg font-medium transition-colors ${activeTab === 'overview' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('records')}
                        className={`pb-3 px-1 text-lg font-medium transition-colors ${activeTab === 'records' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                        Records & Benchmarks
                    </button>
                    <button
                        onClick={() => setActiveTab('steadystate')}
                        className={`pb-3 px-1 text-lg font-medium transition-colors ${activeTab === 'steadystate' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                        Steady State
                    </button>
                    <button
                        onClick={() => setActiveTab('powerprofile')}
                        className={`pb-3 px-1 text-lg font-medium transition-colors ${activeTab === 'powerprofile' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-neutral-400 hover:text-neutral-200'}`}
                    >
                        Power Profile
                    </button>
                </div>

                {activeTab === 'overview' && (
                    <>
                        {/* Suggestions Widget Removed as per user request */}

                        {/* Goals Widget */}
                        {userId && (
                            <GoalProgressWidget
                                userId={userId}
                                workouts={workouts}
                                initialGoals={isGuest ? goals : undefined}
                                initialPRs={isGuest ? [
                                    { label: '2k', pace: 105, date: '', distance: 2000, workoutId: 'mock1', time: 420, shortLabel: '2k', source: 'distance', watts: 302 },
                                    { label: '5k', pace: 114, date: '', distance: 5000, workoutId: 'mock2', time: 1140, shortLabel: '5k', source: 'distance', watts: 237 }
                                ] : undefined}
                            />
                        )}

                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                                        <CalendarCheck size={18} className={isTrainingBlockActive ? 'text-emerald-400' : 'text-neutral-500'} />
                                        <span>Training block context</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${isTrainingBlockActive ? 'border-emerald-500/30 text-emerald-300 bg-emerald-950/20' : 'border-neutral-700 text-neutral-400 bg-neutral-950/60'}`}>
                                            {isTrainingBlockActive ? 'Active' : 'Preview'}
                                        </span>
                                    </div>
                                    {trainingBlockDay ? (
                                        <>
                                            <p className="text-lg font-semibold text-white">
                                                Week {trainingBlockDay.week_number} · {formatTrainingBlockWeekRange(trainingBlockWeekDays)}
                                            </p>
                                            <p className="text-sm text-neutral-400 mt-1">
                                                {trainingBlockWeekSummary
                                                    ? `${trainingBlockCoverage}% week coverage · ${trainingBlockWeekSummary.key_session_credits.earned}/${trainingBlockWeekSummary.key_session_credits.possible} key sessions`
                                                    : 'No current week summary yet'}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-neutral-400">No training block selected.</p>
                                    )}
                                </div>
                                <Link
                                    to="/training-block"
                                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:border-neutral-500 hover:text-white transition-colors"
                                >
                                    Open block
                                </Link>
                            </div>
                        </div>

                        {/* Global Filter Bar & Stats */}
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-neutral-800 pb-6 mt-6">

                            {/* Left Side: Filters */}
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-wrap">
                                {/* Zone Filters */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider hidden md:block">Zone</span>
                                    <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex flex-wrap gap-1">
                                        <button
                                            onClick={() => setZoneFilter('all')}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${zoneFilter === 'all'
                                                ? 'bg-neutral-800 text-white shadow-sm'
                                                : 'text-neutral-500 hover:text-neutral-300'
                                                }`}
                                        >
                                            All
                                        </button>
                                        {ZONES.map(z => (
                                            <button
                                                key={z.id}
                                                onClick={() => setZoneFilter(z.id)}
                                                style={{
                                                    color: zoneFilter === z.id ? z.color : undefined,
                                                    backgroundColor: zoneFilter === z.id ? `${z.color}15` : undefined
                                                }}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${zoneFilter === z.id
                                                    ? 'shadow-sm font-bold'
                                                    : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                            >
                                                {z.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="hidden md:block w-px h-8 bg-neutral-800 mx-2"></div>

                                {/* Date Filters */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider hidden md:block">Period</span>
                                    <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex flex-wrap gap-1">
                                        {([
                                            { key: 'thisMonth', label: 'Month' }, // Shortened labels for cleaner look
                                            { key: 'lastMonth', label: 'Last Mo' },
                                            { key: '3m', label: '3M' },
                                            { key: '6m', label: '6M' },
                                            { key: 'ytd', label: 'YTD' },
                                            { key: '1y', label: '1Y' },
                                            { key: 'all', label: 'All' },
                                        ] as { key: TimeRangePreset; label: string }[]).map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => setTimeRange(key)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === key
                                                    ? 'bg-neutral-800 text-white shadow-sm'
                                                    : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Date Inputs (Condensed) */}
                                    <div className="flex items-center gap-2 ml-2">
                                        <DatePicker
                                            selected={customStartDate}
                                            onChange={(date: Date | null) => {
                                                setCustomStartDate(date);
                                                if (date) setTimeRange('custom');
                                            }}
                                            selectsStart
                                            startDate={customStartDate}
                                            endDate={customEndDate}
                                            placeholderText="Start"
                                            className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-white w-20 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                            dateFormat="MMM d"
                                        />
                                        <span className="text-neutral-700">-</span>
                                        <DatePicker
                                            selected={customEndDate}
                                            onChange={(date: Date | null) => {
                                                setCustomEndDate(date);
                                                if (date) setTimeRange('custom');
                                            }}
                                            selectsEnd
                                            startDate={customStartDate}
                                            endDate={customEndDate}
                                            minDate={customStartDate ?? undefined}
                                            placeholderText="End"
                                            className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1.5 text-xs text-white w-20 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                            dateFormat="MMM d"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Key Metrics */}
                            <div className="flex gap-4 items-center self-end xl:self-auto">
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-end">
                                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Total Dist</div>
                                        <div className="text-xl font-bold text-white leading-none">{(totalDistance / 1000).toLocaleString()}<span className="text-sm font-normal text-neutral-600 ml-1">km</span></div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Total Time</div>
                                        <div className="text-xl font-bold text-white leading-none">{(totalTimeSeconds / 3600).toFixed(1)}<span className="text-sm font-normal text-neutral-600 ml-1">h</span></div>
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-neutral-800 mx-1"></div>
                                {/* Report Button */}
                                <button
                                    onClick={() => setShowReport(true)}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white p-2 rounded-lg border border-neutral-700 transition-colors flex items-center justify-center gap-2"
                                    title="Export Report"
                                >
                                    <Calendar size={18} />
                                    <span className="text-xs font-bold uppercase hidden sm:inline">Report</span>
                                </button>
                            </div>
                        </div>

                        {/* Report Modal */}
                        {showReport && (
                            <WeeklyReport
                                workouts={filteredWorkouts}
                                startDate={
                                    // Determine start date based on filteredWorkouts or current filter logic
                                    // Basic heuristic: Earliest workout in filtered list or today - range
                                    filteredWorkouts.length > 0
                                        ? new Date(filteredWorkouts[0].completed_at)
                                        : new Date()
                                }
                                endDate={
                                    filteredWorkouts.length > 0
                                        ? new Date(filteredWorkouts[filteredWorkouts.length - 1].completed_at)
                                        : new Date()
                                }
                                onClose={() => setShowReport(false)}
                            />
                        )}
                    </>
                )}
            </div>

            {activeTab === 'overview' && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column: Settings & Distribution */}
                        <div className="space-y-8">
                            <BaselineInput onUpdate={fetchData} />

                            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                                    <Activity size={18} className="text-emerald-400" />
                                    Time in Zone (Work)
                                </h3>
                                <div className="h-[250px] w-full relative" role="img" aria-label="Time in zone distribution chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={dataByZone}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {dataByZone.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                                                itemStyle={{ color: '#fff' }}
                                                formatter={(val: number | string | Array<any> | undefined) => {
                                                    const totalMins = dataByZone.reduce((sum, z) => sum + z.value, 0);
                                                    const pct = totalMins > 0 ? ((Number(val) / totalMins) * 100).toFixed(1) : '0';
                                                    return [`${pct}% (${val} mins)`, 'Time'];
                                                }}
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    {/* Center Label */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <span className="text-3xl font-bold text-white">
                                                {totalWorkSeconds > 0 && dataByZone.length > 0 ?
                                                    Math.round(((dataByZone[0].value * 60) / totalWorkSeconds) * 100)
                                                    : 0}%
                                            </span>
                                            <div className="text-xs text-neutral-500 uppercase">of work time is UT2</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Volume Trends */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-[500px] flex flex-col">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="text-xl font-semibold flex items-center gap-2">
                                            <Ruler size={20} className="text-blue-400" />
                                            Weekly Volume
                                        </h3>
                                        <p className="text-sm text-neutral-500 mt-1">Elapsed session volume, with recoveries shown separately when available.</p>
                                        <div className="flex gap-2 mt-2">
                                            {/* Metric Toggle */}
                                            <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex">
                                                {(['hours', 'distance'] as const).map(m => (
                                                    <button
                                                        key={m}
                                                        onClick={() => setVolumeMetric(m)}
                                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${volumeMetric === m
                                                            ? 'bg-neutral-800 text-white shadow-sm'
                                                            : 'text-neutral-500 hover:text-neutral-300'
                                                            }`}
                                                    >
                                                        {m === 'hours' ? 'Time (Hrs)' : 'Dist (km)'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trend Box */}
                                    {volumeTrendMetrics && (
                                        <div className="bg-neutral-800/50 rounded-lg px-4 py-2 border border-neutral-700/50 flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${Math.abs(volumeTrendMetrics.changePerWeek) < 0.01 ? 'bg-neutral-700 text-neutral-400' : volumeTrendMetrics.isImproving ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                {Math.abs(volumeTrendMetrics.changePerWeek) < 0.01 ? <Minus size={20} /> :
                                                    volumeTrendMetrics.isImproving ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                            </div>
                                            <div>
                                                <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Trend</div>
                                                <div className={`text-base font-mono font-bold ${Math.abs(volumeTrendMetrics.changePerWeek) < 0.01 ? 'text-neutral-300' : volumeTrendMetrics.isImproving ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {Math.abs(volumeTrendMetrics.changePerWeek) < 0.01
                                                        ? 'Flat'
                                                        : volumeMetric === 'hours'
                                                            ? `${Math.abs(volumeTrendMetrics.changePerWeek).toFixed(2)}h / wk`
                                                            : `${(Math.abs(volumeTrendMetrics.changePerWeek) / 1000).toFixed(1)}k / wk`
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div role="img" aria-label="Weekly training volume chart" className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weeklyVolume} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                            stroke="#525252"
                                            fontSize={13}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#525252"
                                            fontSize={13}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => volumeMetric === 'hours' ? `${val.toFixed(1)}h` : `${(val / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#262626', opacity: 0.5 }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    const stackEntries = payload
                                                        .filter((entry: any) => entry.dataKey !== 'trendValue' && Number(entry.value) > 0)
                                                        .slice()
                                                        .reverse();
                                                    const total = stackEntries.reduce((sum: number, entry: any) => sum + Number(entry.value), 0);

                                                    const labelVal = label ?? 0;
                                                    const startDate = new Date(labelVal);
                                                    const endDate = new Date(startDate);
                                                    endDate.setDate(startDate.getDate() + 6);

                                                    const dateRange = `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                                                    const workTotal = volumeMetric === 'hours' ? data.workTotal : data.workTotalDist;

                                                    return (
                                                        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg shadow-xl text-xs space-y-2 min-w-[220px]">
                                                            <div className="border-b border-neutral-800 pb-2 mb-2">
                                                                <p className="text-neutral-400 font-medium mb-1">
                                                                    {dateRange}
                                                                </p>
                                                                <div className="flex items-center justify-between gap-6">
                                                                    <span className="text-neutral-300 font-bold">Weekly Total:</span>
                                                                    <span className="text-white font-mono font-bold text-sm">
                                                                        {volumeMetric === 'hours'
                                                                            ? `${Number(total).toFixed(1)} hrs`
                                                                            : `${(Number(total) / 1000).toFixed(1)} km`
                                                                        }
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-6 mt-1">
                                                                    <span className="text-neutral-500">Work only:</span>
                                                                    <span className="text-neutral-300 font-mono">
                                                                        {volumeMetric === 'hours'
                                                                            ? `${Number(workTotal).toFixed(1)} hrs`
                                                                            : `${(Number(workTotal) / 1000).toFixed(1)} km`
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {stackEntries.map((entry: any) => {
                                                                    const val = Number(entry.value);
                                                                    const pct = total > 0 ? ((val / total) * 100).toFixed(0) : '0';
                                                                    const unit = volumeMetric === 'hours' ? 'h' : 'k';
                                                                    const displayVal = volumeMetric === 'hours'
                                                                        ? `${val.toFixed(1)}`
                                                                        : `${(val / 1000).toFixed(1)}`;

                                                                    return (
                                                                        <div key={entry.name} className="flex items-center justify-between gap-4">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                                <span className="text-neutral-400">{entry.display ?? entry.name}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-white font-mono">{displayVal}{unit}</span>
                                                                                <span className="text-neutral-600 w-8 text-right">({pct}%)</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                        {/* Dynamically render bars based on metric */}
                                        <Bar dataKey={volumeMetric === 'hours' ? "UT2" : "dist_UT2"} name="UT2" stackId="a" fill={ZONES[0].color} radius={[0, 0, 4, 4]} />
                                        <Bar dataKey={volumeMetric === 'hours' ? "UT1" : "dist_UT1"} name="UT1" stackId="a" fill={ZONES[1].color} />
                                        <Bar dataKey={volumeMetric === 'hours' ? "AT" : "dist_AT"} name="AT" stackId="a" fill={ZONES[2].color} />
                                        <Bar dataKey={volumeMetric === 'hours' ? "TR" : "dist_TR"} name="TR" stackId="a" fill={ZONES[3].color} />
                                        <Bar dataKey={volumeMetric === 'hours' ? "AN" : "dist_AN"} name="AN" stackId="a" fill={ZONES[4].color} />
                                        <Bar dataKey={volumeMetric === 'hours' ? "REST" : "dist_REST"} name="Rest" stackId="a" fill={REST_COLOR} radius={[4, 4, 0, 0]} />

                                        {/* Trend Line */}
                                        {/* Trend Line (Merged Data) */}
                                        <Line
                                            type="linear"
                                            dataKey="trendValue"
                                            name="Trend"
                                            stroke="#ec4899" // Pink trend line
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            opacity={0.7}
                                            dot={false}
                                            activeDot={false}
                                            isAnimationActive={false}
                                            connectNulls
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Trends Section */}
                    <div className="grid grid-cols-1 gap-8 mt-8">
                        <ZonePaceTrendChart workouts={filteredWorkouts} baselineWatts={baselineWatts} />
                    </div>

                    {/* Performance Trends */}
                    <div className="mt-8">
                        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <TrendingUp size={20} className="text-emerald-400" />
                            Performance Trends
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <SplitVarianceChart workouts={filteredWorkouts} />
                            <WkgProgressChart
                                workouts={filteredWorkouts}
                                weightKg={profile?.weight_lbs ? profile.weight_lbs / 2.20462 : undefined}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* PR Section */}
            {activeTab === 'records' && userId && (
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 mt-6">
                    <PRList userId={userId} />
                </div>
            )}

            {/* Steady State Section */}
            {activeTab === 'steadystate' && (
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 mt-6">
                    <SteadyStateAnalysis baselineWatts={baselineWatts} />
                </div>
            )}

            {/* Power Profile Section */}
            {activeTab === 'powerprofile' && (
                <PowerProfileTab baselineWatts={baselineWatts} />
            )}
        </div>
    );
};
