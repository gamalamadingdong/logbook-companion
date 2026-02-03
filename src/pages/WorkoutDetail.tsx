import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity, Zap, Wind, Clock, Timer, SplitSquareHorizontal, ExternalLink, Pencil, X, Save, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { workoutService } from '../services/workoutService';
import { PowerDistributionChart } from '../components/analytics/PowerDistributionChart';
import { useAuth } from '../hooks/useAuth';
import { calculateWatts } from '../utils/prCalculator';
import { calculateCanonicalName, detectIntervalsFromStrokes } from '../utils/workoutNaming';
import { parseRWN } from '../utils/rwnParser';
import { structureToIntervals } from '../utils/structureAdapter';
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

    // Manual Override State
    const [isEditing, setIsEditing] = useState(false);
    const [manualRWN, setManualRWN] = useState('');
    const [previewName, setPreviewName] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isBenchmark, setIsBenchmark] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
                    setBuckets(bucketsData);
                    if (detailData.manual_rwn) setManualRWN(detailData.manual_rwn);
                    if (detailData.is_benchmark) setIsBenchmark(true);
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
        // Live Preview takes precedence during edit
        if (isEditing && previewName) return previewName;

        // Manual Override (if set and not editing)
        if (!isEditing && detail?.manual_rwn) {
            const parsed = parseRWN(detail.manual_rwn);
            if (parsed) {
                return calculateCanonicalName(structureToIntervals(parsed));
            }
        }

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

    // --- Derived State (Must be unconditional) ---

    // 1. Process Strokes & Intervals
    const processedData = useMemo(() => {
        if (!detail || !strokes) return { intervalsData: [], visibleStrokes: [], segments: [] };

        // Segment strokes into "Raw Segments" based on distance resets
        const rawSegments: C2Stroke[][] = [];
        let currentRawSegment: C2Stroke[] = [];

        strokes.forEach((s, i) => {
            if (i > 0 && s.d < strokes[i - 1].d) {
                rawSegments.push(currentRawSegment);
                currentRawSegment = [];
            }
            currentRawSegment.push(s);
        });
        if (currentRawSegment.length > 0) {
            rawSegments.push(currentRawSegment);
        }

        // Refine segments
        const intervalsData = rawSegments.map((segment, i) => {
            const def = detail.workout?.intervals?.[i];
            if (!def) return { work: segment, rest: [] };

            const isTime = def.type === 'time';
            const isDist = def.type === 'distance';

            let work: C2Stroke[] = [];
            let rest: C2Stroke[] = [];

            if (isTime) {
                work = segment.filter(s => s.t <= def.time);
                rest = segment.filter(s => s.t > def.time);
            } else if (isDist) {
                const targetDm = def.distance * 10;
                work = segment.filter(s => s.d <= targetDm);
                rest = segment.filter(s => s.d > targetDm);
            } else {
                work = segment;
            }
            return { work, rest };
        });

        // Determine visible strokes
        let visibleStrokes: any[] = [];
        if (selectedInterval === 'all') {
            let cumulativeDist = 0;
            intervalsData.forEach((item) => {
                const stitched = item.work.map(s => ({ ...s, d: s.d + cumulativeDist }));
                visibleStrokes = visibleStrokes.concat(stitched);
                if (item.work.length > 0) cumulativeDist += item.work[item.work.length - 1].d;
            });
            if (intervalsData.length === 0) visibleStrokes = strokes;
        } else {
            visibleStrokes = intervalsData[selectedInterval]?.work || [];
        }

        const segments = detail.workout?.intervals || detail.workout?.splits || [];

        return { intervalsData, visibleStrokes, segments };
    }, [detail, strokes, selectedInterval]);

    const { intervalsData, visibleStrokes, segments } = processedData;

    // 2. Chart Data
    const chartData = useMemo(() => {
        return visibleStrokes.map(s => {
            let watts = 0;
            if (s.p > 300) {
                const paceSeconds = s.p / 10;
                watts = calculateWatts(paceSeconds);
            } else {
                watts = s.p;
            }
            return {
                distance: s.d / 10,
                watts: Math.round(watts),
                spm: s.spm,
                hr: s.hr
            };
        });
    }, [visibleStrokes]);

    // 3. Stats & Metrics
    const stats = useMemo(() => {
        if (!detail) return {
            avgPaceFormatted: '-',
            workDistance: 0,
            workTime: 0,
            totalDistance: 0,
            restTime: 0,
            isInterval: false,
            workIntervals: []
        };

        const totalSeconds = (detail.time / 10);
        const avgPaceSeconds = detail.distance ? (totalSeconds * 500) / detail.distance : 0;
        const avgPaceMins = Math.floor(avgPaceSeconds / 60);
        const avgPaceSecs = (avgPaceSeconds % 60).toFixed(1);
        const avgPaceFormatted = detail.distance ? `${avgPaceMins}:${avgPaceSecs.padStart(4, '0')}` : '-';

        const workIntervals = (detail.workout?.intervals || []).filter((i: C2Interval) => i.type !== 'rest');
        const workDistance = workIntervals.length > 0
            ? workIntervals.reduce((sum: number, i: C2Interval) => sum + i.distance, 0)
            : detail.distance;
        const workTime = workIntervals.length > 0
            ? workIntervals.reduce((sum: number, i: C2Interval) => sum + i.time, 0) / 10
            : totalSeconds;
        const totalDistance = detail.distance + (detail.rest_distance || 0);
        const restTime = totalSeconds - workTime;
        const isInterval = !!detail.workout?.intervals;

        return { avgPaceFormatted, workDistance, workTime, totalDistance, restTime, isInterval, workIntervals };
    }, [detail]);

    const { avgPaceFormatted, workDistance, workTime, totalDistance, restTime, isInterval, workIntervals } = stats;

    // 4. Power Buckets
    const activeBuckets = useMemo(() => {
        if (visibleStrokes.length > 0) {
            return calculateBucketsFromStrokes(visibleStrokes);
        }
        return buckets || {};
    }, [visibleStrokes, buckets]);


    // --- Early Returns (Conditionals) ---
    if (loading) return <div className="p-8 text-neutral-400">Loading workout details...</div>;
    if (!detail) return <div className="p-8 text-neutral-400">Workout not found.</div>;

    // Helper must be available to render
    const formatTime = (time: number) => {
        if (!time) return '0:00.0';
        const totalSeconds = time / 10;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = (totalSeconds % 60).toFixed(1);
        return `${minutes}:${seconds.padStart(4, '0')}`;
    };



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
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2 bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent flex items-center gap-3">
                            {canonicalName}
                            {detail.is_benchmark && (
                                <span className="text-xs font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded align-middle">
                                    Benchmark
                                </span>
                            )}
                        </h1>
                        <div className="flex items-center gap-3 text-neutral-400 text-sm md:text-base font-medium">
                            <span className="px-3 py-1 bg-neutral-900 rounded-full border border-neutral-800">
                                {new Date(detail.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{detail.workout_type.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                    </div>
                    <span className="capitalize">{detail.workout_type.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
            </div>

            {/* Manual RWN Edit Modal / Overlay */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Edit Structure</h3>
                            <button onClick={() => setIsEditing(false)} className="text-neutral-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">
                                    RWN String (Structure Override)
                                </label>
                                <input
                                    type="text"
                                    value={manualRWN}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setManualRWN(val);
                                        if (!val.trim()) {
                                            setPreviewName(null);
                                            setParseError(null);
                                            return;
                                        }
                                        const res = parseRWN(val);
                                        if (res) {
                                            setParseError(null);
                                            // Check for #test tag
                                            if (res.tags?.includes('test')) {
                                                setIsBenchmark(true);
                                            } else {
                                                // Only uncheck if we previously auto-checked it? 
                                                // Or strict sync? Strict sync feels safer for "RWN as DNA".
                                                setIsBenchmark(false);
                                            }

                                            try {
                                                const ints = structureToIntervals(res);
                                                setPreviewName(calculateCanonicalName(ints));
                                            } catch (err) {
                                                setPreviewName(null);
                                            }
                                        } else {
                                            setParseError('Invalid RWN syntax');
                                            setPreviewName(null);
                                        }
                                    }}
                                    placeholder="e.g. 4x500m/1:00r"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-mono"
                                />
                                {parseError && (
                                    <div className="flex items-center gap-2 text-rose-400 text-sm mt-2">
                                        <AlertCircle size={14} /> {parseError}
                                    </div>
                                )}
                                {previewName && !parseError && (
                                    <div className="mt-2 p-3 bg-neutral-950/50 rounded-lg border border-neutral-800">
                                        <div className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-1">Preview Name</div>
                                        <div className="text-emerald-400 font-bold">{previewName}</div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Benchmark Toggle */}
                        <div className="flex items-center justify-between p-3 bg-neutral-950/50 rounded-xl border border-neutral-800">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">Mark as Benchmark</span>
                                <span className="text-xs text-neutral-500">Flag this workout as a test or PR attempt.</span>
                            </div>
                            <button
                                onClick={() => {
                                    const newState = !isBenchmark;
                                    setIsBenchmark(newState);

                                    // Update RWN string to match
                                    let current = manualRWN.trim();
                                    if (newState) {
                                        if (!current.includes('#test')) {
                                            setManualRWN(current ? `${current} #test` : '#test');
                                        }
                                    } else {
                                        setManualRWN(current.replace(/\s*#test/gi, '').trim());
                                    }
                                }}
                                className={`relative w-11 h-6 rounded-full transition-colors ${isBenchmark ? 'bg-yellow-500' : 'bg-neutral-700'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isBenchmark ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-neutral-400 hover:text-white font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!!parseError || isSaving}
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        await workoutService.updateWorkoutName(detail.id.toString(), { manualRWN: manualRWN || '', isBenchmark });
                                        // Optimistic update
                                        setDetail(prev => prev ? ({ ...prev, manual_rwn: manualRWN, is_benchmark: isBenchmark }) : null);
                                        setIsEditing(false);
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                className="bg-white text-black px-4 py-2 rounded-xl font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-end">
                <button
                    onClick={() => {
                        setIsEditing(true);
                        if (detail.manual_rwn) {
                            const res = parseRWN(detail.manual_rwn);
                            if (res) {
                                setPreviewName(calculateCanonicalName(structureToIntervals(res)));
                            }
                        }
                    }}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-neutral-700 flex items-center gap-2"
                >
                    <Pencil size={16} />
                    Edit Structure
                </button>
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


            {/* Stats Grid - Row 1: Distance & Time Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {
                    [
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
                    ))
                }
            </div>

            {/* Stats Grid - Row 2: Performance Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {
                    [
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
                    ))
                }
            </div>

            {/* Charts */}
            {
                strokes.length > 0 && (
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

        </div>
    );
};
