import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../components/ui';
import { WorkoutHistoryContent, getWorkoutHistoryStats, type WorkoutHistoryRow } from './WorkoutHistory';

vi.mock('recharts', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: passthrough,
    LineChart: passthrough,
    CartesianGrid: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
    ReferenceLine: passthrough,
    Label: () => <div />,
    Legend: () => <div />,
    Line: () => <div />,
  };
});

vi.mock('../services/workoutService', () => ({
  workoutService: {
    getWorkoutHistory: vi.fn(),
  },
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

const noop = () => undefined;

const sampleHistory: WorkoutHistoryRow[] = [
  { id: 'latest', date: '2026-08-03T00:00:00.000Z', watts: 310, avg_split: 108.4, distance: 2000, time: 434.2 },
  { id: 'middle', date: '2026-08-02T00:00:00.000Z', watts: 295, avg_split: 110.5, distance: 2000, time: 439.1 },
  { id: 'earliest', date: '2026-08-01T00:00:00.000Z', watts: 280, avg_split: 112.9, distance: 2000, time: 445.6 },
];

describe('getWorkoutHistoryStats', () => {
  it('computes best, rounded average, and signed trend from loaded history rows', () => {
    expect(getWorkoutHistoryStats(sampleHistory)).toEqual({
      best: 310,
      average: 295,
      trend: 30,
    });
  });
});

describe('WorkoutHistoryContent', () => {
  it('renders the stat tiles before the progress chart', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <WorkoutHistoryContent
          history={sampleHistory}
          baselineWatts={null}
          workoutName="2k Test"
          setShowTemplateLinking={noop}
          setLoadingTemplates={noop}
          setAvailableTemplates={noop}
        />
      </MemoryRouter>
    );

    expect(markup).toContain('Best');
    expect(markup).toContain('310w');
    expect(markup).toContain('Average');
    expect(markup).toContain('295w');
    expect(markup).toContain('Trend');
    expect(markup).toContain('+30w');
    expect(markup.indexOf('Best')).toBeLessThan(markup.indexOf('Progress (Watts)'));
    expect(markup.indexOf('Average')).toBeLessThan(markup.indexOf('Progress (Watts)'));
    expect(markup.indexOf('Trend')).toBeLessThan(markup.indexOf('Progress (Watts)'));
  });

  it('leaves the empty-state copy unchanged for the no-history path', () => {
    const markup = renderToStaticMarkup(
      <div className="min-h-screen bg-neutral-950 p-12">
        <EmptyState
          title="No workouts found"
          description="No workouts match your current filters."
          icon={<div />}
        />
      </div>
    );

    expect(markup).toContain('No workouts found');
    expect(markup).toContain('No workouts match your current filters.');
  });
});
