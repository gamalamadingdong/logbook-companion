import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTeamSeasons, type TeamSeason } from '../../services/coaching/teamSeasonService';

/** Describes operational roster context; historical selection lives in Seasons. */
export function TeamSeasonNotice({ teamId }: { teamId: string }) {
  const [seasons, setSeasons] = useState<TeamSeason[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSeasons(null);
    setFailed(false);
    listTeamSeasons(teamId).then(rows => { if (!cancelled) setSeasons(rows); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [teamId]);
  const current = seasons?.find(season => season.status === 'active');
  return <div className="rounded-lg border border-border bg-surface-card px-4 py-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-content-secondary">
      {failed ? 'Season context could not be loaded.' : seasons === null ? 'Loading roster season…'
        : current ? <>Current roster · <strong className="text-content-primary">{current.name}</strong></>
          : 'Current roster · No active season selected'}
    </p>
    <Link className="inline-flex min-h-11 items-center text-accent-coaching hover:underline" to="/team-management/seasons">Manage seasons and roster history</Link>
  </div>;
}
