import { describe, expect, it } from 'vitest';

import {
    buildTrainingBlockEnrollmentInsert,
    buildTrainingBlockLogReviewUpsert,
    reviewRowToOverride,
    templateRowsToTrainingBlockPlan,
    type TrainingBlockLogReviewRow,
} from './trainingBlockService';

describe('trainingBlockService builders', () => {
    it('builds a personal enrollment insert without duplicating completed workouts', () => {
        expect(buildTrainingBlockEnrollmentInsert({
            userId: 'user-1',
            templateKey: 'rowing_12_week_2026_v1',
            templateId: 'template-1',
            startDate: '2026-07-06',
            endDate: '2026-09-27',
            isActive: true,
        })).toMatchObject({
            user_id: 'user-1',
            template_id: 'template-1',
            template_key: 'rowing_12_week_2026_v1',
            start_date: '2026-07-06',
            end_date: '2026-09-27',
            is_active: true,
            status: 'active',
            metadata: {
                source: 'training_block_enrollment',
            },
        });
    });

    it('builds a log review upsert keyed to an existing workout log', () => {
        expect(buildTrainingBlockLogReviewUpsert({
            enrollmentId: 'enrollment-1',
            userId: 'user-1',
            workoutLogId: 'workout-1',
            plannedWeekNumber: 2,
            plannedDaySlot: 3,
            plannedSessionKey: 'thu_5x1500-primary',
            status: 'modified',
            keySessionCredit: 'partial',
            strengthStatus: 'not_scheduled',
        })).toMatchObject({
            enrollment_id: 'enrollment-1',
            user_id: 'user-1',
            workout_log_id: 'workout-1',
            planned_week_number: 2,
            planned_day_slot: 3,
            planned_session_key: 'thu_5x1500-primary',
            status: 'modified',
            key_session_credit: 'partial',
            strength_status: 'not_scheduled',
            metadata: {
                source: 'training_block_review',
            },
        });
    });

    it('maps persisted template rows into the existing in-memory plan shape', () => {
        const plan = templateRowsToTrainingBlockPlan({
            template: {
                id: 'template-1',
                template_key: 'rowing_12_week_2026_v1',
                name: '12-week Pete Block',
                description: null,
                version: 1,
                status: 'published',
                source: 'logbook_companion',
                duration_weeks: 12,
                default_start_date: '2026-07-06',
                metadata: {},
                created_at: '2026-07-07T00:00:00Z',
                updated_at: '2026-07-07T00:00:00Z',
            },
            days: [
                {
                    id: 'day-2',
                    template_id: 'template-1',
                    week_number: 1,
                    day_slot: 1,
                    day_of_week: 'Day 2',
                    category: 'erg',
                    planned_distance_meters: 8000,
                    target_distance_meters: 50000,
                    reference: null,
                    metadata: {},
                    created_at: '2026-07-07T00:00:00Z',
                    updated_at: '2026-07-07T00:00:00Z',
                },
                {
                    id: 'day-1',
                    template_id: 'template-1',
                    week_number: 1,
                    day_slot: 0,
                    day_of_week: 'Day 1',
                    category: 'erg',
                    planned_distance_meters: 8500,
                    target_distance_meters: 50000,
                    reference: { warmup: [], core: [], stretching: [], routines: [] },
                    metadata: {},
                    created_at: '2026-07-07T00:00:00Z',
                    updated_at: '2026-07-07T00:00:00Z',
                },
            ],
            sessions: [
                {
                    id: 'session-2',
                    template_day_id: 'day-1',
                    session_key: 'strength-pull',
                    title: 'Strength (pull)',
                    planned_rwn: null,
                    workout_template_id: null,
                    support_prescription: { kind: 'strength', title: 'Strength (pull)' },
                    family: 'strength_pull',
                    role: 'strength',
                    source: 'strength',
                    expected_distance_meters: null,
                    expected_duration_minutes: null,
                    target_split_seconds_per_500m: null,
                    intervals: null,
                    instructions: ['Quality reps'],
                    counts_toward_weekly_volume: false,
                    is_key_session: false,
                    sort_order: 2,
                    metadata: {},
                    created_at: '2026-07-07T00:00:00Z',
                    updated_at: '2026-07-07T00:00:00Z',
                },
                {
                    id: 'session-1',
                    template_day_id: 'day-1',
                    session_key: 'mon-primary',
                    title: 'Row anchor',
                    planned_rwn: '8x500m/3:30r',
                    workout_template_id: 'template-workout-1',
                    support_prescription: null,
                    family: 'mon_8x500',
                    role: 'primary',
                    source: 'erg',
                    expected_distance_meters: 4000,
                    expected_duration_minutes: null,
                    target_split_seconds_per_500m: null,
                    intervals: null,
                    instructions: ['Controlled'],
                    counts_toward_weekly_volume: true,
                    is_key_session: true,
                    sort_order: 1,
                    metadata: {},
                    created_at: '2026-07-07T00:00:00Z',
                    updated_at: '2026-07-07T00:00:00Z',
                },
            ],
        }, '2026-08-03');

        expect(plan.start_date).toBe('2026-08-03');
        expect(plan.end_date).toBe('2026-10-25');
        expect(plan.days.map((day) => day.date)).toEqual(['2026-08-03', '2026-08-04']);
        expect(plan.days[0].sessions.map((session) => session.id)).toEqual(['mon-primary', 'strength-pull']);
        expect(plan.days[0].sessions[0]).toMatchObject({
            planned_rwn: '8x500m/3:30r',
            workout_template_id: 'template-workout-1',
            family: 'mon_8x500',
            is_key_session: true,
        });
        expect(plan.days[0].sessions[1].support_prescription).toMatchObject({
            kind: 'strength',
            title: 'Strength (pull)',
        });
    });

    it('uses the persisted template default start date when no enrollment start is supplied', () => {
        const plan = templateRowsToTrainingBlockPlan({
            template: {
                id: 'template-1',
                template_key: 'rowing_12_week_2026_v1',
                name: '12-week Pete Block',
                description: null,
                version: 1,
                status: 'published',
                source: 'logbook_companion',
                duration_weeks: 12,
                default_start_date: '2026-07-06',
                metadata: {},
                created_at: '2026-07-07T00:00:00Z',
                updated_at: '2026-07-07T00:00:00Z',
            },
            days: [{
                id: 'day-1',
                template_id: 'template-1',
                week_number: 1,
                day_slot: 0,
                day_of_week: 'Day 1',
                category: 'erg',
                planned_distance_meters: 0,
                target_distance_meters: 50000,
                reference: null,
                metadata: {},
                created_at: '2026-07-07T00:00:00Z',
                updated_at: '2026-07-07T00:00:00Z',
            }],
            sessions: [],
        });

        expect(plan.start_date).toBe('2026-07-06');
        expect(plan.days[0].date).toBe('2026-07-06');
    });


    it('converts persisted review rows into the override shape used by matching', () => {
        const row = {
            status: 'swapped',
            key_session_credit: 'no',
            strength_status: 'completed',
            planned_day_slot: 0,
        } as TrainingBlockLogReviewRow;

        expect(reviewRowToOverride(row)).toEqual({
            status: 'swapped',
            key_session_credit: 'no',
            strength_status: 'completed',
            planned_day_slot: 0,
        });
    });
});
