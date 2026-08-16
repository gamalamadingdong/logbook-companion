import { describe, expect, it } from 'vitest';

import { parseLocalDate } from '../utils/dateUtils';

describe('Workout Comparison date displays', () => {
  it('keeps date-only values on their recorded calendar day in a negative UTC offset', () => {
    expect(parseLocalDate('2024-01-15').toLocaleDateString('en-US')).toBe('1/15/2024');
  });

  it('preserves timestamp semantics for ISO date-time values', () => {
    expect(parseLocalDate('2024-01-15T00:00:00.000Z').toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });
});
