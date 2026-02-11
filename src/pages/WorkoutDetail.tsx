import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Activity, Zap, Wind, Clock, Timer, SplitSquareHorizontal, ExternalLink, Pencil, X, Save, AlertCircle, BookmarkPlus, BookmarkCheck, Link as LinkIcon, Search, Lightbulb, Check, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Label } from 'recharts';
import { workoutService } from '../services/workoutService';
import { PowerDistributionChart } from '../components/analytics/PowerDistributionChart';
import { TemplateEditor } from '../components/TemplateEditor';
import { fetchTemplateById } from '../services/templateService';
import { useAuth } from '../hooks/useAuth';
import { calculateWatts } from '../utils/prCalculator';
import { calculateCanonicalName, detectIntervalsFromStrokes } from '../utils/workoutNaming';
import { parseRWN } from '../utils/rwnParser';
import { structureToIntervals } from '../utils/structureAdapter';
import { calculateBucketsFromStrokes, ZONES } from '../utils/zones';
import { getMainBlockIndices, detectWarmupCooldown } from '../utils/workoutAnalysis';
import type { WarmupCooldownDetection } from '../utils/workoutAnalysis';
import { findBestMatchingTemplate } from '../utils/templateMatching';
import { supabase } from '../services/supabase';
import type { C2ResultDetail, C2Stroke, C2Interval, C2Split } from '../api/concept2.types';
import type { WorkoutTemplate, WorkoutStructure } from '../types/workoutStructure.types';
import { DEMO_WORKOUTS } from '../data/demoData';
import { getUserBaseline2kWatts } from '../utils/paceCalculator';
import { toast } from 'sonner';

export const WorkoutDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { profile, isGuest } = useAuth();
    const [detail, setDetail] = useState<C2ResultDetail | null>(null);
    const [dbId, setDbId] = useState<string | null>(null); // Database UUID
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

    // Template Creation State
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);
    const [linkedTemplate, setLinkedTemplate] = useState<WorkoutTemplate | null>(null);

    // Template Linking State
    const [showTemplateLinking, setShowTemplateLinking] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<Array<{
        id: string;
        name: string;
        rwn: string | null;
        workout_type: string;
        training_zone: string | null;
        workout_structure: WorkoutStructure | null;
        is_steady_state: boolean;
        is_interval: boolean;
        estimated_duration: number | null;
        distance: number | null;
    }>>([]);
    const [templateSearch, setTemplateSearch] = useState('');
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Template Suggestion State
    const [suggestedTemplates, setSuggestedTemplates] = useState<Array<{
        id: string;
        name: string;
        rwn: string | null;
        usage_count: number;
        user_attempts: number;
    }>>([]);
    const [suggestionDismissed, setSuggestionDismissed] = useState(false);
    const [linkingTemplateId, setLinkingTemplateId] = useState<string | null>(null);

    // Warmup/Cooldown Detection State
    const [warmupDetection, setWarmupDetection] = useState<WarmupCooldownDetection | null>(null);
    const [warmupDismissed, setWarmupDismissed] = useState(false);
    const [applyingWarmup, setApplyingWarmup] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            try {
                if (isGuest) {
                    const mockDetail = DEMO_WORKOUTS.find(w => w.id === id || w.external_id === id) as C2ResultDetail | undefined;
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
                    // Fetch the database record to get the UUID
                    const { data: dbRecord } = await supabase
                        .from('workout_logs')
                        .select('id')
                        .eq('external_id', id)
                        .single();

                    if (dbRecord) {
                        setDbId(dbRecord.id);
                    }

                    // Fetch detail and strokes from Supabase via workoutService
                    const [detailData, strokeData, bucketsData] = await Promise.all([
                        workoutService.getWorkoutDetail(id),
                        workoutService.getStrokes(id),
                        workoutService.getPowerBuckets(id)
                    ]);
                    setDetail(detailData);
                    setStrokes(strokeData);
                    setBuckets(bucketsData);
                    if (detailData.manual_rwn) setManualRWN(detailData.manual_rwn);
                    if (detailData.is_benchmark) setIsBenchmark(true);

                    // Fetch linked template if present
                    if (detailData.template_id) {
                        try {
                            const template = await fetchTemplateById(detailData.template_id);
                            setLinkedTemplate(template);
                        } catch (err) {
                            console.error('Failed to fetch template:', err);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch details from DB', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, isGuest]);

    // Fetch Template Suggestions based on canonical name
    useEffect(() => {
        const fetchSuggestions = async () => {
            // Only suggest if no linked template and we have a canonical name
            if (linkedTemplate || !detail || isGuest || !profile?.user_id) return;
            
            // Calculate the canonical name for matching
            let matchName = '';
            if (detail.manual_rwn) {
                const parsed = parseRWN(detail.manual_rwn);
                if (parsed) {
                    matchName = calculateCanonicalName(structureToIntervals(parsed));
                }
            } else if (detail.workout?.intervals && detail.workout.intervals.length > 0) {
                matchName = calculateCanonicalName(detail.workout.intervals);
            }
            
            if (!matchName || matchName === 'Workout') return;
            
            try {
                // Find templates that match this canonical name
                const { data: templates, error } = await supabase
                    .from('workout_templates')
                    .select('id, name, rwn, usage_count')
                    .eq('canonical_name', matchName)
                    .eq('workout_type', 'erg')
                    .order('usage_count', { ascending: false })
                    .limit(3);
                
                if (error) throw error;
                if (!templates || templates.length === 0) return;
                
                // Get user's attempt count for each template
                const templatesWithAttempts = await Promise.all(
                    templates.map(async (t) => {
                        const { count } = await supabase
                            .from('workout_logs')
                            .select('*', { count: 'exact', head: true })
                            .eq('template_id', t.id)
                            .eq('user_id', profile.user_id);
                        
                        return {
                            ...t,
                            user_attempts: count || 0
                        };
                    })
                );
                
                setSuggestedTemplates(templatesWithAttempts);
            } catch (err) {
                console.error('Failed to fetch template suggestions:', err);
            }
        };
        
        fetchSuggestions();
    }, [detail, linkedTemplate, isGuest, profile?.user_id]);

    // Warmup/Cooldown Detection — runs when no template suggestions found
    useEffect(() => {
        if (linkedTemplate || isGuest || !detail || !profile?.user_id) return;
        // Only run if no template suggestions were found
        if (suggestedTemplates.length > 0) return;
        // Need raw intervals to detect
        if (!detail.workout?.intervals || detail.workout.intervals.length < 3) return;
        // Don't detect if user already set a manual RWN (they've already handled it)
        if (detail.manual_rwn) return;
        
        const detection = detectWarmupCooldown(detail.workout.intervals);
        if (!detection.detected) return;
        
        // Verify the main block's canonical name matches an existing template
        const checkForMatch = async () => {
            try {
                const match = await findBestMatchingTemplate(profile.user_id, detection.mainCanonicalName);
                if (match) {
                    // There IS a template for the main work — show the prompt
                    setWarmupDetection(detection);
                } else {
                    // No template exists for the main work either — don't prompt
                    // (user would need to create a template first)
                    setWarmupDetection(null);
                }
            } catch (err) {
                console.error('Failed to check warmup detection match:', err);
            }
        };
        
        checkForMatch();
    }, [detail, linkedTemplate, isGuest, profile?.user_id, suggestedTemplates]);

    // Fetch Baseline Watts from Profile
    useEffect(() => {
        const fetchBaseline = async () => {
            if (isGuest) {
                setBaselineWatts(202);
                return;
            }

            if (!profile?.user_id) return;

            const bWatts = await getUserBaseline2kWatts(profile.user_id, supabase);
            setBaselineWatts(bWatts);
        };

        fetchBaseline();
    }, [profile?.user_id, isGuest]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        let visibleStrokes: C2Stroke[] = [];
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
            workIntervals: [],
            sessionPaceFormatted: '-' // New field for session totals
        };

        const totalSeconds = (detail.time / 10);

        // Session Totals (Includes Warmup/Cooldown)
        const totalDistance = detail.distance + (detail.rest_distance || 0);
        const sessionPaceSeconds = detail.distance ? (totalSeconds * 500) / detail.distance : 0;
        const sessionPaceMins = Math.floor(sessionPaceSeconds / 60);
        const sessionPaceSecs = (sessionPaceSeconds % 60).toFixed(1);
        const sessionPaceFormatted = detail.distance ? `${sessionPaceMins}:${sessionPaceSecs.padStart(4, '0')}` : '-';

        // Work Block Analysis
        // 1. Resolve Structure
        let structure: WorkoutStructure | null = null;
        // Check linked template first (if available), then manual RWN override
        // Actually manual_rwn might be on the detail even if not "editing"
        if (detail.manual_rwn) {
            structure = parseRWN(detail.manual_rwn);
        } else if (linkedTemplate?.workout_structure) {
            structure = linkedTemplate.workout_structure;
        }

        // 2. Identify Main Intervals
        const mainIndices = structure ? getMainBlockIndices(structure) : null;

        // 3. Filter C2 Intervals
        const allIntervals = detail.workout?.intervals || [];
        const validIntervals = allIntervals.filter((i: C2Interval) => i.type !== 'rest'); // C2 sometimes includes explicit rest rows

        let workIntervals = validIntervals;
        if (mainIndices && mainIndices.length > 0) {
            // Safety: Only filter if lengths roughly align or if we are confident
            // If mainIndices asks for index 5 but we only have 3 intervals, don't crash
            workIntervals = validIntervals.filter((_, idx) => mainIndices.includes(idx));
        }

        // 4. Calculate Work Metrics
        const isInterval = !!detail.workout?.intervals;

        // Work Distance (exclude Rest segments from total distance?)
        // If we filtered for mainIndices, we sum those. 
        // If no intervals (Single Distance), workDistance = totalDistance usually
        const workDistance = workIntervals.length > 0
            ? workIntervals.reduce((sum: number, i: C2Interval) => sum + i.distance, 0)
            : detail.distance; // Fallback for single piece

        const workTime = workIntervals.length > 0
            ? workIntervals.reduce((sum: number, i: C2Interval) => sum + i.time, 0) / 10
            : totalSeconds;

        const restTime = totalSeconds - workTime;

        // Calculate Average Pace for WORK ONLY
        const avgPaceSeconds = workDistance ? (workTime * 500) / workDistance : 0;
        const avgPaceMins = Math.floor(avgPaceSeconds / 60);
        const avgPaceSecs = (avgPaceSeconds % 60).toFixed(1);
        const avgPaceFormatted = workDistance ? `${avgPaceMins}:${avgPaceSecs.padStart(4, '0')}` : '-';

        return {
            avgPaceFormatted,
            workDistance,
            workTime,
            totalDistance,
            restTime,
            isInterval,
            workIntervals,
            sessionPaceFormatted
        };
    }, [detail, linkedTemplate]); // Added linkedTemplate dependency

    const { avgPaceFormatted, workDistance, workTime, totalDistance, restTime, isInterval, workIntervals, sessionPaceFormatted } = stats;

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
                            <button onClick={() => setIsEditing(false)} className="text-neutral-400 hover:text-white" title="Close" aria-label="Close edit dialog">
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
                                            } catch {
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
                                    const current = manualRWN.trim();
                                    if (newState) {
                                        if (!current.includes('#test')) {
                                            setManualRWN(current ? `${current} #test` : '#test');
                                        }
                                    } else {
                                        setManualRWN(current.replace(/\s*#test/gi, '').trim());
                                    }
                                }}
                                className={`relative w-11 h-6 rounded-full transition-colors ${isBenchmark ? 'bg-yellow-500' : 'bg-neutral-700'}`}
                                title={isBenchmark ? 'Mark as non-benchmark' : 'Mark as benchmark'}
                                aria-label={isBenchmark ? 'Toggle off benchmark status' : 'Toggle on benchmark status'}
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

            {/* Linked Template Display */}
            {linkedTemplate && (
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <BookmarkCheck size={18} className="text-blue-400" />
                                <h3 className="text-sm font-semibold text-blue-400">Linked Template</h3>
                            </div>
                            <p className="text-white font-medium mb-1">{linkedTemplate.name}</p>
                            {linkedTemplate.description && (
                                <p className="text-neutral-400 text-sm">{linkedTemplate.description}</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowTemplateEditor(true)}
                                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                            >
                                View Template
                            </button>
                            <button
                                onClick={async () => {
                                    if (window.confirm('Unlink this template from the workout?')) {
                                        try {
                                            if (!dbId) {
                                                toast.error('Database ID not available');
                                                return;
                                            }
                                            await workoutService.linkWorkoutToTemplate(dbId, null);
                                            setLinkedTemplate(null);
                                            if (detail) {
                                                setDetail({ ...detail, template_id: null });
                                            }
                                        } catch (err) {
                                            console.error('Failed to unlink template:', err);
                                            toast.error('Failed to unlink template');
                                        }
                                    }
                                }}
                                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                            >
                                Unlink
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Suggestion Banner */}
            {!linkedTemplate && suggestedTemplates.length > 0 && !suggestionDismissed && (
                <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={18} className="text-amber-400" />
                                <h3 className="text-sm font-semibold text-amber-400">Template Match Found</h3>
                            </div>
                            <p className="text-white font-medium mb-1">
                                This workout matches: <span className="text-amber-300">{suggestedTemplates[0].name}</span>
                            </p>
                            <p className="text-neutral-400 text-sm">
                                Used by {suggestedTemplates[0].usage_count || 0} athletes
                                {suggestedTemplates[0].user_attempts > 0 && (
                                    <> • You've done this {suggestedTemplates[0].user_attempts} time{suggestedTemplates[0].user_attempts > 1 ? 's' : ''}</>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2 items-start">
                            <button
                                onClick={async () => {
                                    if (!dbId) {
                                        toast.error('Database ID not available');
                                        return;
                                    }
                                    const templateId = suggestedTemplates[0].id;
                                    setLinkingTemplateId(templateId);
                                    try {
                                        await workoutService.linkWorkoutToTemplate(dbId, templateId);
                                        const template = await fetchTemplateById(templateId);
                                        setLinkedTemplate(template);
                                        setDetail(prev => prev ? ({ ...prev, template_id: templateId }) : null);
                                        setSuggestedTemplates([]);
                                    } catch (err) {
                                        console.error('Failed to link template:', err);
                                        toast.error('Failed to link template');
                                    } finally {
                                        setLinkingTemplateId(null);
                                    }
                                }}
                                disabled={linkingTemplateId === suggestedTemplates[0].id}
                                className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 hover:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {linkingTemplateId === suggestedTemplates[0].id ? (
                                    <><Loader2 size={14} className="animate-spin" /> Linking...</>
                                ) : (
                                    <><Check size={14} /> Link to This Template</>
                                )}
                            </button>
                            {suggestedTemplates.length > 1 && (
                                <button
                                    onClick={() => {
                                        setShowTemplateLinking(true);
                                        // Pre-populate with suggestions
                                        setAvailableTemplates(suggestedTemplates.map(t => ({
                                            id: t.id,
                                            name: t.name,
                                            rwn: t.rwn,
                                            workout_type: 'erg',
                                            training_zone: null,
                                            workout_structure: null,
                                            is_steady_state: false,
                                            is_interval: true,
                                            estimated_duration: null,
                                            distance: null
                                        })));
                                    }}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                                >
                                    See {suggestedTemplates.length - 1} More
                                </button>
                            )}
                            <button
                                onClick={() => setSuggestionDismissed(true)}
                                className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                                aria-label="Dismiss suggestion"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warmup/Cooldown Detection Banner */}
            {!linkedTemplate && suggestedTemplates.length === 0 && warmupDetection?.detected && !warmupDismissed && !suggestionDismissed && (
                <div className="bg-violet-600/10 border border-violet-500/30 rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={18} className="text-violet-400" />
                                <h3 className="text-sm font-semibold text-violet-400">Did this include a warmup or cooldown?</h3>
                            </div>
                            <p className="text-white font-medium mb-2">
                                This looks like it could be: <span className="text-violet-300">{warmupDetection.description}</span>
                            </p>
                            <p className="text-neutral-400 text-sm mb-3">
                                The main workout <span className="text-white font-medium">{warmupDetection.mainCanonicalName}</span> matches an existing template.
                                {warmupDetection.warmupIndices.length > 0 && warmupDetection.cooldownIndices.length > 0
                                    ? ' We\'ll tag the first segment as warmup and last as cooldown.'
                                    : warmupDetection.warmupIndices.length > 0
                                        ? ' We\'ll tag the first segment as warmup.'
                                        : ' We\'ll tag the last segment as cooldown.'
                                }
                            </p>
                            <div className="flex items-center gap-2 p-2 bg-neutral-900/50 rounded-lg border border-neutral-800 mb-1">
                                <code className="text-sm text-violet-300 font-mono">{warmupDetection.suggestedRWN}</code>
                            </div>
                        </div>
                        <div className="flex gap-2 items-start">
                            <button
                                onClick={async () => {
                                    if (!dbId || !detail || !profile?.user_id) {
                                        toast.error('Unable to apply — missing data');
                                        return;
                                    }
                                    setApplyingWarmup(true);
                                    try {
                                        // 1. Save the suggested RWN as manual_rwn
                                        await workoutService.updateWorkoutName(detail.id.toString(), {
                                            manualRWN: warmupDetection.suggestedRWN,
                                            isBenchmark: detail.is_benchmark || false
                                        });
                                        
                                        // 2. Update local state
                                        setDetail(prev => prev ? ({
                                            ...prev,
                                            manual_rwn: warmupDetection.suggestedRWN
                                        }) : null);
                                        setManualRWN(warmupDetection.suggestedRWN);
                                        
                                        // 3. Try to match the main canonical name to a template
                                        const match = await findBestMatchingTemplate(
                                            profile.user_id,
                                            warmupDetection.mainCanonicalName
                                        );
                                        
                                        if (match) {
                                            // 4. Link to the matched template
                                            await workoutService.linkWorkoutToTemplate(dbId, match.id);
                                            const template = await fetchTemplateById(match.id);
                                            setLinkedTemplate(template);
                                            setDetail(prev => prev ? ({ ...prev, template_id: match.id }) : null);
                                        }
                                        
                                        // 5. Clear the detection banner
                                        setWarmupDetection(null);
                                    } catch (err) {
                                        console.error('Failed to apply warmup/cooldown:', err);
                                        toast.error('Failed to apply — please try again');
                                    } finally {
                                        setApplyingWarmup(false);
                                    }
                                }}
                                disabled={applyingWarmup}
                                className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 hover:text-violet-300 border border-violet-500/30 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {applyingWarmup ? (
                                    <><Loader2 size={14} className="animate-spin" /> Applying...</>
                                ) : (
                                    <><Check size={14} /> Yes, Apply This</>
                                )}
                            </button>
                            <button
                                onClick={() => setWarmupDismissed(true)}
                                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                            >
                                No, Keep As-Is
                            </button>
                            <button
                                onClick={() => setWarmupDismissed(true)}
                                className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                                aria-label="Dismiss warmup detection"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-end">
                {!linkedTemplate && (
                    <>
                        <button
                            onClick={() => setShowTemplateEditor(true)}
                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <BookmarkPlus size={16} />
                            Create Template
                        </button>
                        <button
                            onClick={async () => {
                                setShowTemplateLinking(true);
                                setLoadingTemplates(true);
                                try {
                                    // Fetch templates with RWN for display
                                    const { data, error } = await supabase
                                        .from('workout_templates')
                                        .select('id, name, rwn, workout_type, training_zone, workout_structure, is_steady_state, is_interval, estimated_duration, distance')
                                        .eq('workout_type', 'erg')
                                        .order('name', { ascending: true });

                                    if (error) throw error;
                                    setAvailableTemplates(data || []);
                                } catch (err) {
                                    console.error('Failed to load templates:', err);
                                } finally {
                                    setLoadingTemplates(false);
                                }
                            }}
                            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded-xl transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <LinkIcon size={16} />
                            Link to Template
                        </button>
                    </>
                )}
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
                        {
                            label: 'Work Pace',
                            value: avgPaceFormatted,
                            unit: '/500m',
                            icon: <Wind size={18} />,
                            color: 'text-blue-400',
                            subtext: isInterval ? 'Main set average' : 'Clean average'
                        },
                        {
                            label: 'Session Pace',
                            value: sessionPaceFormatted,
                            unit: '/500m',
                            icon: <Timer size={18} />,
                            color: 'text-neutral-400',
                            subtext: 'Includes w/up & cool'
                        },
                        {
                            label: 'Avg Watts',
                            // If no watt data, calculate from work pace (avgPaceFormatted). 
                            // Note: avgPaceFormatted is string "M:SS.d". Need seconds.
                            value: detail.watts || (workTime && workDistance ? Math.round(calculateWatts((workTime * 500) / workDistance)) : '-'),
                            unit: 'w',
                            icon: <Zap size={18} />,
                            color: 'text-yellow-400',
                            subtext: 'Based on work set'
                        },
                        { label: 'Stroke Rate', value: detail.stroke_rate, unit: 'spm', icon: <Activity size={18} />, color: 'text-emerald-400' },
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
                                    {/* Training Zone Thresholds */}
                                    {baselineWatts && ZONES.slice(0, 4).map((zone) => {
                                        // Draw line at the TOP of the zone
                                        const thresholdWatts = Math.round(baselineWatts * zone.maxPct);
                                        const nextZone = ZONES.find(z => z.minPct === zone.maxPct);
                                        const label = nextZone ? nextZone.id : 'Max';

                                        return (
                                            <ReferenceLine
                                                key={zone.id}
                                                yAxisId="left"
                                                y={thresholdWatts}
                                                stroke={nextZone?.color || zone.color}
                                                strokeDasharray="3 3"
                                                strokeOpacity={0.5}
                                            >
                                                <Label
                                                    value={label}
                                                    position="insideTopRight"
                                                    fill={nextZone?.color || zone.color}
                                                    fontSize={10}
                                                    offset={10}
                                                />
                                            </ReferenceLine>
                                        );
                                    })}
                                    <YAxis yAxisId="left" stroke="#8884d8" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#a3a3a3' }} domain={[0, 'auto']} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#a3a3a3' }} domain={[0, 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                                        labelStyle={{ color: '#a3a3a3', fontSize: '12px', marginBottom: '4px' }}
                                        formatter={(value: number | string | undefined, name: string | undefined) => [
                                            name === 'watts' && typeof value === 'number' ? value.toFixed(1) : value ?? '',
                                            (name ?? '').toString().toUpperCase()
                                        ]}
                                        labelFormatter={(val) => `${val.toFixed(0)}m`}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Line yAxisId="left" type="monotone" dataKey="watts" stroke="#818cf8" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Watts" />
                                    <Line yAxisId="right" type="monotone" dataKey="hr" stroke="#fb7185" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="HR" />
                                    {/* SPM hidden from chart/legend but kept for tooltip (bound to left axis to avoid distorting HR scale) */}
                                    <Line yAxisId="left" type="monotone" dataKey="spm" stroke="none" dot={false} activeDot={false} legendType="none" name="SPM" />
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

            {/* Template Editor Modal */}
            {showTemplateEditor && detail && (
                <TemplateEditor
                    templateId={linkedTemplate?.id || null}
                    onClose={async (saved, templateId) => {
                        setShowTemplateEditor(false);
                        if (saved && templateId && dbId && !linkedTemplate) {
                            // Only auto-link if creating a NEW template (not editing existing)
                            try {
                                // Link the workout to the newly created template
                                await workoutService.linkWorkoutToTemplate(dbId, templateId);

                                // Fetch and display the linked template
                                const template = await fetchTemplateById(templateId);
                                setLinkedTemplate(template);

                                // Update the detail to reflect the link
                                if (detail) {
                                    setDetail({ ...detail, template_id: templateId });
                                }

                                console.log('Template created and linked successfully!');
                            } catch (err) {
                                console.error('Failed to link workout to template:', err);
                                toast.error('Template created but failed to link to this workout');
                            }
                        } else if (saved && linkedTemplate) {
                            // If editing existing template, just refresh the template data
                            try {
                                const template = await fetchTemplateById(linkedTemplate.id);
                                setLinkedTemplate(template);
                            } catch (err) {
                                console.error('Failed to refresh template:', err);
                            }
                        }
                    }}
                    initialData={!linkedTemplate ? {
                        rwnInput: detail.manual_rwn || detail.workout_name || '',
                        name: detail.workout_name || '',
                        description: `Created from workout on ${new Date(detail.date).toLocaleDateString()}`,
                        is_test: detail.is_benchmark || false,
                        workout_type: 'erg'
                    } : undefined}
                />
            )}

            {/* Template Linking Modal */}
            {showTemplateLinking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                            <h2 className="text-lg font-semibold text-white">Link to Template</h2>
                            <button
                                onClick={() => setShowTemplateLinking(false)}
                                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                                aria-label="Close template linking"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-neutral-800">
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    value={templateSearch}
                                    onChange={(e) => setTemplateSearch(e.target.value)}
                                    placeholder="Search templates..."
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Template List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loadingTemplates ? (
                                <div className="text-center py-8 text-neutral-400">
                                    Loading templates...
                                </div>
                            ) : availableTemplates.filter(t =>
                                !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())
                            ).length === 0 ? (
                                <div className="text-center py-8 text-neutral-400">
                                    {templateSearch ? 'No templates found matching your search' : 'No templates available'}
                                </div>
                            ) : (
                                availableTemplates
                                    .filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                    .map((template) => {
                                        // Determine structure type for visual indication
                                        const structureType = template.is_steady_state
                                            ? 'Steady State'
                                            : template.is_interval
                                                ? 'Interval'
                                                : template.workout_structure
                                                    ? 'Variable'
                                                    : 'Unknown';

                                        // Format distance/duration if available
                                        const workoutInfo = template.distance
                                            ? `${template.distance}m`
                                            : template.estimated_duration
                                                ? `${Math.floor(template.estimated_duration / 60)}min`
                                                : '';

                                        return (
                                            <button
                                                key={template.id}
                                                onClick={async () => {
                                                    if (!dbId) {
                                                        toast.error('Database ID not available');
                                                        return;
                                                    }
                                                    try {
                                                        await workoutService.linkWorkoutToTemplate(dbId, template.id);
                                                        const fullTemplate = await fetchTemplateById(template.id);
                                                        setLinkedTemplate(fullTemplate);
                                                        if (detail) {
                                                            setDetail({ ...detail, template_id: template.id });
                                                        }
                                                        setShowTemplateLinking(false);
                                                        console.log('Template linked successfully!');
                                                    } catch (err) {
                                                        console.error('Failed to link template:', err);
                                                        toast.error('Failed to link template');
                                                    }
                                                }}
                                                className="w-full text-left bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg p-4 transition-colors group"
                                            >
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors mb-1">
                                                            {template.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {template.training_zone && (
                                                                <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                                                                    {template.training_zone}
                                                                </span>
                                                            )}
                                                            <span className="text-xs bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded">
                                                                {structureType}
                                                            </span>
                                                            {workoutInfo && (
                                                                <span className="text-xs text-neutral-400">
                                                                    {workoutInfo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <LinkIcon size={18} className="text-neutral-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                                                </div>
                                                {/* RWN Display */}
                                                {template.rwn && (
                                                    <div className="mt-2 pt-2 border-t border-neutral-700/50">
                                                        <code className="text-xs text-neutral-400 font-mono break-all">
                                                            {template.rwn}
                                                        </code>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
