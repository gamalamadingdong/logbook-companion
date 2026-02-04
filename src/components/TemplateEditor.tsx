import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Eye, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchTemplateById, updateTemplate, createTemplate, findDuplicateTemplate } from '../services/templateService';
import type { WorkoutTemplate, WorkoutStructure, IntervalStep, WorkoutStep, RestStep } from '../types/workoutStructure.types';
import { structureToIntervals } from '../utils/structureAdapter';
import { calculateCanonicalName } from '../utils/workoutNaming';
import { parseRWN, validateRWN, estimateDuration, formatDuration } from '../utils/rwnParser';
import { structureToRWN } from '../utils/structureToRWN';

interface TemplateEditorProps {
    templateId: string | null; // null = new template
    onClose: (saved: boolean, templateId?: string) => void;
    initialData?: {
        rwnInput?: string;
        name?: string;
        description?: string;
        is_test?: boolean;
        workout_type?: 'erg' | 'on_water';
    };
}

const TRAINING_ZONES = ['UT2', 'UT1', 'AT', 'TR', 'AN'] as const;

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ templateId, onClose, initialData }) => {
    const [loading, setLoading] = useState(!!templateId);
    const [saving, setSaving] = useState(false);
    const [template, setTemplate] = useState<Partial<WorkoutTemplate>>({
        name: initialData?.name || '',
        description: initialData?.description || '',
        workout_type: initialData?.workout_type || 'erg',
        training_zone: null,
        workout_structure: null,
        is_test: initialData?.is_test || false,
        pacing_guidance: null,
        coaching_points: null,
        technique_focus: null
    });

    // Structure builder state
    const [structureType, setStructureType] = useState<'none' | 'steady_state' | 'interval' | 'variable'>('none');
    const [steadyValue, setSteadyValue] = useState(5000);
    const [steadyUnit, setSteadyUnit] = useState<'meters' | 'seconds' | 'calories'>('meters');
    const [steadyTargetRate, setSteadyTargetRate] = useState<number | undefined>(undefined);
    const [steadyTargetRateMax, setSteadyTargetRateMax] = useState<number | undefined>(undefined);
    const [steadyTargetPace, setSteadyTargetPace] = useState<string | undefined>(undefined);
    const [steadyTargetPaceMax, setSteadyTargetPaceMax] = useState<string | undefined>(undefined);
    const [intervalRepeats, setIntervalRepeats] = useState(5);
    const [workType, setWorkType] = useState<'distance' | 'time' | 'calories'>('distance');
    const [workValue, setWorkValue] = useState(500);
    const [workTargetRate, setWorkTargetRate] = useState<number | undefined>(undefined);
    const [workTargetRateMax, setWorkTargetRateMax] = useState<number | undefined>(undefined);
    const [workTargetPace, setWorkTargetPace] = useState<string | undefined>(undefined);
    const [workTargetPaceMax, setWorkTargetPaceMax] = useState<string | undefined>(undefined);
    const [restValue, setRestValue] = useState(60); // Rest is always time (seconds)
    const [variableSteps, setVariableSteps] = useState<WorkoutStep[]>([]);

    // Quick Create State
    const [rwnInput, setRwnInput] = useState('');
    const [rwnError, setRwnError] = useState<string | null>(null);
    const [rwnValidation, setRwnValidation] = useState<{
        valid: boolean;
        errors: string[];
        warnings?: string[];
        workDistance?: number;
        workTime?: number;
        restTime?: number;
        totalTime?: number;
        paceUsed?: string;
        requiresBaseline?: boolean;
    } | null>(null);

    // Auto-update RWN when structure is manually changed via UI controls
    useEffect(() => {
        // Skip if user is actively typing in RWN field or if no structure selected
        if (structureType === 'none') return;

        let structure: WorkoutStructure | null = null;

        if (structureType === 'steady_state') {
            structure = {
                type: 'steady_state',
                value: steadyValue,
                unit: steadyUnit,
                ...(steadyTargetRate && { target_rate: steadyTargetRate }),
                ...(steadyTargetRateMax && { target_rate_max: steadyTargetRateMax }),
                ...(steadyTargetPace && { target_pace: steadyTargetPace }),
                ...(steadyTargetPaceMax && { target_pace_max: steadyTargetPaceMax }),
                tags: template.is_test ? ['test'] : []
            };
        } else if (structureType === 'interval') {
            const workStep: IntervalStep = {
                type: workType,
                value: workValue,
                ...(workTargetRate && { target_rate: workTargetRate }),
                ...(workTargetRateMax && { target_rate_max: workTargetRateMax }),
                ...(workTargetPace && { target_pace: workTargetPace }),
                ...(workTargetPaceMax && { target_pace_max: workTargetPaceMax })
            };
            const restStep: RestStep = { type: 'time', value: restValue };
            structure = {
                type: 'interval',
                repeats: intervalRepeats,
                work: workStep,
                rest: restStep,
                tags: template.is_test ? ['test'] : []
            };
        } else if (structureType === 'variable' && variableSteps.length > 0) {
            structure = { type: 'variable', steps: variableSteps, tags: template.is_test ? ['test'] : [] };
        }

        if (!structure) return;

        // Generate RWN from current structure
        const generatedRWN = structureToRWN(structure);
        
        // Only update if different and not empty
        if (generatedRWN && generatedRWN !== rwnInput) {
            setRwnInput(generatedRWN);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        structureType,
        steadyValue, steadyUnit, steadyTargetRate, steadyTargetRateMax, steadyTargetPace, steadyTargetPaceMax,
        intervalRepeats, workType, workValue, workTargetRate, workTargetRateMax, workTargetPace, workTargetPaceMax, restValue,
        variableSteps,
        template.is_test
    ]);

    // Validate RWN as user types
    useEffect(() => {
        if (!rwnInput.trim()) {
            setRwnValidation(null);
            return;
        }

        const validation = validateRWN(rwnInput);
        const estimate = estimateDuration(rwnInput);

        setRwnValidation({
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            workDistance: estimate?.workDistance,
            workTime: estimate?.workTime,
            restTime: estimate?.restTime,
            totalTime: estimate?.totalTime,
            paceUsed: estimate?.paceUsed,
            requiresBaseline: estimate?.requiresBaseline
        });
    }, [rwnInput]);

    const handleQuickCreate = () => {
        setRwnError(null);
        
        if (rwnValidation && !rwnValidation.valid) {
            setRwnError(rwnValidation.errors.join('; '));
            return;
        }

        const structure = parseRWN(rwnInput);

        if (!structure) {
            setRwnError("Could not parse workout. Check syntax (e.g., '4x500m/1:00r').");
            return;
        }

        // Populate State
        setStructureType(structure.type);

        // Check for tags
        if (structure.tags?.includes('test')) {
            setTemplate(prev => ({ ...prev, is_test: true }));
        }

        if (structure.type === 'steady_state') {
            setSteadyValue(structure.value);
            setSteadyUnit(structure.unit);
            setSteadyTargetRate(structure.target_rate);
            setSteadyTargetRateMax(structure.target_rate_max);
            setSteadyTargetPace(structure.target_pace);
            setSteadyTargetPaceMax(structure.target_pace_max);
        } else if (structure.type === 'interval') {
            setIntervalRepeats(structure.repeats);
            setWorkType(structure.work.type);
            setWorkValue(structure.work.value);
            setWorkTargetRate(structure.work.target_rate);
            setWorkTargetRateMax(structure.work.target_rate_max);
            setWorkTargetPace(structure.work.target_pace);
            setWorkTargetPaceMax(structure.work.target_pace_max);
            setRestValue(structure.rest.value);
        } else if (structure.type === 'variable') {
            setVariableSteps(structure.steps);
        }

        // Auto-fill name if empty
        if (!template.name) {
            setTemplate(prev => ({ ...prev, name: rwnInput }));
        }
    };

    useEffect(() => {
        const loadTemplate = async () => {
            if (!templateId) return;
            setLoading(true);
            try {
                const data = await fetchTemplateById(templateId);
                if (data) {
                    setTemplate(data);
                    // Initialize structure builder from existing structure
                    if (data.workout_structure) {
                        const struct = data.workout_structure;
                        setStructureType(struct.type);
                        if (struct.type === 'steady_state') {
                            setSteadyValue(struct.value);
                            setSteadyUnit(struct.unit);
                            setSteadyTargetRate(struct.target_rate);
                            setSteadyTargetRateMax(struct.target_rate_max);
                            setSteadyTargetPace(struct.target_pace);
                            setSteadyTargetPaceMax(struct.target_pace_max);
                        } else if (struct.type === 'interval') {
                            setIntervalRepeats(struct.repeats);
                            setWorkType(struct.work.type);
                            setWorkValue(struct.work.value);
                            setWorkTargetRate(struct.work.target_rate);
                            setWorkTargetRateMax(struct.work.target_rate_max);
                            setWorkTargetPace(struct.work.target_pace);
                            setWorkTargetPaceMax(struct.work.target_pace_max);
                            setRestValue(struct.rest.value);
                        } else if (struct.type === 'variable') {
                            setVariableSteps(struct.steps);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load template:', err);
            } finally {
                setLoading(false);
            }
        };

        if (templateId) {
            loadTemplate();
        } else if (initialData?.rwnInput) {
            // Auto-populate from initialData when creating new template
            setRwnInput(initialData.rwnInput);
            // Trigger quick create to parse the RWN
            setTimeout(() => {
                const structure = parseRWN(initialData.rwnInput!);
                if (structure) {
                    setStructureType(structure.type);
                    if (structure.tags?.includes('test')) {
                        setTemplate(prev => ({ ...prev, is_test: true }));
                    }
                    if (structure.type === 'steady_state') {
                        setSteadyValue(structure.value);
                        setSteadyUnit(structure.unit);
                        setSteadyTargetRate(structure.target_rate);
                        setSteadyTargetRateMax(structure.target_rate_max);
                        setSteadyTargetPace(structure.target_pace);
                        setSteadyTargetPaceMax(structure.target_pace_max);
                    } else if (structure.type === 'interval') {
                        setIntervalRepeats(structure.repeats);
                        setWorkType(structure.work.type);
                        setWorkValue(structure.work.value);
                        setWorkTargetRate(structure.work.target_rate);
                        setWorkTargetRateMax(structure.work.target_rate_max);
                        setWorkTargetPace(structure.work.target_pace);
                        setWorkTargetPaceMax(structure.work.target_pace_max);
                        setRestValue(structure.rest.value);
                    } else if (structure.type === 'variable') {
                        setVariableSteps(structure.steps);
                    }
                }
            }, 100);
        }
    }, [templateId, initialData]);

    const buildStructure = (): WorkoutStructure | null => {
        if (structureType === 'none') return null;

        if (structureType === 'steady_state') {
            return {
                type: 'steady_state',
                value: steadyValue,
                unit: steadyUnit,
                ...(steadyTargetRate && { target_rate: steadyTargetRate }),
                ...(steadyTargetRateMax && { target_rate_max: steadyTargetRateMax }),
                ...(steadyTargetPace && { target_pace: steadyTargetPace }),
                ...(steadyTargetPaceMax && { target_pace_max: steadyTargetPaceMax }),
                tags: template.is_test ? ['test'] : []
            };
        }

        if (structureType === 'interval') {
            const workStep: IntervalStep = {
                type: workType,
                value: workValue,
                ...(workTargetRate && { target_rate: workTargetRate }),
                ...(workTargetRateMax && { target_rate_max: workTargetRateMax }),
                ...(workTargetPace && { target_pace: workTargetPace }),
                ...(workTargetPaceMax && { target_pace_max: workTargetPaceMax })
            };
            const restStep: RestStep = { type: 'time', value: restValue };
            return {
                type: 'interval',
                repeats: intervalRepeats,
                work: workStep,
                rest: restStep,
                tags: template.is_test ? ['test'] : []
            };
        }

        if (structureType === 'variable' && variableSteps.length > 0) {
            return { type: 'variable', steps: variableSteps, tags: template.is_test ? ['test'] : [] };
        }

        return null;
    };

    const generateCanonicalName = (): string => {
        const struct = buildStructure();
        if (!struct) return '—';

        // Use the real canonical name calculator via the adapter
        const intervals = structureToIntervals(struct);
        if (intervals.length === 0) return '—';

        return calculateCanonicalName(intervals);
    };

    const handleSave = async () => {
        if (!template.name?.trim()) {
            alert('Please enter a template name');
            return;
        }

        setSaving(true);
        try {
            const structure = buildStructure();
            
            // Check for duplicate structure before saving
            if (structure) {
                const duplicate = await findDuplicateTemplate(structure, templateId || undefined);
                if (duplicate) {
                    setSaving(false);
                    
                    const confirmSave = window.confirm(
                        `A template with identical structure already exists:\n\n` +
                        `"${duplicate.name}"\n\n` +
                        `Do you want to create a duplicate template anyway?`
                    );
                    
                    if (!confirmSave) {
                        return;
                    }
                    setSaving(true);
                }
            }
            
            const updates = {
                name: template.name,
                description: template.description || '',
                workout_type: template.workout_type || 'erg',
                training_zone: template.training_zone,
                workout_structure: structure,
                rwn: rwnInput.trim() || null,
                is_test: template.is_test || false,
                pacing_guidance: template.pacing_guidance || null,
                coaching_points: template.coaching_points || null,
                technique_focus: template.technique_focus || null
            };

            let savedTemplateId: string;
            if (templateId) {
                await updateTemplate(templateId, updates);
                savedTemplateId = templateId;
            } else {
                const newTemplate = await createTemplate(updates);
                savedTemplateId = newTemplate.id;
            }
            onClose(true, savedTemplateId);
        } catch (err) {
            console.error('Failed to save template:', err);
            // Show the actual error message
            const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
            alert(`Failed to save template: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    const addVariableStep = (type: 'work' | 'rest') => {
        setVariableSteps([...variableSteps, {
            type,
            duration_type: type === 'work' ? 'distance' : 'time',
            value: type === 'work' ? 500 : 60
        }]);
    };

    const updateVariableStep = (index: number, updates: Partial<WorkoutStep>) => {
        const newSteps = [...variableSteps];
        newSteps[index] = { ...newSteps[index], ...updates };
        setVariableSteps(newSteps);
    };

    const removeVariableStep = (index: number) => {
        setVariableSteps(variableSteps.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                    <h2 className="text-lg font-semibold text-white">
                        {templateId ? 'Edit Template' : 'New Template'}
                    </h2>
                    <button
                        type="button"
                        onClick={() => onClose(false)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                        title="Close"
                        aria-label="Close editor"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-neutral-500" size={32} />
                        </div>
                    ) : (
                        <>
                            {/* Duplicate Detection Notice */}
                            {!templateId && (
                                <div className="bg-blue-900/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <strong className="font-semibold">Duplicate Detection Active:</strong> If an identical workout structure already exists, you'll be prompted before creating a duplicate.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Basic Info */}
                            <div className="space-y-4">
                                {/* Quick Create Section */}
                                <div className="bg-gradient-to-r from-emerald-900/10 to-transparent p-4 rounded-lg border border-emerald-900/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-emerald-500 uppercase tracking-wide">
                                            ⚡ Quick Create from RWN
                                        </label>
                                        <a
                                            href="/docs"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-emerald-600 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                                            title="View Rowing Workout Notation Spec"
                                        >
                                            <HelpCircle size={12} />
                                            Syntax Guide
                                        </a>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={rwnInput}
                                            onChange={e => setRwnInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleQuickCreate()}
                                            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
                                            placeholder="e.g. 30:00, 4x500m/1:00r, 2k+1k"
                                        />
                                        <button
                                            onClick={handleQuickCreate}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                    {rwnError && (
                                        <div className="flex items-start gap-2 mt-2 text-xs text-red-400">
                                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                            <span>{rwnError}</span>
                                        </div>
                                    )}
                                    {rwnValidation && rwnValidation.valid && (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex items-center gap-2 text-xs text-emerald-400">
                                                <CheckCircle size={14} />
                                                <span>Valid RWN</span>
                                            </div>
                                            {rwnValidation.workDistance !== undefined && !isNaN(rwnValidation.workDistance) && (
                                                <div className="text-xs text-neutral-400 ml-5">
                                                    🏃 Work: {rwnValidation.workDistance}m
                                                    {rwnValidation.workTime !== undefined && (
                                                        <> ({formatDuration(rwnValidation.workTime)}
                                                        {rwnValidation.paceUsed && <> @ {rwnValidation.paceUsed}/500m</>})
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {rwnValidation.requiresBaseline && (
                                                <div className="flex items-start gap-2 text-xs text-yellow-400 ml-5">
                                                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                                    <span>Uses training zones - duration estimate requires baseline tests</span>
                                                </div>
                                            )}
                                            {rwnValidation.restTime !== undefined && rwnValidation.restTime > 0 && (
                                                <div className="text-xs text-neutral-400 ml-5">
                                                    ⏸️ Rest: {formatDuration(rwnValidation.restTime)}
                                                </div>
                                            )}
                                            {rwnValidation.totalTime !== undefined && !rwnValidation.requiresBaseline && (
                                                <div className="text-xs text-neutral-400 ml-5">
                                                    ⚡ Total: {formatDuration(rwnValidation.totalTime)}
                                                </div>
                                            )}
                                            {rwnValidation.warnings && rwnValidation.warnings.length > 0 && (
                                                <div className="flex items-start gap-2 text-xs text-yellow-400 ml-5">
                                                    <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                                                    <span>{rwnValidation.warnings.join('; ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={template.name || ''}
                                        onChange={e => setTemplate({ ...template, name: e.target.value })}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        placeholder="e.g., 5x500m with 1:00 rest"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Description</label>
                                    <textarea
                                        value={template.description || ''}
                                        onChange={e => setTemplate({ ...template, description: e.target.value })}
                                        rows={3}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none"
                                        placeholder="Describe the workout purpose and execution..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Training Zone</label>
                                    <select
                                        value={template.training_zone || ''}
                                        onChange={e => setTemplate({ ...template, training_zone: (e.target.value || null) as WorkoutTemplate['training_zone'] })}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                        title="Training Zone"
                                        aria-label="Training Zone"
                                    >
                                        <option value="">No zone specified</option>
                                        {TRAINING_ZONES.map(zone => (
                                            <option key={zone} value={zone}>{zone}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setTemplate(prev => ({ ...prev, is_test: !prev.is_test }))}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${template.is_test ? 'bg-emerald-600' : 'bg-neutral-700'}`}
                                        title="Toggle benchmark/test"
                                        aria-label="Toggle benchmark/test"
                                    >
                                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${template.is_test ? 'translate-x-5' : ''}`} />
                                    </button>
                                    <span className="text-sm font-medium text-white">Mark as Benchmark / Test</span>
                                </div>
                            </div>

                            {/* Guidance & Coaching */}
                            <div className="border-t border-neutral-800 pt-6 space-y-4">
                                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide mb-4">
                                    Guidance & Coaching
                                </h3>
                                
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Pacing Guidance</label>
                                    <textarea
                                        value={template.pacing_guidance || ''}
                                        onChange={e => setTemplate({ ...template, pacing_guidance: e.target.value || null })}
                                        rows={3}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none"
                                        placeholder="e.g., Start at UT2 pace (2:10-2:15/500m), build to UT1 in final 10 minutes..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Technique Focus (one per line)</label>
                                    <textarea
                                        value={template.technique_focus?.join('\n') || ''}
                                        onChange={e => setTemplate({ 
                                            ...template, 
                                            technique_focus: e.target.value ? e.target.value.split('\n').filter(line => line.trim()) : null 
                                        })}
                                        rows={4}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none font-mono text-sm"
                                        placeholder="Body angle timing\nConnection at the catch\nRelaxed recovery\nQuick hands away"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">Coaching Points (one per line)</label>
                                    <textarea
                                        value={template.coaching_points?.join('\n') || ''}
                                        onChange={e => setTemplate({ 
                                            ...template, 
                                            coaching_points: e.target.value ? e.target.value.split('\n').filter(line => line.trim()) : null 
                                        })}
                                        rows={4}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 resize-none font-mono text-sm"
                                        placeholder="Focus on the drive sequence\nKeep shoulders relaxed\nQuick hands away at the finish\nMaintain controlled breathing rhythm"
                                    />
                                </div>
                            </div>

                            {/* Structure Builder */}
                            <div className="border-t border-neutral-800 pt-6">
                                <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide mb-4">
                                    Workout Structure
                                </h3>

                                {/* Type Selector */}
                                <div className="flex gap-2 mb-4">
                                    {(['none', 'steady_state', 'interval', 'variable'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setStructureType(type)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${structureType === type
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                                }`}
                                        >
                                            {type === 'none' ? 'None' :
                                                type === 'steady_state' ? 'Steady State' :
                                                    type === 'interval' ? 'Fixed Interval' : 'Variable'}
                                        </button>
                                    ))}
                                </div>

                                {/* Steady State Builder */}
                                {structureType === 'steady_state' && (
                                    <div className="bg-neutral-800/50 p-4 rounded-lg space-y-4">
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="block text-xs text-neutral-500 mb-1">Value</label>
                                                <input
                                                    type="number"
                                                    value={steadyValue}
                                                    onChange={e => setSteadyValue(parseInt(e.target.value) || 0)}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white"
                                                    placeholder="5000"
                                                    aria-label="Workout value"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-xs text-neutral-500 mb-1">Unit</label>
                                                <select
                                                    value={steadyUnit}
                                                    onChange={e => setSteadyUnit(e.target.value as 'meters' | 'seconds' | 'calories')}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white"
                                                    title="Unit"
                                                    aria-label="Unit"
                                                >
                                                    <option value="meters">Meters</option>
                                                    <option value="seconds">Seconds</option>
                                                    <option value="calories">Calories</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Guidance Fields */}
                                        <div className="flex gap-4">
                                            <div className="w-24">
                                                <label className="block text-xs text-neutral-500 mb-1">Target SPM</label>
                                                <input
                                                    type="number"
                                                    value={steadyTargetRate || ''}
                                                    onChange={e => setSteadyTargetRate(parseInt(e.target.value) || undefined)}
                                                    placeholder="e.g. 20"
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-neutral-500 mb-1">Target Pace</label>
                                                <input
                                                    type="text"
                                                    value={steadyTargetPace || ''}
                                                    onChange={e => setSteadyTargetPace(e.target.value || undefined)}
                                                    placeholder="e.g. 2:00 or sub-2:00"
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Interval Builder */}
                                {structureType === 'interval' && (
                                    <div className="bg-neutral-800/50 p-4 rounded-lg space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-24">
                                                <label className="block text-xs text-neutral-500 mb-1">Repeats</label>
                                                <input
                                                    type="number"
                                                    value={intervalRepeats}
                                                    onChange={e => setIntervalRepeats(parseInt(e.target.value) || 1)}
                                                    min={1}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white"
                                                    placeholder="4"
                                                    aria-label="Number of repeats"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Work */}
                                            <div className="bg-neutral-900/50 p-3 rounded-lg space-y-2">
                                                <div className="text-xs font-medium text-emerald-400 mb-2">WORK</div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={workValue}
                                                        onChange={e => setWorkValue(parseInt(e.target.value) || 0)}
                                                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
                                                        placeholder="500"
                                                        aria-label="Work value"
                                                    />
                                                    <select
                                                        value={workType}
                                                        onChange={e => setWorkType(e.target.value as 'distance' | 'time' | 'calories')}
                                                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
                                                        title="Work unit"
                                                        aria-label="Work unit"
                                                    >
                                                        <option value="distance">m</option>
                                                        <option value="time">sec</option>
                                                        <option value="calories">cal</option>
                                                    </select>
                                                </div>
                                                {/* Work Guidance */}
                                                <div className="flex gap-2 pt-1">
                                                    <input
                                                        type="number"
                                                        value={workTargetRate || ''}
                                                        onChange={e => setWorkTargetRate(parseInt(e.target.value) || undefined)}
                                                        placeholder="SPM"
                                                        className="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={workTargetPace || ''}
                                                        onChange={e => setWorkTargetPace(e.target.value || undefined)}
                                                        placeholder="Pace (2:00)"
                                                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-xs"
                                                    />
                                                </div>
                                            </div>
                                            {/* Rest - Time only */}
                                            <div className="bg-neutral-900/50 p-3 rounded-lg">
                                                <div className="text-xs font-medium text-amber-400 mb-2">REST (seconds)</div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={restValue}
                                                        onChange={e => setRestValue(parseInt(e.target.value) || 0)}
                                                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
                                                        placeholder="60"
                                                        aria-label="Rest duration in seconds"
                                                    />
                                                    <span className="text-neutral-500 text-sm self-center">sec</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Variable Builder */}
                                {structureType === 'variable' && (
                                    <div className="bg-neutral-800/50 p-4 rounded-lg space-y-3">
                                        {variableSteps.map((step, idx) => (
                                            <div key={idx} className={`p-2 rounded ${step.type === 'work' ? 'bg-emerald-900/30' : 'bg-amber-900/30'}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-medium w-12 ${step.type === 'work' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        {step.type.toUpperCase()}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        value={step.value}
                                                        onChange={e => updateVariableStep(idx, { value: parseInt(e.target.value) || 0 })}
                                                        className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
                                                        placeholder="500"
                                                        aria-label={`${step.type} value`}
                                                    />
                                                    <select
                                                        value={step.duration_type}
                                                        onChange={e => updateVariableStep(idx, { duration_type: e.target.value as 'distance' | 'time' | 'calories' })}
                                                        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
                                                        disabled={step.type === 'rest'} // Rest is always time
                                                        title="Duration type"
                                                        aria-label="Duration type"
                                                    >
                                                        <option value="distance">m</option>
                                                        <option value="time">sec</option>
                                                        {step.type === 'work' && <option value="calories">cal</option>}
                                                    </select>
                                                    {step.type === 'work' && (
                                                        <>
                                                            <input
                                                                type="number"
                                                                value={step.target_rate || ''}
                                                                onChange={e => updateVariableStep(idx, { target_rate: parseInt(e.target.value) || undefined })}
                                                                placeholder="SPM"
                                                                className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-white text-xs"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={step.target_pace || ''}
                                                                onChange={e => updateVariableStep(idx, { target_pace: e.target.value || undefined })}
                                                                placeholder="Pace"
                                                                className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-white text-xs"
                                                            />
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeVariableStep(idx)}
                                                        className="p-1 text-red-400 hover:bg-red-900/30 rounded ml-auto"
                                                        title="Remove step"
                                                        aria-label="Remove step"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => addVariableStep('work')}
                                                className="flex-1 py-1.5 bg-emerald-900/30 text-emerald-400 rounded text-sm hover:bg-emerald-900/50"
                                            >
                                                + Work
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => addVariableStep('rest')}
                                                className="flex-1 py-1.5 bg-amber-900/30 text-amber-400 rounded text-sm hover:bg-amber-900/50"
                                            >
                                                + Rest
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preview */}
                            {structureType !== 'none' && (
                                <div className="border-t border-neutral-800 pt-4">
                                    <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                                        <Eye size={14} /> Preview
                                    </h3>
                                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-emerald-400 font-mono text-lg mb-2">
                                            {generateCanonicalName()}
                                        </div>
                                        <pre className="text-xs text-neutral-500 overflow-x-auto">
                                            {JSON.stringify(buildStructure(), null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-neutral-800 bg-neutral-900/50">
                    <button
                        onClick={() => onClose(false)}
                        className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
