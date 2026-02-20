import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getTeamsForUser } from '../services/coaching/coachingService';
import type { UserTeamInfo } from '../services/coaching/types';

const SELECTED_TEAM_KEY = 'lc_selected_team_id';

/**
 * Provides coaching context: the current user's ID, their teams, and the active team.
 * Supports multiple teams with a switchTeam() function.
 * Persists the selected team in localStorage across page refreshes.
 */
export function useCoachingContext() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [teams, setTeams] = useState<UserTeamInfo[]>([]);
  const [teamId, setTeamId] = useState<string>('');
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  // Resolve active team from list + localStorage preference
  const resolveActiveTeam = useCallback((allTeams: UserTeamInfo[]) => {
    if (allTeams.length === 0) {
      setTeamId('');
      setHasTeam(false);
      return;
    }
    const saved = localStorage.getItem(SELECTED_TEAM_KEY);
    const match = allTeams.find((t) => t.team_id === saved);
    const active = match ?? allTeams[0];
    setTeamId(active.team_id);
    setHasTeam(true);
    localStorage.setItem(SELECTED_TEAM_KEY, active.team_id);
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLoadingTeam(false);
      setHasTeam(false);
      return;
    }

    getTeamsForUser(userId)
      .then((allTeams) => {
        setTeams(allTeams);
        resolveActiveTeam(allTeams);
      })
      .catch((err) => {
        setTeamError(err instanceof Error ? err.message : 'Failed to load team');
        setHasTeam(false);
      })
      .finally(() => setIsLoadingTeam(false));
  }, [userId, resolveActiveTeam]);

  /** Switch to a different team */
  const switchTeam = useCallback((newTeamId: string) => {
    const match = teams.find((t) => t.team_id === newTeamId);
    if (match) {
      setTeamId(newTeamId);
      localStorage.setItem(SELECTED_TEAM_KEY, newTeamId);
    }
  }, [teams]);

  /** Call after creating a team to refresh context */
  const refreshTeam = useCallback(async () => {
    if (!userId) return;
    setIsLoadingTeam(true);
    try {
      const allTeams = await getTeamsForUser(userId);
      setTeams(allTeams);
      resolveActiveTeam(allTeams);
      setTeamError(null);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setIsLoadingTeam(false);
    }
  }, [userId, resolveActiveTeam]);

  // Derived: current team info
  const activeTeam = teams.find((t) => t.team_id === teamId) ?? null;
  const teamName = activeTeam?.team_name ?? '';
  const teamRole = activeTeam?.role ?? null;

  return {
    userId,
    teamId,
    teamName,
    teamRole,
    teams,
    isLoadingTeam,
    teamError,
    hasTeam,
    switchTeam,
    refreshTeam,
  };
}
