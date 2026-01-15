
import type { WorkoutLog, UserGoal, WorkoutTemplate, UserProfile } from '../services/supabase';

// Helper to parse "2k" time strings "6:40.0" -> seconds
const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(timeStr);
};

// Helper to format seconds -> "1:45.0"
const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
};

interface SuggestedWorkout {
    template: WorkoutTemplate;
    reason: string;
    targetPaceRange?: { low: string; high: string };
    targetSplitSeconds?: number;
}

export const getSuggestedWorkout = (
    recentWorkouts: WorkoutLog[],
    userGoals: UserGoal[],
    templates: WorkoutTemplate[],
    userProfile?: UserProfile
): SuggestedWorkout | null => {
    if (!templates || templates.length === 0) return null;

    // 1. Analyze Recent Load (Last 7 Days)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = recentWorkouts.filter(w => new Date(w.completed_at) > oneWeekAgo);

    // If completed > 4 hard sessions, suggest recovery
    // (This is a placeholder for real Impulse-Response logic)
    const hardSessionCount = recentLogs.filter(w => w.workout_type && w.workout_type.includes('Interval')).length;
    let reason = "Balanced training suggestion.";

    if (hardSessionCount > 3) {
        reason = "High recent intensity detected. Suggesting recovery work.";
    }

    // 2. Goal-Based Filtering & Recovery Logic
    const activeGoal = userGoals.find(g => g.is_active);
    let candidateTemplates = templates;

    if (hardSessionCount > 3) {
        // OVERRIDE: Prioritize Recovery if fatigue is high
        // Select only UT2 / Steady State workouts
        candidateTemplates = templates.filter(t => t.training_zone === 'UT2');
        reason = "High recent intensity detected. Suggesting recovery work (UT2).";
    } else {
        // Standard Goal-Based Logic
        if (activeGoal?.type === 'target_2k_watts' || activeGoal?.type === 'benchmark_goal') {
            // Prioritize structured intervals (TR, AN, AT) or explicitly categorized intervals
            candidateTemplates = templates.filter(t =>
                t.tags?.includes('2k') ||
                ['TR', 'AN', 'AT'].includes(t.training_zone || '') ||
                t.workout_category?.includes('interval')
            );
            reason = "Focusing on 2k speed and threshold development.";
        } else if (activeGoal?.type === 'weekly_distance') {
            // Prioritize steady state
            candidateTemplates = templates.filter(t => t.training_zone === 'UT2' || t.training_zone === 'UT1');
            reason = "Building aerobic base for distance goal.";
        }
    }

    // 3. Selection (Random for now, could be round-robin)
    if (candidateTemplates.length === 0) candidateTemplates = templates; // Fallback
    const selectedTemplate = candidateTemplates[Math.floor(Math.random() * candidateTemplates.length)];

    // 4. Pacing Engine
    let targetPaceRange = undefined;
    let targetSplitSeconds = undefined;

    if (userProfile?.benchmark_preferences) {
        // Look for Reference 2k (stored as '2k' or '2000m' usually, but relying on UserProfile structure)
        const baseline2k = userProfile.benchmark_preferences['2k']?.working_baseline; // e.g., "7:00.0"

        if (baseline2k) {
            const baseSeconds = parseTime(baseline2k) / 4; // /500m split
            let adjustment = 0;
            let foundPacing = false;

            // 1. Try Explicit Guidance "2k+5"
            if (selectedTemplate.pacing_guidance && selectedTemplate.pacing_guidance.includes('2k')) {
                if (selectedTemplate.pacing_guidance.includes('+')) {
                    adjustment = parseFloat(selectedTemplate.pacing_guidance.split('+')[1]);
                    foundPacing = true;
                } else if (selectedTemplate.pacing_guidance.includes('-')) {
                    adjustment = -parseFloat(selectedTemplate.pacing_guidance.split('-')[1]);
                    foundPacing = true;
                }
            }

            // 2. Fallback to Zone-Based Estimation if no explicit formula found
            if (!foundPacing && selectedTemplate.training_zone) {
                switch (selectedTemplate.training_zone) {
                    case 'UT2': adjustment = 25; break; // +25s (Slower/Easier)
                    case 'UT1': adjustment = 18; break; // +18s
                    case 'AT': adjustment = 10; break;  // +10s
                    case 'TR': adjustment = 2; break;   // +2s (Slightly slower than 2k)
                    case 'AN': adjustment = -2; break;  // -2s (Slightly faster than 2k)
                    default: adjustment = 22; // safe default
                }
                foundPacing = true;
            }

            if (foundPacing) {
                targetSplitSeconds = baseSeconds + adjustment;

                // Confidence Range (Fixed 2% for MVP)
                const range = targetSplitSeconds * 0.02;
                targetPaceRange = {
                    low: formatTime(targetSplitSeconds - range),
                    high: formatTime(targetSplitSeconds + range)
                };
            }
        }
    }

    return {
        template: selectedTemplate,
        reason,
        targetPaceRange,
        targetSplitSeconds
    };
};
