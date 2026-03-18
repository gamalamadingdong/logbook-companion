import { useMemo } from 'react';
import { useCoachingContext } from './useCoachingContext';

export function useScopedTeamScope() {
  const context = useCoachingContext();
  const { activeTeam, teams, orgId, filterTeamId, filterTeamName } = context;

  const scopedTeams = useMemo(() => {
    if (filterTeamId) {
      return teams.filter((team) => team.team_id === filterTeamId);
    }

    if (orgId) {
      const orgTeams = teams.filter((team) => team.org_id === orgId);
      if (orgTeams.length > 0) return orgTeams;
    }

    return activeTeam ? [activeTeam] : [];
  }, [activeTeam, filterTeamId, orgId, teams]);

  const scopedTeamIds = useMemo(
    () => scopedTeams.map((team) => team.team_id),
    [scopedTeams]
  );

  const scopedTeamIdSet = useMemo(
    () => new Set(scopedTeamIds),
    [scopedTeamIds]
  );

  const isOrgWideScope = filterTeamId === null && Boolean(orgId) && scopedTeams.length > 1;
  const scopeLabel = isOrgWideScope
    ? `${activeTeam?.org_name ?? 'Organization'} · All Teams`
    : filterTeamName;

  return {
    ...context,
    scopedTeams,
    scopedTeamIds,
    scopedTeamIdSet,
    isOrgWideScope,
    scopeLabel,
  };
}
