import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Edit, Users, TrendingUp, Calendar, ChevronDown, ChevronUp, Clock, Target, Lightbulb, Compass, Trophy, ArrowRight, Library, ShieldCheck, GitBranchPlus, Copy, Check, Code2 } from 'lucide-react';
import { fetchPublicTemplateDetail, getTemplateHistory, getTemplatePersonalBest, promoteTemplateToStandard } from '../services/templateService';
import type { PersonalBest, TemplateHistoryItem } from '../services/templateService';
import { supabase } from '../services/supabase';
import type { PublicWorkoutTemplateDetail } from '../types/workoutStructure.types';
import { Badge, Breadcrumb, Button, Card, CardHeader, EmptyState } from '../components/ui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDuration, estimateDuration } from '../utils/rwnParser';
import { structureToRWN } from '../utils/structureToRWN';
import { structureToWhiteboard } from '../utils/structureToWhiteboard';
import { useAuth } from '../hooks/useAuth';
import { WorkoutVisualizer } from '../components/WorkoutVisualizer';
import { TemplateEditor } from '../components/TemplateEditor';
import { extractPaceTargets, calculateActualPace, getUserBaseline2kWatts } from '../utils/paceCalculator';
import { toast } from 'sonner';

export const TemplateDetail: React.FC = () => {
    const { templateId } = useParams<{ templateId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAdmin } = useAuth();

    const [template, setTemplate] = useState<PublicWorkoutTemplateDetail | null>(null);
    const [loading, setLoading] = useState(true);
    // const [starting, setStarting] = useState(false);
    const [showJson, setShowJson] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [copiedField, setCopiedField] = useState<'whiteboard' | 'rwn' | 'json' | null>(null);
    const [promoting, setPromoting] = useState(false);
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
                const data = await fetchPublicTemplateDetail(templateId);
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
        navigate(`/library/${templateId}`);
        if (saved) {
            // Reload template to show updates
            if (templateId) {
                fetchPublicTemplateDetail(templateId).then(data => setTemplate(data));
            }
        }
    };

    const handlePromoteToStandard = async () => {
        if (!template || template.tier !== 'community') return;

        setPromoting(true);
        try {
            const updated = await promoteTemplateToStandard(template.id);
            if (!updated) {
                throw new Error('Failed to promote template.');
            }

            const refreshed = await fetchPublicTemplateDetail(template.id);
            setTemplate(refreshed);
            toast.success('Workout promoted to the standard library.');
        } catch (error) {
            console.error('Failed to promote template to standard:', error);
            toast.error('Failed to promote workout. Please try again.');
        } finally {
            setPromoting(false);
        }
    };

    const handleCopy = async (field: 'whiteboard' | 'rwn' | 'json', value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(field);
            toast.success(`${label} copied to clipboard.`);
            window.setTimeout(() => {
                setCopiedField(current => (current === field ? null : current));
            }, 1500);
        } catch (error) {
            console.error(`Failed to copy ${label.toLowerCase()}:`, error);
            toast.error(`Failed to copy ${label.toLowerCase()}.`);
        }
    };

    if (loading) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <EmptyState
                    title="Loading workout"
                    description="Pulling the library workout detail now."
                />
            </div>
        );
    }

    if (!template) {
        return (
            <div className="p-6 max-w-5xl mx-auto">
                <EmptyState
                    title="Workout not found"
                    description="That library workout could not be loaded."
                />
            </div>
        );
    }

    // Calculate duration estimate if we have structure
    const estimate = template.workout_structure
        ? estimateDuration(structureToRWN(template.workout_structure))
        : null;
    const canEdit = !!user && (isAdmin || user.id === template.created_by);
    const templateTier = template.tier === 'draft'
        ? { label: 'Draft', variant: 'muted' as const, icon: <Library size={14} /> }
        : template.tier === 'standard'
            ? { label: 'Standard Library', variant: 'success' as const, icon: <ShieldCheck size={14} /> }
            : { label: 'Community Library', variant: 'info' as const, icon: <GitBranchPlus size={14} /> };
    const whiteboardLines = template.whiteboard_lines?.length
        ? template.whiteboard_lines
        : template.workout_structure
            ? structureToWhiteboard(template.workout_structure)
            : template.rwn
                ? [template.rwn]
                : [];
    const structuredDataJson = template.workout_structure ? JSON.stringify(template.workout_structure, null, 2) : '';
    const chartStroke = 'var(--color-border-default)';
    const chartText = 'var(--color-text-muted)';
    const tooltipStyles = {
        backgroundColor: 'var(--color-surface-elevated)',
        borderColor: 'var(--color-border-default)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <Breadcrumb items={[
                    { label: 'Workout Library', to: '/library' },
                    { label: template.name },
                ]} className="mb-4" />

                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-content-primary mb-2">{template.name}</h1>
                        <p className="text-content-secondary text-lg">{template.description}</p>

                        <div className="flex flex-wrap items-center gap-4 mt-4">
                            <Badge variant={templateTier.variant} className="inline-flex items-center gap-1 px-3 py-1 text-sm">
                                {templateTier.icon}
                                {templateTier.label}
                            </Badge>
                            {template.training_zone && (
                                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                                    template.training_zone === 'UT2' ? 'bg-blue-500/15 text-blue-500' :
                                        template.training_zone === 'UT1' ? 'bg-cyan-500/15 text-cyan-500' :
                                            template.training_zone === 'AT' ? 'bg-amber-500/15 text-amber-500' :
                                                template.training_zone === 'TR' ? 'bg-orange-500/15 text-orange-500' :
                                                    'bg-red-500/15 text-red-500'
                                }`}>
                                    {template.training_zone}
                                </span>
                            )}
                            {template.difficulty_level && (
                                <span className="text-content-secondary text-sm capitalize">
                                    Difficulty: <span className="text-content-primary font-medium">{template.difficulty_level}</span>
                                </span>
                            )}
                            {estimate && estimate.totalTime > 0 && (
                                <span className="text-content-secondary text-sm">
                                    Est. Time: <span className="text-content-primary font-medium">{formatDuration(estimate.totalTime)}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {isAdmin && template.tier === 'community' && (
                            <Button
                                variant="primary"
                                icon={<ShieldCheck size={18} />}
                                loading={promoting}
                                onClick={handlePromoteToStandard}
                            >
                                Make standard
                            </Button>
                        )}
                        {canEdit && (
                            <Button
                                variant="secondary"
                                icon={<Edit size={18} />}
                                onClick={() => navigate(`/library/${template.id}/edit`)}
                            >
                                Edit
                            </Button>
                        )}
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
            <div className="grid gap-4 mb-8 md:grid-cols-2 xl:grid-cols-3">
                {/* Estimated Duration - Now More Prominent */}
                {estimate && estimate.totalTime > 0 && (
                    <Card className="bg-accent-primary-surface border-emerald-500/25">
                        <div className="flex items-center gap-3 text-emerald-500 mb-2">
                            <Clock size={20} />
                            <span className="text-sm font-medium">Est. Duration</span>
                        </div>
                        <div className="text-3xl font-bold text-content-primary">{formatDuration(estimate.totalTime)}</div>
                        {estimate.workDistance > 0 && (
                            <div className="text-sm text-emerald-600 mt-1">{estimate.workDistance}m distance</div>
                        )}
                    </Card>
                )}

                <Card>
                    <div className="flex items-center gap-3 text-content-muted mb-2">
                        <Users size={20} />
                        <span className="text-sm">Times Used</span>
                    </div>
                    <div className="text-3xl font-bold text-content-primary">{template.usage_count || 0}</div>
                </Card>

                <Card>
                    <div className="flex items-center gap-3 text-content-muted mb-2">
                        <TrendingUp size={20} />
                        <span className="text-sm">Plan Slots</span>
                    </div>
                    <div className="text-3xl font-bold text-content-primary">
                        {template.reference_stats.planWorkoutCount}
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center gap-3 text-content-muted mb-2">
                        <Calendar size={20} />
                        <span className="text-sm">Last Used</span>
                    </div>
                    <div className="text-xl font-bold text-content-primary">
                        {template.last_used_at
                            ? new Date(template.last_used_at).toLocaleDateString()
                            : 'Never'
                        }
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center gap-3 text-content-muted mb-2">
                        <Library size={20} />
                        <span className="text-sm">Team Assignments</span>
                    </div>
                    <div className="text-3xl font-bold text-content-primary">{template.reference_stats.groupAssignmentCount}</div>
                </Card>

                <Card>
                    <div className="flex items-center gap-3 text-content-muted mb-2">
                        <Calendar size={20} />
                        <span className="text-sm">Daily Assignments</span>
                    </div>
                    <div className="text-3xl font-bold text-content-primary">{template.reference_stats.dailyAssignmentCount}</div>
                </Card>
            </div>

            {/* Performance Trend */}
            {history.length > 1 && (
                <Card className="mb-8">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp size={20} className="text-emerald-400" />
                        <h2 className="text-xl font-bold text-content-primary">Performance Trend</h2>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartStroke} vertical={false} />
                                <XAxis
                                    dataKey="completed_at"
                                    stroke={chartText}
                                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    stroke={chartText}
                                    domain={['auto', 'auto']}
                                    tick={{ fontSize: 12 }}
                                    unit="w"
                                />
                                <Tooltip
                                    contentStyle={tooltipStyles}
                                    formatter={(value: number | string | undefined) => [`${Math.round(Number(value ?? 0))}w`, 'Power']}
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
                </Card>
            )}

            {/* Personal Best Card - Prominent Display */}
            {personalBest && (
                <Card onClick={() => navigate(`/workouts/${personalBest.id}`)} className="mb-8 cursor-pointer border-amber-500/25 bg-amber-500/10 transition-colors duration-150 hover:border-amber-500/50 group">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <div className="text-amber-700 dark:text-amber-200 font-bold text-lg">Personal Best</div>
                                <div className="text-amber-700/80 dark:text-amber-400 text-sm">
                                    Achieved on {new Date(personalBest.completed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="text-amber-600 group-hover:text-amber-500 transition-colors" size={24} />
                    </div>

                    <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-content-primary">{Math.round(personalBest.watts || 0)}</span>
                        <span className="text-amber-700/80 dark:text-amber-400 font-medium">watts</span>
                    </div>

                    {/* Show split if available */}
                    {personalBest.duration_seconds > 0 && personalBest.distance_meters > 0 && (
                        <div className="mt-2 text-sm text-content-secondary">
                            Split: <span className="text-content-primary font-mono">
                                {formatDuration(500 * personalBest.duration_seconds / personalBest.distance_meters)}
                            </span>
                        </div>
                    )}
                </Card>
            )}

            {/* Workout Details */}
            {template.workout_structure && (
                <>
                    <div className="grid gap-4 mb-8 xl:grid-cols-[1.35fr,1fr]">
                        <div className="space-y-4">
                            <Card>
                                <CardHeader
                                    title="Coach Whiteboard"
                                    subtitle="The fastest public read of the workout, formatted the way a coach would brief it."
                                    action={whiteboardLines.length > 0 ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            icon={copiedField === 'whiteboard' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                            onClick={() => handleCopy('whiteboard', whiteboardLines.join('\n'), 'Whiteboard view')}
                                        >
                                            {copiedField === 'whiteboard' ? 'Copied' : 'Copy'}
                                        </Button>
                                    ) : undefined}
                                />
                                {whiteboardLines.length > 0 ? (
                                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 font-mono text-sm text-amber-950 dark:text-amber-50">
                                        {whiteboardLines.map((line, index) => (
                                            <div key={`${line}-${index}`} className="whitespace-pre-wrap leading-7">
                                                {line}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border bg-surface-well px-4 py-4 text-sm text-content-secondary">
                                        No separate whiteboard layout was generated, so the canonical RWN below is acting as the coach-facing brief.
                                    </div>
                                )}
                            </Card>

                            {template.rwn && (
                                <Card>
                                    <CardHeader
                                        title="RWN"
                                        subtitle="Canonical Rowing Workout Notation for copying, sharing, and round-tripping back into structure."
                                        action={(
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                icon={copiedField === 'rwn' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                                onClick={() => handleCopy('rwn', template.rwn ?? '', 'RWN')}
                                            >
                                                {copiedField === 'rwn' ? 'Copied' : 'Copy'}
                                            </Button>
                                        )}
                                    />
                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
                                        <div className="text-content-muted text-xs font-medium mb-2 uppercase tracking-wide">
                                            Rowing Workout Notation
                                        </div>
                                        <div className="text-emerald-700 dark:text-emerald-300 font-mono text-sm break-words">
                                            {template.rwn}
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>

                        <Card>
                            <div className="flex items-start justify-between gap-3 mb-4">
                                <div>
                                    <div className="flex items-center gap-2 text-cyan-500 mb-2">
                                        <Code2 size={18} />
                                        <span className="text-sm font-semibold uppercase tracking-wide">Structured data</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-content-primary">AI-ready workout shape</h2>
                                    <p className="text-sm text-content-secondary mt-1">
                                        Public machines should consume the structure, whiteboard view, and RWN together rather than infer meaning from raw text alone.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    icon={copiedField === 'json' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    onClick={() => handleCopy('json', structuredDataJson, 'Workout JSON')}
                                >
                                    {copiedField === 'json' ? 'Copied' : 'Copy JSON'}
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="rounded-lg border border-border bg-surface-well p-3">
                                    <div className="text-xs uppercase tracking-wide text-content-muted mb-1">Tier</div>
                                    <div className="text-sm font-semibold text-content-primary">{templateTier.label}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-well p-3">
                                    <div className="text-xs uppercase tracking-wide text-content-muted mb-1">Uses</div>
                                    <div className="text-sm font-semibold text-content-primary">{template.usage_count || 0}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-well p-3">
                                    <div className="text-xs uppercase tracking-wide text-content-muted mb-1">Plans</div>
                                    <div className="text-sm font-semibold text-content-primary">{template.reference_stats.planWorkoutCount}</div>
                                </div>
                                <div className="rounded-lg border border-border bg-surface-well p-3">
                                    <div className="text-xs uppercase tracking-wide text-content-muted mb-1">Assignments</div>
                                    <div className="text-sm font-semibold text-content-primary">
                                        {template.reference_stats.groupAssignmentCount + template.reference_stats.dailyAssignmentCount}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-surface-well p-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowJson(!showJson)}
                                    className="w-full justify-between px-0 py-0 text-content-secondary hover:text-content-primary"
                                >
                                    <span className="text-sm font-medium">
                                        {showJson ? 'Hide' : 'Show'} machine-readable JSON
                                    </span>
                                    {showJson ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </Button>
                                {showJson && (
                                    <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-page p-4 font-mono text-sm text-content-secondary">
                                        <pre>{structuredDataJson}</pre>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    <Card className="mb-8">
                        <h2 className="text-xl font-bold text-content-primary mb-2">Workout Visualizer</h2>
                        <p className="text-sm text-content-secondary mb-6">
                            Visual block-by-block breakdown of the same workout structure shown above in whiteboard and RWN form.
                        </p>
                        <WorkoutVisualizer structure={template.workout_structure} />
                    </Card>
                </>
            )}

            {/* Pacing & Technique Guidance */}
            {(template.pacing_guidance || Object.keys(personalizedPaces).length > 0 || (template.coaching_points && template.coaching_points.length > 0) || (template.technique_focus && template.technique_focus.length > 0)) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                    {/* Pacing Guidance */}
                    {(template.pacing_guidance || Object.keys(personalizedPaces).length > 0) && (
                        <Card>
                            <div className="flex items-center gap-2 mb-4">
                                <Target size={20} className="text-emerald-400" />
                                <h2 className="text-lg font-bold text-content-primary">Pacing Guidance</h2>
                            </div>
                            {template.pacing_guidance && (
                                <p className="text-content-secondary leading-relaxed mb-4">{template.pacing_guidance}</p>
                            )}
                            {Object.keys(personalizedPaces).length > 0 && (
                                <div className="space-y-3 mt-4 pt-4 border-t border-border">
                                    <div className="text-sm font-medium text-content-secondary mb-2">Your Target Paces:</div>
                                    {Object.entries(personalizedPaces).map(([target, pace]) => (
                                        <div key={target} className="flex items-center justify-between bg-surface-well rounded-lg p-3">
                                            <span className="text-content-secondary text-sm font-mono">{target}</span>
                                            <span className="text-emerald-400 font-bold font-mono">{pace.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Technique Focus */}
                    {template.technique_focus && template.technique_focus.length > 0 && (
                        <Card>
                            <div className="flex items-center gap-2 mb-4">
                                <Compass size={20} className="text-blue-400" />
                                <h2 className="text-lg font-bold text-content-primary">Technique Focus</h2>
                            </div>
                            <ul className="space-y-2">
                                {template.technique_focus.map((focus, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-content-secondary">
                                        <span className="text-blue-400 mt-1">•</span>
                                        <span>{focus}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            )}

            {/* Coaching Points */}
            {template.coaching_points && template.coaching_points.length > 0 && (
                <Card className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb size={20} className="text-yellow-400" />
                        <h2 className="text-lg font-bold text-content-primary">Coaching Points</h2>
                    </div>
                    <ul className="space-y-3">
                        {template.coaching_points.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-500 mt-0.5">
                                    {idx + 1}
                                </div>
                                <span className="text-content-secondary leading-relaxed">{point}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
                <Card>
                    <h2 className="text-xl font-bold text-content-primary mb-4">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {template.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-surface-well text-content-secondary rounded-full text-sm">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </Card>
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
