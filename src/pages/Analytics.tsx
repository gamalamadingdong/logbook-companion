import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { BaselineInput } from '../components/analytics/BaselineInput';
import { ZonePaceTrendChart } from '../components/analytics/ZonePaceTrendChart';
import { classifyWorkout, ZONES } from '../utils/zones';
import type { TrainingZone } from '../utils/zones';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Activity, Ruler } from 'lucide-react';

export const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [baselineWatts, setBaselineWatts] = useState(0);
    const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | 'all'>('6m');

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Get Baseline
        const { data: baseline } = await supabase
            .from('user_baseline_metrics')
            .select('pr_2k_watts')
            .eq('user_id', user.id)
            .single();

        const bWatts = baseline?.pr_2k_watts || 202; // Default ~2:00
        setBaselineWatts(bWatts);

        // 2. Get Workouts (ALL TIME)
        const { data: logs } = await supabase
            .from('workout_logs')
            .select('id, completed_at, training_zone, distance_meters, duration_minutes, duration_seconds, watts, workout_type, zone_distribution, workout_name')
            .order('completed_at', { ascending: true }); // Oldest first for charts

        setWorkouts(logs || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Logic
    const filteredWorkouts = useMemo(() => {
        if (timeRange === 'all') return workouts;

        const now = new Date();
        const cutoff = new Date();
        // Reset to start of day relative to the cutoff
        if (timeRange === '3m') cutoff.setMonth(now.getMonth() - 3);
        else if (timeRange === '6m') cutoff.setMonth(now.getMonth() - 6);
        else if (timeRange === '1y') cutoff.setFullYear(now.getFullYear() - 1);

        return workouts.filter(w => new Date(w.completed_at) >= cutoff);
    }, [workouts, timeRange]);


    // --- Calculations ---
    const dataByZone = useMemo(() => {
        if (!baselineWatts || filteredWorkouts.length === 0) return [];

        const distribution: Record<TrainingZone, number> = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };

        filteredWorkouts.forEach(w => {
            let usedDistribution = false;

            // Priority 1: Use Granular Zone Distribution (Seconds)
            if (w.zone_distribution && Object.keys(w.zone_distribution).length > 0) {
                const dist = w.zone_distribution;
                const totalDistSeconds = (Object.values(dist) as number[]).reduce((a, b) => a + b, 0);

                // Only use if we actually have data (tolerance of 10s)
                if (totalDistSeconds > 10) {
                    (Object.keys(dist) as TrainingZone[]).forEach(z => {
                        distribution[z] += (dist[z] / 60); // Seconds -> Min
                    });
                    usedDistribution = true;
                }
            }

            if (!usedDistribution) {
                // Fallback: Estimate from Average Watts
                let watts = w.watts;
                const sec = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);

                if (!watts && w.distance_meters && sec > 0) {
                    const split = 500 * (sec / w.distance_meters);
                    watts = 2.8 / Math.pow(split / 500, 3);
                }

                if (!watts) watts = 0;
                const zone = classifyWorkout(watts, baselineWatts);

                // Add entire duration to the dominant zone
                if (sec > 0) distribution[zone] += (sec / 60);
            }
        });

        // Convert Seconds to Minutes for the Chart
        return ZONES.map(z => ({
            name: z.id,
            value: Math.round(distribution[z.id]),
            color: z.color
        }));
    }, [filteredWorkouts, baselineWatts]);

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

            if (!weeks[key]) {
                weeks[key] = { date: key, UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0, total: 0 };
            }

            let usedDistribution = false;

            // Logic: Add TIME (Hours) to the week
            if (w.zone_distribution && Object.keys(w.zone_distribution).length > 0) {
                const dist = w.zone_distribution;
                const totalDistSeconds = (Object.values(dist) as number[]).reduce((a, b) => a + b, 0);

                if (totalDistSeconds > 10) {
                    (Object.keys(dist) as TrainingZone[]).forEach(z => {
                        const hours = dist[z] / 3600;
                        weeks[key][z] += hours;
                        weeks[key].total += hours;
                    });
                    usedDistribution = true;
                }
            }

            if (!usedDistribution) {
                // Fallback: Whole workout classification
                let watts = w.watts;
                const sec = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);

                if (!watts && w.distance_meters && sec > 0) {
                    const split = 500 * (sec / w.distance_meters);
                    watts = 2.8 / Math.pow(split / 500, 3);
                }
                const zone = classifyWorkout(watts || 0, baselineWatts);
                const hours = sec / 3600;
                weeks[key][zone] += hours;
                weeks[key].total += hours;
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

                {/* Header (Local Controls) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-800 pb-6 mt-6">
                    <div>
                        <h2 className="text-2xl font-bold">Zone Distribution</h2>
                        <p className="text-neutral-500 text-sm">Training load analysis</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        {/* Time Range Selector */}
                        <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex">
                            {(['3m', '6m', '1y', 'all'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === range
                                        ? 'bg-neutral-800 text-white shadow-sm'
                                        : 'text-neutral-500 hover:text-neutral-300'
                                        }`}
                                >
                                    {range === 'all' ? 'All Time' : range.toUpperCase()}
                                </button>
                            ))}
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
                        </div>
                    </div>
                </div>

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
                                            formatter={(val: number | string | Array<any> | undefined) => [`${val} mins`, 'Duration']}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>

                                {/* Center Label */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <span className="text-3xl font-bold text-white">
                                            {totalTimeSeconds > 0 ?
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
                                    Weekly Training Hours
                                </h3>
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
                                        tickFormatter={(val) => `${val.toFixed(1)}h`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#262626', opacity: 0.5 }}
                                        contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                        labelStyle={{ color: '#a3a3a3', marginBottom: '8px' }}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                        formatter={(val: any) => [`${Number(val).toFixed(2)} hrs`, '']}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="UT2" stackId="a" fill={ZONES[0].color} radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="UT1" stackId="a" fill={ZONES[1].color} />
                                    <Bar dataKey="AT" stackId="a" fill={ZONES[2].color} />
                                    <Bar dataKey="TR" stackId="a" fill={ZONES[3].color} />
                                    <Bar dataKey="AN" stackId="a" fill={ZONES[4].color} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* Trends Section */}
                <div className="grid grid-cols-1 gap-8">
                    <ZonePaceTrendChart workouts={filteredWorkouts} baselineWatts={baselineWatts} />
                </div>
            </div>
        </div>
    );
};
