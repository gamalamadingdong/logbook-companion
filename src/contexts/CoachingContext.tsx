import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getTeamsForUser } from '../services/coaching/coachingService';
import type { UserTeamInfo } from '../services/coaching/types';
import { CoachingContext } from './coachingContextDef';
import type { OrgTeamGroup, CoachingContextType } from './coachingContextDef';

/** User-scoped localStorage key so different coach accounts don't collide */
const selectedTeamKey = (uid: string) => `lc_selected_team_${uid}`;
const filterTeamKey = (uid: string) => `lc_filter_team_${uid}`;



/**
 * Provides coaching context (teams, active team, switcher) to all descendants.
 * Wrap this around any route tree that needs shared team state.
 */
export function CoachingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return <CoachingSessionProvider key={userId} userId={userId}>{children}</CoachingSessionProvider>;
}

function CoachingSessionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [teams, setTeams] = useState<UserTeamInfo[]>([]);
  const [teamId, setTeamId] = useState<string>('');
  const [filterTeamId, setFilterTeamIdRaw] = useState<string | null>(null);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  // Resolve active team from list + localStorage preference
  const resolveActiveTeam = useCallback((allTeams: UserTeamInfo[]) => {
    if (allTeams.length === 0) {
      setTeamId('');
      setHasTeam(false);
      setFilterTeamIdRaw(null);
      return;
    }
    const key = userId ? selectedTeamKey(userId) : '';
    const saved = key ? localStorage.getItem(key) : null;
    const match = allTeams.find((t) => t.team_id === saved);
    let active = match ?? allTeams[0];
    setTeamId(active.team_id);
    setHasTeam(true);
    if (key) localStorage.setItem(key, active.team_id);

    // Restore filter preference (null = all teams)
    const fKey = userId ? filterTeamKey(userId) : '';
    const savedFilter = fKey ? localStorage.getItem(fKey) : null;
    const filteredTeam = allTeams.find(t => t.team_id === savedFilter);
    if (filteredTeam && (filteredTeam.org_id ?? null) === (active.org_id ?? null)) {
      // Migrate a legacy filter-only selection into one coherent team selection.
      active = filteredTeam;
      setTeamId(active.team_id);
      if (key) localStorage.setItem(key, active.team_id);
      setFilterTeamIdRaw(active.team_id);
    } else if (!active.org_id || allTeams.filter(t => t.org_id === active.org_id).length === 1) {
      setFilterTeamIdRaw(active.team_id);
      if (fKey) localStorage.setItem(fKey, active.team_id);
    } else {
      setFilterTeamIdRaw(null);
      if (fKey) localStorage.removeItem(fKey);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsLoadingTeam(false);
      setHasTeam(false);
      return;
    }

    let cancelled = false;
    getTeamsForUser(userId)
      .then((allTeams) => {
        if (cancelled) return;
        setTeams(allTeams);
        resolveActiveTeam(allTeams);
      })
      .catch((err) => {
        if (cancelled) return;
        setTeamError(err instanceof Error ? err.message : 'Failed to load team');
        setHasTeam(false);
      })
      .finally(() => { if (!cancelled) setIsLoadingTeam(false); });
    return () => { cancelled = true; };
  }, [userId, resolveActiveTeam]);

  /** A specific selection is both the viewing and action team. */
  const switchTeam = useCallback((newTeamId: string) => {
    if (!teams.some(t => t.team_id === newTeamId)) return;
    setTeamId(newTeamId);
    setFilterTeamIdRaw(newTeamId);
    if (userId) {
      localStorage.setItem(selectedTeamKey(userId), newTeamId);
      localStorage.setItem(filterTeamKey(userId), newTeamId);
    }
  }, [teams, userId]);

  const switchOrganization = useCallback((newOrgId: string | null) => {
    const clubTeams = teams.filter(t => (t.org_id ?? null) === newOrgId);
    const first = clubTeams[0];
    if (!first) return;
    setTeamId(first.team_id);
    const filter = newOrgId && clubTeams.length > 1 ? null : first.team_id;
    setFilterTeamIdRaw(filter);
    if (userId) {
      localStorage.setItem(selectedTeamKey(userId), first.team_id);
      if (filter) localStorage.setItem(filterTeamKey(userId), filter);
      else localStorage.removeItem(filterTeamKey(userId));
    }
  }, [teams, userId]);

  /** All Teams is limited to the current club; specific selections stay in it. */
  const setFilterTeamId = useCallback((id: string | null) => {
    const active = teams.find(t => t.team_id === teamId);
    if (!active) return;
    if (id !== null) {
      const next = teams.find(t => t.team_id === id);
      if (!next || (next.org_id ?? null) !== (active.org_id ?? null)) return;
      switchTeam(id);
      return;
    }
    if (!active.org_id || teams.filter(t => t.org_id === active.org_id).length < 2) return;
    setFilterTeamIdRaw(null);
    if (userId) localStorage.removeItem(filterTeamKey(userId));
  }, [teams, teamId, switchTeam, userId]);

  /** Call after creating a team to refresh context */
  const refreshTeam = useCallback(async (options?: { throwOnError?: boolean }) => {
    if (!userId) return;
    setIsLoadingTeam(true);
    try {
      const allTeams = await getTeamsForUser(userId);
      setTeams(allTeams);
      resolveActiveTeam(allTeams);
      setTeamError(null);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to load team');
      if (options?.throwOnError) throw err;
    } finally {
      setIsLoadingTeam(false);
    }
  }, [userId, resolveActiveTeam]);

  // Derived: current team info
  const activeTeam = teams.find((t) => t.team_id === teamId) ?? null;
  const teamName = activeTeam?.team_name ?? '';
  const teamRole = (activeTeam?.role ?? null) as import('../services/coaching/types').TeamRole | null;
  const orgId = activeTeam?.org_id ?? null;

  // Derived: filter team name
  const filterTeamName = filterTeamId
    ? (teams.find((t) => t.team_id === filterTeamId)?.team_name ?? teamName)
    : orgId ? 'All Teams' : teamName;

  // Derived: teams grouped by organization for the switcher
  const teamsByOrg = useMemo((): OrgTeamGroup[] => {
    const orgMap = new Map<string | null, OrgTeamGroup>();

    for (const t of teams) {
      const key = t.org_id ?? null;
      if (!orgMap.has(key)) {
        orgMap.set(key, {
          org_id: key,
          org_name: t.org_name ?? 'Standalone Teams',
          teams: [],
        });
      }
      orgMap.get(key)!.teams.push(t);
    }

    // Sort: named orgs first, standalone last
    const groups = Array.from(orgMap.values());
    groups.sort((a, b) => {
      if (a.org_id === null) return 1;
      if (b.org_id === null) return -1;
      return a.org_name.localeCompare(b.org_name);
    });

    return groups;
  }, [teams]);

  const value = useMemo<CoachingContextType>(() => ({
    userId,
    teamId,
    teamName,
    teamRole,
    orgId,
    activeTeam,
    teams,
    teamsByOrg,
    filterTeamId,
    filterTeamName,
    setFilterTeamId,
    isLoadingTeam,
    teamError,
    hasTeam,
    switchTeam,
    switchOrganization,
    refreshTeam,
  }), [userId, teamId, teamName, teamRole, orgId, activeTeam, teams, teamsByOrg, filterTeamId, filterTeamName, setFilterTeamId, isLoadingTeam, teamError, hasTeam, switchTeam, switchOrganization, refreshTeam]);

  return (
    <CoachingContext.Provider value={value}>
      {children}
    </CoachingContext.Provider>
  );
}


