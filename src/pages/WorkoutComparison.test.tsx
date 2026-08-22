import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { parseLocalDate } from '../utils/dateUtils';
import { METRIC_HEADINGS, WorkoutSummaryCard } from './WorkoutComparison';

describe('Workout Comparison metric headings', () => {
  it.each([
    ['watts', 'Power Overlay'],
    ['pace', 'Pace Overlay'],
    ['rate', 'Stroke Rate'],
    ['hr', 'Heart Rate'],
  ] as const)('maps %s to %s', (metric, heading) => {
    expect(METRIC_HEADINGS[metric]).toBe(heading);
  });
});

describe('Workout Comparison date displays', () => {
  it('keeps date-only values on their recorded calendar day in a negative UTC offset', () => {
    expect(parseLocalDate('2024-01-15').toLocaleDateString('en-US')).toBe('1/15/2024');
  });

  it('preserves timestamp semantics for ISO date-time values', () => {
    expect(parseLocalDate('2024-01-15T00:00:00.000Z').toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });
});

describe('Workout Comparison selected workout removal', () => {
  it('activates an explicitly named remove control to return to the base workout comparison', () => {
    const baseWorkoutId = 'workout-a';
    const navigate = vi.fn();
    const removeComparison = () => navigate(`/compare/${baseWorkoutId}`);
    const comparisonCard = React.createElement(WorkoutSummaryCard, {
      workout: {
        id: baseWorkoutId,
        workout_name: 'Base workout',
        distance_meters: 2000,
        duration_seconds: 420,
        date: '2024-01-15',
      },
      title: 'Comparison',
      onClear: removeComparison,
    });
    const markup = renderToStaticMarkup(comparisonCard);

    expect(markup).toContain('Base workout');
    expect(markup).toContain('aria-label="Remove comparison workout"');

    removeComparison();

    expect(navigate).toHaveBeenCalledWith(`/compare/${baseWorkoutId}`);
  });
});
