import { beforeEach, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { from } }));
import { getOrganizationsForUser, getOrganizationMembershipsForUser } from './coachingService';
beforeEach(() => vi.resetAllMocks());
it('does not turn a failed club query into an empty membership list', async () => {
  const error = { message: 'offline' };
  from.mockReturnValue({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error }) }) }) });
  await expect(getOrganizationsForUser('coach')).rejects.toEqual(error);
});
it('scopes role lookup to the current account and propagates failures', async () => {
  const eq = vi.fn().mockResolvedValue({ data: [{ org_id: 'club', role: 'admin' }], error: null });
  from.mockReturnValue({ select: () => ({ eq }) });
  await expect(getOrganizationMembershipsForUser('coach')).resolves.toEqual([{ org_id: 'club', role: 'admin' }]);
  expect(eq).toHaveBeenCalledWith('user_id', 'coach');
  eq.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await expect(getOrganizationMembershipsForUser('coach')).rejects.toEqual({ message: 'offline' });
});
