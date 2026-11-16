import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const response = { data: null as unknown, error: null as unknown };
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn() };
  return { response, query, from: vi.fn(), rpc: vi.fn() };
});
vi.mock('../supabase', () => ({ supabase: { from: db.from, rpc: db.rpc } }));

import { createTeamSeason, getSeasonRoster, listTeamSeasons, validateSeasonInput } from './teamSeasonService';

const teamId = '00000000-0000-4000-8000-000000000001';
const athleteId = '00000000-0000-4000-8000-000000000002';
const seasonId = '00000000-0000-4000-8000-000000000003';
const input = { teamId, name: '2026/2027', startsOn: '2026-08-01', endsOn: '2027-07-31', sourceSeasonId: null, athleteIds: [athleteId], copySquads: false };

beforeEach(() => {
  vi.clearAllMocks();
  db.response.data = []; db.response.error = null;
  db.from.mockReturnValue(db.query);
  db.query.select.mockReturnValue(db.query);
  db.query.eq.mockReturnValue(db.query);
  db.query.order.mockImplementation(() => Promise.resolve(db.response));
  db.rpc.mockResolvedValue({ data: seasonId, error: null });
});

describe('season input boundaries', () => {
  it('rejects reversed and impossible dates without writing', async () => {
    await expect(createTeamSeason({ ...input, endsOn: '2025-01-01' })).rejects.toThrow('end');
    await expect(createTeamSeason({ ...input, startsOn: '2026-02-30' })).rejects.toThrow('valid');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('requires explicit valid identity selections and a season name', () => {
    expect(() => validateSeasonInput({ ...input, teamId: '' })).toThrow();
    expect(() => validateSeasonInput({ ...input, name: '  ' })).toThrow();
    expect(() => validateSeasonInput({ ...input, athleteIds: [athleteId, athleteId] })).toThrow('once');
  });
  it('allows preparing an empty roster without requiring accounts', async () => {
    await expect(createTeamSeason({ ...input, athleteIds: [] })).resolves.toBe(seasonId);
    expect(db.rpc).toHaveBeenCalledWith('create_team_season', expect.objectContaining({ p_athlete_ids: [], p_source_season_id: null }));
  });
  it('sends the reviewed team and participant IDs, without account creation', async () => {
    await expect(createTeamSeason(input)).resolves.toBe(seasonId);
    expect(db.rpc).toHaveBeenCalledWith('create_team_season', {
      p_team_id: teamId, p_name: '2026/2027', p_starts_on: input.startsOn, p_ends_on: input.endsOn,
      p_source_season_id: null, p_athlete_ids: [athleteId], p_copy_squads: false,
    });
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('snapshot reads', () => {
  it('retains an athlete without an account and historical profile values', async () => {
    const snapshot = { season_id: seasonId, athlete_id: athleteId, first_name: 'Pat', last_name: 'Rower', grade: '10', squad: 'Novice', performance_tier: null, status: 'active', has_account: false };
    db.response.data = [snapshot];
    await expect(getSeasonRoster(seasonId)).resolves.toEqual([snapshot]);
    expect(db.query.eq).toHaveBeenCalledWith('season_id', seasonId);
  });
  it('filters season lists by the explicit team and reports database errors', async () => {
    db.response.error = { message: 'Permission denied' };
    await expect(listTeamSeasons(teamId)).rejects.toThrow('Permission denied');
    expect(db.query.eq).toHaveBeenCalledWith('team_id', teamId);
  });
});
