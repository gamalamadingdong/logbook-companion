import React, { useEffect, useState, useMemo } from 'react';
import { supabase, getUserGoals } from '../services/supabase';
import type { UserGoal } from '../services/supabase';
import { BaselineInput } from '../components/analytics/BaselineInput';
import { ZonePaceTrendChart } from '../components/analytics/ZonePaceTrendChart';
import { PRList } from '../components/analytics/PRList';
import { classifyWorkout, ZONES, aggregateBucketsByZone } from '../utils/zones';
import type { TrainingZone } from '../utils/zones';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Activity, Ruler, Calendar } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { WeeklyReport } from '../components/analytics/WeeklyReport';

import { useAuth } from '../hooks/useAuth';
import { calculateWatts } from '../utils/prCalculator';
import { workoutService } from '../services/workoutService';
import { DEMO_WORKOUTS, GUEST_USER_GOALS } from '../data/demoData';

import { GoalProgressWidget } from '../components/analytics/GoalProgressWidget';
import { TrainingSuggestionsWidget } from '../components/analytics/TrainingSuggestionsWidget';

type TimeRangePreset = 'thisMonth' | 'lastMonth' | 'ytd' | '3m' | '6m' | '1y' | 'all' | 'custom';

export const Analytics: React.FC = () => {
    const { profile, loading: authLoading, isGuest } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'records'>('overview');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [goals, setGoals] = useState<UserGoal[]>([]); // Added state for goals
    const [baselineWatts, setBaselineWatts] = useState(0);
    const [timeRange, setTimeRange] = useState<TimeRangePreset>('6m');
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
        // Priority:
        // A. "Working Baseline" for 2k from Preferences (Re-fetch to get latest)
        // B. "pr_2k_watts" from user_baseline_metrics (Legacy/Auto)
        // C. Default 202 (~2:00 split)

        let bWatts = 202;

        // Re-fetch profile to get latest baseline preferences
        const { data: freshProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', profile.user_id)
            .single();

        if (freshProfile?.benchmark_preferences?.['2k']?.working_baseline) {
            // Parse "MM:SS" or "SS.s" -> Watts
            // For 2k, the baseline string is usually a time like "7:00.0"
            // We need to convert that to a 500m split, then variables.
            const timeStr = freshProfile.benchmark_preferences['2k'].working_baseline;
            const parts = timeStr.split(':');
            let totalSeconds = 0;
            if (parts.length === 2) {
                totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            } else {
                totalSeconds = parseFloat(timeStr);
            }

            if (totalSeconds > 0) {
                // Assuming 2k distance
                const pace = (totalSeconds / 2000) * 500;
                bWatts = calculateWatts(pace);
            }
        }

        if (bWatts === 202) {
            // Try fetching legacy if no preference set
            const { data: baseline } = await supabase
                .from('user_baseline_metrics')
                .select('pr_2k_watts')
                .eq('user_id', profile.user_id)
                .single();

            if (baseline?.pr_2k_watts) bWatts = baseline.pr_2k_watts;
        }

        setBaselineWatts(bWatts);

        // 2. Get Workouts (ALL TIME)
        const { data: logs } = await supabase
            .from('workout_logs')
            .select('id, completed_at, training_zone, distance_meters, duration_minutes, duration_seconds, watts, workout_type, zone_distribution, workout_name, avg_split_500m')
            .order('completed_at', { ascending: true }); // Oldest first for charts

        setWorkouts(logs || []);
        setLoading(false);
    };

    useEffect(() => {
        if (!authLoading && (profile || isGuest)) {
            fetchData();
        }
    }, [authLoading, profile, isGuest]);

    // Filter Logic
    const filteredWorkouts = useMemo(() => {
        if (timeRange === 'all') return workouts;

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
            return workouts;
        }

        return workouts.filter(w => {
            const d = new Date(w.completed_at);
            return d >= startDate && d <= endDate;
        });
    }, [workouts, timeRange, customStartDate, customEndDate]);


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

    const weeklyVolume = useMemo(() => {
        // Aggregate by Week (ISO Week)
        const weeks: Record<string, any> = {};

        filteredWorkouts.forEach(w => {
            const date = new Date(w.completed_at);
            // Simple "Week Start" Key
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(date.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            const key = monday.toISOString().split('T')[0]; // "2023-10-23"

            // Initialize if new week
            if (!weeks[key]) {
                weeks[key] = {
                    date: key,
                    // Hours
                    UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0, total: 0,
                    // Distance (Meters)
                    dist_UT2: 0, dist_UT1: 0, dist_AT: 0, dist_TR: 0, dist_AN: 0, totalDist: 0
                };
            }

            let usedDistribution = false;

            // Logic: Add TIME (Hours) and DISTANCE to the week
            if (w.zone_distribution && Object.keys(w.zone_distribution).length > 0) {
                const dist = w.zone_distribution;
                const totalDistSeconds = (Object.values(dist) as number[]).reduce((a, b) => a + b, 0);

                if (totalDistSeconds > 10) {
                    (Object.keys(dist) as TrainingZone[]).forEach(z => {
                        const ratio = dist[z] / totalDistSeconds;

                        // Hours
                        const hours = dist[z] / 3600;
                        weeks[key][z] += hours;
                        weeks[key].total += hours;

                        // Distance (allocate proportional to time for now)
                        const distance = (w.distance_meters || 0) * ratio;
                        weeks[key][`dist_${z}`] += distance;
                        weeks[key].totalDist += distance;
                    });
                    usedDistribution = true;
                }
            }

            if (!usedDistribution) {
                // Fallback: Whole workout classification
                let watts = w.watts;

                // Use Work Pace (avg_split_500m) if available
                if (!watts && w.avg_split_500m) {
                    watts = 2.8 / Math.pow(w.avg_split_500m / 500, 3);
                }

                const sec = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);

                if (!watts && w.distance_meters && sec > 0) {
                    const split = 500 * (sec / w.distance_meters);
                    watts = 2.8 / Math.pow(split / 500, 3);
                }
                const zone = classifyWorkout(watts || 0, baselineWatts);

                // Hours
                const hours = sec / 3600;
                weeks[key][zone] += hours;
                weeks[key].total += hours;

                // Distance
                const distance = w.distance_meters || 0;
                weeks[key][`dist_${zone}`] += distance;
                weeks[key].totalDist += distance;
            }
        });

        return Object.values(weeks).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [filteredWorkouts, baselineWatts]);

    const totalDistance = filteredWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
    // Total Time in Seconds for accurate display
    const totalTimeSeconds = filteredWorkouts.reduce((sum, w) => sum + (w.duration_seconds || (w.duration_minutes * 60) || 0), 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-emerald-500">
                <Loader2 className="animate-spin" size={32} />
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
                </div>

                {activeTab === 'overview' && (
                    <>
                        {/* Suggestions Widget */}
                        <div className="mb-6">
                            <TrainingSuggestionsWidget
                                recentWorkouts={workouts}
                                userGoals={goals}
                                userProfile={profile || undefined}
                            />
                        </div>

                        {/* Goals Widget */}
                        {userId && (
                            <GoalProgressWidget
                                userId={userId}
                                workouts={workouts}
                                initialGoals={isGuest ? goals : undefined}
                                initialPRs={isGuest ? [
                                    { label: '2k', pace: 105, date: '', distance: 2000, workoutId: 'mock1', time: 420, shortLabel: '2k', source: 'distance' },
                                    { label: '5k', pace: 114, date: '', distance: 5000, workoutId: 'mock2', time: 1140, shortLabel: '5k', source: 'distance' }
                                ] : undefined}
                            />
                        )}

                        {/* Header (Local Controls) */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-800 pb-6 mt-6">

                            <div>
                                <h2 className="text-2xl font-bold">Zone Distribution</h2>
                                <p className="text-neutral-500 text-sm">Training load analysis</p>
                            </div>

                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-wrap">
                                {/* Quick Filter Buttons */}
                                <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex flex-wrap gap-1">
                                    {([
                                        { key: 'thisMonth', label: 'This Month' },
                                        { key: 'lastMonth', label: 'Last Month' },
                                        { key: 'ytd', label: 'YTD' },
                                        { key: '3m', label: '3M' },
                                        { key: '6m', label: '6M' },
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

                                {/* Custom Date Range */}
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-neutral-500" />
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
                                        className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs text-white w-24 placeholder-neutral-500"
                                        dateFormat="MMM d, yy"
                                    />
                                    <span className="text-neutral-600">—</span>
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
                                        className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs text-white w-24 placeholder-neutral-500"
                                        dateFormat="MMM d, yy"
                                    />
                                </div>
                            </div>

                            {/* Key Metrics */}
                            <div className="flex gap-4">
                                <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 min-w-[120px]">
                                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">Total Distance</div>
                                    <div className="text-xl font-bold text-white">{(totalDistance / 1000).toLocaleString()} <span className="text-sm font-normal text-neutral-600">km</span></div>
                                </div>
                                <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 min-w-[120px]">
                                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold mb-1">Total Time</div>
                                    <div className="text-xl font-bold text-white">{Math.round(totalTimeSeconds / 3600)} <span className="text-sm font-normal text-neutral-600">hrs</span></div>
                                </div>
                                {/* Report Button */}
                                <button
                                    onClick={() => setShowReport(true)}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white p-4 rounded-xl border border-neutral-700 transition-colors flex flex-col items-center justify-center gap-1 min-w-[80px]"
                                    title="Export Report"
                                >
                                    <Calendar size={20} />
                                    <span className="text-[10px] font-bold uppercase">Report</span>
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
                                    Time in Zone
                                </h3>
                                <div className="h-[250px] w-full relative">
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
                                                {totalTimeSeconds > 0 && dataByZone.length > 0 ?
                                                    Math.round(((dataByZone[0].value * 60) / totalTimeSeconds) * 100)
                                                    : 0}%
                                            </span>
                                            <div className="text-xs text-neutral-500 uppercase">is UT2</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Volume Trends */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-[500px]">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Ruler size={18} className="text-blue-400" />
                                        Weekly Volume
                                    </h3>

                                    {/* Metric Toggle */}
                                    <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex">
                                        {(['hours', 'distance'] as const).map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setVolumeMetric(m)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${volumeMetric === m
                                                    ? 'bg-neutral-800 text-white shadow-sm'
                                                    : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                            >
                                                {m === 'hours' ? 'Time (Hrs)' : 'Dist (km)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weeklyVolume} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                            stroke="#525252"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#525252"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => volumeMetric === 'hours' ? `${val.toFixed(1)}h` : `${(val / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#262626', opacity: 0.5 }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    const total = volumeMetric === 'hours' ? data.total : data.totalDist;

                                                    // Calculate Week Range
                                                    const labelVal = label ?? 0; // Fallback to 0 if undefined
                                                    const startDate = new Date(labelVal);
                                                    const endDate = new Date(startDate);
                                                    endDate.setDate(startDate.getDate() + 6);

                                                    const dateRange = `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

                                                    return (
                                                        <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg shadow-xl text-xs space-y-2 min-w-[200px]">
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
                                                            </div>
                                                            <div className="space-y-1">
                                                                {payload.slice().reverse().map((entry: any) => {
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
                                        <Bar dataKey={volumeMetric === 'hours' ? "AN" : "dist_AN"} name="AN" stackId="a" fill={ZONES[4].color} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>

                    {/* Trends Section */}
                    <div className="grid grid-cols-1 gap-8 mt-8">
                        <ZonePaceTrendChart workouts={filteredWorkouts} baselineWatts={baselineWatts} />
                    </div>
                </>
            )}

            {/* PR Section */}
            {activeTab === 'records' && userId && (
                <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6 mt-6">
                    <PRList userId={userId} />
                </div>
            )}
        </div>
    );
};
