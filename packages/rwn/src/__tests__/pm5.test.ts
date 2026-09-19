import { describe, expect, it } from 'vitest';
import { parseRWN } from '../parser';
import { translateWorkoutToPm5 } from '../pm5';

describe('PM5 translation', () => {
    it('translates an exact fixed interval workout', () => {
        const result = translateWorkoutToPm5(parseRWN('4x500m/1:00r')!);
        expect(result).toMatchObject({
            mode: 'exact',
            workout: { _v: 1, type: 'interval_distance', split_value: 500, rest: 60, repeats: 4 },
            notes: [],
        });
    });

    it('retains non-native orchestration as prompt-only guidance', () => {
        const result = translateWorkoutToPm5(parseRWN('partner(on=4x500m/1:00r,off=wait,switch=every_rep)')!);
        expect(result.mode).toBe('prompt_only');
        expect(result.workout?.type).toBe('interval_distance');
        expect(result.notes[0]).toContain("Session extension 'partner'");
    });

    it('rejects calorie work without weakening RWN', () => {
        const result = translateWorkoutToPm5(parseRWN('v500m/40cal/500m')!);
        expect(result.mode).toBe('unsupported');
        expect(result.workout).toBeNull();
        expect(result.notes[0]).toContain('calorie');
    });
});
