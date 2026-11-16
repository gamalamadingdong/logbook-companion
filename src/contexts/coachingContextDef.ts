import { createContext } from 'react';
import type { UserTeamInfo, TeamRole } from '../services/coaching/types';

/** Teams grouped by organization for the switcher UI */
export interface OrgTeamGroup {
  org_id: string | null;
  org_name: string;
  teams: UserTeamInfo[];
}

export interface CoachingContextType {
  userId: string;
  teamId: string;
  teamName: string;
  teamRole: TeamRole | null;
  orgId: string | null;
  activeTeam: UserTeamInfo | null;
  teams: UserTeamInfo[];
  teamsByOrg: OrgTeamGroup[];
  /** Currently active team filter. null = "All Teams" (org-wide view). */
  filterTeamId: string | null;
  /** Name of the filtered team, or "All Teams" when filterTeamId is null. */
  filterTeamName: string;
  /** Update the team filter. Pass null for org-wide, or a team_id. */
  setFilterTeamId: (id: string | null) => void;
  isLoadingTeam: boolean;
  teamError: string | null;
  hasTeam: boolean | null;
  switchTeam: (newTeamId: string) => void;
  /** Select a club, using All Teams when it contains multiple teams. */
  switchOrganization: (orgId: string | null) => void;
  refreshTeam: (options?: { throwOnError?: boolean }) => Promise<void>;
}

export const CoachingContext = createContext<CoachingContextType | null>(null);
