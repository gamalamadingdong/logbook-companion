import { describe, expect, it } from 'vitest';

import {
    alignLogsToPlanDays,
    calculateTrainingLoad,
    plannedDistanceMetersForDay,
    summarizeDayProgress,
    summarizeWeekProgress,
} from './trainingBlockCalculations';
import { buildRowing12WeekPlan } from '../data/rowingTrainingBlockTemplate';
import type { TrainingBlockActualLogEvent, TrainingBlockStrengthStatus, TrainingBlockWorkoutStatus } from '../types/trainingBlock.types';

describe('trainingBlockCalculations', () => {
    it('calculates training load with km * RPE', () => {
        expect(calculateTrainingLoad(10000, 7)).toBe(70);
        expect(calculateTrainingLoad(5000, 6)).toBe(30);
        expect(calculateTrainingLoad(null, 7)).toBeNull();
        expect(calculateTrainingLoad(10000, 11)).toBeNull();
        expect(calculateTrainingLoad(10000, 0)).toBeNull();
    });

    it('summarizes a planned day with explicit log status and credit', () => {
        const plan = buildRowing12WeekPlan();
        const monday = plan.days[0];
        const logs: TrainingBlockActualLogEvent[] = [
            {
                workout_id: 'w1',
                date: monday.date,
                source: 'concept2',
                distance_meters: 10000,
                duration_seconds: 3600,
                perceived_exertion: 7,
                status: 'modified' as TrainingBlockWorkoutStatus,
                key_session_credit: 'partial',
                strength_status: 'completed' as TrainingBlockStrengthStatus,
            },
        ];

        const summary = summarizeDayProgress(monday, logs);

        expect(summary.date).toBe(monday.date);
        expect(summary.planned_distance_meters).toBe(plannedDistanceMetersForDay(monday));
        expect(summary.actual_distance_meters).toBe(10000);
        expect(summary.status).toBe('modified');
        expect(summary.key_session_credit).toBe('partial');
        expect(summary.strength_status).toBe('completed');
        expect(summary.training_load).toBe(70);
        expect(summary.logged_session_count).toBe(1);
    });

    it('builds week summaries with key-session credits and target coverage', () => {
        const plan = buildRowing12WeekPlan();
        const monday = plan.days[0];
        const logs: TrainingBlockActualLogEvent[] = [
            {
                workout_id: 'w1',
                date: monday.date,
                source: 'manual',
                distance_meters: 10000,
                duration_seconds: 3600,
                perceived_exertion: 7,
                status: 'as_written',
                key_session_credit: 'partial',
                strength_status: 'partial',
            },
        ];

        const [summary] = summarizeWeekProgress(plan, logs);
        expect(summary.week_number).toBe(1);
        expect(summary.target_distance_meters).toBe(50000);
        expect(summary.key_session_credits.possible).toBe(2);
        expect(summary.key_session_credits.earned).toBe(0.5);
        expect(summary.key_session_credits.partial).toBe(1);
        expect(summary.key_session_complete).toBe(false);
        expect(summary.target_coverage_ratio).toBeGreaterThan(0);
        expect(summary.day_summaries).toHaveLength(7);
        expect(summary.day_summaries[0].key_session_credit).toBe('partial');
        expect(summary.day_summaries[6].category).toBe('rest');
        expect(summary.delta_to_target_meters).toBeLessThan(0);
    });

    it('handles rest day summaries as non-logged with N/A key-session credit', () => {
        const plan = buildRowing12WeekPlan();
        const sunday = plan.days[6];
        const sundaySummary = summarizeDayProgress(sunday, []);

        expect(sundaySummary.category).toBe('rest');
        expect(sundaySummary.status).toBe('as_written');
        expect(sundaySummary.key_session_credit).toBe('n_a');
        expect(sundaySummary.logged_session_count).toBe(0);
    });

    it('respects explicit day-slot overrides when aligning logs to planned days', () => {
        const plan = buildRowing12WeekPlan();
        const monday = plan.days[0];
        const tuesday = plan.days[1];
        const logs = [
            {
                workout_id: 'slot0',
                date: tuesday.date,
                source: 'manual',
                workout_name: 'Concept2 style row',
                workout_type: '500m intervals',
                distance_meters: 8000,
                planned_day_slot: 0,
            },
            {
                workout_id: 'day1',
                date: tuesday.date,
                source: 'concept2',
                workout_name: 'Cross trainer',
                workout_type: 'spin',
                distance_meters: 5000,
            },
        ] as const;

        const aligned = alignLogsToPlanDays(plan, logs, 'slot');
        const mondayAligned = aligned.get(`${monday.week_number}:${monday.day_slot}`) ?? [];
        const tuesdayAligned = aligned.get(`${tuesday.week_number}:${tuesday.day_slot}`) ?? [];
        const mondayIds = mondayAligned.map((log) => log.workout_id);
        const tuesdayIds = tuesdayAligned.map((log) => log.workout_id);

        expect(mondayIds).toContain('slot0');
        expect(tuesdayIds).toContain('day1');
        expect(mondayIds.every((id) => id !== 'day1')).toBe(true);
    });
});
