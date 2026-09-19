import { describe, expect, it } from 'vitest';
import { parseRWN } from './rwnParser';
import { lowerWorkoutStructureToPm5 } from './rwnPm5Lowering';

describe('RWN PM5 Lowering', () => {
  it('returns prompt_only when PM5 cannot enforce the fixed-interval repeat cap', () => {
    const parsed = parseRWN('4x500m/1:00r');
    expect(parsed).not.toBeNull();

    const lowered = lowerWorkoutStructureToPm5(parsed!);
    expect(lowered.mode).toBe('prompt_only');
    expect(lowered.activeWorkoutSpec).toMatchObject({
      _v: 1,
      type: 'interval_distance',
      split_value: 500,
      rest: 60,
      repeats: 4,
    });
    expect(lowered.notes[0]).toContain('complete 4 reps');
  });

  it('returns prompt_only for partner orchestration while preserving PM5 core workout', () => {
    const parsed = parseRWN('partner(on=4x500m/1:00r,off=wait,switch=every_rep)');
    expect(parsed).not.toBeNull();

    const lowered = lowerWorkoutStructureToPm5(parsed!);
    expect(lowered.mode).toBe('prompt_only');
    expect(lowered.activeWorkoutSpec).toMatchObject({
      _v: 1,
      type: 'interval_distance',
      split_value: 500,
      rest: 60,
      repeats: 4,
    });
    expect(lowered.notes.some((note) => note.includes("Session extension 'partner'"))).toBe(true);
  });

  it('returns prompt_only for rotate orchestration with variable core', () => {
    const parsed = parseRWN('rotate(stations=4,switch=60s,rounds=3,plan=[500m,60s,500m,60s])');
    expect(parsed).not.toBeNull();

    const lowered = lowerWorkoutStructureToPm5(parsed!);
    expect(lowered.mode).toBe('prompt_only');
    expect(lowered.activeWorkoutSpec?.type).toBe('fixed_distance');
    expect(lowered.notes[0]).toContain("Session extension 'rotate'");
  });

  it('returns unsupported when workout contains calorie-based steps', () => {
    const parsed = parseRWN('v500m/40cal/500m');
    expect(parsed).not.toBeNull();

    const lowered = lowerWorkoutStructureToPm5(parsed!);
    expect(lowered.mode).toBe('unsupported');
    expect(lowered.activeWorkoutSpec).toBeNull();
    expect(lowered.notes[0]).toContain('calorie');
  });
});
