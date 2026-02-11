import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getTeamForUser } from '../services/coaching/coachingService';

/**
 * Provides coaching context: the current user's ID and their team ID.
 * All coaching pages should use this instead of manually resolving coachId.
 * `hasTeam` is null while loading, then true/false once resolved.
 */
export function useCoachingContext() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [teamId, setTeamId] = useState<string>('');
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoadingTeam(false);
      setHasTeam(false);
      return;
    }

    getTeamForUser(userId)
      .then((id) => {
        setTeamId(id ?? '');
        setHasTeam(!!id);
        if (!id) setTeamError(null);
      })
      .catch((err) => {
        setTeamError(err instanceof Error ? err.message : 'Failed to load team');
        setHasTeam(false);
      })
      .finally(() => setIsLoadingTeam(false));
  }, [userId]);

  /** Call after creating a team to refresh context */
  const refreshTeam = async () => {
    if (!userId) return;
    setIsLoadingTeam(true);
    try {
      const id = await getTeamForUser(userId);
      setTeamId(id ?? '');
      setHasTeam(!!id);
      setTeamError(null);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setIsLoadingTeam(false);
    }
  };

  return { userId, teamId, isLoadingTeam, teamError, hasTeam, refreshTeam };
}
