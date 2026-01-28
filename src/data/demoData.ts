// import type { C2ResultDetail } from '../api/concept2.types';

// Helper to create a date N days ago
const daysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().replace('T', ' ').split('.')[0]; // "YYYY-MM-DD HH:MM:SS"ish
};

// Mock User for Guest
export const GUEST_USER = {
    id: 'guest_user_123',
    email: 'guest@demo.co',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
};

export const GUEST_PROFILE = {
    id: 'guest_profile_123',
    user_id: 'guest_user_123',
    email: 'guest@demo.co',
    display_name: 'Guest Rower',
    created_at: new Date().toISOString(),
    onboarding_completed: true,
    skill_level: 'intermediate',
    profile_visibility: 'public',
    share_workouts: true,
    share_progress: true,
    personal_records: {
        '2k': 420, // 7:00 (1:45 pace)
        '5k': 1140, // 19:00 (1:54 pace)
        '10k': 2400 // 40:00 (2:00 pace)
    }
};

// 6. Guest Goals
export const GUEST_USER_GOALS: any[] = [
    {
        id: 'guest_goal_1',
        user_id: GUEST_USER.id,
        goal_type: 'weekly_distance',
        target_value: 30000,
        current_value: 24500,
        start_date: daysAgo(7),
        end_date: daysAgo(-7),
        is_active: true,
        created_at: daysAgo(7)
    },
    {
        id: 'guest_goal_2',
        user_id: GUEST_USER.id,
        goal_type: '2k',
        target_value: 410, // 6:50
        current_value: 420, // 7:00
        start_date: daysAgo(30),
        end_date: daysAgo(-30),
        is_active: true,
        created_at: daysAgo(30)
    }
];

// --- MOCK WORKOUTS ---

// 1. Recent 4x2000m (Hard Interval)
const workout_4x2k: any = {
    id: 'demo_1',
    external_id: 'c2_demo_1',
    user_id: GUEST_USER.id,
    workout_name: '4x2000m/5:00r', // Canonical
    workout_type: 'FixedDistanceInterval',
    completed_at: daysAgo(1),
    distance_meters: 8000,
    duration_seconds: 1680, // 28:00 total work (1:45 pace)
    duration_minutes: 28,
    watts: 300,
    average_stroke_rate: 28,
    calories_burned: 1200,
    canonical_name: '4x2000m/5:00r',
    source: 'concept2',
    raw_data: {
        id: 1, user_id: 1, date: daysAgo(1), type: 'rower', distance: 8000, time: 16800, time_formatted: "28:00.0",
        workout_type: 'FixedDistanceInterval', verified: true, ranked: true, weight_class: 'H',
        stroke_data: false, stroke_rate: 28, watts: 300, calories_total: 1200,
        workout: {
            intervals: [
                { type: 'distance', distance: 2000, time: 4200, stroke_rate: 28, rest_time: 3000 },
                { type: 'distance', distance: 2000, time: 4200, stroke_rate: 28, rest_time: 3000 },
                { type: 'distance', distance: 2000, time: 4200, stroke_rate: 28, rest_time: 3000 },
                { type: 'distance', distance: 2000, time: 4200, stroke_rate: 28, rest_time: 3000 }
            ]
        }
    }
};

// 2. Steady State 10k (Zone 2)
const workout_10k: any = {
    id: 'demo_2',
    external_id: 'c2_demo_2',
    user_id: GUEST_USER.id,
    workout_name: '10k',
    workout_type: 'FixedDistance',
    completed_at: daysAgo(3),
    distance_meters: 10000,
    duration_seconds: 2400, // 40:00 (2:00 pace)
    duration_minutes: 40,
    watts: 200,
    average_stroke_rate: 20,
    calories_burned: 900,
    canonical_name: '1x10000m',
    source: 'concept2',
    raw_data: {
        id: 2, user_id: 1, date: daysAgo(3), type: 'rower', distance: 10000, time: 24000, time_formatted: "40:00.0",
        workout_type: 'FixedDistance', verified: true, ranked: true, weight_class: 'H',
        stroke_data: false, stroke_rate: 20, watts: 200, calories_total: 900,
        workout: { intervals: [] }
    }
};

// 3. Fast 500m Sprints (8x500m)
const workout_8x500: any = {
    id: 'demo_3',
    external_id: 'c2_demo_3',
    user_id: GUEST_USER.id,
    workout_name: '8x500m/3:30r',
    workout_type: 'FixedDistanceInterval',
    completed_at: daysAgo(5),
    distance_meters: 4000,
    duration_seconds: 800, // 13:20 total (1:40 pace)
    duration_minutes: 13.3,
    watts: 350,
    average_stroke_rate: 32,
    calories_burned: 600,
    canonical_name: '8x500m/3:30r',
    source: 'concept2',
    raw_data: {
        id: 3, user_id: 1, date: daysAgo(5), type: 'rower', distance: 4000, time: 8000, time_formatted: "13:20.0",
        workout_type: 'FixedDistanceInterval', verified: true, ranked: true, weight_class: 'H',
        stroke_data: false, stroke_rate: 32, watts: 350, calories_total: 600,
        workout: {
            intervals: Array(8).fill({
                type: 'distance', distance: 500, time: 1000, stroke_rate: 32, rest_time: 2100 // 3:30r
            })
        }
    }
};

// 4. Pyramid (variable)
const workout_pyramid: any = {
    id: 'demo_4',
    external_id: 'c2_demo_4',
    user_id: GUEST_USER.id,
    workout_name: 'v250m... Pyramid',
    workout_type: 'FixedDistanceInterval',
    completed_at: daysAgo(8),
    distance_meters: 2500,
    duration_seconds: 450, // 7:30 approx
    duration_minutes: 7.5,
    watts: 400,
    average_stroke_rate: 34,
    calories_burned: 400,
    canonical_name: 'v250m... Pyramid',
    source: 'concept2',
    raw_data: {
        id: 4, user_id: 1, date: daysAgo(8), type: 'rower', distance: 2500, time: 4500, time_formatted: "7:30.0",
        workout_type: 'FixedDistanceInterval', verified: true, ranked: true, weight_class: 'H',
        stroke_data: false, stroke_rate: 34, watts: 400, calories_total: 400,
        workout: {
            intervals: [
                { type: 'distance', distance: 250, time: 450, stroke_rate: 36, rest_time: 900 },
                { type: 'distance', distance: 500, time: 900, stroke_rate: 34, rest_time: 900 },
                { type: 'distance', distance: 750, time: 1350, stroke_rate: 32, rest_time: 900 },
                { type: 'distance', distance: 500, time: 900, stroke_rate: 34, rest_time: 900 },
                { type: 'distance', distance: 250, time: 450, stroke_rate: 36, rest_time: 900 },
            ]
        }
    }
};

// 5. 30:00 Piece (Time)
const workout_30min: any = {
    id: 'demo_5',
    external_id: 'c2_demo_5',
    user_id: GUEST_USER.id,
    workout_name: '30:00',
    workout_type: 'FixedTime',
    completed_at: daysAgo(12),
    distance_meters: 7500, // 2:00 pace exactly
    duration_seconds: 1800,
    duration_minutes: 30,
    watts: 202,
    average_stroke_rate: 22,
    calories_burned: 750,
    canonical_name: '1x30:00',
    source: 'concept2',
    raw_data: {
        id: 5, user_id: 1, date: daysAgo(12), type: 'rower', distance: 7500, time: 18000, time_formatted: "30:00.0",
        workout_type: 'FixedTime', verified: true, ranked: true, weight_class: 'H',
        stroke_data: false, stroke_rate: 22, watts: 202, calories_total: 750,
        workout: { intervals: [] }
    }
};

// 6. Just Row (Warmup)
const workout_warmup: any = {
    id: 'demo_6',
    external_id: 'c2_demo_6',
    user_id: GUEST_USER.id,
    workout_name: 'Just Row',
    workout_type: 'JustRow',
    completed_at: daysAgo(0), // Today
    distance_meters: 2000,
    duration_seconds: 600, // 10:00
    duration_minutes: 10,
    watts: 150,
    average_stroke_rate: 18,
    calories_burned: 100,
    canonical_name: '2000m JustRow',
    source: 'concept2',
    raw_data: {
        id: 6, user_id: 1, date: daysAgo(0), type: 'rower', distance: 2000, time: 6000, time_formatted: "10:00.0",
        workout_type: 'JustRow', verified: false, ranked: false, weight_class: 'H',
        stroke_data: false, stroke_rate: 18, watts: 150, calories_total: 100,
        workout: { intervals: [] }
    }
};

export const DEMO_WORKOUTS = [
    workout_warmup,
    workout_4x2k,
    workout_10k,
    workout_8x500,
    workout_pyramid,
    workout_30min,
    // Add duplicates to flesh out history
    { ...workout_10k, id: 'demo_7', completed_at: daysAgo(15), external_id: 'c2_demo_7' },
    { ...workout_8x500, id: 'demo_8', completed_at: daysAgo(20), external_id: 'c2_demo_8', watts: 340, distance_meters: 4000 },
    { ...workout_30min, id: 'demo_9', completed_at: daysAgo(25), external_id: 'c2_demo_9', distance_meters: 7400, watts: 195 },
    { ...workout_4x2k, id: 'demo_10', completed_at: daysAgo(28), external_id: 'c2_demo_10', watts: 290, duration_seconds: 1720 }
];
