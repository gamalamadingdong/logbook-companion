// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routeId: '93d73146-1bdb-426c-b6c6-9cf7d9fbe9f7',
  getDetail: vi.fn(), link: vi.fn(), from: vi.fn(), error: vi.fn(), paceRank: vi.fn(),
}));
vi.mock('react-router-dom', async importOriginal => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useParams: () => ({ id: mocks.routeId }),
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ profile: { user_id: 'owner' }, isGuest: false }) }));
vi.mock('../hooks/useTrainingBlockMatchingContext', () => ({ useTrainingBlockMatchingContext: () => ({ matchingContext: {} }) }));
vi.mock('../services/workoutService', () => ({ workoutService: {
  getWorkoutDetail: mocks.getDetail, getStrokes: async () => [], getPowerBuckets: async () => ({}), linkWorkoutToTemplate: mocks.link,
} }));
vi.mock('../services/templateLinkingService', () => ({
  previewTemplateLinks: async (_owner: string, id: string) => ({ current: { id }, matches: [], comparable: true }),
  saveTemplateLinks: async (_owner: string, templateId: string, rows: Array<{ id: string }>) => {
    await mocks.link(rows[0].id, templateId);
    return { linked: [rows[0].id], skipped: [], failed: [] };
  },
}));
vi.mock('../services/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../services/workoutPaceRankService', () => ({ loadWorkoutPaceRank: mocks.paceRank }));
vi.mock('../utils/paceCalculator', async importOriginal => ({
  ...await importOriginal<typeof import('../utils/paceCalculator')>(),
  getUserBaseline2kWatts: async () => 300,
}));
vi.mock('../utils/templateMatching', () => ({
  findBestMatchingTemplate: async () => null,
  findTemplateMatchesWithConfidence: async () => [{ id: 'template-1', name: 'Speed Pyramid', canonical_name: 'v250m... Pyramid', usage_count: 0, match_confidence: 0.92, match_reason: 'exact_user_template' }],
}));
vi.mock('../services/templateService', () => ({ fetchTemplateById: async () => ({ id: 'template-1', name: 'Speed Pyramid' }) }));
vi.mock('../components/analytics/PowerDistributionChart', () => ({ PowerDistributionChart: () => null }));
vi.mock('../components/TemplateEditor', () => ({ TemplateEditor: () => null }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.mock('recharts', () => Object.fromEntries([
  'LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'Legend', 'ReferenceLine', 'Label',
].map(name => [name, () => null])));

import { WorkoutDetail } from './WorkoutDetail';
const dbId = '93d73146-1bdb-426c-b6c6-9cf7d9fbe9f7';
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => null } });
  vi.clearAllMocks();
  mocks.link.mockResolvedValue({ template_id: 'template-1' });
  mocks.paceRank.mockResolvedValue(null);
  mocks.getDetail.mockResolvedValue({
    id: 122675261, db_id: dbId, workout_type: 'VariableInterval', date: '2026-11-09T16:21:00Z', distance: 4000, time: 8163,
    workout: { intervals: [250, 500, 750, 1000, 750, 500, 250].map(distance => ({ type: 'distance', distance, time: 1000, rest_time: 900, stroke_rate: 28 })) },
  });
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: 0 }).then(resolve),
  };
  mocks.from.mockReturnValue(query);
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

describe('workout detail pace history', () => {
  it('places the pace comparison below the complete performance grid', async () => {
    mocks.routeId = '122675261';
    mocks.paceRank.mockResolvedValue({ rank: 2, attemptCount: 21, percentile: 95, tied: false, secondsOffBest: 0.3 });
    await act(async () => root.render(<MemoryRouter><WorkoutDetail /></MemoryRouter>));
    const comparison = document.querySelector('[aria-label="Work pace vs. your history"]');
    expect(comparison?.textContent).toContain('95th percentile');
    expect(comparison?.textContent).toContain('2nd of 21 attempts');
    expect(comparison?.textContent).toContain('0.3 s/500m off your best');
    expect(comparison?.previousElementSibling?.textContent).toContain('Stroke Rate');
    expect(comparison?.previousElementSibling?.textContent).toContain('Work Pace');
    expect(mocks.paceRank).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', workoutId: dbId }));
  });

  it('preserves the performance cards when the comparison fails', async () => {
    mocks.paceRank.mockRejectedValueOnce(new Error('History is unavailable'));
    await act(async () => root.render(<MemoryRouter><WorkoutDetail /></MemoryRouter>));
    expect(document.body.textContent).toContain('Work Pace');
    expect(document.body.textContent).toContain('Stroke Rate');
    expect(document.querySelector('[aria-label="Work pace vs. your history"]')).toBeNull();
  });

  it.each([
    [{ rank: 1, attemptCount: 1, percentile: null, tied: false, secondsOffBest: 0 }, 'First recorded attempt'],
    [{ rank: 1, attemptCount: 12, percentile: 100, tied: false, secondsOffBest: 0 }, 'Best of 12 attempts'],
    [{ rank: 1, attemptCount: 12, percentile: 90, tied: true, secondsOffBest: 0 }, 'Tied for best of 12 attempts'],
    [{ rank: 2, attemptCount: 4, percentile: null, tied: false, secondsOffBest: 0.2 }, '2nd of 4 attempts'],
  ])('shows useful rank wording without a percentile when appropriate', async (rank, label) => {
    mocks.paceRank.mockResolvedValueOnce(rank);
    await act(async () => root.render(<MemoryRouter><WorkoutDetail /></MemoryRouter>));
    const comparison = document.querySelector('[aria-label="Work pace vs. your history"]');
    expect(comparison?.textContent).toContain(label);
    expect(comparison?.textContent).not.toContain('percentile');
  });
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });

describe('workout detail template linking', () => {
  it.each([dbId, '122675261'])('links using the loaded LC UUID when opened at /workout/%s', async routeId => {
    mocks.routeId = routeId;
    await act(async () => root.render(<MemoryRouter><WorkoutDetail /></MemoryRouter>));
    const link = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Link to This Template'));
    expect(link).toBeDefined();
    await act(async () => link!.click());
    expect(mocks.link).not.toHaveBeenCalled();
    const confirm = [...document.querySelectorAll('button')].find(button => button.textContent === 'Link this workout')!;
    await act(async () => confirm.click());
    expect(mocks.link).toHaveBeenCalledWith(dbId, 'template-1');
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('ignores a previous workout load that finishes after navigating to another workout', async () => {
    const sample = await mocks.getDetail();
    let finishOld!: (value: typeof sample) => void;
    const oldDetail = new Promise(resolve => { finishOld = resolve; });
    const nextId = '2401ee1e-43f2-4a19-8800-a2668560b5e9';
    mocks.getDetail.mockImplementation(id => id === dbId ? oldDetail : Promise.resolve({ ...sample, db_id: nextId }));
    mocks.routeId = dbId;
    await act(async () => root.render(<MemoryRouter><WorkoutDetail /></MemoryRouter>));
    expect(document.body.textContent).toContain('Loading workout details');
    mocks.routeId = nextId;
    await act(async () => root.render(<MemoryRouter><WorkoutDetail /></MemoryRouter>));
    await act(async () => finishOld(sample));
    const link = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Link to This Template'))!;
    await act(async () => link.click());
    const confirm = [...document.querySelectorAll('button')].find(button => button.textContent === 'Link this workout')!;
    await act(async () => confirm.click());
    expect(mocks.link).toHaveBeenCalledWith(nextId, 'template-1');
  });
});
