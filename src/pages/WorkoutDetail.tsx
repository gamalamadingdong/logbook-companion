import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity, Zap, Wind, Clock, Timer, SplitSquareHorizontal, ExternalLink } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { workoutService } from '../services/workoutService';
import { PowerDistributionChart } from '../components/analytics/PowerDistributionChart';
import { useAuth } from '../hooks/useAuth';
import { calculateWatts, calculateCanonicalName, detectIntervalsFromStrokes } from '../utils/prCalculator';
import { calculateBucketsFromStrokes } from '../utils/zones';
import { supabase } from '../services/supabase';
import type { C2ResultDetail, C2Stroke, C2Interval, C2Split } from '../api/concept2.types';
import { DEMO_WORKOUTS } from '../data/demoData';

export const WorkoutDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { profile, isGuest } = useAuth();
    const [detail, setDetail] = useState<C2ResultDetail | null>(null);
    const [strokes, setStrokes] = useState<C2Stroke[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInterval, setSelectedInterval] = useState<number | 'all'>('all');
    const [buckets, setBuckets] = useState<Record<string, number> | null>(null);
    const [baselineWatts, setBaselineWatts] = useState<number>(202); // Default 2:00 split

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            try {
                if (isGuest) {
                    const mockDetail = DEMO_WORKOUTS.find(w => w.id === id || w.external_id === id) as any;
                    if (mockDetail) {
                        // Cast to C2ResultDetail - demo data has similar shape
                        setDetail(mockDetail);
                        // Mock strokes if available in raw_data, otherwise empty
                        // strokes are usually fetched separately. For demo, we might not have full stroke data.
                        // We can generate fake strokes or just use empty.
                        // For the charts to work, we need strokes.
                        // Let's create a minimal mock for strokes if needed, or leave empty.
                        setStrokes([]);
                        setBuckets({});
                    }
                } else {
                    // Fetch detail and strokes from Supabase via workoutService
                    const [detailData, strokeData, bucketsData] = await Promise.all([
                        workoutService.getWorkoutDetail(id),
                        workoutService.getStrokes(id),
                        workoutService.getPowerBuckets(id)
                    ]);
                    setDetail(detailData);
                    setStrokes(strokeData);
                    setBuckets(bucketsData);
                }
            } catch (error) {
                console.error('Failed to fetch details from DB', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, isGuest]);

    // Fetch Baseline Watts from Profile
    useEffect(() => {
        const fetchBaseline = async () => {
            if (!profile?.user_id) return;

            let bWatts = 202; // Default

            // Try working baseline from preferences
            if (profile?.benchmark_preferences?.['2k']?.working_baseline) {
                const timeStr = profile.benchmark_preferences['2k'].working_baseline;
                const parts = timeStr.split(':');
                let totalSeconds = 0;
                if (parts.length === 2) {
                    totalSeconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
                } else {
                    totalSeconds = parseFloat(timeStr);
                }
                if (totalSeconds > 0) {
                    const pace = (totalSeconds / 2000) * 500;
                    bWatts = calculateWatts(pace);
                }
            }

            // Fallback to legacy baseline
            if (bWatts === 202) {
                const { data: baseline } = await supabase
                    .from('user_baseline_metrics')
                    .select('pr_2k_watts')
                    .eq('user_id', profile.user_id)
                    .single();
                if (baseline?.pr_2k_watts) bWatts = baseline.pr_2k_watts;
            }

            setBaselineWatts(bWatts);
        };

        fetchBaseline();
    }, [profile, isGuest]);

    // Calculate Canonical Name (must be before early returns per Rules of Hooks)
    const canonicalName = useMemo(() => {
        if (!detail) return 'Workout';
        const intervals = detail.workout?.intervals || [];
        if (intervals.length > 0) {
            return calculateCanonicalName(intervals);
        }
        // Try to detect from strokes if no explicit intervals
        if (strokes.length > 0) {
            const detected = detectIntervalsFromStrokes(strokes);
            if (detected.length > 1) {
                return calculateCanonicalName(detected);
            }
        }
        // Fallback to distance if single piece
        if (detail.distance) {
            return `${detail.distance}m`;
        }
        return detail.workout_name || 'Workout';
    }, [detail, strokes]);

    if (loading) return <div className="p-8 text-neutral-400">Loading workout details...</div>;
    if (!detail) return <div className="p-8 text-neutral-400">Workout not found.</div>;

    // Helper to format time (deciseconds)
    const formatTime = (time: number) => {
        if (!time) return '0:00.0';
        const totalSeconds = time / 10;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = (totalSeconds % 60).toFixed(1);
        return `${minutes}:${seconds.padStart(4, '0')}`;
    };



    // ... existing loading checks ...



    // Segment strokes into "Raw Segments" based on distance resets
    const rawSegments: C2Stroke[][] = [];
    let currentRawSegment: C2Stroke[] = [];

    strokes.forEach((s, i) => {
        // If distance drops significantly (reset), start new segment
        // We use a threshold of < 100m (1000 dm) to detect reset, or just strictly less than previous
        if (i > 0 && s.d < strokes[i - 1].d) {
            rawSegments.push(currentRawSegment);
            currentRawSegment = [];
        }
        currentRawSegment.push(s);
    });
    if (currentRawSegment.length > 0) {
        rawSegments.push(currentRawSegment);
    }

    // Now refine segments into Work vs Rest based on workout definition
    const intervalsData = rawSegments.map((segment, i) => {
        // If we have interval definitions, use them to split Work/Rest
        // "Splits" (steady state) usually don't have resets, so they end up as 1 segment.
        // "Intervals" have resets.
        const def = detail.workout?.intervals?.[i];

        if (!def) {
            // No definition means it's likely a steady state or single piece
            // Treat entire segment as work
            return { work: segment, rest: [] };
        }

        // Split based on definition type
        const isTime = def.type === 'time';
        const isDist = def.type === 'distance';

        let work: C2Stroke[] = [];
        let rest: C2Stroke[] = [];

        if (isTime) {
            // Filter by time (deciseconds)
            // Stroke time s.t is accumulated FROM START OF INTERVAL in ds
            work = segment.filter(s => s.t <= def.time);
            rest = segment.filter(s => s.t > def.time);
        } else if (isDist) {
            // Filter by distance (decimeters)
            const targetDm = def.distance * 10;
            work = segment.filter(s => s.d <= targetDm);
            rest = segment.filter(s => s.d > targetDm);
        } else {
            // Fallback
            work = segment;
        }
        return { work, rest };
    });

    // Determine strokes to show based on selection
    let visibleStrokes: any[] = [];

    if (selectedInterval === 'all') {
        // Stitch "Work" segments together
        let cumulativeDist = 0;

        intervalsData.forEach((item) => {
            const stitched = item.work.map(s => ({
                ...s,
                d: s.d + cumulativeDist
            }));
            visibleStrokes = visibleStrokes.concat(stitched);

            // Add max distance of THIS work segment to cumulative
            if (item.work.length > 0) {
                cumulativeDist += item.work[item.work.length - 1].d;
            }
        });

        // Use raw strokes if no intervals detected (fallback)
        if (intervalsData.length === 0) visibleStrokes = strokes;

    } else {
        // Show specific interval (Work only)
        visibleStrokes = intervalsData[selectedInterval]?.work || [];
    }

    // Prepare chart data (convert units)
    // Stroke distance (d) is definitely decimeters
    const chartData = visibleStrokes.map(s => {
        // Concept2 API usually returns 'p' as Pace (time per 500m) in deciseconds for rowing
        // OR Watts directly? The bug report suggests it is returning ~1150 which is 1:55 pace.
        // If it were watts, 1150w is huge. If it were tenths of watts, 115w is low for 1:55.
        // 1:55 pace -> ~230-240 watts. 
        // So s.p is likely Pace in Deciseconds.

        let watts = 0;
        // Heuristic: If p > 500, it's likely Pace in Deciseconds (e.g. 1150 = 1:55.0)
        // If p < 500, it might be raw Watts? Or if it's huge > 2000? 
        // For now, assume Pace (ds) if > 300 (which is 0:30/500m - impossible record)
        if (s.p > 300) {
            const paceSeconds = s.p / 10;
            watts = calculateWatts(paceSeconds);
        } else {
            // Treat as raw watts (tenths?) or just watts
            // Existing code divided by 10. Let's assume if it is explicitly "watts" type stroke data it might be different, 
            // but user data s.p seems to be pace based on graph.
            watts = s.p; // Fallback
        }

        return {
            distance: s.d / 10,
            watts: Math.round(watts),
            spm: s.spm,
            hr: s.hr
        };
    });

    // Identify if we have intervals or splits
    const segments = detail.workout?.intervals || detail.workout?.splits || [];
    const isInterval = !!detail.workout?.intervals;

    // Calculate Average 500m Pace
    // time (ds) -> seconds: time / 10
    // distance (m)
    // pace = (seconds * 500) / distance
    const totalSeconds = (detail.time / 10);
    const avgPaceSeconds = detail.distance ? (totalSeconds * 500) / detail.distance : 0;
    const avgPaceMins = Math.floor(avgPaceSeconds / 60);
    const avgPaceSecs = (avgPaceSeconds % 60).toFixed(1);
    const avgPaceFormatted = detail.distance ? `${avgPaceMins}:${avgPaceSecs.padStart(4, '0')}` : '-';

    // Calculate Work vs Total metrics
    const workIntervals = (detail.workout?.intervals || []).filter((i: C2Interval) => i.type !== 'rest');
    const workDistance = workIntervals.length > 0
        ? workIntervals.reduce((sum: number, i: C2Interval) => sum + i.distance, 0)
        : detail.distance;
    const workTime = workIntervals.length > 0
        ? workIntervals.reduce((sum: number, i: C2Interval) => sum + i.time, 0) / 10
        : totalSeconds;
    const totalDistance = detail.distance + (detail.rest_distance || 0);
    const restTime = totalSeconds - workTime;

    // Calculate Dynamic Buckets from Visible Strokes (Work Only)
    // This solves the bug where Rest was included in DB-generated buckets!
    const activeBuckets = useMemo(() => {
        if (visibleStrokes.length > 0) {
            return calculateBucketsFromStrokes(visibleStrokes);
        }
        return buckets || {}; // Fallback to DB buckets if no strokes (unlikely if we have detail)
    }, [visibleStrokes, buckets]);



    return (
        <div className="min-h-screen bg-neutral-950 p-6 md:p-12 space-y-8 max-w-7xl mx-auto font-sans">
            {/* Header / Nav */}
            <div className="space-y-6">
                <Link to="/" className="inline-flex items-center text-neutral-400 hover:text-white transition-colors group">
                    <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Back to Dashboard</span>
                </Link>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-neutral-800">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                            {canonicalName}
                        </h1>
                        <div className="flex items-center gap-3 text-neutral-400 text-sm md:text-base font-medium">
                            <span className="px-3 py-1 bg-neutral-900 rounded-full border border-neutral-800">
                                {new Date(detail.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{detail.workout_type.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <a
                            href={`https://log.concept2.com/profile/${detail.user_id}/log/${detail.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-neutral-700 flex items-center gap-2"
                        >
                            <ExternalLink size={16} />
                            View on Logbook
                        </a>
                        <Link
                            to={`/history/${encodeURIComponent(detail.workout_name || '')}`}
                            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-neutral-700"
                        >
                            View History
                        </Link>
                        <Link
                            to={`/compare/${id}`}
                            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded-xl transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <SplitSquareHorizontal size={16} />
                            Compare
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats Grid - Row 1: Distance & Time Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Work Distance',
                        value: Math.round(workDistance),
                        unit: 'm',
                        icon: <Activity size={18} />,
                        color: 'text-blue-400',
                        subtext: workIntervals.length > 0 ? `${workIntervals.length} intervals` : null
                    },
                    {
                        label: 'Total Distance',
                        value: Math.round(totalDistance),
                        unit: 'm',
                        icon: <Activity size={18} />,
                        color: 'text-neutral-400',
                        subtext: detail.rest_distance ? `+${detail.rest_distance}m rest` : null
                    },
                    {
                        label: 'Work Time',
                        value: formatTime(workTime * 10),
                        unit: '',
                        icon: <Clock size={18} />,
                        color: 'text-emerald-400',
                        subtext: null
                    },
                    {
                        label: 'Total Time',
                        value: formatTime(detail.time),
                        unit: '',
                        icon: <Timer size={18} />,
                        color: 'text-neutral-400',
                        subtext: restTime > 0 ? `+${Math.round(restTime)}s rest` : null
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl hover:border-neutral-700 transition-colors group">
                        <div className={`flex items-center gap-2 ${stat.color} mb-3 opacity-80 group-hover:opacity-100 transition-opacity`}>
                            {stat.icon}
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 group-hover:text-neutral-400 transition-colors">{stat.label}</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {stat.value || '-'} {stat.unit && <span className="text-base text-neutral-600 font-medium ml-0.5">{stat.unit}</span>}
                        </div>
                        {stat.subtext && (
                            <div className="text-xs text-neutral-500 mt-2 font-medium">{stat.subtext}</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Stats Grid - Row 2: Performance Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Avg Pace', value: avgPaceFormatted, unit: '/500m', icon: <Activity size={18} />, color: 'text-blue-400' },
                    {
                        label: 'Avg Watts',
                        // If no watt data, calculate from avg pace. Avoid using drag_factor (usually ~130) as watts.
                        value: detail.watts || (detail.time ? calculateWatts((detail.time / 10 / detail.distance) * 500) : '-'),
                        unit: 'w',
                        icon: <Zap size={18} />,
                        color: 'text-yellow-400'
                    },
                    { label: 'Stroke Rate', value: detail.stroke_rate, unit: 'spm', icon: <Activity size={18} />, color: 'text-emerald-400' },
                    { label: 'Rest Distance', value: detail.rest_distance || 0, unit: 'm', icon: <Wind size={18} />, color: 'text-neutral-400' },
                ].map((stat, i) => (
                    <div key={i} className="bg-neutral-900/60 border border-neutral-800 p-5 rounded-2xl hover:border-neutral-700 transition-colors group">
                        <div className={`flex items-center gap-2 ${stat.color} mb-3 opacity-80 group-hover:opacity-100 transition-opacity`}>
                            {stat.icon}
                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 group-hover:text-neutral-400 transition-colors">{stat.label}</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {stat.value || '-'} <span className="text-base text-neutral-600 font-medium ml-0.5">{stat.unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            {strokes.length > 0 && (
                <div className="bg-neutral-900/40 border border-neutral-800 p-6 md:p-8 rounded-2xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            Performance Analysis
                        </h3>

                        {/* Interval Selector */}
                        {isInterval && intervalsData.length > 1 && (
                            <div className="flex gap-2 p-1 bg-neutral-900 rounded-lg overflow-x-auto max-w-full">
                                <button
                                    onClick={() => setSelectedInterval('all')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedInterval === 'all'
                                        ? 'bg-neutral-800 text-white shadow-sm'
                                        : 'text-neutral-500 hover:text-neutral-300'
                                        }`}
                                >
                                    All
                                </button>
                                {intervalsData.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedInterval(i)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${selectedInterval === i
                                            ? 'bg-neutral-800 text-white shadow-sm'
                                            : 'text-neutral-500 hover:text-neutral-300'
                                            }`}
                                    >
                                        Int {i + 1}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis
                                    dataKey="distance"
                                    stroke="#525252"
                                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                    fontSize={12}
                                />
                                <YAxis yAxisId="left" stroke="#8884d8" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#a3a3a3' }} domain={[0, 'auto']} />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#a3a3a3' }} domain={[0, 'auto']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                                    labelStyle={{ color: '#a3a3a3', fontSize: '12px', marginBottom: '4px' }}
                                    formatter={(value: any, name: any) => [
                                        name === 'watts' && typeof value === 'number' ? value.toFixed(1) : value,
                                        name.toString().toUpperCase()
                                    ]}
                                    labelFormatter={(val) => `${val.toFixed(0)}m`}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line yAxisId="left" type="monotone" dataKey="watts" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Watts" />
                                <Line yAxisId="right" type="monotone" dataKey="hr" stroke="#fb7185" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="HR" />
                                <Line yAxisId="right" type="monotone" dataKey="spm" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="SPM" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )
            }

            {/* Power Distribution Chart */}
            {
                Object.keys(activeBuckets).length > 0 && (
                    <div className="bg-neutral-900/40 border border-neutral-800 p-6 md:p-8 rounded-2xl">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Zap size={18} className="text-yellow-400" />
                            Power Distribution
                        </h3>
                        <div className="h-[300px] w-full">
                            <PowerDistributionChart buckets={activeBuckets} baselineWatts={baselineWatts} />
                        </div>
                    </div>
                )
            }

            {/* Splits / Intervals Table */}
            {
                segments.length > 0 && (
                    <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/60">
                            <h3 className="text-lg font-bold text-white">{isInterval ? 'Interval Breakdown' : 'Split Breakdown'}</h3>
                            <span className="text-xs font-mono text-neutral-500 bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
                                {segments.length} segments
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-900/80 text-neutral-400 font-medium uppercase tracking-wider text-xs border-b border-neutral-800">
                                    <tr>
                                        <th className="p-4 pl-6 font-semibold">#</th>
                                        <th className="p-4 font-semibold">Distance</th>
                                        <th className="p-4 font-semibold">Time</th>
                                        <th className="p-4 font-semibold">Pace</th>
                                        <th className="p-4 font-semibold">SPM</th>
                                        <th className="p-4 font-semibold">HR</th>
                                        {isInterval && <th className="p-4 pr-6 font-semibold">Rest</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800/50 bg-neutral-900/20">
                                    {segments.map((seg: C2Interval | C2Split, i: number) => {
                                        const seconds = seg.time / 10;
                                        const paceSeconds = (seconds * 500) / seg.distance;
                                        const paceMins = Math.floor(paceSeconds / 60);
                                        const paceSecs = (paceSeconds % 60).toFixed(1);
                                        const pace = `${paceMins}:${paceSecs.padStart(4, '0')}`;

                                        return (
                                            <tr key={i} className="hover:bg-neutral-800/40 transition-colors group">
                                                <td className="p-4 pl-6 font-mono text-neutral-500 group-hover:text-white transition-colors">{i + 1}</td>
                                                <td className="p-4 font-medium text-white">{seg.distance}m</td>
                                                <td className="p-4 font-mono text-neutral-300">{formatTime(seg.time)}</td>
                                                <td className="p-4 font-mono text-blue-400 font-medium">{pace}</td>
                                                <td className="p-4 text-emerald-400">{seg.stroke_rate}</td>
                                                <td className="p-4 text-rose-400 font-medium">
                                                    {seg.heart_rate?.average || seg.heart_rate?.ending || '-'}
                                                </td>
                                                {isInterval && (
                                                    <td className="p-4 pr-6 text-neutral-500 font-mono text-xs">
                                                        {(seg as C2Interval).rest_time ? formatTime((seg as C2Interval).rest_time!) + 'r' : '-'}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
        </div >
    );

};
