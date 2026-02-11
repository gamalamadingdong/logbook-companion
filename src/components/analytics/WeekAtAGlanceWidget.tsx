import React, { useMemo, useState } from 'react';
import { startOfWeek, endOfWeek, subWeeks, addWeeks, isWithinInterval, format, isAfter } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkoutLog } from '../../services/supabase';
import { classifyWorkout, ZONES } from '../../utils/zones';
import type { TrainingZone } from '../../utils/zones';

interface WeekAtAGlanceWidgetProps {
    workouts: WorkoutLog[];
    baselineWatts?: number; // Optional, for zone classification if needed
}

export const WeekAtAGlanceWidget: React.FC<WeekAtAGlanceWidgetProps> = ({ workouts, baselineWatts = 200 }) => {

    // 1. Determine Date Ranges
    const [selectedDate, setSelectedDate] = useState(new Date());

    const currentWeekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
    const currentWeekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

    const lastWeekStart = startOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 1 });

    const handlePrevWeek = () => setSelectedDate(prev => subWeeks(prev, 1));
    const handleNextWeek = () => {
        const next = addWeeks(selectedDate, 1);
        if (!isAfter(next, new Date())) {
            setSelectedDate(next);
        }
    };

    const isCurrentWeek = isWithinInterval(new Date(), { start: currentWeekStart, end: currentWeekEnd });

    // 2. Filter Workouts
    const thisWeekWorkouts = useMemo(() => {
        return workouts.filter(w => isWithinInterval(new Date(w.completed_at), { start: currentWeekStart, end: currentWeekEnd }));
    }, [workouts, currentWeekStart, currentWeekEnd]);

    const lastWeekWorkouts = useMemo(() => {
        return workouts.filter(w => isWithinInterval(new Date(w.completed_at), { start: lastWeekStart, end: lastWeekEnd }));
    }, [workouts, lastWeekStart, lastWeekEnd]);

    // 3. Calculate Stats Helper
    const calculateStats = (logs: WorkoutLog[]) => {
        let totalDistance = 0;
        let totalSeconds = 0;
        const distribution: Record<TrainingZone, number> = { UT2: 0, UT1: 0, AT: 0, TR: 0, AN: 0 };

        logs.forEach(w => {
            totalDistance += w.distance_meters || 0;
            const sec = w.duration_seconds || (w.duration_minutes ? w.duration_minutes * 60 : 0);
            totalSeconds += sec;

            // Simplified Zone Logic (Fallback to classifyWorkout if no distribution)
            // Ideally we'd use granular buckets, but for "Glance" simplified is okay?
            // Let's reuse the simple fallback logic from Analytics.tsx if granular missing
            let zone: TrainingZone = 'UT2';

            // Try to use existing distribution if available (from backend aggregation?)
            // Assuming simplified for now for speed/widget lightness
            let watts = w.watts;
            if (!watts && w.avg_split_500m) {
                watts = 2.8 / Math.pow(w.avg_split_500m / 500, 3);
            }
            if (!watts && w.distance_meters && sec > 0) {
                const split = 500 * (sec / w.distance_meters);
                watts = 2.8 / Math.pow(split / 500, 3);
            }

            zone = classifyWorkout(watts || 0, baselineWatts);
            distribution[zone] += sec;
        });

        return { totalDistance, totalSeconds, count: logs.length, distribution };
    };

    const currentStats = calculateStats(thisWeekWorkouts);
    const lastStats = calculateStats(lastWeekWorkouts);

    // 4. Trends
    const getTrend = (current: number, last: number) => {
        if (last === 0) return current > 0 ? { type: 'up', pct: 100 } : { type: 'neutral', pct: 0 };
        const pct = ((current - last) / last) * 100;
        return {
            type: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
            pct: Math.abs(Math.round(pct))
        };
    };

    const distTrend = getTrend(currentStats.totalDistance, lastStats.totalDistance);

    // Chart Data
    const chartData = (Object.keys(currentStats.distribution) as TrainingZone[])
        .filter(z => currentStats.distribution[z] > 0)
        .map(z => ({
            name: z,
            value: Math.round(currentStats.distribution[z] / 60), // minutes
            color: ZONES.find(ref => ref.id === z)?.color || '#525252'
        }));

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calendar size={18} className="text-emerald-500" />
                        Week at a Glance
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <button type="button" title="Previous week" onClick={handlePrevWeek} className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-white">
                            <ChevronLeft size={14} />
                        </button>
                        <p className="text-neutral-500 text-xs tabular-nums">
                            {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d')}
                        </p>
                        <button
                            type="button"
                            title="Next week"
                            onClick={handleNextWeek}
                            disabled={isCurrentWeek}
                            className={`p-1 rounded transition-colors ${isCurrentWeek ? 'text-neutral-700 cursor-not-allowed' : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>

                {/* Comparison Badge */}
                <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${distTrend.type === 'up' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                    distTrend.type === 'down' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                        'bg-neutral-800 border-neutral-700 text-neutral-400'
                    }`}>
                    {distTrend.type === 'up' && <TrendingUp size={14} />}
                    {distTrend.type === 'down' && <TrendingDown size={14} />}
                    {distTrend.type === 'neutral' && <Minus size={14} />}
                    <span>{distTrend.pct}% meters vs last wk</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Stats Column */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                            <div className="text-neutral-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Total Distance</div>
                            <div className="text-2xl font-bold text-white">
                                {(currentStats.totalDistance / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                <span className="text-sm font-normal text-neutral-600 ml-1">km</span>
                            </div>
                        </div>
                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                            <div className="text-neutral-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Total Time</div>
                            <div className="text-2xl font-bold text-white">
                                {(currentStats.totalSeconds / 3600).toFixed(1)}
                                <span className="text-sm font-normal text-neutral-600 ml-1">hrs</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                        <div className="bg-blue-500/10 p-2.5 rounded-lg text-blue-500">
                            <Activity size={20} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{currentStats.count}</div>
                            <div className="text-neutral-500 text-xs">Sessions completed</div>
                        </div>
                    </div>
                </div>

                {/* Chart Column */}
                <div className="relative">
                    {/* Center Label for Chart */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        {currentStats.totalSeconds === 0 ? (
                            <div className="text-neutral-600 text-xs">No Data</div>
                        ) : (
                            <div className="text-center">
                                <span className="text-2xl font-bold text-white block">
                                    {Math.round((currentStats.distribution['UT2'] / currentStats.totalSeconds) * 100)}%
                                </span>
                                <span className="text-[10px] text-neutral-500 uppercase">UT2</span>
                            </div>
                        )}
                    </div>

                    <div className="h-[160px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.length > 0 ? chartData : [{ name: 'Empty', value: 1, color: '#262626' }]}
                                    innerRadius={55}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {(chartData.length > 0 ? chartData : [{ name: 'Empty', value: 1, color: '#262626' }]).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                {chartData.length > 0 && <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(val: number | string | Array<number | string> | undefined) => [`${val} mins`, 'Duration']}
                                />}
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    {chartData.length > 0 && (
                        <div className="flex justify-center gap-3 mt-[-10px]">
                            {chartData.sort((a, b) => b.value - a.value).slice(0, 3).map(d => (
                                <div key={d.name} className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                    <span className="text-[10px] text-neutral-400 font-medium">{d.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
