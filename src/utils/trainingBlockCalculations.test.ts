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

    it('aligns a shifted exact canonical workout to its matching plan slot inside the same week', () => {
        const plan = buildRowing12WeekPlan();
        const monday = plan.days[0];
        const tuesday = plan.days[1];
        const logs: TrainingBlockActualLogEvent[] = [
            {
                workout_id: 'shifted-monday-key',
                date: tuesday.date,
                source: 'concept2',
                canonical_name: '8x500m/3:30r',
                workout_name: 'FixedDistanceInterval',
                workout_type: 'FixedDistanceInterval',
                distance_meters: 4000,
            },
        ];

        const aligned = alignLogsToPlanDays(plan, logs, 'slot');
        expect(aligned.get(`${monday.week_number}:${monday.day_slot}`)?.map((log) => log.workout_id)).toContain('shifted-monday-key');
        expect(aligned.get(`${tuesday.week_number}:${tuesday.day_slot}`)).toBeUndefined();

        const mondaySummary = summarizeDayProgress(monday, aligned.get(`${monday.week_number}:${monday.day_slot}`) ?? []);
        expect(mondaySummary.status).toBe('as_written');
        expect(mondaySummary.key_session_credit).toBe('yes');
    });

    it('matches manual RWN entries to the plan without requiring Concept2 data', () => {
        const plan = buildRowing12WeekPlan();
        const monday = plan.days[0];
        const logs: TrainingBlockActualLogEvent[] = [
            {
                workout_id: 'manual-rwn-key',
                date: monday.date,
                source: 'manual',
                manual_rwn: '8x500m/3:30r',
                workout_name: 'Manual intervals',
                workout_type: 'manual',
                distance_meters: 4000,
            },
        ];

        const summary = summarizeDayProgress(monday, logs);
        expect(summary.status).toBe('as_written');
        expect(summary.key_session_credit).toBe('yes');
    });

    it('pins manually assigned logs to the selected planned session and ignores does-not-count logs', () => {
        const plan = buildRowing12WeekPlan();
        const monday = plan.days[0];
        const tuesday = plan.days[1];
        const logs: TrainingBlockActualLogEvent[] = [
            {
                workout_id: 'manual-pin-to-tuesday',
                date: monday.date,
                source: 'concept2',
                canonical_name: '8x500m/3:30r',
                workout_name: 'Intervals',
                workout_type: 'FixedDistanceInterval',
                distance_meters: 4000,
                planned_session_key: tuesday.sessions[0].id,
            },
            {
                workout_id: 'ignored-exact-monday',
                date: monday.date,
                source: 'concept2',
                canonical_name: '8x500m/3:30r',
                workout_name: 'Ignored intervals',
                workout_type: 'FixedDistanceInterval',
                distance_meters: 4000,
                status: 'skipped',
            },
        ];

        const aligned = alignLogsToPlanDays(plan, logs, 'slot');
        expect(aligned.get(`${monday.week_number}:${monday.day_slot}`)).toBeUndefined();
        expect(aligned.get(`${tuesday.week_number}:${tuesday.day_slot}`)?.map((log) => log.workout_id)).toEqual(['manual-pin-to-tuesday']);

        const weekSummary = summarizeWeekProgress(plan, logs).find((summary) => summary.week_number === monday.week_number);
        const mondaySummary = weekSummary?.day_summaries.find((summary) => summary.date === monday.date);
        const tuesdaySummary = weekSummary?.day_summaries.find((summary) => summary.date === tuesday.date);
        expect(mondaySummary?.actual_distance_meters).toBe(0);
        expect(tuesdaySummary?.actual_distance_meters).toBe(4000);
        expect(weekSummary?.actual_distance_meters).toBe(4000);
        expect(weekSummary?.logged_session_count).toBe(1);
        expect(weekSummary?.completed_day_count).toBe(1);
        expect(weekSummary?.planned_session_count).toBeGreaterThan(0);
        const ignoredOnlySummary = summarizeDayProgress(monday, [logs[1]]);
        expect(ignoredOnlySummary.actual_distance_meters).toBe(0);
        expect(ignoredOnlySummary.logged_session_count).toBe(0);
    });

});
