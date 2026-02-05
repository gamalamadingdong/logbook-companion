import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Edit, Users, TrendingUp, Calendar, ChevronDown, ChevronUp, Clock, Target, Lightbulb, Compass, Trophy, ArrowRight } from 'lucide-react';
import { fetchTemplateById, getTemplateHistory, getTemplatePersonalBest } from '../services/templateService';
import type { PersonalBest, TemplateHistoryItem } from '../services/templateService';
import { supabase } from '../services/supabase';
import type { WorkoutTemplate } from '../types/workoutStructure.types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDuration, estimateDuration } from '../utils/rwnParser';
import { useAuth } from '../hooks/useAuth';
import { WorkoutVisualizer } from '../components/WorkoutVisualizer';
import { TemplateEditor } from '../components/TemplateEditor';
import { extractPaceTargets, calculateActualPace, getUserBaseline2kWatts } from '../utils/paceCalculator';

export const TemplateDetail: React.FC = () => {
    const { templateId } = useParams<{ templateId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    // const [starting, setStarting] = useState(false);
    const [showJson, setShowJson] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [personalizedPaces, setPersonalizedPaces] = useState<Record<string, { split: number; label: string; isRange?: boolean; splitMax?: number }>>({});
    const [history, setHistory] = useState<TemplateHistoryItem[]>([]);
    const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);

    // Check if we're on the edit route
    useEffect(() => {
        setShowEditor(location.pathname.endsWith('/edit'));
    }, [location.pathname]);

    useEffect(() => {
        if (!templateId) return;

        const loadTemplate = async () => {
            setLoading(true);
            try {
                const data = await fetchTemplateById(templateId);
                setTemplate(data);

                // Fetch user baseline if logged in
                if (user?.id) {
                    // Load baseline
                    const baselineWatts = await getUserBaseline2kWatts(user.id, supabase);

                    // Load history
                    const historyData = await getTemplateHistory(templateId, user.id);
                    setHistory(historyData);

                    // Load Personal Best
                    const pbData = await getTemplatePersonalBest(templateId, user.id);
                    setPersonalBest(pbData);

                    // Calculate personalized paces for all targets in structure
                    if (data && data.workout_structure) {
                        const targets = extractPaceTargets(data.workout_structure);
                        const paces: Record<string, { split: number; label: string; isRange?: boolean; splitMax?: number }> = {};
                        targets.forEach(target => {
                            const pace = calculateActualPace(target, baselineWatts);
                            if (pace) paces[target] = pace;
                        });
                        setPersonalizedPaces(paces);
                    }
                }
            } catch (err) {
                console.error('Failed to load template:', err);
            } finally {
                setLoading(false);
            }
        };

        loadTemplate();
    }, [templateId, user?.id]);

    const handleEditorClose = (saved: boolean) => {
        setShowEditor(false);
        navigate(`/templates/${templateId}`);
        if (saved) {
            // Reload template to show updates
            if (templateId) {
                fetchTemplateById(templateId).then(data => setTemplate(data));
            }
        }
    };

    /*     const handleStartWorkout = async () => {
            if (!template || !user) return;
    
            setStarting(true);
            try {
                // Create a planned workout from this template
                const { data: workout, error } = await supabase
                    .from('workout_logs')
                    .insert({
                        user_id: user.id,
                        workout_name: template.name,
                        workout_type: template.workout_type,
                        status: 'planned',
                        planned_date: new Date().toISOString(),
                        template_id: templateId,
                        // Store the template structure for reference
                        notes: template.description
                    })
                    .select()
                    .single();
    
                if (error) throw error;
    
                // Navigate to workout detail page
                navigate(`/workouts/${workout.id}`);
            } catch (err) {
                console.error('Failed to start workout:', err);
                alert('Failed to start workout. Please try again.');
            } finally {
                setStarting(false);
            }
        }; */

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="text-center text-neutral-500 py-12">Loading template...</div>
            </div>
        );
    }

    if (!template) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <div className="text-center text-neutral-500 py-12">Template not found</div>
            </div>
        );
    }

    // Calculate duration estimate if we have structure
    const estimate = template.workout_structure
        ? estimateDuration(JSON.stringify(template.workout_structure))
        : null;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => navigate('/templates')}
                    className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
                >
                    <ArrowLeft size={18} />
                    Back to Templates
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-2">{template.name}</h1>
                        <p className="text-neutral-400 text-lg">{template.description}</p>

                        <div className="flex flex-wrap items-center gap-4 mt-4">
                            {template.training_zone && (
                                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${template.training_zone === 'UT2' ? 'bg-blue-900/50 text-blue-300' :
                                    template.training_zone === 'UT1' ? 'bg-cyan-900/50 text-cyan-300' :
                                        template.training_zone === 'AT' ? 'bg-yellow-900/50 text-yellow-300' :
                                            template.training_zone === 'TR' ? 'bg-orange-900/50 text-orange-300' :
                                                'bg-red-900/50 text-red-300'
                                    }`}>
                                    {template.training_zone}
                                </span>
                            )}
                            {template.difficulty_level && (
                                <span className="text-neutral-400 text-sm capitalize">
                                    Difficulty: <span className="text-white font-medium">{template.difficulty_level}</span>
                                </span>
                            )}
                            {estimate && estimate.totalTime > 0 && (
                                <span className="text-neutral-400 text-sm">
                                    Est. Time: <span className="text-white font-medium">{formatDuration(estimate.totalTime)}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate(`/templates/${template.id}/edit`)}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                        >
                            <Edit size={18} />
                            Edit
                        </button>
                        {/* <button
                            onClick={handleStartWorkout}
                            disabled={starting}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                            <Play size={18} />
                            {starting ? 'Starting...' : 'Do This Workout'}
                        </button> */}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {/* Estimated Duration - Now More Prominent */}
                {estimate && estimate.totalTime > 0 && (
                    <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border border-emerald-700/50 rounded-xl p-6">
                        <div className="flex items-center gap-3 text-emerald-400 mb-2">
                            <Clock size={20} />
                            <span className="text-sm font-medium">Est. Duration</span>
                        </div>
                        <div className="text-3xl font-bold text-white">{formatDuration(estimate.totalTime)}</div>
                        {estimate.workDistance > 0 && (
                            <div className="text-sm text-emerald-300 mt-1">{estimate.workDistance}m distance</div>
                        )}
                    </div>
                )}

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 text-neutral-400 mb-2">
                        <Users size={20} />
                        <span className="text-sm">Times Used</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{template.usage_count || 0}</div>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 text-neutral-400 mb-2">
                        <TrendingUp size={20} />
                        <span className="text-sm">Completion Rate</span>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {template.completion_rate ? `${Math.round(template.completion_rate * 100)}%` : '—'}
                    </div>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 text-neutral-400 mb-2">
                        <Calendar size={20} />
                        <span className="text-sm">Last Used</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                        {template.last_used_at
                            ? new Date(template.last_used_at).toLocaleDateString()
                            : 'Never'
                        }
                    </div>
                </div>
            </div>

            {/* Performance Trend */}
            {history.length > 1 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp size={20} className="text-emerald-400" />
                        <h2 className="text-xl font-bold text-white">Performance Trend</h2>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis
                                    dataKey="workout_date"
                                    stroke="#666"
                                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    stroke="#666"
                                    domain={['auto', 'auto']}
                                    tick={{ fontSize: 12 }}
                                    unit="w"
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#171717', borderColor: '#333', color: '#fff' }}
                                    formatter={(value: any) => [`${Math.round(value)}w`, 'Power']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="watts"
                                    name="Power"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ fill: '#10b981', r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Personal Best Card - Prominent Display */}
            {personalBest && (
                <div onClick={() => navigate(`/workouts/${personalBest.id}`)} className="bg-gradient-to-r from-amber-900/40 to-yellow-900/20 border border-amber-700/30 rounded-xl p-6 mb-8 cursor-pointer hover:border-amber-500/50 transition-colors group">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <div className="text-amber-200 font-bold text-lg">Personal Best</div>
                                <div className="text-amber-500/80 text-sm">
                                    Achieved on {new Date(personalBest.workout_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="text-amber-700 group-hover:text-amber-400 transition-colors" size={24} />
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">{Math.round(personalBest.watts || 0)}</span>
                        <span className="text-amber-500/80 font-medium">watts</span>
                    </div>

                    {/* Show split if available */}
                    {personalBest.time > 0 && personalBest.distance > 0 && (
                        <div className="mt-2 text-sm text-neutral-400">
                            Split: <span className="text-white font-mono">
                                {formatDuration(500 * (personalBest.time / 10) / personalBest.distance)}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Workout Details */}
            {template.workout_structure && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
                    <h2 className="text-xl font-bold text-white mb-6">Workout Structure</h2>

                    {/* Visual Workout Breakdown */}
                    <WorkoutVisualizer structure={template.workout_structure} />

                    {/* RWN Notation - Compact Reference */}
                    {template.rwn && (
                        <div className="mt-6 p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
                            <div className="text-neutral-400 text-xs font-medium mb-2 uppercase tracking-wide">
                                RWN (Rowing Workout Notation)
                            </div>
                            <div className="text-emerald-400 font-mono text-sm">
                                {template.rwn}
                            </div>
                        </div>
                    )}

                    {/* Collapsible JSON Structure */}
                    <div className="border-t border-neutral-800 pt-4 mt-6">
                        <button
                            onClick={() => setShowJson(!showJson)}
                            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors w-full"
                        >
                            {showJson ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            <span className="text-sm font-medium">
                                {showJson ? 'Hide' : 'Show'} Raw JSON Structure
                            </span>
                        </button>
                        {showJson && (
                            <div className="bg-neutral-950 rounded-lg p-4 font-mono text-sm text-neutral-300 mt-3 overflow-x-auto">
                                <pre>{JSON.stringify(template.workout_structure, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Pacing & Technique Guidance */}
            {(template.pacing_guidance || Object.keys(personalizedPaces).length > 0 || (template.coaching_points && template.coaching_points.length > 0) || (template.technique_focus && template.technique_focus.length > 0)) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                    {/* Pacing Guidance */}
                    {(template.pacing_guidance || Object.keys(personalizedPaces).length > 0) && (
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Target size={20} className="text-emerald-400" />
                                <h2 className="text-lg font-bold text-white">Pacing Guidance</h2>
                            </div>
                            {template.pacing_guidance && (
                                <p className="text-neutral-300 leading-relaxed mb-4">{template.pacing_guidance}</p>
                            )}
                            {Object.keys(personalizedPaces).length > 0 && (
                                <div className="space-y-3 mt-4 pt-4 border-t border-neutral-800">
                                    <div className="text-sm font-medium text-neutral-400 mb-2">Your Target Paces:</div>
                                    {Object.entries(personalizedPaces).map(([target, pace]) => (
                                        <div key={target} className="flex items-center justify-between bg-neutral-950/50 rounded-lg p-3">
                                            <span className="text-neutral-400 text-sm font-mono">{target}</span>
                                            <span className="text-emerald-400 font-bold font-mono">{pace.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Technique Focus */}
                    {template.technique_focus && template.technique_focus.length > 0 && (
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Compass size={20} className="text-blue-400" />
                                <h2 className="text-lg font-bold text-white">Technique Focus</h2>
                            </div>
                            <ul className="space-y-2">
                                {template.technique_focus.map((focus, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-neutral-300">
                                        <span className="text-blue-400 mt-1">•</span>
                                        <span>{focus}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Coaching Points */}
            {template.coaching_points && template.coaching_points.length > 0 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb size={20} className="text-yellow-400" />
                        <h2 className="text-lg font-bold text-white">Coaching Points</h2>
                    </div>
                    <ul className="space-y-3">
                        {template.coaching_points.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-900/30 border border-yellow-600/30 flex items-center justify-center text-xs font-bold text-yellow-400 mt-0.5">
                                    {idx + 1}
                                </div>
                                <span className="text-neutral-300 leading-relaxed">{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {template.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full text-sm">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor Modal */}
            {showEditor && templateId && (
                <TemplateEditor
                    templateId={templateId}
                    onClose={handleEditorClose}
                />
            )}
        </div>
    );
};
