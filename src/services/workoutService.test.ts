import { describe, expect, it } from 'vitest';
import { buildWorkoutNameUpdates } from './workoutService';

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
