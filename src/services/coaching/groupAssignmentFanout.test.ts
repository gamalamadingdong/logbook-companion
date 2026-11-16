import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { from } }));
import { createGroupAssignment } from './coachingService';

describe('group assignment delivery errors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a saved group whose athlete delivery was rejected instead of claiming success', async () => {
    from.mockImplementation((table: string) => table === 'group_assignments'
      ? { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'group-1' }, error: null }) }) }) }
      : { insert: async () => ({ error: { message: 'Team assignments require an active season covering the workout date' } }) });

    await expect(createGroupAssignment({
      team_id: 'team-1', template_id: 'template-1', scheduled_date: '2027-01-15', created_by: 'coach-1',
    }, ['athlete-1'])).rejects.toThrow('Group assignment saved, but athlete assignments could not be delivered');
  });

  it('fans out club-wide work only to athletes on an active team roster', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    from.mockImplementation((table: string) => {
      if (table === 'group_assignments') return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'group-1' }, error: null }) }) }) };
      if (table === 'teams') return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'team-1' }], error: null }) }) }) };
      if (table === 'team_athletes') return { select: () => ({ in: () => ({ eq: async () => ({ data: [{ team_id: 'team-1', athlete_id: 'active-1' }], error: null }) }) }) };
      return { insert };
    });
    await createGroupAssignment({ org_id: 'club-1', template_id: 'template-1', scheduled_date: '2027-01-15', created_by: 'coach-1' }, ['inactive-1']);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ athlete_id: 'active-1', team_id: 'team-1' })]);
  });

  it('reports roster lookup failure as partial delivery rather than an empty successful assignment', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'group_assignments') return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'group-1' }, error: null }) }) }) };
      if (table === 'teams') return { select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'team-1' }], error: null }) }) }) };
      return { select: () => ({ in: () => ({ eq: async () => ({ data: null, error: { message: 'Roster lookup failed' } }) }) }) };
    });
    await expect(createGroupAssignment({ org_id: 'club-1', template_id: 'template-1', scheduled_date: '2027-01-15', created_by: 'coach-1' }, []))
      .rejects.toThrow('Group assignment saved, but athlete assignments could not be delivered');
  });
});
