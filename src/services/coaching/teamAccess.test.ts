import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: mocks }));
import { getTeamsForUser, updateTeamMemberAdmin, canCreateCoachingSpace, joinTeamByInviteCode } from './coachingService';
beforeEach(() => vi.resetAllMocks());
it('uses server effective roles and admin grants without expanding club-coach access', async () => {
  mocks.rpc.mockResolvedValue({ data: [{ team_id: 'one', role: 'coach', is_admin: false }, { team_id: 'two', role: 'coxswain', is_admin: false }], error: null });
  const ids = vi.fn().mockReturnValue({ order: async () => ({ data: [{ id: 'one', name: 'Boys', org_id: 'club', organizations: { name: 'Titan' } }, { id: 'two', name: 'Girls', org_id: 'club', organizations: { name: 'Titan' } }], error: null }) });
  mocks.from.mockReturnValue({ select: () => ({ in: ids }) });
  const teams = await getTeamsForUser('coach');
  expect(mocks.rpc).toHaveBeenCalledWith('get_team_access');
  expect(ids).toHaveBeenCalledWith('id', ['one', 'two']);
  expect(teams.map(t => [t.team_id, t.role, t.is_admin])).toEqual([['one', 'coach', false], ['two', 'coxswain', false]]);
});
it('fails closed instead of hiding access lookup errors', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(getTeamsForUser('coach')).rejects.toThrow('offline');
  expect(mocks.from).not.toHaveBeenCalled();
});
it('writes only the admin permission through the existing membership policy', async () => {
  const update = vi.fn().mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'member' }, error: null }) }) }) });
  mocks.from.mockReturnValue({ update });
  await updateTeamMemberAdmin('member', true);
  expect(update).toHaveBeenCalledWith({ is_admin: true });
});
it('does not let a team code request an elevated role', async () => {
  await expect(joinTeamByInviteCode('athlete', 'CODE', 'coach')).rejects.toThrow('administrator');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('uses the server create-space capability, propagating errors', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect(canCreateCoachingSpace()).resolves.toBe(false);
  expect(mocks.rpc).toHaveBeenCalledWith('can_create_coaching_space');
});
it('reads private athlete notes through their RLS boundary', async () => {
  const { getAthleteById } = await import('./coachingService');
  const privateRead = vi.fn().mockResolvedValue({ data: [], error: null });
  mocks.from.mockImplementation(table => table === 'athletes'
    ? { select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: 'athlete', notes: 'legacy secret', team_athletes: [] }, error: null }) }) }) }) }
    : { select: () => ({ in: privateRead }) });
  const athlete = await getAthleteById('athlete');
  expect(privateRead).toHaveBeenCalledWith('athlete_id', ['athlete']);
  expect(athlete?.notes).toBeNull();
});
it('can clear private athlete notes without writing them to the public roster', async () => {
  const { updateAthlete } = await import('./coachingService');
  const update = vi.fn().mockReturnValue({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'athlete' }, error: null }) }) }) });
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  mocks.from.mockImplementation(table => table === 'athletes' ? { update } : {
    upsert, select: () => ({ in: async () => ({ data: [{ athlete_id: 'athlete', notes: null }], error: null }) }),
  });
  await updateAthlete('athlete', { notes: null });
  expect(update.mock.calls[0][0]).not.toHaveProperty('notes');
  expect(upsert).toHaveBeenCalledWith({ athlete_id: 'athlete', notes: null }, { onConflict: 'athlete_id' });
});
