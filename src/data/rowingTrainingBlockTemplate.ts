import {
    parseLocalDate,
} from '../utils/dateUtils';
import { parseRWN, structureToRWN } from '@readyall/rwn';

import type {
    TrainingBlockPlan,
    TrainingBlockPlannedDay,
    TrainingBlockPlannedSession,
    TrainingBlockReferenceContent,
    TrainingBlockReferenceExercise,
    TrainingBlockSessionRole,
    TrainingBlockSupportPrescription,
    TrainingBlockTemplateKey,
    TrainingBlockWeekTarget,
    TrainingBlockWorkoutFamily,
} from '../types/trainingBlock.types';

const DAY_SLOT_LABELS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
export const TEMPLATE_ID: TrainingBlockTemplateKey = 'rowing_12_week_2026_v1';
export const DEFAULT_START_DATE = '2026-07-06';
export const DEFAULT_DURATION_WEEKS = 12;

const WEEK_TARGET_KM: readonly number[] = [50, 55, 60, 55, 65, 70, 75, 65, 78, 82, 85, 70];
const WEEK_TARGETS_M: readonly TrainingBlockWeekTarget[] = WEEK_TARGET_KM.map((kilometers, index) => ({
    week_number: index + 1,
    target_distance_meters: kilometers * 1000,
}));

function canonicalizeRWN(raw: string): string {
    const parsed = parseRWN(raw);
    if (!parsed) {
        throw new Error(`Invalid training block RWN: ${raw}`);
    }

    return structureToRWN(parsed);
}

const PETER_PLAN_RWN_BY_FAMILY: Readonly<Partial<Record<TrainingBlockWorkoutFamily, string>>> = {
    mon_8x500: '8x500m/3:30r',
    mon_pyramid_250_500_750_1000_750_500_250: '250m + 500m + 750m + 1000m + 750m + 500m + 250m',
    mon_4x1000: '4x1000m/5:00r',
    mon_30r20: '30:00@r20',
    mon_hour_of_power: '60:00',
    mon_cascading_pyramid_3000_2000_1000: '3000m + 2000m + 1000m',
    mon_2x5000: '2x5000m/6:00r',
    mon_final_5000_or_6000: '6000m',
    thu_5x1500: '5x1500m/5:00r',
    thu_4x2000: '4x2000m/5:00r',
    thu_4x1000: '4x1000m/5:00r',
    thu_3000_2500_2000: '3000m + 2500m + 2000m',
    thu_3x2000_controlled: '3x2000m/5:00r',
    thu_hour_of_power: '60:00',
    thu_cascading_pyramid_3000_2000_1000: '3000m + 2000m + 1000m',
    thu_2x5000: '2x5000m/6:00r',
    thu_final_5000_or_6000: '6000m',
    steady_45_75min: '60:00',
    flush_min_3k: '3000m',
    flush_standard_4to5k: '4500m',
    flush_full_6k: '6000m',
    cross_training: 'Cross: 60:00',
    cross_with_optional_row: 'Cross: 60:00',
} as const;

function resolvePlannedRWN(family: TrainingBlockWorkoutFamily): string {
    const rawRWN = PETER_PLAN_RWN_BY_FAMILY[family];
    if (!rawRWN) {
        throw new Error(`No canonical RWN defined for training block family: ${family}`);
    }

    return canonicalizeRWN(rawRWN);
}

const PULL_ROUTINE = [
    {
        name: 'Deadlift or Romanian Deadlift',
        sets: 4,
        reps: '6-8',
        notes: 'Quality hinge pattern; stop 1-2 reps before failure.',
    },
    {
        name: 'Pendlay Row or Bench Pull',
        sets: 4,
        reps: '8',
        notes: 'Brace hard and keep the pull controlled.',
    },
    {
        name: 'Weighted Pull-ups or Lat Pulldown',
        sets: 3,
        reps: '8-10',
        notes: 'Full range without grinding.',
    },
    {
        name: 'Face Pulls',
        sets: 3,
        reps: '15',
        notes: 'Light, clean scapular control.',
    },
] as const satisfies readonly TrainingBlockReferenceExercise[];

const PUSH_ROUTINE = [
    {
        name: 'Front Squat or Back Squat',
        sets: 4,
        reps: '6-8',
        notes: 'Smooth reps; no failed attempts.',
    },
    {
        name: 'Overhead Press or Flat Bench Press',
        sets: 4,
        reps: '8',
        notes: 'Controlled eccentric on each rep.',
    },
    {
        name: 'Walking Lunges',
        sets: 3,
        reps: '10 steps per leg',
        notes: 'Stay tall and balanced.',
    },
    {
        name: 'Ab Wheel Rollouts',
        sets: 3,
        reps: '10-12',
        notes: 'Brace through the trunk; shorten range if needed.',
    },
] as const satisfies readonly TrainingBlockReferenceExercise[];

const PULL_REFERENCE: TrainingBlockReferenceContent = {
    warmup: ['5 min easy row or bike spin', 'Dynamic shoulder circles', 'Banded pull-aparts x2 sets'],
    core: ['Pallof press', 'Side plank', 'Dead bug'],
    stretching: ['Lat stretch', 'Hip flexor stretch'],
    routines: [
        {
            kind: 'pull',
            focus: ['Back', 'Grip', 'Posterior chain'],
            exercises: PULL_ROUTINE,
        },
    ],
};

const PUSH_REFERENCE: TrainingBlockReferenceContent = {
    warmup: ['5 min easy spin', 'Shoulder prep', 'Scap retractions'],
    core: ['Anti-rotation press', 'Bird-dog', 'Hollow hold'],
    stretching: ['Doorway pec stretch', 'Chest opener'],
    routines: [
        {
            kind: 'push',
            focus: ['Upper back', 'Chest', 'Triceps'],
            exercises: PUSH_ROUTINE,
        },
    ],
};

const TOGGLE_FAMILIES: Record<number, {
    mon: TrainingBlockWorkoutFamily;
    thu: TrainingBlockWorkoutFamily;
}> = {
    1: {
        mon: 'mon_8x500',
        thu: 'thu_5x1500',
    },
    2: {
        mon: 'mon_pyramid_250_500_750_1000_750_500_250',
        thu: 'thu_4x2000',
    },
    3: {
        mon: 'mon_4x1000',
        thu: 'thu_3000_2500_2000',
    },
    4: {
        mon: 'mon_30r20',
        thu: 'thu_3x2000_controlled',
    },
    5: {
        mon: 'mon_8x500',
        thu: 'thu_5x1500',
    },
    6: {
        mon: 'mon_pyramid_250_500_750_1000_750_500_250',
        thu: 'thu_4x2000',
    },
    7: {
        mon: 'mon_4x1000',
        thu: 'thu_3000_2500_2000',
    },
    8: {
        mon: 'mon_hour_of_power',
        thu: 'thu_cascading_pyramid_3000_2000_1000',
    },
    9: {
        mon: 'mon_8x500',
        thu: 'thu_5x1500',
    },
    10: {
        mon: 'mon_pyramid_250_500_750_1000_750_500_250',
        thu: 'thu_4x2000',
    },
    11: {
        mon: 'mon_4x1000',
        thu: 'thu_3000_2500_2000',
    },
    12: {
        mon: 'mon_2x5000',
        thu: 'thu_final_5000_or_6000',
    },
};

const WEEK_FLUSH_BY_WEEK: Record<number, number> = {
    4: 3000,
    12: 6000,
};

function localDateToIso(date: Date): string {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date.getTime());
    next.setDate(date.getDate() + days);
    return next;
}

function buildIntervalsSession(params: {
    title: string;
    role: TrainingBlockSessionRole;
    family: TrainingBlockWorkoutFamily;
    expected_distance_meters: number;
    split_seconds_per_500m?: number;
    instructions: readonly string[];
    isKeySession?: boolean;
}): TrainingBlockPlannedSession {
    return {
        id: `${params.family}-primary`,
        title: params.title,
        planned_rwn: resolvePlannedRWN(params.family),
        family: params.family,
        role: params.role,
        source: 'erg',
        expected_distance_meters: params.expected_distance_meters,
        target_split_seconds_per_500m: params.split_seconds_per_500m,
        instructions: params.instructions,
        counts_toward_weekly_volume: true,
        is_key_session: params.isKeySession ?? false,
    };
}

function buildFlushSession(weekNumber: number): TrainingBlockPlannedSession {
    const flushMeters = WEEK_FLUSH_BY_WEEK[weekNumber] ?? 4500;
    const flushFamily = weekNumber === 4
        ? 'flush_min_3k'
        : weekNumber === 12
            ? 'flush_full_6k'
            : 'flush_standard_4to5k';

    return {
        id: `flush-${weekNumber}`,
        title: `Flush ${flushMeters / 1000}k`,
        planned_rwn: resolvePlannedRWN(flushFamily),
        family: flushFamily,
        role: 'supplemental',
        source: 'erg',
        expected_distance_meters: flushMeters,
        counts_toward_weekly_volume: true,
        instructions: ['No sprinting; keep the pacing conversational.'],
    };
}

function buildSteadySession(distanceMeters: number, role: TrainingBlockSessionRole): TrainingBlockPlannedSession {
    const steadyRWN = distanceMeters === 8000 ? '8000m' : '10000m';
    return {
        id: `steady-${distanceMeters}`,
        title: `Steady ${distanceMeters / 1000}k`,
        planned_rwn: canonicalizeRWN(steadyRWN),
        family: 'steady_45_75min',
        role,
        source: 'erg',
        expected_distance_meters: distanceMeters,
        expected_duration_minutes: 50,
        target_split_seconds_per_500m: 130,
        counts_toward_weekly_volume: true,
        instructions: [
            'Zone 2 focus.',
            'Keep transitions calm and smooth.',
            'No hard finish unless energy allows.',
        ],
    };
}

function buildStrengthSupportPrescription(kind: 'pull' | 'push'): TrainingBlockSupportPrescription {
    const routine = kind === 'pull' ? PULL_REFERENCE.routines[0] : PUSH_REFERENCE.routines[0];
    return {
        kind: 'strength',
        title: `Strength (${kind})`,
        focus: routine.focus,
        exercises: routine.exercises,
        notes: [
            '1-2 reps in reserve.',
            'No failed reps or grindy reps.',
            'Quality and consistency over load chasing.',
        ],
    };
}

function buildCrossSession(): TrainingBlockPlannedSession {
    return {
        id: 'cross-60min',
        title: 'Cross-training 60 min',
        planned_rwn: resolvePlannedRWN('cross_training'),
        family: 'cross_training',
        role: 'primary',
        source: 'cross_training',
        expected_duration_minutes: 60,
        counts_toward_weekly_volume: false,
        instructions: ['Bike, ski, run, or general aerobic conditioning.'],
    };
}

function buildStrengthSession(kind: 'pull' | 'push'): TrainingBlockPlannedSession {
    const isPull = kind === 'pull';
    return {
        id: `strength-${kind}`,
        title: `Strength (${kind})`,
        family: isPull ? 'strength_pull' : 'strength_push',
        role: 'strength',
        source: 'strength',
        support_prescription: buildStrengthSupportPrescription(kind),
        instructions: [isPull ? 'Keep low to moderate load' : 'Keep movement quality high'],
        counts_toward_weekly_volume: false,
    };
}

function primaryDistanceByFamily(family: TrainingBlockWorkoutFamily): number {
    switch (family) {
        case 'mon_8x500':
            return 8 * 500;
        case 'mon_pyramid_250_500_750_1000_750_500_250':
            return 4000;
        case 'mon_4x1000':
            return 4000;
        case 'mon_30r20':
            return 3000;
        case 'mon_hour_of_power':
            return 12000;
        case 'mon_2x5000':
            return 10000;
        case 'thu_5x1500':
            return 5 * 1500;
        case 'thu_4x2000':
            return 8000;
        case 'thu_3000_2500_2000':
            return 3000 + 2500 + 2000;
        case 'thu_3x2000_controlled':
            return 6000;
        case 'thu_hour_of_power':
            return 12000;
        case 'thu_cascading_pyramid_3000_2000_1000':
            return 6000;
        case 'thu_2x5000':
            return 10000;
        case 'thu_final_5000_or_6000':
            return 6000;
        default:
            return 0;
    }
}

function resolveMondaySession(weekNumber: number): TrainingBlockPlannedSession {
    const family = TOGGLE_FAMILIES[weekNumber]?.mon ?? 'mon_8x500';
    return buildIntervalsSession({
        title: `Row anchor: ${family.replace(/_/g, ' ')}`,
        role: 'primary',
        family,
        expected_distance_meters: primaryDistanceByFamily(family),
        instructions: [
            'Use this as the anchor session for the day.',
            'Keep intervals controlled and repeatable.',
        ],
        isKeySession: true,
    });
}

function resolveThursdaySession(weekNumber: number): TrainingBlockPlannedSession {
    const family = TOGGLE_FAMILIES[weekNumber]?.thu ?? 'thu_5x1500';
    return buildIntervalsSession({
        title: `Benchmark focus: ${family.replace(/_/g, ' ')}`,
        role: 'primary',
        family,
        expected_distance_meters: primaryDistanceByFamily(family),
        instructions: [
            'This is the weekly endurance benchmark slot.',
            'Use race-pace discipline and avoid blowups.',
        ],
        isKeySession: true,
    });
}

function resolveReference(kind: 'pull' | 'push'): TrainingBlockReferenceContent | undefined {
    return kind === 'pull' ? PULL_REFERENCE : PUSH_REFERENCE;
}

function buildDay(
    date: Date,
    weekNumber: number,
    daySlot: number,
): TrainingBlockPlannedDay {
    const targetDistanceMeters = WEEK_TARGETS_M[weekNumber - 1]?.target_distance_meters ?? 0;
    const sessions: TrainingBlockPlannedSession[] = [];
    let plannedDistance = 0;

    if (daySlot === 0) {
        sessions.push(resolveMondaySession(weekNumber));
        sessions.push(buildFlushSession(weekNumber));
        sessions.push(buildStrengthSession('pull'));
    } else if (daySlot === 1 || daySlot === 4) {
        sessions.push(buildSteadySession(daySlot === 1 ? 8000 : 10000, 'primary'));
    } else if (daySlot === 2 || daySlot === 5) {
        sessions.push(buildCrossSession());
        sessions.push(buildStrengthSession('push'));
    } else if (daySlot === 3) {
        sessions.push(resolveThursdaySession(weekNumber));
        sessions.push(buildFlushSession(weekNumber));
        sessions.push(buildStrengthSession('pull'));
    } else {
        // Sunday
    }

    for (const session of sessions) {
        if (session.counts_toward_weekly_volume) {
            plannedDistance += session.expected_distance_meters ?? 0;
        }
    }

    return {
        date: localDateToIso(date),
        week_number: weekNumber,
        day_of_week: DAY_SLOT_LABELS[daySlot] ?? `Day ${daySlot + 1}`,
        weekday_index: daySlot,
        day_slot: daySlot,
        category: daySlot === 2 || daySlot === 5
            ? 'cross_training'
            : daySlot === 6
                ? 'rest'
                : 'erg',
        sessions,
        planned_distance_meters: plannedDistance,
        target_distance_meters: targetDistanceMeters,
        reference:
            daySlot === 0 || daySlot === 3
                ? resolveReference('pull')
                : daySlot === 2 || daySlot === 5
                    ? resolveReference('push')
                    : undefined,
    };
}

export function buildRowing12WeekPlan(startDate = DEFAULT_START_DATE): TrainingBlockPlan {
    const parsedStart = parseLocalDate(startDate);
    const days: TrainingBlockPlannedDay[] = [];

    for (let offset = 0; offset < DEFAULT_DURATION_WEEKS * 7; offset += 1) {
        const date = addDays(parsedStart, offset);
        const weekNumber = Math.floor(offset / 7) + 1;
        const daySlot = offset % 7;
        days.push(buildDay(date, weekNumber, daySlot));
    }

    const endDate = localDateToIso(addDays(parsedStart, DEFAULT_DURATION_WEEKS * 7 - 1));

    return {
        template_id: TEMPLATE_ID,
        start_date: startDate,
        end_date: endDate,
        duration_weeks: DEFAULT_DURATION_WEEKS,
        days,
    };
}

export { WEEK_TARGETS_M, TOGGLE_FAMILIES };
export const ROWING_12_WEEK_TEMPLATE: TrainingBlockPlan = buildRowing12WeekPlan();
export const ROWING_12_WEEK_CROSS_REFERENCE: ReadonlyArray<TrainingBlockReferenceContent> = [PULL_REFERENCE, PUSH_REFERENCE];
