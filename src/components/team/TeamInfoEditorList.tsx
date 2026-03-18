import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save } from 'lucide-react';
import { getTeamsByIds, updateTeam } from '../../services/coaching/coachingService';
import type { TeamRole, UserTeamInfo } from '../../services/coaching/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';

const ROLE_VARIANT: Record<TeamRole, 'coaching' | 'warning' | 'muted'> = {
  coach: 'coaching',
  coxswain: 'warning',
  member: 'muted',
};

interface TeamInfoEditorListProps {
  teams: UserTeamInfo[];
  onTeamsChanged?: () => Promise<void> | void;
}

interface TeamDraft {
  name: string;
  description: string;
}

interface TeamGroup {
  orgName: string;
  orgId: string | null;
  teams: UserTeamInfo[];
}

export function TeamInfoEditorList({ teams, onTeamsChanged }: TeamInfoEditorListProps) {
  const [drafts, setDrafts] = useState<Record<string, TeamDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [savedTeamId, setSavedTeamId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const orderedTeams = useMemo(
    () => [...teams].sort((a, b) => (a.org_name ?? 'Standalone Teams').localeCompare(b.org_name ?? 'Standalone Teams') || a.team_name.localeCompare(b.team_name)),
    [teams]
  );

  const groupedTeams = useMemo((): TeamGroup[] => {
    const groups = new Map<string, TeamGroup>();

    for (const team of orderedTeams) {
      const key = team.org_id ?? '__standalone__';
      if (!groups.has(key)) {
        groups.set(key, {
          orgId: team.org_id ?? null,
          orgName: team.org_name ?? 'Standalone Teams',
          teams: [],
        });
      }
      groups.get(key)!.teams.push(team);
    }

    return Array.from(groups.values());
  }, [orderedTeams]);

  const loadTeams = useCallback(async () => {
    const teamIds = orderedTeams.map((team) => team.team_id);
    if (teamIds.length === 0) {
      setDrafts({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const nextTeams = await getTeamsByIds(teamIds);
    const nextTeamMap = Object.fromEntries(nextTeams.map((team) => [team.id, team]));
    const nextDrafts = Object.fromEntries(
      orderedTeams.map((team) => {
        const detail = nextTeamMap[team.team_id];
        return [
          team.team_id,
          {
            name: detail?.name ?? team.team_name,
            description: detail?.description ?? '',
          },
        ];
      })
    );

    setDrafts(nextDrafts);
    setIsLoading(false);
  }, [orderedTeams]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (!savedTeamId) return;
    const timeout = window.setTimeout(() => setSavedTeamId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [savedTeamId]);

  const handleDraftChange = (teamId: string, field: keyof TeamDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [teamId]: {
        ...current[teamId],
        [field]: value,
      },
    }));
    setErrors((current) => ({ ...current, [teamId]: '' }));
  };

  const handleSave = async (team: UserTeamInfo) => {
    const draft = drafts[team.team_id];
    if (!draft || draft.name.trim().length < 3) {
      setErrors((current) => ({ ...current, [team.team_id]: 'Team name must be at least 3 characters.' }));
      return;
    }

    setSavingTeamId(team.team_id);
    setErrors((current) => ({ ...current, [team.team_id]: '' }));
    try {
      const updated = await updateTeam(team.team_id, {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
      });
      setDrafts((current) => ({
        ...current,
        [team.team_id]: {
          name: updated.name,
          description: updated.description ?? '',
        },
      }));
      setSavedTeamId(team.team_id);
      try {
        await onTeamsChanged?.();
      } catch {
        // Keep local success visible even if parent refresh is temporarily unavailable.
      }
    } catch (err) {
      setErrors((current) => ({
        ...current,
        [team.team_id]: err instanceof Error ? err.message : 'Failed to save team info.',
      }));
    } finally {
      setSavingTeamId(null);
    }
  };

  if (isLoading) {
    return (
      <Card variant="ghost" padding="md" className="flex items-center gap-2 text-sm text-content-secondary">
        <Loader2 className="w-4 h-4 animate-spin text-accent-coaching" />
        Loading team details…
      </Card>
    );
  }

  if (orderedTeams.length === 0) {
    return (
      <Card variant="ghost" padding="md" className="text-sm text-content-secondary">
        No teams are available to edit yet.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card variant="ghost" padding="md">
        <CardHeader
          title="All team identities"
          subtitle="Edit any team you can access here. This section no longer depends on the active team selector or the top filter pills."
        />
        <div className="flex flex-wrap gap-2">
          <Badge variant="coaching" dot>
            {orderedTeams.length} accessible team{orderedTeams.length === 1 ? '' : 's'}
          </Badge>
          <Badge variant="muted">
            {orderedTeams.filter((team) => team.role === 'coach').length} coach-editable
          </Badge>
        </div>
      </Card>

      {groupedTeams.map((group) => (
        <Card key={group.orgId ?? '__standalone__'} variant="default" padding="lg">
          <CardHeader
            title={group.orgName}
            subtitle={`${group.teams.length} ${group.teams.length === 1 ? 'team' : 'teams'} in this group`}
            action={
              <Badge variant={group.orgId ? 'info' : 'muted'} size="sm">
                {group.orgId ? 'Organization' : 'Standalone'}
              </Badge>
            }
          />

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] gap-4 px-4 py-3 bg-surface-secondary text-[11px] font-medium uppercase tracking-wide text-content-faint">
              <div>Team</div>
              <div>Description</div>
              <div>Action</div>
            </div>

            {group.teams.map((team) => {
              const draft = drafts[team.team_id];
              const canEdit = team.role === 'coach';
              const isSaving = savingTeamId === team.team_id;
              const didSave = savedTeamId === team.team_id;
              const error = errors[team.team_id];

              return (
                <div
                  key={team.team_id}
                  className="border-t border-border first:border-t-0 bg-surface-card"
                >
                  <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:items-start">
                    <div className="space-y-3">
                      <Input
                        id={`team-name-${team.team_id}`}
                        label="Team Name"
                        value={draft?.name ?? ''}
                        onChange={(e) => handleDraftChange(team.team_id, 'name', e.target.value)}
                        minLength={3}
                        maxLength={100}
                        disabled={!canEdit || isSaving}
                        error={error && (!draft || draft.name.trim().length < 3) ? error : undefined}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={ROLE_VARIANT[team.role]} size="sm" className="capitalize">
                          {team.role}
                        </Badge>
                        {!canEdit && (
                          <Badge variant="muted" size="sm">
                            Read-only
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor={`team-description-${team.team_id}`}
                        className="block text-xs font-medium text-content-muted"
                      >
                        Description
                      </label>
                      <textarea
                        id={`team-description-${team.team_id}`}
                        value={draft?.description ?? ''}
                        onChange={(e) => handleDraftChange(team.team_id, 'description', e.target.value)}
                        rows={2}
                        disabled={!canEdit || isSaving}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-surface-secondary border border-border text-content-primary placeholder-content-faint focus:outline-none focus:ring-2 focus:ring-focus focus:border-accent-coaching transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
                      />
                      {error && draft && draft.name.trim().length >= 3 && (
                        <p className="text-[11px] text-accent-danger">{error}</p>
                      )}
                    </div>

                    <div className="flex md:justify-end md:pt-6">
                      <Button
                        type="button"
                        variant="coaching"
                        size="md"
                        loading={isSaving}
                        disabled={!canEdit || (draft?.name.trim().length ?? 0) < 3}
                        icon={didSave ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        onClick={() => void handleSave(team)}
                        className="min-h-11 min-w-36"
                      >
                        {didSave ? 'Saved!' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
