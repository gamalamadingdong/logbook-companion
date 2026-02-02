import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Eye } from 'lucide-react';
import { fetchTemplateById, updateTemplate, createTemplate } from '../services/templateService';
import type { WorkoutTemplate, WorkoutStructure, IntervalStep, WorkoutStep, RestStep } from '../types/workoutStructure.types';
import { structureToIntervals } from '../utils/structureAdapter';
import { calculateCanonicalName } from '../utils/prCalculator';

interface TemplateEditorProps {
    templateId: string | null; // null = new template
    onClose: (saved: boolean) => void;
}

const TRAINING_ZONES = ['UT2', 'UT1', 'AT', 'TR', 'AN'] as const;

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ templateId, onClose }) => {
    const [loading, setLoading] = useState(!!templateId);
    const [saving, setSaving] = useState(false);
    const [template, setTemplate] = useState<Partial<WorkoutTemplate>>({
        name: '',
        description: '',
        workout_type: 'erg',
        training_zone: null,
        workout_structure: null
    });

    // Structure builder state
    const [structureType, setStructureType] = useState<'none' | 'steady_state' | 'interval' | 'variable'>('none');
    const [steadyValue, setSteadyValue] = useState(5000);
    const [steadyUnit, setSteadyUnit] = useState<'meters' | 'seconds' | 'calories'>('meters');
    const [steadyTargetRate, setSteadyTargetRate] = useState<number | undefined>(undefined);
    const [steadyTargetPace, setSteadyTargetPace] = useState<string | undefined>(undefined);
    const [intervalRepeats, setIntervalRepeats] = useState(5);
    const [workType, setWorkType] = useState<'distance' | 'time' | 'calories'>('distance');
    const [workValue, setWorkValue] = useState(500);
    const [workTargetRate, setWorkTargetRate] = useState<number | undefined>(undefined);
    const [workTargetPace, setWorkTargetPace] = useState<string | undefined>(undefined);
    const [restValue, setRestValue] = useState(60); // Rest is always time (seconds)
    const [variableSteps, setVariableSteps] = useState<WorkoutStep[]>([]);

    useEffect(() => {
        if (templateId) {
            loadTemplate();
        }
    }, [templateId]);

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
                        setSteadyTargetPace(struct.target_pace);
                    } else if (struct.type === 'interval') {
                        setIntervalRepeats(struct.repeats);
                        setWorkType(struct.work.type);
                        setWorkValue(struct.work.value);
                        setWorkTargetRate(struct.work.target_rate);
                        setWorkTargetPace(struct.work.target_pace);
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

    const buildStructure = (): WorkoutStructure | null => {
        if (structureType === 'none') return null;

        if (structureType === 'steady_state') {
            return {
                type: 'steady_state',
                value: steadyValue,
                unit: steadyUnit,
                ...(steadyTargetRate && { target_rate: steadyTargetRate }),
                ...(steadyTargetPace && { target_pace: steadyTargetPace })
            };
        }

        if (structureType === 'interval') {
            const workStep: IntervalStep = {
                type: workType,
                value: workValue,
                ...(workTargetRate && { target_rate: workTargetRate }),
                ...(workTargetPace && { target_pace: workTargetPace })
            };
            const restStep: RestStep = { type: 'time', value: restValue };
            return {
                type: 'interval',
                repeats: intervalRepeats,
                work: workStep,
                rest: restStep
            };
        }

        if (structureType === 'variable' && variableSteps.length > 0) {
            return { type: 'variable', steps: variableSteps };
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
            const updates = {
                name: template.name,
                description: template.description || '',
                workout_type: template.workout_type || 'erg',
                training_zone: template.training_zone,
                workout_structure: structure
            };

            if (templateId) {
                await updateTemplate(templateId, updates);
            } else {
                await createTemplate(updates as any);
            }
            onClose(true);
        } catch (err) {
            console.error('Failed to save template:', err);
            alert('Failed to save template');
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
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                    <h2 className="text-lg font-semibold text-white">
                        {templateId ? 'Edit Template' : 'New Template'}
                    </h2>
                    <button
                        onClick={() => onClose(false)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
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
                            {/* Basic Info */}
                            <div className="space-y-4">
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
                                        onChange={e => setTemplate({ ...template, training_zone: e.target.value as any || null })}
                                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">No zone specified</option>
                                        {TRAINING_ZONES.map(zone => (
                                            <option key={zone} value={zone}>{zone}</option>
                                        ))}
                                    </select>
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
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-xs text-neutral-500 mb-1">Unit</label>
                                                <select
                                                    value={steadyUnit}
                                                    onChange={e => setSteadyUnit(e.target.value as any)}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white"
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
                                                    />
                                                    <select
                                                        value={workType}
                                                        onChange={e => setWorkType(e.target.value as any)}
                                                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
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
                                                    />
                                                    <select
                                                        value={step.duration_type}
                                                        onChange={e => updateVariableStep(idx, { duration_type: e.target.value as any })}
                                                        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-white text-sm"
                                                        disabled={step.type === 'rest'} // Rest is always time
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
                                                        onClick={() => removeVariableStep(idx)}
                                                        className="p-1 text-red-400 hover:bg-red-900/30 rounded ml-auto"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => addVariableStep('work')}
                                                className="flex-1 py-1.5 bg-emerald-900/30 text-emerald-400 rounded text-sm hover:bg-emerald-900/50"
                                            >
                                                + Work
                                            </button>
                                            <button
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
