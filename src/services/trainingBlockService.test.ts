import { describe, expect, it } from 'vitest';

import {
    buildTrainingBlockEnrollmentInsert,
    buildTrainingBlockLogReviewUpsert,
    buildTrainingBlockSupportCompletionUpsert,
    computeTrainingBlockEndDate,
    reviewRowToOverride,
    templateRowsToTrainingBlockPlan,
    type TrainingBlockLogReviewRow,
} from './trainingBlockService';

describe('trainingBlockService builders', () => {
    it('computes enrollment end dates from fixed template duration', () => {
        expect(computeTrainingBlockEndDate('2026-08-03', 12)).toBe('2026-10-25');
        expect(computeTrainingBlockEndDate('2026-08-05', 1)).toBe('2026-08-11');
    });

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

    it('builds a scheduled enrollment insert without marking it active', () => {
        expect(buildTrainingBlockEnrollmentInsert({
            userId: 'user-1',
            templateKey: 'intermediate_2k_8_week_v1',
            templateId: 'template-2',
            startDate: '2026-10-26',
            endDate: '2026-12-20',
            isActive: false,
            status: 'scheduled',
        })).toMatchObject({
            user_id: 'user-1',
            template_id: 'template-2',
            template_key: 'intermediate_2k_8_week_v1',
            start_date: '2026-10-26',
            end_date: '2026-12-20',
            is_active: false,
            status: 'scheduled',
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

    it('builds support completion upserts without creating workout log data', () => {
        expect(buildTrainingBlockSupportCompletionUpsert({
            enrollmentId: 'enrollment-1',
            userId: 'user-1',
            templateSessionId: 'template-session-1',
            plannedWeekNumber: 1,
            plannedDaySlot: 0,
            plannedSessionKey: 'strength-pull',
            scheduledDate: '2026-07-06',
            supportSessionTemplateId: 'support-template-1',
            status: 'modified',
            minutesCompleted: 28,
            perceivedExertion: 6,
            painFlag: true,
            notes: 'Swapped deadlift for RDL.',
        })).toMatchObject({
            enrollment_id: 'enrollment-1',
            user_id: 'user-1',
            template_session_id: 'template-session-1',
            planned_week_number: 1,
            planned_day_slot: 0,
            planned_session_key: 'strength-pull',
            scheduled_date: '2026-07-06',
            support_session_template_id: 'support-template-1',
            status: 'modified',
            minutes_completed: 28,
            perceived_exertion: 6,
            pain_flag: true,
            notes: 'Swapped deadlift for RDL.',
            metadata: {
                source: 'training_block_support_completion',
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
                    support_prescription: { kind: 'strength', title: 'Legacy Strength (pull)' },
                    support_session_template_id: 'support-template-pull',
                    resolved_support_prescription: {
                        kind: 'strength',
                        title: 'Strength (pull)',
                        focus: ['Back'],
                        exercises: [{ name: 'Deadlift or Romanian Deadlift', sets: 4, reps: '6-8' }],
                        notes: ['1-2 reps in reserve.'],
                    },
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
                    support_session_template_id: null,
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
                {
                    id: 'session-3',
                    template_day_id: 'day-1',
                    session_key: 'flush-1',
                    title: 'Flush 4.5000000000000000k',
                    planned_rwn: '4500m',
                    workout_template_id: null,
                    support_prescription: null,
                    support_session_template_id: null,
                    family: 'flush_standard_4to5k',
                    role: 'supplemental',
                    source: 'erg',
                    expected_distance_meters: 4500,
                    expected_duration_minutes: null,
                    target_split_seconds_per_500m: null,
                    intervals: null,
                    instructions: ['Easy'],
                    counts_toward_weekly_volume: true,
                    is_key_session: false,
                    sort_order: 3,
                    metadata: {},
                    created_at: '2026-07-07T00:00:00Z',
                    updated_at: '2026-07-07T00:00:00Z',
                },
            ],
        }, '2026-08-03');

        expect(plan.start_date).toBe('2026-08-03');
        expect(plan.end_date).toBe('2026-10-25');
        expect(plan.days.map((day) => day.date)).toEqual(['2026-08-03', '2026-08-04']);
        expect(plan.days[0].sessions.map((session) => session.id)).toEqual(['mon-primary', 'strength-pull', 'flush-1']);
        expect(plan.days[0].sessions[0]).toMatchObject({
            planned_rwn: '8x500m/3:30r',
            workout_template_id: 'template-workout-1',
            family: 'mon_8x500',
            is_key_session: true,
        });
        expect(plan.days[0].sessions[1]).toMatchObject({
            support_session_template_id: 'support-template-pull',
            support_prescription: {
                kind: 'strength',
                title: 'Strength (pull)',
                exercises: [{ name: 'Deadlift or Romanian Deadlift', sets: 4, reps: '6-8' }],
            },
        });
        expect(plan.days[0].sessions[2]).toMatchObject({
            title: 'Flush 4.5 km',
            expected_distance_meters: 4500,
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
            planned_session_key: 'mon-primary',
        } as TrainingBlockLogReviewRow;

        expect(reviewRowToOverride(row)).toEqual({
            status: 'swapped',
            key_session_credit: 'no',
            strength_status: 'completed',
            planned_day_slot: 0,
            planned_session_key: 'mon-primary',
        });
    });
});
