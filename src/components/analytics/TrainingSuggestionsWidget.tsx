
import React, { useEffect, useState } from 'react';
import { Zap, TrendingUp, Info, RefreshCw } from "lucide-react";
import { getWorkoutTemplates } from '../../services/supabase';
import type { WorkoutTemplate, WorkoutLog, UserGoal, UserProfile } from '../../services/supabase';
import { getSuggestedWorkout } from '../../utils/recommendationEngine';

interface TrainingSuggestionsWidgetProps {
    recentWorkouts: WorkoutLog[];
    userGoals: UserGoal[];
    userProfile?: UserProfile;
}

export const TrainingSuggestionsWidget: React.FC<TrainingSuggestionsWidgetProps> = ({
    recentWorkouts,
    userGoals,
    userProfile
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
    const generateSuggestion = () => {
        if (templates.length > 0) {
            const result = getSuggestedWorkout(recentWorkouts, userGoals, templates, userProfile);
            setSuggestion(result);
        }
    };

    // Initial Suggestion Generation
    useEffect(() => {
        if (!loading && templates.length > 0 && !suggestion) {
            generateSuggestion();
        }
    }, [loading, templates, recentWorkouts, userGoals, userProfile]);

    const handleRefresh = () => {
        generateSuggestion();
    };

    if (loading) {
        // ... (loading state remains)
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
