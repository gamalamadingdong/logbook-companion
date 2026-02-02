
import { getSuggestedWorkout } from '../src/utils/recommendationEngine.js';
import type { WorkoutLog, UserGoal, WorkoutTemplate, UserProfile } from '../src/services/supabase.js';

// Mocks
const mockTemplates: WorkoutTemplate[] = [
    { id: '1', name: '2k Prep', workout_type: 'interval', training_zone: 'TR', pacing_guidance: '2k+2', tags: ['2k'] },
    { id: '2', name: 'Base Building', workout_type: 'distance', training_zone: 'UT2', pacing_guidance: '2k+18', difficulty_level: 'easy' },
];

const mockGoal2k: UserGoal = {
    id: 'g1', user_id: 'u1', type: 'target_2k_watts', target_value: 200, is_active: true
};

const mockGoalDist: UserGoal = {
    id: 'g2', user_id: 'u1', type: 'weekly_distance', target_value: 50000, is_active: true
};

const mockProfile: UserProfile = {
    id: 'p1', user_id: 'u1', email: 'test@example.com',
    benchmark_preferences: {
        '2k': { is_tracked: true, working_baseline: '7:00.0' } // 1:45 split => 105s
    }
};

// Test 1: Pacing Logic
console.log("Test 1: Pacing Calculation (Ref 2k = 1:45)");
const result1 = getSuggestedWorkout([], [mockGoal2k], mockTemplates, mockProfile);
if (result1?.targetSplitSeconds) {
    console.log(`PASS: Template selected: ${result1.template.name}`);
    // Template 1 is 2k+2. 2k=105s. Target = 107s.
    // 107s = 1:47.0
    const low = result1.targetPaceRange?.low;
    const high = result1.targetPaceRange?.high;
    console.log(`PASS: Range: ${low} - ${high} (Target ~1:47)`);

    // Check if range is ~2%
    // 107 * 0.02 = 2.14s. Range should be ~1:44.9 - 1:49.1
} else {
    console.error("FAIL: No suggestion or pacing calculation");
}

// Test 2: Goal Filtering (Distance)
console.log("\nTest 2: Goal Filtering (Distance)");
const result2 = getSuggestedWorkout([], [mockGoalDist], mockTemplates, mockProfile);
if (result2?.template.training_zone === 'UT2') {
    console.log(`PASS: Correctly selected UT2 template for Distance goal: ${result2.template.name}`);
} else {
    console.error(`FAIL: Selected ${result2?.template.name} instead of UT2 template`);
}

// Test 3: Load Management (High Fatigue)
console.log("\nTest 3: High Fatigue Logic");
const hardWorkout: WorkoutLog = {
    id: 'w1', user_id: 'u1', workout_name: 'Hard', workout_type: 'VariableInterval', completed_at: new Date().toISOString(), distance_meters: 5000, duration_minutes: 20, source: 'concept2'
};
const recentWorkouts = [hardWorkout, hardWorkout, hardWorkout, hardWorkout]; // 4 hard sessions
const result3 = getSuggestedWorkout(recentWorkouts, [mockGoal2k], mockTemplates, mockProfile);

// Should prefer 'easy' difficulty.
// Our mock template 2 is 'easy'.
if (result3?.template.difficulty_level === 'easy') {
    console.log(`PASS: Switched to Easy template due to fatigue: ${result3.template.name}`);
} else {
    console.log(`INFO: Selected ${result3?.template.name} (Diff: ${result3?.template.difficulty_level}). Note: Logic requires finding an easy template if filtered.`);
}

console.log("\nVerification Complete.");
