import React from 'react';
import { Activity, Timer, Target, Zap, Coffee, Award } from 'lucide-react';
import type { WorkoutStructure, WorkoutStep } from '../types/workoutStructure.types';

interface WorkoutVisualizerProps {
    structure: WorkoutStructure;
}

const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:00`;
};

const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
        const km = meters / 1000;
        return km % 1 === 0 ? `${km}k` : `${km.toFixed(1)}k`;
    }
    return `${meters}m`;
};

const getTagIcon = (tag: string) => {
    switch (tag) {
        case 'warmup': return <Zap size={14} className="text-yellow-400" />;
        case 'cooldown': return <Coffee size={14} className="text-blue-400" />;
        case 'test': return <Award size={14} className="text-red-400" />;
        default: return null;
    }
};

const getTagColor = (tag: string): string => {
    switch (tag) {
        case 'warmup': return 'border-yellow-600/30 bg-yellow-900/20';
        case 'cooldown': return 'border-blue-600/30 bg-blue-900/20';
        case 'test': return 'border-red-600/30 bg-red-900/20';
        default: return 'border-neutral-700 bg-neutral-800/30';
    }
};

const WorkStep: React.FC<{ 
    step: WorkoutStep; 
    index: number;
    isRepeating?: boolean;
}> = ({ step, index, isRepeating }) => {
    const isWork = step.type === 'work';
    const hasTag = step.tags && step.tags.length > 0;
    const tag = hasTag ? step.tags![0] : null;
    
    // Format value based on duration type
    let valueDisplay = '';
    if (step.duration_type === 'distance') {
        valueDisplay = formatDistance(step.value);
    } else if (step.duration_type === 'time') {
        valueDisplay = formatTime(step.value);
    } else {
        valueDisplay = `${step.value} cal`;
    }

    // Show target pace/rate if available
    const hasTarget = step.target_pace || step.target_rate;
    
    return (
        <div className={`relative flex items-center gap-3 p-3 rounded-lg border ${
            tag ? getTagColor(tag) : 
            isWork ? 'border-emerald-700/50 bg-emerald-900/20' : 'border-neutral-700 bg-neutral-800/30'
        }`}>
            {/* Step Number (only for work steps in non-repeating context) */}
            {isWork && !isRepeating && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-400">
                    {index + 1}
                </div>
            )}
            
            {/* Icon */}
            <div className="flex-shrink-0">
                {tag ? (
                    getTagIcon(tag)
                ) : isWork ? (
                    <Activity size={16} className="text-emerald-400" />
                ) : (
                    <Timer size={16} className="text-neutral-500" />
                )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className={`font-bold ${isWork ? 'text-white' : 'text-neutral-400'}`}>
                        {valueDisplay}
                    </span>
                    {tag && (
                        <span className={`text-xs font-medium capitalize ${
                            tag === 'warmup' ? 'text-yellow-400' :
                            tag === 'cooldown' ? 'text-blue-400' :
                            'text-red-400'
                        }`}>
                            {tag}
                        </span>
                    )}
                    {isWork && step.duration_type === 'time' && (
                        <span className="text-xs text-neutral-500">work</span>
                    )}
                    {!isWork && (
                        <span className="text-xs text-neutral-500">rest</span>
                    )}
                </div>
                
                {/* Target info */}
                {hasTarget && (
                    <div className="flex items-center gap-3 mt-2 text-xs">
                        <Target size={12} className="text-emerald-400 flex-shrink-0" />
                        <div className="flex flex-wrap gap-2">
                            {step.target_pace && (
                                <span className="px-2 py-0.5 bg-emerald-900/30 border border-emerald-700/50 rounded text-emerald-300 font-medium">
                                    {step.target_pace_max 
                                        ? `${step.target_pace}-${step.target_pace_max}` 
                                        : `@${step.target_pace}`}
                                </span>
                            )}
                            {step.target_rate && (
                                <span className="px-2 py-0.5 bg-cyan-900/30 border border-cyan-700/50 rounded text-cyan-300 font-medium">
                                    {step.target_rate_max 
                                        ? `${step.target_rate}-${step.target_rate_max} spm` 
                                        : `${step.target_rate} spm`}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const WorkoutVisualizer: React.FC<WorkoutVisualizerProps> = ({ structure }) => {
    // Steady State
    if (structure.type === 'steady_state') {
        let valueDisplay = '';
        if (structure.unit === 'meters') {
            valueDisplay = formatDistance(structure.value);
        } else if (structure.unit === 'seconds') {
            valueDisplay = formatTime(structure.value);
        } else {
            valueDisplay = `${structure.value} cal`;
        }

        const hasTag = structure.tags && structure.tags.length > 0;
        const tag = hasTag ? structure.tags![0] : null;
        const hasTarget = structure.target_pace || structure.target_rate;

        return (
            <div className={`p-6 rounded-xl border ${
                tag ? getTagColor(tag) : 'border-emerald-700/50 bg-emerald-900/10'
            }`}>
                <div className="flex items-center gap-3 mb-2">
                    {tag ? getTagIcon(tag) : <Activity size={20} className="text-emerald-400" />}
                    <h3 className="text-lg font-bold text-white">
                        {tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : 'Steady State'}
                    </h3>
                </div>
                <div className="text-3xl font-bold text-white mb-2">{valueDisplay}</div>
                {hasTarget && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Target size={14} className="text-emerald-400" />
                        {structure.target_pace && (
                            <span className="px-3 py-1 bg-emerald-900/30 border border-emerald-700/50 rounded text-emerald-300 text-sm font-medium">
                                {structure.target_pace_max 
                                    ? `${structure.target_pace}-${structure.target_pace_max}` 
                                    : `@${structure.target_pace}`}
                            </span>
                        )}
                        {structure.target_rate && (
                            <span className="px-3 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded text-cyan-300 text-sm font-medium">
                                {structure.target_rate_max 
                                    ? `${structure.target_rate}-${structure.target_rate_max} spm` 
                                    : `${structure.target_rate} spm`}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Fixed Intervals
    if (structure.type === 'interval') {
        const { repeats, work, rest } = structure;
        
        let workDisplay = '';
        if (work.type === 'distance') {
            workDisplay = formatDistance(work.value);
        } else if (work.type === 'time') {
            workDisplay = formatTime(work.value);
        } else {
            workDisplay = `${work.value} cal`;
        }
        
        const restDisplay = formatTime(rest.value);
        const hasTarget = work.target_pace || work.target_rate;

        return (
            <div className="p-6 rounded-xl border border-emerald-700/50 bg-emerald-900/10">
                <div className="flex items-center gap-3 mb-4">
                    <Activity size={20} className="text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">
                        Intervals: {repeats} × ({workDisplay} / {restDisplay} rest)
                    </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-900/30 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Work</div>
                        <div className="text-2xl font-bold text-white">{workDisplay}</div>
                    </div>
                    <div className="p-4 bg-neutral-800/50 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Rest</div>
                        <div className="text-2xl font-bold text-neutral-300">{restDisplay}</div>
                    </div>
                </div>

                {hasTarget && (
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-neutral-800">
                        <Target size={14} className="text-emerald-400" />
                        <span className="text-xs font-medium text-neutral-300">Targets:</span>
                        {work.target_pace && (
                            <span className="px-3 py-1 bg-emerald-900/30 border border-emerald-700/50 rounded text-emerald-300 text-xs font-medium">
                                {work.target_pace_max 
                                    ? `${work.target_pace}-${work.target_pace_max}` 
                                    : `@${work.target_pace}`}
                            </span>
                        )}
                        {work.target_rate && (
                            <span className="px-3 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded text-cyan-300 text-xs font-medium">
                                {work.target_rate_max 
                                    ? `${work.target_rate}-${work.target_rate_max} spm` 
                                    : `${work.target_rate} spm`}
                            </span>
                        )}
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-neutral-800 text-xs text-neutral-500">
                    This interval repeats {repeats} times
                </div>
            </div>
        );
    }

    // Variable Structure - Group into sections
    if (structure.type === 'variable') {
        const { steps } = structure;
        
        // Detect warmup, main work, cooldown based on tags
        const warmupSteps: WorkoutStep[] = [];
        const mainSteps: WorkoutStep[] = [];
        const cooldownSteps: WorkoutStep[] = [];
        
        steps.forEach(step => {
            const hasWarmup = step.tags?.includes('warmup');
            const hasCooldown = step.tags?.includes('cooldown');
            
            if (hasWarmup) {
                warmupSteps.push(step);
            } else if (hasCooldown) {
                cooldownSteps.push(step);
            } else {
                mainSteps.push(step);
            }
        });
        
        // Detect repeating patterns in main work
        const mainSections: { steps: WorkoutStep[]; repeats: number }[] = [];
        
        if (mainSteps.length > 0) {
            // Simple pattern detection: look for work/rest pairs
            let i = 0;
            while (i < mainSteps.length) {
                const step = mainSteps[i];
                
                if (step.type === 'work' && i + 1 < mainSteps.length && mainSteps[i + 1].type === 'rest') {
                    // Found a work/rest pair - check if it repeats
                    const workValue = step.value;
                    const workType = step.duration_type;
                    const restValue = mainSteps[i + 1].value;
                    
                    let repeatCount = 1;
                    let j = i + 2;
                    
                    while (j + 1 < mainSteps.length) {
                        const nextWork = mainSteps[j];
                        const nextRest = mainSteps[j + 1];
                        
                        if (nextWork.type === 'work' && 
                            nextRest.type === 'rest' &&
                            nextWork.value === workValue &&
                            nextWork.duration_type === workType &&
                            nextRest.value === restValue) {
                            repeatCount++;
                            j += 2;
                        } else {
                            break;
                        }
                    }
                    
                    if (repeatCount > 1) {
                        mainSections.push({
                            steps: [step, mainSteps[i + 1]],
                            repeats: repeatCount
                        });
                        i = j;
                    } else {
                        mainSections.push({
                            steps: [step, mainSteps[i + 1]],
                            repeats: 1
                        });
                        i += 2;
                    }
                } else {
                    // Single step (non-repeating)
                    mainSections.push({
                        steps: [step],
                        repeats: 1
                    });
                    i++;
                }
            }
        }

        return (
            <div className="space-y-4">
                {/* Warmup Section */}
                {warmupSteps.length > 0 && (
                    <div className="p-4 rounded-xl border border-yellow-600/30 bg-yellow-900/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} className="text-yellow-400" />
                            <h4 className="text-sm font-bold text-yellow-200 uppercase tracking-wide">Warmup</h4>
                        </div>
                        <div className="space-y-2">
                            {warmupSteps.map((step, idx) => (
                                <WorkStep key={idx} step={step} index={idx} />
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Main Work Section */}
                {mainSections.length > 0 && (
                    <div className="p-4 rounded-xl border border-emerald-700/50 bg-emerald-900/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity size={16} className="text-emerald-400" />
                            <h4 className="text-sm font-bold text-emerald-200 uppercase tracking-wide">Main Work</h4>
                        </div>
                        <div className="space-y-3">
                            {mainSections.map((section, idx) => (
                                <div key={idx}>
                                    {section.repeats > 1 ? (
                                        <div className="border border-emerald-700/30 bg-emerald-900/20 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold rounded">
                                                    {section.repeats}×
                                                </div>
                                                <span className="text-xs text-emerald-300 font-medium">Repeat {section.repeats} times</span>
                                            </div>
                                            <div className="space-y-2">
                                                {section.steps.map((step, stepIdx) => (
                                                    <WorkStep key={stepIdx} step={step} index={stepIdx} isRepeating />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {section.steps.map((step, stepIdx) => (
                                                <WorkStep key={stepIdx} step={step} index={idx} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Cooldown Section */}
                {cooldownSteps.length > 0 && (
                    <div className="p-4 rounded-xl border border-blue-600/30 bg-blue-900/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Coffee size={16} className="text-blue-400" />
                            <h4 className="text-sm font-bold text-blue-200 uppercase tracking-wide">Cooldown</h4>
                        </div>
                        <div className="space-y-2">
                            {cooldownSteps.map((step, idx) => (
                                <WorkStep key={idx} step={step} index={idx} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};
