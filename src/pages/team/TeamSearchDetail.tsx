import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { loadTeamSearchDetail, type TeamSearchDetail as Detail } from '../../search/teamSearch';

/** Read-only member destination; the loader repeats owner/team predicates. */
export function TeamSearchDetail() {
    const { kind = '', id = '' } = useParams();
    const { user } = useAuth();
    const { activeTeam, isLoadingTeam } = useCoachingContext();
    const userId = user?.id ?? '';
    const teamId = activeTeam?.team_id ?? '';
    const orgId = activeTeam?.org_id ?? null;
    const key = JSON.stringify([userId, teamId, orgId, kind, id]);
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{ key: string; detail: Detail | null; error?: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!userId || !teamId) return;
        loadTeamSearchDetail(kind, id, userId, teamId, orgId)
            .then((detail) => { if (!cancelled) setState({ key, detail }); })
            .catch(() => { if (!cancelled) setState({ key, detail: null, error: 'Could not load this team item. Try again.' }); });
        return () => { cancelled = true; };
    }, [userId, teamId, orgId, kind, id, key, attempt]);

    const current = state?.key === key ? state : null;
    return (
        <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
            <Link to="/team" className="inline-flex min-h-11 items-center text-sm text-accent-coaching-text underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Back to my team</Link>
            {isLoadingTeam || (teamId && !current) ? (
                <div role="status" className="flex items-center gap-2 text-content-muted"><Loader2 size={18} className="animate-spin" />Loading team item…</div>
            ) : !teamId ? (
                <EmptyState title="Select a team" description="Choose the team this item belongs to, then search again." />
            ) : current?.error ? (
                <Card><p role="alert" className="mb-3 text-content-secondary">{current.error}</p><Button variant="secondary" onClick={() => { setState(null); setAttempt((value) => value + 1); }}>Try again</Button></Card>
            ) : !current?.detail ? (
                <EmptyState title="Team item unavailable" description="This item may have been removed, belong to another team, or no longer be shared with you." />
            ) : (
                <Card className="space-y-4">
                    <div>
                        <p className="text-sm text-content-muted mb-1">{activeTeam?.team_name} · {current.detail.type} · {current.detail.date}</p>
                        <h1 className="text-xl font-semibold text-content-primary">{current.detail.title}</h1>
                    </div>
                    {current.detail.completed !== undefined && <Badge variant={current.detail.completed ? 'success' : 'muted'}>{current.detail.completed ? 'Completed' : 'Assigned'}</Badge>}
                    {current.detail.notation && <p className="font-mono break-words text-content-primary">{current.detail.notation}</p>}
                    {current.detail.description && <p className="whitespace-pre-wrap text-content-secondary">{current.detail.description}</p>}
                </Card>
            )}
        </div>
    );
}
