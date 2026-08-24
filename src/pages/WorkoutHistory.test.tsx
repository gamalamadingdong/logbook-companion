import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../components/ui';
import { WorkoutHistoryContent, WorkoutHistoryLoadError, getWorkoutHistoryPbAttemptId, getWorkoutHistoryStats, type WorkoutHistoryRow } from './WorkoutHistory';

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

describe('getWorkoutHistoryPbAttemptId', () => {
  it('returns the highest-watts attempt id', () => {
    expect(getWorkoutHistoryPbAttemptId(sampleHistory)).toBe('latest');
  });

  it('breaks watts ties by the most recent attempt date', () => {
    const tiedHistory: WorkoutHistoryRow[] = [
      { id: 'most-recent-pb', date: '2026-08-03T00:00:00.000Z', watts: 310, avg_split: 108.1, distance: 2000, time: 433.7 },
      { id: 'older-max', date: '2026-08-02T00:00:00.000Z', watts: 310, avg_split: 108.8, distance: 2000, time: 436.0 },
      { id: 'lower', date: '2026-08-01T00:00:00.000Z', watts: 295, avg_split: 110.5, distance: 2000, time: 439.1 },
    ];

    expect(getWorkoutHistoryPbAttemptId(tiedHistory)).toBe('most-recent-pb');
  });

  it('returns the only attempt id for a single-attempt history', () => {
    const singleAttemptHistory: WorkoutHistoryRow[] = [
      { id: 'only', date: '2026-08-03T00:00:00.000Z', watts: 305, avg_split: 109.2, distance: 2000, time: 437.5 },
    ];

    expect(getWorkoutHistoryPbAttemptId(singleAttemptHistory)).toBe('only');
  });
});

describe('WorkoutHistoryContent', () => {
  it('renders an explicit load error with an accessible retry action', () => {
    const markup = renderToStaticMarkup(
      <WorkoutHistoryLoadError onRetry={noop} />
    );

    expect(markup).toContain('Unable to load workout history');
    expect(markup).toContain('Please try again.');
    expect(markup).toContain('aria-label="Retry loading workout history"');
    expect(markup).not.toContain('No workouts found');
  });

  it('shows a PB badge on the single highest-watts attempt row only', () => {
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

    expect(markup).toContain('310w');
    expect(markup).toContain('PB');
    expect(markup.match(/>PB</g)?.length).toBe(1);
    expect(markup.indexOf('310w')).toBeLessThan(markup.indexOf('PB'));
  });

  it('breaks watts ties by marking only the most recent max-watts attempt as PB', () => {
    const tiedHistory: WorkoutHistoryRow[] = [
      { id: 'most-recent-pb', date: '2026-08-03T00:00:00.000Z', watts: 310, avg_split: 108.1, distance: 2000, time: 433.7 },
      { id: 'older-max', date: '2026-08-02T00:00:00.000Z', watts: 310, avg_split: 108.8, distance: 2000, time: 436.0 },
      { id: 'lower', date: '2026-08-01T00:00:00.000Z', watts: 295, avg_split: 110.5, distance: 2000, time: 439.1 },
    ];

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <WorkoutHistoryContent
          history={tiedHistory}
          baselineWatts={null}
          workoutName="2k Test"
          setShowTemplateLinking={noop}
          setLoadingTemplates={noop}
          setAvailableTemplates={noop}
        />
      </MemoryRouter>
    );

    expect(markup.match(/>PB</g)?.length).toBe(1);
    expect(markup).toContain('310w');
    expect(markup.indexOf('310w')).toBeLessThan(markup.indexOf('PB'));
  });

  it('marks the only attempt as PB in a single-attempt history', () => {
    const singleAttemptHistory: WorkoutHistoryRow[] = [
      { id: 'only', date: '2026-08-03T00:00:00.000Z', watts: 305, avg_split: 109.2, distance: 2000, time: 437.5 },
    ];

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <WorkoutHistoryContent
          history={singleAttemptHistory}
          baselineWatts={null}
          workoutName="2k Test"
          setShowTemplateLinking={noop}
          setLoadingTemplates={noop}
          setAvailableTemplates={noop}
        />
      </MemoryRouter>
    );

    expect(markup).toContain('305w');
    expect(markup.match(/>PB</g)?.length).toBe(1);
    expect(markup.indexOf('305w')).toBeLessThan(markup.indexOf('PB'));
  });

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

  it('renders the best and average watt paces beneath their values', () => {
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

    expect(markup).toContain('1:44.1/500m');
    expect(markup).toContain('1:45.9/500m');
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
