import { describe, expect, it } from 'vitest';
import { parseRWN, structureToRWN } from '@readyall/rwn';
import {
  buildRwnFromSpec,
  defaultWorkoutBuilderSpec,
  formatRwnDuration,
  type WorkoutBuilderSpec,
} from './workoutBuilder';

const spec = (overrides: Partial<WorkoutBuilderSpec> = {}): WorkoutBuilderSpec => ({
  ...defaultWorkoutBuilderSpec,
  ...overrides,
});

describe('guided workout builder', () => {
  it('formats durations the way RWN writes them', () => {
    expect(formatRwnDuration(60)).toBe('1:00');
    expect(formatRwnDuration(90)).toBe('1:30');
    expect(formatRwnDuration(1200)).toBe('20:00');
    expect(formatRwnDuration(5)).toBe('0:05');
  });

  it('builds steady distance', () => {
    expect(buildRwnFromSpec(spec({ mode: 'steady', measure: 'distance', distanceMeters: 5000 })).rwn)
      .toBe('5000m');
  });

  it('builds steady time', () => {
    expect(buildRwnFromSpec(spec({ mode: 'steady', measure: 'time', durationSeconds: 1800 })).rwn)
      .toBe('30:00');
  });

  it('builds distance intervals with rest', () => {
    expect(buildRwnFromSpec(spec({
      mode: 'intervals', measure: 'distance', repeats: 4, distanceMeters: 500, restSeconds: 60,
    })).rwn).toBe('4x500m/1:00r');
  });

  it('builds time intervals with rest', () => {
    expect(buildRwnFromSpec(spec({
      mode: 'intervals', measure: 'time', repeats: 3, durationSeconds: 1200, restSeconds: 120,
    })).rwn).toBe('3x20:00/2:00r');
  });

  it('produces notation the RWN parser accepts', () => {
    // The builder must never hand the PM5 path notation it would reject.
    const cases: WorkoutBuilderSpec[] = [
      spec({ mode: 'steady', measure: 'distance', distanceMeters: 2000 }),
      spec({ mode: 'steady', measure: 'time', durationSeconds: 3600 }),
      spec({ mode: 'intervals', measure: 'distance', repeats: 8, distanceMeters: 250, restSeconds: 90 }),
      spec({ mode: 'intervals', measure: 'time', repeats: 6, durationSeconds: 60, restSeconds: 60 }),
    ];

    for (const candidate of cases) {
      const built = buildRwnFromSpec(candidate);
      expect(built.errors).toEqual([]);
      expect(built.rwn).not.toBeNull();
      expect(parseRWN(built.rwn as string)).not.toBeNull();
    }
  });

  it('round-trips through the shared serializer', () => {
    const built = buildRwnFromSpec(spec({
      mode: 'intervals', measure: 'distance', repeats: 4, distanceMeters: 500, restSeconds: 60,
    }));
    const structure = parseRWN(built.rwn as string);
    expect(structure).not.toBeNull();
    expect(structureToRWN(structure!)).toBe(built.rwn);
  });

  it('rejects a non-positive distance', () => {
    const built = buildRwnFromSpec(spec({ measure: 'distance', distanceMeters: 0 }));
    expect(built.rwn).toBeNull();
    expect(built.errors).toContain('Enter a distance greater than zero.');
  });

  it('rejects a fractional distance', () => {
    expect(buildRwnFromSpec(spec({ measure: 'distance', distanceMeters: 500.5 })).rwn).toBeNull();
  });

  it('requires rest and repeats for intervals', () => {
    const built = buildRwnFromSpec(spec({ mode: 'intervals', repeats: 0, restSeconds: 0 }));
    expect(built.rwn).toBeNull();
    expect(built.errors).toContain('Enter at least one interval.');
    expect(built.errors).toContain('Enter a rest greater than zero.');
  });

  it('ignores interval fields for steady state', () => {
    // Rest and repeats are irrelevant to a continuous piece and must not block it.
    const built = buildRwnFromSpec(spec({
      mode: 'steady', measure: 'distance', distanceMeters: 6000, repeats: 0, restSeconds: 0,
    }));
    expect(built.rwn).toBe('6000m');
    expect(built.errors).toEqual([]);
  });
});
