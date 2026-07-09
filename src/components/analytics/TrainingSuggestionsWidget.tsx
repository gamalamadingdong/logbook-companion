
import React, { useEffect, useState } from 'react';
import { CalendarCheck, Info, RefreshCw, TrendingUp, Zap } from "lucide-react";
import { getWorkoutTemplates } from '../../services/supabase';
import type { WorkoutTemplate, WorkoutLog, UserGoal, UserProfile } from '../../services/supabase';
import type { TrainingBlockPlannedDay, TrainingBlockPlannedSession } from '../../types/trainingBlock.types';
import { getSuggestedWorkout } from '../../utils/recommendationEngine';

import { supabase } from '../../services/supabase';

interface TrainingBlockDailyRecommendation {
    day: TrainingBlockPlannedDay;
    sessions: readonly TrainingBlockPlannedSession[];
    templateName?: string | null;
}

interface TrainingSuggestionsWidgetProps {
    recentWorkouts: WorkoutLog[];
    userGoals: UserGoal[];
    userProfile?: UserProfile | null;
    trainingBlockRecommendation?: TrainingBlockDailyRecommendation | null;
    suppressGenericRecommendation?: boolean;
}

export const TrainingSuggestionsWidget: React.FC<TrainingSuggestionsWidgetProps> = ({
    recentWorkouts,
    userGoals,
    userProfile,
    trainingBlockRecommendation,
    suppressGenericRecommendation = false
}) => {
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [suggestion, setSuggestion] = useState<ReturnType<typeof getSuggestedWorkout>>(null);

    // Initial Load
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const data = await getWorkoutTemplates();
                setTemplates(data || []);
            } catch (err) {
                console.error("Failed to load templates", err);
            } finally {
                setLoading(false);
            }
        };
        loadTemplates();
    }, []);

    // Generate Suggestion Helper
    const generateSuggestion = async (force: boolean = false) => {
        if (templates.length > 0) {

            const today = new Date().toISOString().split('T')[0];

            // 1. Check for valid existing recommendation for TODAY if NOT forcing
            if (!force) {
                const savedRec = userProfile?.daily_recommendation;

                if (savedRec && savedRec.date === today && savedRec.template_id) {
                    // Try to find the template
                    const savedTemplate = templates.find(t => t.id === savedRec.template_id);
                    if (savedTemplate) {
                        setSuggestion({
                            template: savedTemplate,
                            reason: savedRec.reason,
                            targetPaceRange: savedRec.targetPaceRange
                        });
                        return;
                    }
                }
            }

            // 2. Generate NEW
            const result = getSuggestedWorkout(recentWorkouts, userGoals, templates, userProfile || undefined);

            if (result) {
                setSuggestion(result);

                // 3. Persist if we have a user (and not guest)
                if (userProfile?.user_id && userProfile.user_id !== 'guest_user_123') {
                    await supabase.from('user_profiles').update({
                        daily_recommendation: {
                            date: today,
                            template_id: result.template.id,
                            reason: result.reason,
                            targetPaceRange: result.targetPaceRange
                        }
                    }).eq('user_id', userProfile.user_id);
                }
            }
        }
    };

    // Initial Suggestion Generation
    useEffect(() => {
        if (trainingBlockRecommendation || suppressGenericRecommendation) return;
        if (!loading && templates.length > 0 && !suggestion) {
            generateSuggestion();
        }
    }, [loading, templates, recentWorkouts, userGoals, userProfile, trainingBlockRecommendation, suppressGenericRecommendation]);

    const handleRefresh = () => {
        generateSuggestion(true);
    };

    if (trainingBlockRecommendation) {
        const primarySession = trainingBlockRecommendation.sessions.find((session) => session.source === 'erg' && session.role === 'primary')
            ?? trainingBlockRecommendation.sessions.find((session) => session.source === 'erg')
            ?? trainingBlockRecommendation.sessions[0];
        const linkedTemplate = primarySession?.workout_template_id
            ? templates.find((entry) => entry.id === primarySession.workout_template_id)
            : null;
        const trainingZone = linkedTemplate?.training_zone ?? null;
        const description = linkedTemplate?.description
            ?? primarySession?.instructions?.[0]
            ?? primarySession?.planned_rwn
            ?? "Follow today\'s scheduled training block work.";
        const expectedDistance = trainingBlockRecommendation.day.target_distance_meters || primarySession?.expected_distance_meters;
        const expectedDuration = primarySession?.expected_duration_minutes;

        return (
            <div className="bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950 border border-blue-500/25 shadow-sm rounded-xl relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 text-blue-500/5 rotate-12 pointer-events-none transition-transform group-hover:scale-110 duration-700">
                    <CalendarCheck size={140} />
                </div>

                <div className="p-6 pb-2 relative z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full">
                                    Training Block Today
                                </span>
                                {trainingZone && (
                                    <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-medium px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                                        {trainingZone}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                                {linkedTemplate?.name ?? primarySession?.title ?? 'Training block workout'}
                            </h3>
                            <p className="flex items-center gap-1 text-xs mt-1 text-blue-600 dark:text-blue-300 font-medium">
                                <TrendingUp size={12} />
                                Week {trainingBlockRecommendation.day.week_number} · {trainingBlockRecommendation.day.day_of_week}
                                {trainingBlockRecommendation.templateName ? ` · ${trainingBlockRecommendation.templateName}` : ''}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-2 relative z-10">
                    <div className="space-y-4">
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">
                            {description}
                        </p>

                        {primarySession?.planned_rwn && (
                            <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-3 dark:border-neutral-700 dark:bg-neutral-800">
                                <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                                    <Info size={12} />
                                    RWN
                                </div>
                                <p className="font-mono text-sm text-neutral-900 dark:text-white">{primarySession.planned_rwn}</p>
                            </div>
                        )}

                        {(expectedDistance || expectedDuration) && (
                            <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                {expectedDistance ? <span>{expectedDistance.toLocaleString()}m planned</span> : null}
                                {expectedDuration ? <span>{expectedDuration} min expected</span> : null}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (loading || suppressGenericRecommendation) {
        return (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 text-neutral-500 text-sm">
                Loading today's workout...
            </div>
        );
    }

    if (!suggestion) {
        return (
            <div className="bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-6 text-center text-neutral-500 text-sm">
                No workout suggestions available. Set a goal to get started!
            </div>
        );
    }

    const { template, reason, targetPaceRange } = suggestion;

    return (
        <div className="bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950 border border-emerald-500/20 shadow-sm rounded-xl relative overflow-hidden group">
            {/* Decorative Background Icon */}
            <div className="absolute -right-6 -top-6 text-emerald-500/5 rotate-12 pointer-events-none transition-transform group-hover:scale-110 duration-700">
                <Zap size={140} />
            </div>

            <div className="p-6 pb-2 relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full">
                                Recommended for Today
                            </span>
                            {template.training_zone && (
                                <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-medium px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                                    {template.training_zone}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                            {template.name}
                        </h3>
                        <p className="flex items-center gap-1 text-xs mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <TrendingUp size={12} />
                            {reason}
                        </p>
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-neutral-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-full transition-all"
                        title="Get another suggestion"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            <div className="p-6 pt-2 relative z-10">
                <div className="space-y-4">
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        {template.description || "No description available."}
                    </p>

                    {targetPaceRange && (
                        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 border border-neutral-200 dark:border-neutral-700">
                            <div className="flex items-center gap-2 mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                                <Info size={12} />
                                Target Pace
                            </div>
                            <div className="text-2xl font-mono font-bold text-neutral-900 dark:text-white">
                                {targetPaceRange.low} <span className="text-neutral-400 text-lg mx-1">-</span> {targetPaceRange.high}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-1">
                                Based on your recent 2k reference.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
