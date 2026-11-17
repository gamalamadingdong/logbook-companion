import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';
import { getOrganizationMembers, updateOrganizationMemberRole } from '../../services/coaching/coachingService';
import type { OrganizationMember } from '../../services/coaching/types';

interface Props {
  orgId: string;
  userId: string | null;
  onChanged: () => Promise<void>;
}

/** Only mount within an owner/admin club panel. Server permissions also protect changes. */
export function ClubPeopleAccess({ orgId, userId, onChanged }: Props) {
  const [people, setPeople] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const mounted = useRef(false);
  const saveLock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    getOrganizationMembers(orgId).then(rows => { if (!cancelled) setPeople(rows); })
      .catch(() => { if (!cancelled) setError('Unable to load club people. Please retry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, retry]);

  const toggleAdmin = async (person: OrganizationMember) => {
    if (person.role === 'owner' || person.user_id === userId || saveLock.current) return;
    saveLock.current = true; setSaving(person.id); setError(null);
    const role = person.role === 'admin' ? 'coach' : 'admin';
    try {
      await updateOrganizationMemberRole(person.id, role);
      if (!mounted.current) return;
      setPeople(previous => previous.map(p => p.id === person.id ? { ...p, role } : p));
      try { await onChanged(); }
      catch { if (mounted.current) setError('Access saved. Refresh the page to update team access.'); }
    } catch { if (mounted.current) setError('Unable to change club Admin access. Check your permissions and try again.'); }
    finally { saveLock.current = false; if (mounted.current) setSaving(null); }
  };

  return <section className="rounded-lg border border-border bg-surface-secondary p-4 space-y-3" aria-label="Club people and access">
    <div><h4 className="font-medium text-content-primary">People &amp; access</h4>
      <p className="mt-1 text-sm text-content-secondary">Club admins manage club details and all its teams. Coaches work with their assigned teams. Ownership stays unchanged.</p></div>
    {error && <p role="alert" className="text-sm text-accent-danger">{error} <Button variant="ghost" className="min-h-11" onClick={() => setRetry(v => v + 1)}>Retry people</Button></p>}
    {loading ? <p role="status" className="text-sm text-content-muted">Loading people…</p> : <ul className="divide-y divide-border">
      {people.map(person => {
        const label = person.display_name || person.email || person.user_id;
        return <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="break-words text-sm text-content-primary">{label}{person.user_id === userId ? ' (you)' : ''}</p><p className="text-xs text-content-muted capitalize">{person.role}</p></div>
          {person.role !== 'owner' && <Button variant="secondary" className="min-h-11" aria-label={`Club admin access for ${label}`} aria-pressed={person.role === 'admin'} disabled={person.user_id === userId || saving !== null} loading={saving === person.id} onClick={() => void toggleAdmin(person)}>Admin: {person.role === 'admin' ? 'On' : 'Off'}</Button>}
        </li>;
      })}
      {people.length === 0 && !error && <li className="text-sm text-content-muted py-3">No club memberships to show.</li>}
    </ul>}
  </section>;
}
