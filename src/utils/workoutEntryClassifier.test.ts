import { describe, expect, test } from 'vitest';
import { parseCanonicalForEntry, parseWorkoutStructureForEntry } from './workoutEntryClassifier';

describe('workoutEntryClassifier', () => {
  test('classifies v-prefixed variable distance list as variable_interval', () => {
    const shape = parseCanonicalForEntry('v500m/1000m/1500m');

    expect(shape.type).toBe('variable_interval');
    expect(shape.reps).toBe(3);
    expect(shape.variableReps).toEqual([
      { fixedType: 'distance', fixedValue: 500, label: '500m' },
      { fixedType: 'distance', fixedValue: 1000, label: '1000m' },
      { fixedType: 'distance', fixedValue: 1500, label: '1500m' },
    ]);
  });

  test('classifies variable time ladder with per-rep rest as variable_interval', () => {
    const shape = parseCanonicalForEntry('1:00/5:00r + 3:00/5:00r + 7:00/5:00r');

    expect(shape.type).toBe('variable_interval');
    expect(shape.reps).toBe(3);
    expect(shape.variableReps).toEqual([
      { fixedType: 'time', fixedValue: 60, label: '1:00' },
      { fixedType: 'time', fixedValue: 180, label: '3:00' },
      { fixedType: 'time', fixedValue: 420, label: '7:00' },
    ]);
  });

  test('accepts full-width plus signs in variable ladders', () => {
    const shape = parseCanonicalForEntry('1:00/5:00r ＋ 3:00/5:00r ＋ 7:00/5:00r');

    expect(shape.type).toBe('variable_interval');
    expect(shape.reps).toBe(3);
  });

  test('classifies variable ladder from workout_structure JSON', () => {
    const shape = parseWorkoutStructureForEntry({
      type: 'variable',
      steps: [
        { type: 'work', value: 60, duration_type: 'time', tags: [] },
        { type: 'rest', value: 300, duration_type: 'time' },
        { type: 'work', value: 180, duration_type: 'time', tags: [] },
        { type: 'rest', value: 300, duration_type: 'time' },
        { type: 'work', value: 420, duration_type: 'time', tags: [] },
        { type: 'rest', value: 300, duration_type: 'time' },
      ],
      tags: [],
    });

    expect(shape?.type).toBe('variable_interval');
    expect(shape?.reps).toBe(3);
    expect(shape?.variableReps).toEqual([
      { fixedType: 'time', fixedValue: 60, label: '1:00' },
      { fixedType: 'time', fixedValue: 180, label: '3:00' },
      { fixedType: 'time', fixedValue: 420, label: '7:00' },
    ]);
  });
});
