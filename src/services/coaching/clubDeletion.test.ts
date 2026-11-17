import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: mocks }));
import { getClubDeletionCounts, deleteOrganization } from './coachingService';
const empty = { teams: 0, schedule_events: 0, assignments: 0, training_enrollments: 0, leaderboard_shares: 0 };
beforeEach(() => vi.resetAllMocks());
it('gets authoritative deletion blockers scoped to the exact club', async () => {
  mocks.rpc.mockResolvedValue({ data: [{ ...empty, assignments: 2 }], error: null });
  await expect(getClubDeletionCounts('club')).resolves.toEqual({ ...empty, assignments: 2 });
  expect(mocks.rpc).toHaveBeenCalledWith('get_club_deletion_counts', { p_org_id: 'club' });
});
it('does not treat denied or failed previews as an empty club', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('Permission denied') });
  await expect(getClubDeletionCounts('club')).rejects.toThrow('Permission denied');
});
it.each([{ data: [] }, { data: [{}] }, { data: [{ ...empty, teams: null }] }])('fails closed on an incomplete preview: %j', async ({ data }) => {
  mocks.rpc.mockResolvedValue({ data, error: null });
  await expect(getClubDeletionCounts('club')).rejects.toThrow('Unable to verify');
});
it('requires a returned deletion result so a hidden row is not reported deleted', async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: new Error('No row') });
  const eq = vi.fn().mockReturnValue({ select: () => ({ single }) });
  mocks.from.mockReturnValue({ delete: () => ({ eq }) });
  await expect(deleteOrganization('club')).rejects.toThrow('No row');
  expect(mocks.from).toHaveBeenCalledWith('organizations');
  expect(eq).toHaveBeenCalledWith('id', 'club');
});
it('propagates concurrent dependency guard failures without retrying deletion', async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: new Error('Move teams first') });
  mocks.from.mockReturnValue({ delete: () => ({ eq: () => ({ select: () => ({ single }) }) }) });
  await expect(deleteOrganization('club')).rejects.toThrow('Move teams first');
  expect(single).toHaveBeenCalledTimes(1);
});
it('does not report an empty team when dependency counts fail', async () => {
  const { getTeamDataCounts } = await import('./coachingService');
  mocks.from.mockReturnValue({ select: () => ({ eq: async () => ({ count: null, error: new Error('Count unavailable') }) }) });
  await expect(getTeamDataCounts('team')).rejects.toThrow('Count unavailable');
});
it('does not report successful team deletion when RLS hides the target', async () => {
  const { deleteTeam } = await import('./coachingService');
  const single = vi.fn().mockResolvedValue({ data: null, error: new Error('No visible team') });
  mocks.from.mockReturnValue({ delete: () => ({ eq: () => ({ select: () => ({ single }) }) }) });
  await expect(deleteTeam('team')).rejects.toThrow('No visible team');
});
