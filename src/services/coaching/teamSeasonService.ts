import { z } from 'zod';
import { supabase } from '../supabase';
import type { Database } from '../../types/database.types';

type SeasonRow = Database['public']['Tables']['team_seasons']['Row'];
type RosterRow = Database['public']['Tables']['team_season_athletes']['Row'];

const uuid = z.string().uuid();
const seasonSchema = z.object({
  id: uuid, team_id: uuid, name: z.string(), starts_on: z.string(), ends_on: z.string(),
  status: z.enum(['draft', 'active', 'archived']), created_at: z.string(),
}) satisfies z.ZodType<Pick<SeasonRow, 'id' | 'team_id' | 'name' | 'starts_on' | 'ends_on' | 'status' | 'created_at'>>;
const rosterSchema = z.object({
  season_id: uuid, athlete_id: uuid, first_name: z.string(), last_name: z.string(),
  grade: z.string().nullable(), squad: z.string().nullable(), performance_tier: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'graduated']), has_account: z.boolean(),
}) satisfies z.ZodType<RosterRow>;

export type TeamSeason = z.infer<typeof seasonSchema>;
export type SeasonRosterAthlete = z.infer<typeof rosterSchema>;
export interface CreateTeamSeasonInput {
  teamId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  sourceSeasonId: string | null;
  athleteIds: string[];
  copySquads: boolean;
}

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateSeasonInput(input: CreateTeamSeasonInput): void {
  uuid.parse(input.teamId);
  if (input.sourceSeasonId !== null) uuid.parse(input.sourceSeasonId);
  if (!input.name.trim() || input.name.trim().length > 80) throw new Error('Enter a season name of 1–80 characters.');
  if (!isDate(input.startsOn) || !isDate(input.endsOn)) throw new Error('Enter valid season dates.');
  if (input.endsOn < input.startsOn) throw new Error('The season end must be on or after its start.');
  input.athleteIds.forEach(id => uuid.parse(id));
  if (new Set(input.athleteIds).size !== input.athleteIds.length) throw new Error('Select each athlete only once.');
}

function checkError(error: unknown): void {
  if (!error) return;
  const details = z.object({ message: z.string(), code: z.string().optional() }).safeParse(error);
  if (details.success) {
    if (['42P01', 'PGRST205', 'PGRST202'].includes(details.data.code ?? '')) {
      throw new Error('Season management is not available yet. Please try again after the app update is complete.');
    }
    throw new Error(details.data.message);
  }
  throw error instanceof Error ? error : new Error('Unable to save or load this season. Please try again.');
}

export async function listTeamSeasons(teamId: string): Promise<TeamSeason[]> {
  uuid.parse(teamId);
  const { data, error } = await supabase.from('team_seasons')
    .select('id,team_id,name,starts_on,ends_on,status,created_at').eq('team_id', teamId)
    .order('starts_on', { ascending: false });
  checkError(error);
  return seasonSchema.array().parse(data ?? []);
}

export async function getSeasonRoster(seasonId: string): Promise<SeasonRosterAthlete[]> {
  uuid.parse(seasonId);
  const { data, error } = await supabase.from('team_season_athletes')
    .select('season_id,athlete_id,first_name,last_name,grade,squad,performance_tier,status,has_account')
    .eq('season_id', seasonId).order('last_name');
  checkError(error);
  return rosterSchema.array().parse(data ?? []);
}

export async function createTeamSeason(input: CreateTeamSeasonInput): Promise<string> {
  validateSeasonInput(input);
  const { data, error } = await supabase.rpc('create_team_season', {
    p_team_id: input.teamId, p_name: input.name.trim(), p_starts_on: input.startsOn, p_ends_on: input.endsOn,
    p_source_season_id: input.sourceSeasonId, p_athlete_ids: input.athleteIds, p_copy_squads: input.copySquads,
  });
  checkError(error);
  return uuid.parse(data);
}

export async function activateTeamSeason(seasonId: string): Promise<void> {
  uuid.parse(seasonId);
  const { error } = await supabase.rpc('activate_team_season', { p_season_id: seasonId });
  checkError(error);
}

export async function archiveTeamSeason(seasonId: string): Promise<void> {
  uuid.parse(seasonId);
  const { error } = await supabase.rpc('archive_team_season', { p_season_id: seasonId });
  checkError(error);
}

export async function setTeamSeasonSquad(seasonId: string, athleteId: string, squad: string | null): Promise<void> {
  uuid.parse(seasonId); uuid.parse(athleteId);
  const normalized = squad?.trim() || null;
  if (normalized && normalized.length > 80) throw new Error('Squad names must be 80 characters or fewer.');
  const { error } = await supabase.rpc('set_team_season_squad', { p_season_id: seasonId, p_athlete_id: athleteId, p_squad: normalized });
  checkError(error);
}
