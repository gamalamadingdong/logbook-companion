import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '../ui';
import { Modal } from '../ui/Modal';
import { deleteOrganization, getClubDeletionCounts } from '../../services/coaching/coachingService';
import type { Organization } from '../../services/coaching/types';

type Counts = { teams: number; schedule_events: number; assignments: number; training_enrollments: number; leaderboard_shares: number };
const labels: Record<keyof Counts, string> = { teams: 'Teams', schedule_events: 'Schedule events', assignments: 'Assignments', training_enrollments: 'Training enrollments', leaderboard_shares: 'Leaderboard shares' };
function message(error: unknown, fallback: string): string {
  return typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : fallback;
}

/** Mounted separately for each club so previews and confirmation drafts cannot cross clubs. */
export function ClubDeletionDialog({ club, onClose, onDeleted }: { club: Organization; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setCounts(null); setPreviewError(null);
    getClubDeletionCounts(club.id).then(result => {
      if (!cancelled) setCounts(result);
    }).catch(error => {
      if (!cancelled) setPreviewError(message(error, 'Unable to check club contents. Please retry.'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [club.id, retry]);
  const empty = counts !== null && Object.keys(labels).every(key => counts[key as keyof Counts] === 0);
  const eligible = !loading && !previewError && empty && confirmation === club.name;
  const close = () => { if (!lock.current) onClose(); };
  const remove = async () => {
    if (!eligible || lock.current) return;
    lock.current = true; setBusy(true); setDeleteError(null);
    try {
      await deleteOrganization(club.id);
      if (!mounted.current) return;
      toast.success('Club deleted');
      await onDeleted();
    } catch (error) {
      if (mounted.current) setDeleteError(message(error, 'Unable to delete club. Check your permissions and try again.'));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <Modal open onClose={close} title={`Delete club: ${club.name}`} description="Only an empty club can be deleted. This permanently removes the club and its membership access.">
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void remove(); }}>
      {loading && <p role="status" className="text-content-muted">Checking club contents…</p>}
      {previewError && <div role="alert" className="text-content-secondary"><p>{previewError}</p><Button type="button" variant="secondary" className="min-h-11 mt-2" onClick={() => setRetry(value => value + 1)}>Retry preview</Button></div>}
      {counts && <><ul className="space-y-1 text-sm text-content-secondary">{(Object.keys(labels) as (keyof Counts)[]).map(key => <li key={key}>{labels[key]}: {counts[key]}</li>)}</ul>
        {!empty && <p className="text-sm text-content-secondary">This club cannot be deleted while teams or club-owned training data remain. Move or remove these items first, then retry the preview.</p>}
        <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => setRetry(value => value + 1)}>Refresh preview</Button></>}
      <Input id="club-delete-confirm" label={`Type ${club.name} to confirm`} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy || loading || !!previewError || !empty} autoComplete="off" className="min-h-11" />
      {deleteError && <p role="alert" className="text-sm text-accent-danger">{deleteError}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" className="min-h-11" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" variant="danger" className="min-h-11" loading={busy} disabled={!eligible || busy}>Delete club</Button></div>
    </form>
  </Modal>;
}
