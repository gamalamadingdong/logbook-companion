import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupAssignment } from './types';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { from: mocks.from } }));

import { getDashboardPractices, getDashboardRoster, getDashboardWorkouts, type DashboardScope } from './teamDashboardService';

const scope: DashboardScope = { teamIds: ['team-a', 'team-b', 'team-a'], orgId: 'club', date: '2026-11-17' };
const assignment = (id: string, team_id: string | null, org_id: string | null = null, scheduled_date = scope.date): GroupAssignment => ({
  id, team_id, org_id, scheduled_date, template_id: 'template', created_at: '2026-11-01',
});
const athlete = (id: string, teamIds: string[], first_name: string | null = 'Pat') => ({
  id, user_id: null, first_name, last_name: '', created_by: 'coach', created_at: '2026-11-01', updated_at: '2026-11-01',
  team_athletes: teamIds.map(team_id => ({ team_id, status: 'active', squad: null })),
});
const responses: Record<string, { data: unknown; error: unknown; failAfter?: number }> = {};
const queries: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
const setAssignments = (assignments: GroupAssignment[]) => {
  responses.group_assignments.data = assignments.map(row => ({ ...row, workout_templates: { name: 'Test workout' } }));
};

beforeEach(() => {
  vi.clearAllMocks();
  responses.group_assignments = { data: [], error: null };
  responses.athletes = { data: [athlete('a', ['team-a']), athlete('b', ['team-b'])], error: null };
  responses.coaching_sessions = { data: [], error: null };
  responses.daily_workout_assignments = { data: [], error: null };
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    let offset = 0;
    let end = Number.POSITIVE_INFINITY;
    for (const method of ['select', 'in', 'eq', 'order', 'or', 'returns']) query[method] = vi.fn(() => query);
    query.range = vi.fn((from: number, to: number) => { offset = from; end = to; return query; });
    query.then = vi.fn((resolve: (value: unknown) => unknown) => {
      const response = responses[table];
      const page = { ...response, data: Array.isArray(response.data) ? response.data.slice(offset, end + 1) : response.data,
        error: response.failAfter !== undefined && offset >= response.failAfter ? new Error('Later page denied') : response.error };
      return Promise.resolve(page).then(resolve);
    });
    queries[table] = query;
    return query;
  });
});

describe('dashboard scope', () => {
  it('does no reads for an empty accessible-team scope', async () => {
    const empty = { ...scope, teamIds: [] };
    await expect(getDashboardWorkouts(empty)).resolves.toEqual([]);
    await expect(getDashboardPractices(empty)).resolves.toEqual([]);
    await expect(getDashboardRoster(empty)).resolves.toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('includes both accessible teams and current club shared assignments once', async () => {
    const shared = assignment('shared', null, 'club');
    setAssignments([
      assignment('a', 'team-a'), assignment('b', 'team-b'), shared, shared,
      assignment('inaccessible', 'team-c', 'club'), assignment('other-club', null, 'other'),
      assignment('conflicting-club', 'team-a', 'other'), assignment('yesterday', 'team-a', null, '2026-11-16'),
    ]);
    const result = await getDashboardWorkouts(scope);
    expect(result.map(row => [row.assignment.id, row.total, row.completed])).toEqual([
      ['a', 0, 0], ['b', 0, 0], ['shared', 0, 0],
    ]);
    expect(queries.group_assignments.eq).toHaveBeenCalledWith('scheduled_date', scope.date);
    expect(queries.group_assignments.or).toHaveBeenCalledWith('and(team_id.is.null,org_id.eq.club),team_id.in.(team-a,team-b)');
  });

  it('restricts selected-team shared completion to roster athlete IDs and exact day', async () => {
    setAssignments([assignment('a', 'team-a'), assignment('b', 'team-b'), assignment('shared', null, 'club')]);
    responses.athletes.data = [athlete('a', ['team-a']), athlete('outsider', ['team-b'])];
    responses.daily_workout_assignments.data = [
      { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-a', completed: false, workout_date: scope.date },
      { group_assignment_id: 'shared', athlete_id: 'outsider', team_id: 'team-b', completed: true, workout_date: scope.date },
      { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-a', completed: true, workout_date: '2026-11-16' },
      { group_assignment_id: 'a', athlete_id: 'a', team_id: 'team-a', completed: true, workout_date: scope.date },
      { group_assignment_id: 'a', athlete_id: 'a', team_id: 'team-b', completed: true, workout_date: scope.date },
      { group_assignment_id: 'b', athlete_id: 'a', team_id: 'team-a', completed: true, workout_date: scope.date },
    ];
    const result = await getDashboardWorkouts({ ...scope, teamIds: ['team-a'] });
    expect(result.map(row => [row.assignment.id, row.total, row.completed])).toEqual([['a', 1, 1], ['shared', 1, 0]]);
    expect(queries.daily_workout_assignments.eq).toHaveBeenCalledWith('workout_date', scope.date);
    expect(queries.daily_workout_assignments.in).toHaveBeenCalledWith('athlete_id', ['a']);
  });

  it('counts unique assigned athletes once across accessible teams, with any completion recorded', async () => {
    setAssignments([assignment('shared', null, 'club')]);
    responses.athletes.data = [athlete('a', ['team-a', 'team-b']), athlete('b', ['team-b'])];
    responses.daily_workout_assignments.data = [
      { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-a', completed: false, workout_date: scope.date },
      { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-b', completed: true, workout_date: scope.date },
      { group_assignment_id: 'shared', athlete_id: 'b', team_id: 'team-b', completed: false, workout_date: scope.date },
    ];
    const result = await getDashboardWorkouts(scope);
    expect(result.map(row => [row.total, row.completed])).toEqual([[2, 1]]);
    expect(queries.daily_workout_assignments.in).not.toHaveBeenCalledWith('team_id', expect.anything());
  });

  it.each(['team-a', 'team-b'])('counts a shared first-team-wins delivery for the active %s roster', async teamId => {
    setAssignments([assignment('shared', null, 'club')]);
    responses.athletes.data = [athlete('a', ['team-a', 'team-b'])];
    // An admin can read the sole shared delivery even when viewing its other roster.
    responses.daily_workout_assignments.data = [
      { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-b', completed: true, workout_date: scope.date },
      { group_assignment_id: 'shared', athlete_id: 'outside', team_id: 'team-b', completed: true, workout_date: scope.date },
      { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-b', completed: false, workout_date: '2026-11-16' },
      { group_assignment_id: 'unrelated', athlete_id: 'a', team_id: 'team-b', completed: false, workout_date: scope.date },
    ];
    const result = await getDashboardWorkouts({ ...scope, teamIds: [teamId] });
    expect(result.map(row => [row.assignment.id, row.total, row.completed])).toEqual([['shared', 1, 1]]);
    expect(queries.daily_workout_assignments.in).not.toHaveBeenCalledWith('team_id', expect.anything());
  });

  it('requires delivery rows to match the actual team-specific assignment team', async () => {
    setAssignments([assignment('a', 'team-a')]);
    responses.daily_workout_assignments.data = [
      { group_assignment_id: 'a', athlete_id: 'a', team_id: 'team-a', completed: false, workout_date: scope.date },
      { group_assignment_id: 'a', athlete_id: 'a', team_id: 'team-b', completed: true, workout_date: scope.date },
    ];
    const result = await getDashboardWorkouts(scope);
    expect(result.map(row => [row.total, row.completed])).toEqual([[1, 0]]);
    expect(queries.daily_workout_assignments.in).toHaveBeenCalledWith('team_id', ['team-a', 'team-b']);
  });

  it('keeps standalone team scopes separate and deduplicates accessible IDs', async () => {
    setAssignments([assignment('team-a', 'team-a'), assignment('team-b', 'team-b'), assignment('club-shared', null, 'club')]);
    const result = await getDashboardWorkouts({ ...scope, orgId: null });
    expect(result.map(row => row.assignment.id)).toEqual(['team-a', 'team-b']);
    expect(queries.group_assignments.in).toHaveBeenCalledWith('team_id', ['team-a', 'team-b']);
  });

  it('deduplicates active roster profiles and preserves account-free and unnamed athletes', async () => {
    responses.athletes.data = [athlete('a', ['team-a', 'team-b']), athlete('a', ['team-b']), athlete('unnamed', ['team-b'], null), athlete('outside', ['team-c'])];
    const result = await getDashboardRoster(scope);
    expect(result.map(row => [row.id, row.name, row.user_id])).toEqual([['a', 'Pat', null], ['unnamed', '', null]]);
    expect(queries.athletes.in).toHaveBeenCalledWith('team_athletes.team_id', ['team-a', 'team-b']);
    expect(queries.athletes.eq).toHaveBeenCalledWith('team_athletes.status', 'active');
  });

  it('returns exact-day accessible practices with their original destination team', async () => {
    const session = { id: 'practice-b', team_id: 'team-b', date: scope.date, type: 'water', coach_user_id: 'coach', created_at: '2026-11-01', updated_at: '2026-11-01' };
    responses.coaching_sessions.data = [session, session, { ...session, id: 'other', team_id: 'team-c' }, { ...session, id: 'yesterday', date: '2026-11-16' }];
    await expect(getDashboardPractices(scope)).resolves.toEqual([session]);
    expect(queries.coaching_sessions.in).toHaveBeenCalledWith('team_id', ['team-a', 'team-b']);
    expect(queries.coaching_sessions.eq).toHaveBeenCalledWith('date', scope.date);
    await expect(getDashboardPractices({ ...scope, teamIds: ['team-a'] })).resolves.toEqual([]);
  });

  it.each(['athletes', 'daily_workout_assignments', 'coaching_sessions'])('throws %s failures instead of presenting an empty state', async table => {
    const error = new Error('Read denied');
    responses[table].error = error;
    setAssignments([assignment('a', 'team-a')]);
    const read = table === 'coaching_sessions' ? getDashboardPractices : table === 'athletes' ? getDashboardRoster : getDashboardWorkouts;
    await expect(read(scope)).rejects.toThrow('Read denied');
  });

  it('includes completion recorded on a later API page', async () => {
    setAssignments([assignment('shared', null, 'club')]);
    const delivery = { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-a', completed: false, workout_date: scope.date };
    responses.daily_workout_assignments.data = [...Array.from({ length: 500 }, () => ({ ...delivery })), { ...delivery, completed: true }];
    const result = await getDashboardWorkouts(scope);
    expect(result.map(row => [row.total, row.completed])).toEqual([[1, 1]]);
    expect(queries.daily_workout_assignments.range).toHaveBeenCalledWith(500, 999);
  });

  it.each(['athletes', 'coaching_sessions', 'daily_workout_assignments', 'group_assignments'])('rejects a failed later %s page rather than returning partial data', async table => {
    setAssignments([assignment('shared', null, 'club')]);
    const row = table === 'group_assignments' ? { ...assignment('shared', null, 'club'), workout_templates: { name: 'Test workout' } } : table === 'athletes' ? athlete('a', ['team-a']) : table === 'coaching_sessions'
      ? { id: 'practice', team_id: 'team-a', date: scope.date }
      : { group_assignment_id: 'shared', athlete_id: 'a', team_id: 'team-a', completed: false, workout_date: scope.date };
    responses[table].data = Array.from({ length: 501 }, () => ({ ...row }));
    responses[table].failAfter = 500;
    const read = table === 'athletes' ? getDashboardRoster : table === 'coaching_sessions' ? getDashboardPractices : getDashboardWorkouts;
    await expect(read(scope)).rejects.toThrow('Later page denied');
  });

  it('loads assignments beyond the API default cap', async () => {
    setAssignments(Array.from({ length: 1001 }, (_, index) => assignment(`assignment-${index}`, 'team-a')));
    const result = await getDashboardWorkouts(scope);
    expect(result).toHaveLength(1001);
    expect(result[1000].assignment.id).toBe('assignment-1000');
    expect(queries.group_assignments.range).toHaveBeenCalledWith(1000, 1499);
  });

  it('throws rejected assignment reads', async () => {
    responses.group_assignments.error = new Error('Assignments denied');
    await expect(getDashboardWorkouts(scope)).rejects.toThrow('Assignments denied');
  });
});
