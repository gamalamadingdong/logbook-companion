import { describe, expect, test } from 'vitest';
import { parseCanonicalForEntry } from './workoutEntryClassifier';

describe('workoutEntryClassifier', () => {
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
});
