import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, SplitSquareHorizontal, Calendar, Zap, Gauge, Trophy, Search, Heart, Activity } from 'lucide-react';
import { workoutService } from '../services/workoutService';
import { formatPace } from '../utils/prDetection';
import { DualWorkoutChart } from '../components/analytics/DualWorkoutChart';
import type { C2Stroke } from '../api/concept2.types';

// Type Definitions
interface WorkoutData {
    id?: string | number;
    db_id?: string;
    workout_name?: string;
    distance_meters?: number;
    distance?: number;
    duration_seconds?: number;
    time?: number;
    watts?: number;
    formatted_pace?: string;
    date?: string;
    completed_at?: string;
}

interface SimilarWorkouts {
    target: WorkoutData;
    pr?: WorkoutData | null;
    previous?: WorkoutData | null;
    history?: WorkoutData[];
}

interface SearchResult {
    id?: string;
    db_id?: string;
    name: string;
    date: string;
    distance: number;
    time_formatted: string;
}

interface StatBoxProps {
    label: string;
    value: string | number;
    unit: string;
    icon: React.ComponentType<{ size: number }>;
    color: string;
}

interface WorkoutSummaryCardProps {
    workout: WorkoutData | null;
    title: string;
    onClear?: () => void;
}

// Helper Components
const colorTextClasses: Record<string, string> = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    indigo: 'text-indigo-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
};

const StatBox = ({ label, value, unit, icon: Icon, color }: StatBoxProps) => (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
        <div className={`${colorTextClasses[color] || 'text-neutral-500'} opacity-80`}>
            <Icon size={16} />
        </div>
        <div className="text-2xl font-bold font-mono text-white">{value}<span className="text-xs text-neutral-500 font-sans ml-1">{unit}</span></div>
        <div className="text-xs text-neutral-500 uppercase tracking-wider">{label}</div>
    </div>
);

const WorkoutSummaryCard = ({ workout, title, onClear }: WorkoutSummaryCardProps) => {
    // Basic stats extraction
    const stats = useMemo(() => {
        if (!workout) return null;

        const dist = workout.distance_meters || workout.distance || 0;
        const time = workout.duration_seconds || (typeof workout.time === 'number' ? workout.time / 10 : 0);
        const paceSeconds = dist > 0 ? (time / dist) * 500 : 0;
        const pace = workout.formatted_pace || formatPace(paceSeconds);
        const watts = workout.watts || (time > 0 && dist > 0 ? Math.round(2.8 / Math.pow((time / dist) * 500 / 500, 3)) : 0);
        const date = workout.date || workout.completed_at ? new Date(workout.date || workout.completed_at || '').toLocaleDateString() : 'Unknown';

        return { dist, pace, watts, date };
    }, [workout]);

    if (!workout || !stats) return null;

    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative group">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">{title}</div>
                    <div className="text-2xl font-bold text-white">{workout.workout_name || `${(stats.dist / 1000).toFixed(1)}k Row`}</div>
                    <div className="flex items-center gap-2 text-neutral-400 text-sm mt-1">
                        <Calendar size={12} />
                        {stats.date}
                    </div>
                </div>
                {onClear && (
                    <button
                        onClick={onClear}
                        className="text-neutral-600 hover:text-red-500 transition-colors p-2"
                        title="Remove comparison"
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <StatBox label="Avg Split" value={stats.pace} unit="/500m" icon={Gauge} color="blue" />
                <StatBox label="Avg Watts" value={stats.watts || '-'} unit="w" icon={Zap} color="emerald" />
            </div>
        </div>
    );
};

export const WorkoutComparison: React.FC = () => {
    const { aId, bId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Workout A Data
    const [workoutA, setWorkoutA] = useState<WorkoutData | null>(null);
    const [statsA, setStatsA] = useState<C2Stroke[]>([]);

    // Workout B Data
    const [workoutB, setWorkoutB] = useState<WorkoutData | null>(null);
    const [statsB, setStatsB] = useState<C2Stroke[]>([]);

    // Smart Picker Data
    const [similar, setSimilar] = useState<SimilarWorkouts | null>(null);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Chart State
    const [chartMetric, setChartMetric] = useState<'watts' | 'pace' | 'rate' | 'hr'>('watts');

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchTerm.length > 2) {
                setIsSearching(true);
                try {
                    const results = await workoutService.searchWorkouts(searchTerm);
                    setSearchResults(results);
                } catch (err) {
                    console.error("Search failed", err);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    useEffect(() => {
        const load = async () => {
            if (!aId) return;
            setLoading(true);
            try {
                // 1. Load Workout A (Target) and its strokes
                const [data, strokesA] = await Promise.all([
                    workoutService.getSimilarWorkouts(aId),
                    workoutService.getStrokes(aId)
                ]);

                setWorkoutA(data.target);
                setStatsA(strokesA);
                setSimilar(data);

                // 2. Load Workout B if present
                if (bId) {
                    const [b, strokesB] = await Promise.all([
                        workoutService.getWorkoutDetail(bId),
                        workoutService.getStrokes(bId)
                    ]);
                    setWorkoutB(b);
                    setStatsB(strokesB);
                } else {
                    setWorkoutB(null);
                    setStatsB([]);
                }
            } catch (err) {
                console.error("Failed to load comparison data", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [aId, bId]);

    const handleSelectB = (id: string | number | undefined) => {
        if (!id) return;
        navigate(`/compare/${aId}/${id}`);
    };

    if (loading) return <div className="p-8 text-neutral-500">Loading comparison...</div>;

    if (!workoutA) return <div className="p-8 text-neutral-500">Workout not found.</div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
            {/* Header */}
            <header className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <SplitSquareHorizontal className="text-blue-500" />
                        Workout Comparison
                    </h1>
                    <p className="text-neutral-500 text-sm">Head-to-Head Analysis</p>
                </div>
            </header>

            {/* Split View */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Workout A (Fixed) */}
                <div className="space-y-6">
                    <WorkoutSummaryCard workout={workoutA} title="Base Workout" />
                </div>

                {/* Right: Workout B (Selector or Content) */}
                <div className="space-y-6">
                    {workoutB ? (
                        <>
                            <WorkoutSummaryCard workout={workoutB} title="Comparison" onClear={() => navigate(`/compare/${aId}`)} />
                        </>
                    ) : (
                        <div className="bg-neutral-900/30 border border-neutral-800 border-dashed rounded-2xl p-8 h-full flex flex-col items-center justify-start gap-6">
                            <h3 className="text-lg font-medium text-neutral-400">Select comparison workout</h3>

                            {/* Search Bar */}
                            <div className="w-full relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search workouts..."
                                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {isSearching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="animate-spin h-4 w-4 border-2 border-neutral-600 border-t-transparent rounded-full"></div>
                                    </div>
                                )}
                            </div>

                            {/* Search Results */}
                            {searchTerm.length > 2 && (
                                <div className="w-full flex-1 overflow-y-auto min-h-[200px] -mt-2">
                                    {searchResults.length === 0 && !isSearching ? (
                                        <div className="text-center text-neutral-500 py-8">No workouts found</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {searchResults.map((res) => (
                                                <button
                                                    key={res.id || res.db_id}
                                                    onClick={() => handleSelectB(res.id || res.db_id)}
                                                    className="w-full flex items-center justify-between p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors text-left"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-medium text-sm">{res.name}</span>
                                                        <span className="text-xs text-neutral-500">{new Date(res.date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs font-mono text-neutral-400">{res.distance}m</span>
                                                        <span className="text-xs font-mono text-neutral-400">{res.time_formatted}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Smart Suggestions (Hide if searching) */}
                            {searchTerm.length <= 2 && (
                                <>
                                    <div className="w-full space-y-4">
                                        {similar?.pr && (
                                            <button
                                                onClick={() => handleSelectB(similar.pr?.id || similar.pr?.db_id)}
                                                className="w-full flex items-center justify-between p-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:scale-110 transition-transform">
                                                        <Trophy size={18} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-white">Personal Best</div>
                                                        <div className="text-xs text-neutral-500">
                                                            {similar.pr.date ? new Date(similar.pr.date).toLocaleDateString() : 'Unknown'} • {similar.pr.watts}w
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-emerald-400 text-sm font-mono font-bold">
                                                    Select
                                                </div>
                                            </button>
                                        )}

                                        {similar?.previous && (
                                            <button
                                                onClick={() => handleSelectB(similar.previous?.id || similar.previous?.db_id)}
                                                className="w-full flex items-center justify-between p-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                                                        <Calendar size={18} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-bold text-white">Previous Attempt</div>
                                                        <div className="text-xs text-neutral-500">
                                                            {similar.previous.date ? new Date(similar.previous.date).toLocaleDateString() : 'Unknown'} • {similar.previous.watts}w
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-emerald-400 text-sm font-mono font-bold">
                                                    Select
                                                </div>
                                            </button>
                                        )}
                                    </div>

                                    <div className="w-full border-t border-neutral-800 pt-4">
                                        <p className="text-xs text-neutral-600 text-center uppercase tracking-widest mb-2">History Match</p>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                            {similar?.history?.slice(0, 10).map((h: WorkoutData) => (
                                                <button
                                                    key={h.id || h.db_id}
                                                    onClick={() => handleSelectB(h.id || h.db_id)}
                                                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-800 rounded-lg transition-colors text-left"
                                                >
                                                    <span className="text-sm text-neutral-300">
                                                        {h.date || h.completed_at ? new Date(h.date || h.completed_at || '').toLocaleDateString() : 'Unknown'}
                                                    </span>
                                                    <span className="text-sm font-mono text-neutral-500">{h.watts}w</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>




            {/* Comparison Charts Area - Only if B is selected */}
            {
                workoutB && (
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 h-[500px] flex flex-col">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {chartMetric === 'hr' ? <Heart size={18} className="text-red-500" /> :
                                    chartMetric === 'rate' ? <Activity size={18} className="text-blue-400" /> :
                                        <Zap size={18} className="text-yellow-400" />}
                                {chartMetric === 'hr' ? 'Heart Rate' : chartMetric === 'rate' ? 'Stroke Rate' : 'Power Overlay'}
                            </h3>

                            {/* Metric Toggle */}
                            <div className="bg-neutral-900 rounded-lg p-1 border border-neutral-800 flex">
                                {(['watts', 'pace', 'hr', 'rate'] as const).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setChartMetric(m)}
                                        className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${chartMetric === m
                                            ? 'bg-neutral-800 text-white shadow-sm'
                                            : 'text-neutral-500 hover:text-neutral-300'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 w-full min-h-0">
                            <DualWorkoutChart
                                workoutA={workoutA}
                                strokesA={statsA}
                                workoutB={workoutB}
                                strokesB={statsB}
                                metric={chartMetric}
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
    // End of component
};
export default WorkoutComparison;
