import { describe, expect, it } from 'vitest';
import { buildManualWorkoutLogInsert, buildManualWorkoutLogUpdate, buildWorkoutNameUpdates } from './workoutService';

describe('buildWorkoutNameUpdates', () => {
    it('normalizes a manual RWN override into canonical matching metadata', () => {
        expect(buildWorkoutNameUpdates({ manualRWN: '  4x500m/1:00r  ' })).toEqual({
            manual_rwn: '4x500m/1:00r',
            canonical_name: '4x500m/1:00r',
            canonical_signature: '4x500m/1:00r',
            template_id: null,
            match_confidence: null,
            match_reason: null,
        });
    });

    it('clears manual RWN without replacing existing canonical metadata when the override is blank', () => {
        expect(buildWorkoutNameUpdates({ manualRWN: '   ' })).toEqual({
            manual_rwn: null,
        });
    });

    it('can update benchmark state independently', () => {
        expect(buildWorkoutNameUpdates({ isBenchmark: true })).toEqual({
            is_benchmark: true,
        });
    });
});


describe('buildManualWorkoutLogInsert', () => {
    it('creates canonical metadata for deliberate manual rowing entries', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-06T16:00:00.000Z',
            mode: 'row',
            manualRWN: '  8x500m/3:30r  ',
            distanceMeters: 4000,
            durationSeconds: 1800,
            avgSplit500m: 225,
            perceivedExertion: 7,
            plannedWeekNumber: 1,
            plannedDaySlot: 0,
            plannedSessionKey: 'mon_8x500-primary',
        });

        expect(insert).toMatchObject({
            user_id: 'user-1',
            completed_at: '2026-07-06T16:00:00.000Z',
            source: 'manual',
            workout_type: 'row',
            workout_name: '8x500m/3:30r',
            manual_rwn: '8x500m/3:30r',
            canonical_name: '8x500m/3:30r',
            canonical_signature: '8x500m/3:30r',
            distance_meters: 4000,
            duration_seconds: 1800,
            duration_minutes: 30,
            avg_split_500m: 225,
            perceived_exertion: 7,
            notes: '[tb:slot:0] [tb:session:mon_8x500-primary]',
        });
        expect(insert.raw_data).toMatchObject({
            source: 'training_block_manual_entry',
            mode: 'row',
            planned_week_number: 1,
            planned_day_slot: 0,
            planned_session_key: 'mon_8x500-primary',
            avg_split_500m: 225,
        });
    });


    it('builds editable manual workout updates without changing ownership fields', () => {
        const update = buildManualWorkoutLogUpdate({
            userId: 'user-1',
            completedAt: '2026-07-06T17:30:00.000Z',
            mode: 'row',
            manualRWN: '8x500m/3:30r',
            distanceMeters: 4100,
            durationSeconds: 1810,
            avgSplit500m: 220.7,
            perceivedExertion: 8,
            notes: 'Edited after review',
            plannedWeekNumber: 1,
            plannedDaySlot: 0,
            plannedSessionKey: 'mon_8x500-primary',
        });

        expect(update).toMatchObject({
            completed_at: '2026-07-06T17:30:00.000Z',
            source: 'manual',
            workout_type: 'row',
            distance_meters: 4100,
            duration_seconds: 1810,
            avg_split_500m: 220.7,
            perceived_exertion: 8,
            notes: 'Edited after review [tb:slot:0] [tb:session:mon_8x500-primary]',
        });
        expect(update).not.toHaveProperty('user_id');
        expect(update.raw_data).toMatchObject({
            planned_session_key: 'mon_8x500-primary',
            avg_split_500m: 220.7,
        });
    });

    it('allows strength/support completion without lossy canonical RWN', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-08T16:00:00.000Z',
            mode: 'strength',
            distanceMeters: 5000,
            durationSeconds: 2400,
            manualRWN: '5000m',
            notes: 'Push routine complete',
            plannedWeekNumber: 1,
            plannedDaySlot: 2,
        });

        expect(insert).toMatchObject({
            source: 'manual',
            workout_name: 'Strength work',
            workout_type: 'strength',
            manual_rwn: null,
            canonical_name: null,
            canonical_signature: null,
            distance_meters: null,
            duration_seconds: 2400,
            duration_minutes: 40,
            notes: 'Push routine complete [tb:slot:2] [tb:strength:completed]',
        });
    });

    it('marks quick training block completions so checkbox mistakes can be reversed', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-08T16:00:00.000Z',
            mode: 'strength',
            notes: 'Strength (push) complete',
            plannedWeekNumber: 1,
            plannedDaySlot: 2,
            plannedSessionKey: 'wed_strength_push-support',
            trainingBlockQuickCompletionKey: 'strength-push',
        });

        expect(insert.notes).toBe('Strength (push) complete [tb:slot:2] [tb:session:wed_strength_push-support] [tb:strength:completed] [tb:quick:strength-push]');
        expect(insert.raw_data).toMatchObject({
            planned_session_key: 'wed_strength_push-support',
            training_block_quick_completion_key: 'strength-push',
        });
    });

    it('marks support-prep quick completions without pretending they are strength work', () => {
        const insert = buildManualWorkoutLogInsert({
            userId: 'user-1',
            completedAt: '2026-07-08T16:00:00.000Z',
            mode: 'support',
            notes: 'Support prep complete',
            plannedWeekNumber: 1,
            plannedDaySlot: 2,
            trainingBlockQuickCompletionKey: 'support-prep',
        });

        expect(insert.notes).toBe('Support prep complete [tb:slot:2] [tb:quick:support-prep]');
        expect(insert.workout_type).toBe('support');
        expect(insert.raw_data).toMatchObject({
            training_block_quick_completion_key: 'support-prep',
        });
    });
});
