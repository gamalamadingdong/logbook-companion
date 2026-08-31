import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../components/ui';
import { WorkoutHistoryContent, WorkoutHistoryLoadError, WorkoutHistoryRangeControls, WorkoutHistorySelectedRangeEmpty, filterWorkoutHistoryByRange, formatWorkoutHistoryDate, getWorkoutHistoryAttemptDeltas, getWorkoutHistoryPbAttemptId, getWorkoutHistoryStats, type WorkoutHistoryRow } from './WorkoutHistory';

vi.mock('recharts', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: passthrough,
    LineChart: ({ children, data }: { children?: React.ReactNode; data?: Array<{ watts: number }> }) => (
      <div data-chart-watts={data?.map(({ watts }) => watts).join(',')}>{children}</div>
    ),
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

describe('formatWorkoutHistoryDate', () => {
  it('preserves a date-only value as its local calendar day', () => {
    expect(formatWorkoutHistoryDate('2024-01-01')).toBe(new Date(2024, 0, 1).toLocaleDateString());
  });

  it('formats ISO date-time values with normal Date semantics', () => {
    const dateTime = '2024-01-01T12:00:00.000Z';

    expect(formatWorkoutHistoryDate(dateTime)).toBe(new Date(dateTime).toLocaleDateString());
  });
});

describe('filterWorkoutHistoryByRange', () => {
  const referenceDate = new Date('2026-08-27T12:00:00.000Z');
  const rangeHistory: WorkoutHistoryRow[] = [
    { id: 'older-than-90-days', date: '2026-05-29T11:59:59.999Z', watts: 250, avg_split: 118, distance: 2000, time: 472 },
    { id: 'at-30-day-cutoff', date: '2026-07-28T12:00:00.000Z', watts: 280, avg_split: 113, distance: 2000, time: 452 },
    { id: 'at-90-day-cutoff', date: '2026-05-29T12:00:00.000Z', watts: 270, avg_split: 115, distance: 2000, time: 460 },
    { id: 'recent', date: '2026-08-26T12:00:00.000Z', watts: 300, avg_split: 110, distance: 2000, time: 440 },
  ];

  it('keeps all rows in their original order for the all-time range', () => {
    const result = filterWorkoutHistoryByRange(rangeHistory, 'all', referenceDate);

    expect(result).toEqual(rangeHistory);
    expect(result).not.toBe(rangeHistory);
  });

  it('includes attempts exactly at the 30-day cutoff without sorting input', () => {
    expect(filterWorkoutHistoryByRange(rangeHistory, '30d', referenceDate).map(({ id }) => id)).toEqual([
      'at-30-day-cutoff',
      'recent',
    ]);
  });

  it('includes attempts exactly at the 90-day cutoff', () => {
    expect(filterWorkoutHistoryByRange(rangeHistory, '90d', referenceDate).map(({ id }) => id)).toEqual([
      'at-30-day-cutoff',
      'at-90-day-cutoff',
      'recent',
    ]);
  });

  it('returns an empty collection when no attempts fall in the selected range', () => {
    expect(filterWorkoutHistoryByRange([rangeHistory[0]], '30d', referenceDate)).toEqual([]);
  });
});

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

describe('getWorkoutHistoryAttemptDeltas', () => {
  it('compares each attempt to the immediately preceding chronological attempt', () => {
    const now = new Date();
    const history: WorkoutHistoryRow[] = [
      { id: 'newest', date: new Date(now.getTime() - 1_000).toISOString(), watts: 310, avg_split: 108, distance: 2000, time: 434 },
      { id: 'oldest', date: new Date(now.getTime() - 3_000).toISOString(), watts: 280, avg_split: 112, distance: 2000, time: 446 },
      { id: 'middle', date: new Date(now.getTime() - 2_000).toISOString(), watts: 290, avg_split: 110, distance: 2000, time: 440 },
    ];

    expect(getWorkoutHistoryAttemptDeltas(history)).toEqual({
      oldest: { baseline: true, watts: null, pace: null },
      middle: { baseline: false, watts: 10, pace: -2 },
      newest: { baseline: false, watts: 20, pace: -2 },
    });
  });

  it('preserves signed regression and unchanged deltas and handles one attempt', () => {
    const now = new Date();
    const history: WorkoutHistoryRow[] = [
      { id: 'later', date: new Date(now.getTime() - 1_000).toISOString(), watts: 300, avg_split: 110, distance: 2000, time: 438 },
      { id: 'baseline', date: new Date(now.getTime() - 2_000).toISOString(), watts: 300, avg_split: 110, distance: 2000, time: 438 },
      { id: 'single', date: now.toISOString(), watts: 300, avg_split: 110, distance: 2000, time: 438 },
    ];

    expect(getWorkoutHistoryAttemptDeltas(history)).toEqual({
      baseline: { baseline: true, watts: null, pace: null },
      later: { baseline: false, watts: 0, pace: 0 },
      single: { baseline: false, watts: 0, pace: 0 },
    });
    expect(getWorkoutHistoryAttemptDeltas([history[2]])).toEqual({
      single: { baseline: true, watts: null, pace: null },
    });
  });
});

describe('WorkoutHistoryContent', () => {
  it('renders controls and uses the selected-range history for count, summary, PB, chart, and attempt rows', () => {
    const referenceDate = new Date('2026-08-27T12:00:00.000Z');
    const history: WorkoutHistoryRow[] = [
      { id: 'outside-range', date: '2026-07-28T11:59:59.999Z', watts: 410, avg_split: 95, distance: 2000, time: 380 },
      { id: 'cutoff', date: '2026-07-28T12:00:00.000Z', watts: 280, avg_split: 113, distance: 2000, time: 452 },
      { id: 'recent-pb', date: '2026-08-26T12:00:00.000Z', watts: 300, avg_split: 110, distance: 2000, time: 440 },
    ];
    const filteredHistory = filterWorkoutHistoryByRange(history, '30d', referenceDate);

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <WorkoutHistoryContent
          history={filteredHistory}
          baselineWatts={null}
          workoutName="2k Test"
          selectedRange="30d"
          setShowTemplateLinking={noop}
          setLoadingTemplates={noop}
          setAvailableTemplates={noop}
        />
      </MemoryRouter>
    );

    expect(markup).toContain('All time');
    expect(markup).toContain('Last 30 days');
    expect(markup).toContain('Last 90 days');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('2 attempts');
    expect(markup).toContain('300w');
    expect(markup).toContain('290w');
    expect(markup).toContain('data-chart-watts="300,280"');
    expect(markup.match(/>PB</g)?.length).toBe(2);
    expect(markup.match(/aria-label="View workout from/g)?.length).toBe(2);
    expect(markup).not.toContain('410w');
  });

  it('renders a selected-range empty state with an all-time recovery action', () => {
    const markup = renderToStaticMarkup(
      <WorkoutHistorySelectedRangeEmpty selectedRange="90d" onSelectedRangeChange={noop} />
    );

    expect(markup).toContain('No attempts in this date range');
    expect(markup).toContain('Try a longer date range or view all workout attempts.');
    expect(markup).toContain('View all time');
    expect(markup).toContain('All time');
    expect(markup).toContain('Last 30 days');
    expect(markup).toContain('Last 90 days');
  });

  it('exposes each date-range control as a pressed button when selected', () => {
    const markup = renderToStaticMarkup(
      <WorkoutHistoryRangeControls selectedRange="90d" onSelectedRangeChange={noop} />
    );

    expect(markup).toContain('aria-label="Workout history date range"');
    expect(markup).toContain('Last 90 days');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('renders a labeled stacked mobile attempt list with complete values and reachable actions', () => {
    const now = new Date();
    const history: WorkoutHistoryRow[] = [
      { id: 'mobile-pb', date: new Date(now.getTime() - 1_000).toISOString(), watts: 310, avg_split: 108.4, distance: 2000, time: 434.2 },
      { id: 'mobile-baseline', date: new Date(now.getTime() - 2_000).toISOString(), watts: 280, avg_split: 112.9, distance: 2000, time: 445.6 },
    ];

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <WorkoutHistoryContent
          history={history}
          baselineWatts={null}
          workoutName="2k Test"
          setShowTemplateLinking={noop}
          setLoadingTemplates={noop}
          setAvailableTemplates={noop}
        />
      </MemoryRouter>
    );

    expect(markup).toContain('aria-label="Workout attempts"');
    expect(markup).toContain('Date');
    expect(markup).toContain('Result');
    expect(markup).toContain('Watts');
    expect(markup).toContain('Pace');
    expect(markup).toContain('Status');
    expect(markup).toContain('2000m / 7:14.2');
    expect(markup).toContain('310w');
    expect(markup).toContain('1:48.4/500m');
    expect(markup).toContain('PB');
    expect(markup).toContain('Baseline attempt');
    expect(markup).toContain('aria-label="View workout from');
    expect(markup.match(/aria-label="View workout from/g)?.length).toBe(2);
  });

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
    expect(markup.match(/>PB</g)?.length).toBe(2);
    expect(markup.indexOf('310w')).toBeLessThan(markup.indexOf('PB'));
  });

  it('renders baseline and accessible improvement, regression, and unchanged cues', () => {
    const now = new Date();
    const history: WorkoutHistoryRow[] = [
      { id: 'improved', date: new Date(now.getTime() - 1_000).toISOString(), watts: 310, avg_split: 108, distance: 2000, time: 434 },
      { id: 'unchanged', date: new Date(now.getTime() - 2_000).toISOString(), watts: 290, avg_split: 112, distance: 2000, time: 440 },
      { id: 'regressed', date: new Date(now.getTime() - 3_000).toISOString(), watts: 290, avg_split: 112, distance: 2000, time: 440 },
      { id: 'baseline', date: new Date(now.getTime() - 4_000).toISOString(), watts: 300, avg_split: 110, distance: 2000, time: 438 },
    ];

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <WorkoutHistoryContent
          history={history}
          baselineWatts={null}
          workoutName="2k Test"
          setShowTemplateLinking={noop}
          setLoadingTemplates={noop}
          setAvailableTemplates={noop}
        />
      </MemoryRouter>
    );

    expect(markup).toContain('Baseline attempt');
    expect(markup).toContain('Improved');
    expect(markup).toContain('Regressed');
    expect(markup).toContain('Unchanged');
    expect(markup).toContain('+20w');
    expect(markup).toContain('-10w');
    expect(markup).toContain('0w');
    expect(markup).toContain('-4.0s/500m');
    expect(markup).toContain('+2.0s/500m');
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

    expect(markup.match(/>PB</g)?.length).toBe(2);
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
    expect(markup.match(/>PB</g)?.length).toBe(2);
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
