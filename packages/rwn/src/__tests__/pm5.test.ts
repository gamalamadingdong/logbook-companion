import { describe, expect, it } from 'vitest';
import { parseRWN } from '../parser';
import { translateWorkoutToPm5 } from '../pm5';

describe('PM5 translation', () => {
    it('translates a fixed interval core and preserves repeat-count guidance', () => {
        const result = translateWorkoutToPm5(parseRWN('8x500m/3:30r')!);
        expect(result).toMatchObject({
            mode: 'prompt_only',
            workout: { _v: 1, type: 'interval_distance', split_value: 500, rest: 210, repeats: 8 },
        });
        expect(result.notes[0]).toContain('complete 8 reps');
    });

    it('translates a PM5-native fixed distance exactly', () => {
        const result = translateWorkoutToPm5(parseRWN('2000m')!);
        expect(result).toMatchObject({ mode: 'exact', workout: { type: 'fixed_distance', value: 2000 }, notes: [] });
    });

    it('retains non-native orchestration as prompt-only guidance', () => {
        const result = translateWorkoutToPm5(parseRWN('partner(on=4x500m/1:00r,off=wait,switch=every_rep)')!);
        expect(result.mode).toBe('prompt_only');
        expect(result.workout?.type).toBe('interval_distance');
        expect(result.notes.some((note) => note.includes("Session extension 'partner'"))).toBe(true);
    });

    it('rejects calorie work without weakening RWN', () => {
        const result = translateWorkoutToPm5(parseRWN('v500m/40cal/500m')!);
        expect(result.mode).toBe('unsupported');
        expect(result.workout).toBeNull();
        expect(result.notes[0]).toContain('calorie');
    });
});
