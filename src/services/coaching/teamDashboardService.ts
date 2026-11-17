import type { Database } from '../../types/database.types';
import { supabase } from '../supabase';
import type { Athlete, CoachingAthlete, CoachingSession, GroupAssignment, TeamAthlete } from './types';

/** Effective-access team IDs for the selected team or current club, supplied by context. */
export interface DashboardScope {
  teamIds: string[];
  orgId: string | null;
  date: string;
}

const PAGE_SIZE = 500;

async function readAllRows<T>(query: {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
}): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function getDashboardRoster(scope: DashboardScope): Promise<CoachingAthlete[]> {
  const teamIds = [...new Set(scope.teamIds)];
  if (!teamIds.length) return [];

  // Dashboard counts need roster identity, not private coaching notes or account membership.
  type RosterRow = Athlete & { team_athletes: TeamAthlete[] };
  const data = await readAllRows<RosterRow>(supabase
    .from('athletes')
    .select('*, team_athletes!inner(team_id, status, squad)')
    .in('team_athletes.team_id', teamIds)
    .eq('team_athletes.status', 'active')
    .order('last_name').order('id'));

  const roster = new Map<string, CoachingAthlete>();
  for (const { team_athletes, ...athlete } of data) {
    const membership = team_athletes.find(row => teamIds.includes(row.team_id) && row.status === 'active');
    if (!membership || roster.has(athlete.id)) continue;
    roster.set(athlete.id, {
      ...athlete,
      name: `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim(),
      team_id: membership.team_id,
      squad: membership.squad ?? null,
    });
  }
  return [...roster.values()];
}

export async function getDashboardPractices(scope: DashboardScope): Promise<CoachingSession[]> {
  const teamIds = [...new Set(scope.teamIds)];
  if (!teamIds.length) return [];

  const data = await readAllRows<CoachingSession>(supabase
    .from('coaching_sessions')
    .select('*')
    .in('team_id', teamIds)
    .eq('date', scope.date)
    .order('created_at').order('id'));

  // Preserve the actual team_id: practice links must select the session's team.
  return [...new Map((data ?? [])
    .filter(row => row.team_id && teamIds.includes(row.team_id) && row.date === scope.date)
    .map(row => [row.id, row as CoachingSession])).values()];
}

export async function getDashboardWorkouts(scope: DashboardScope): Promise<{
  assignment: GroupAssignment;
  total: number;
  completed: number;
}[]> {
  const teamIds = [...new Set(scope.teamIds)];
  if (!teamIds.length) return [];

  // Read the exact day directly so pagination cannot silently truncate the
  // legacy helper's organization-wide response. Other helper consumers are unchanged.
  type AssignmentRow = GroupAssignment & { workout_templates: {
    name: string; canonical_name: GroupAssignment['canonical_name'];
    workout_structure: GroupAssignment['workout_structure']; workout_type: string;
    training_zone: string | null; is_test: boolean;
  } };
  let assignmentQuery = supabase.from('group_assignments').select(`
    id, team_id, org_id, template_id, scheduled_date, title, instructions,
    created_by, created_at,
    workout_templates!inner ( name, canonical_name, workout_structure, workout_type, training_zone, is_test )
  `).eq('scheduled_date', scope.date).order('id');
  assignmentQuery = scope.orgId
    ? assignmentQuery.or(`and(team_id.is.null,org_id.eq.${scope.orgId}),team_id.in.(${teamIds.join(',')})`)
    : assignmentQuery.in('team_id', teamIds);
  const assignmentRows = await readAllRows<AssignmentRow>(assignmentQuery.returns<AssignmentRow[]>());
  const candidates: GroupAssignment[] = assignmentRows.map(({ workout_templates: template, ...assignment }) => ({
    ...assignment,
    template_name: template?.name,
    canonical_name: template?.canonical_name ?? null,
    workout_structure: template?.workout_structure ?? null,
    workout_type: template?.workout_type,
    training_zone: template?.training_zone ?? null,
    is_test_template: template?.is_test ?? false,
  }));
  const assignments = [...new Map(candidates.filter(assignment => {
    if (assignment.scheduled_date !== scope.date) return false;
    if (assignment.org_id && assignment.org_id !== scope.orgId) return false;
    return assignment.team_id
      ? teamIds.includes(assignment.team_id)
      : Boolean(scope.orgId && assignment.org_id === scope.orgId);
  }).map(assignment => [assignment.id, assignment])).values()];
  if (!assignments.length) return [];

  const roster = await getDashboardRoster(scope);
  const athleteIds = roster.map(athlete => athlete.id);
  if (!athleteIds.length) return assignments.map(assignment => ({ assignment, total: 0, completed: 0 }));

  let dailyQuery = supabase
    .from('daily_workout_assignments')
    .select('group_assignment_id, athlete_id, team_id, completed, workout_date')
    .in('group_assignment_id', assignments.map(assignment => assignment.id))
    .in('athlete_id', athleteIds)
    .eq('workout_date', scope.date).order('id');
  // Shared fanout chooses one team per athlete. Its delivery may belong to another
  // active membership, so identity defines the selected roster; RLS still applies.
  if (!assignments.some(assignment => !assignment.team_id)) {
    dailyQuery = dailyQuery.in('team_id', teamIds);
  }
  type DailyRow = Pick<Database['public']['Tables']['daily_workout_assignments']['Row'],
    'group_assignment_id' | 'athlete_id' | 'team_id' | 'completed' | 'workout_date'>;
  const dailyRows = await readAllRows<DailyRow>(dailyQuery);
  const athleteSet = new Set(athleteIds);
  return assignments.map(assignment => {
    // Count assigned people, including account-free athletes, rather than duplicate
    // delivery rows. A completion on any scoped delivery records that person's work.
    const assignedAthletes = new Map<string, boolean>();
    for (const row of dailyRows) {
      if (row.group_assignment_id !== assignment.id || !row.athlete_id
        || !athleteSet.has(row.athlete_id) || row.workout_date !== scope.date
        || (assignment.team_id && row.team_id !== assignment.team_id)) continue;
      assignedAthletes.set(row.athlete_id, Boolean(row.completed) || Boolean(assignedAthletes.get(row.athlete_id)));
    }
    return { assignment, total: assignedAthletes.size, completed: [...assignedAthletes.values()].filter(Boolean).length };
  });
}
