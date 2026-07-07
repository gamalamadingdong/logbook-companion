import { describe, expect, it } from 'vitest';
import { buildManualWorkoutLogInsert, buildWorkoutNameUpdates } from './workoutService';

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
            perceivedExertion: 7,
            plannedWeekNumber: 1,
            plannedDaySlot: 0,
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
            perceived_exertion: 7,
            notes: '[tb:slot:0]',
        });
        expect(insert.raw_data).toMatchObject({
            source: 'training_block_manual_entry',
            mode: 'row',
            planned_week_number: 1,
            planned_day_slot: 0,
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
});
