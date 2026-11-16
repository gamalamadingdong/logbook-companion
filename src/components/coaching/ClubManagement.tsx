import { useEffect, useRef, useState } from 'react';
import { Button, Card, Input } from '../ui';
import { Modal } from '../ui/Modal';
import { createOrganization, getOrganizationMembershipsForUser, getOrganizationsForUser, updateOrganization } from '../../services/coaching/coachingService';
import type { Organization, OrganizationMember } from '../../services/coaching/types';

interface Props { userId: string | null; onChanged: () => Promise<void> }

/** Mount keyed by account so drafts and late responses cannot cross accounts. */
export function ClubManagement({ userId, onChanged }: Props) {
  const [clubs, setClubs] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<Organization | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const mounted = useRef(false);
  const savingLock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(false);
    if (!userId) { setClubs([]); setMemberships([]); setLoading(false); return; }
    Promise.all([getOrganizationsForUser(userId), getOrganizationMembershipsForUser(userId)])
      .then(([orgs, roles]) => { if (!cancelled) { setClubs(orgs); setMemberships(roles); } })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, retry]);
  const refresh = async () => {
    try { await onChanged(); if (mounted.current) setRefreshFailed(false); }
    catch { if (mounted.current) setRefreshFailed(true); }
  };
  const open = (club: Organization | 'new') => {
    setEditing(club); setName(club === 'new' ? '' : club.name);
    setDescription(club === 'new' ? '' : club.description ?? ''); setError(null);
  };
  const save = async () => {
    if (!userId || !editing || name.trim().length < 3 || savingLock.current) return;
    savingLock.current = true; setSaving(true); setError(null);
    try {
      const saved = editing === 'new'
        ? await createOrganization(userId, { name: name.trim(), description: description.trim() || undefined })
        : await updateOrganization(editing.id, { name: name.trim(), description: description.trim() || null });
      if (!mounted.current) return;
      setClubs(prev => [...prev.filter(c => c.id !== saved.id), saved]);
      if (editing === 'new') setMemberships(prev => [...prev, { org_id: saved.id, user_id: userId, role: 'owner' } as OrganizationMember]);
      setEditing(null);
      await refresh();
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Unable to save club. Please try again.');
    } finally { savingLock.current = false; if (mounted.current) setSaving(false); }
  };
  return <Card className="p-4 sm:p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-content-primary">Clubs</h2>
        <p className="text-sm text-content-secondary">Add a club or edit its details here. Choose a team below to change its club.</p></div>
      <Button variant="secondary" className="min-h-11" onClick={() => open('new')} disabled={!userId || saving || loading}>Add club</Button>
    </div>
    {loading ? <p role="status" className="text-content-muted">Loading clubs…</p> : loadError ? <div role="alert" className="text-content-secondary">Unable to load clubs. <Button variant="ghost" className="min-h-11" onClick={() => setRetry(v => v + 1)}>Retry</Button></div> : clubs.length === 0 ? <p className="text-sm text-content-muted">You haven't joined or created a club yet.</p> : <ul className="divide-y divide-border">
      {clubs.map(club => <li key={club.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><h3 className="font-medium text-content-primary break-words">{club.name}</h3>{club.description && <p className="text-sm text-content-muted break-words">{club.description}</p>}</div>
        {memberships.some(m => m.org_id === club.id && (m.role === 'owner' || m.role === 'admin'))
          ? <Button variant="secondary" className="min-h-11" aria-label={`Edit club ${club.name}`} onClick={() => open(club)} disabled={saving}>Edit club</Button>
          : <span className="text-xs text-content-muted">Club owners and admins can edit details.</span>}
      </li>)}
    </ul>}
    {refreshFailed && <div role="status" className="text-sm text-content-secondary">Club saved. The scope selector could not refresh. <Button variant="ghost" className="min-h-11" onClick={() => void refresh()}>Retry refresh</Button></div>}
    <Modal open={editing !== null} onClose={() => { if (!savingLock.current) setEditing(null); }} title={editing === 'new' ? 'Add club' : `Edit club: ${editing?.name ?? ''}`}
      description={editing === 'new' ? 'Create the club first, then assign teams in their settings.' : 'Changes apply to this club across all its teams.'}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
        <Input id="club-name" label="Club name" value={name} onChange={e => setName(e.target.value)} minLength={3} maxLength={100} required disabled={saving} className="min-h-11" />
        <Input id="club-description" label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} disabled={saving} className="min-h-11" />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" className="min-h-11" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" className="min-h-11" loading={saving} disabled={saving || name.trim().length < 3}>{editing === 'new' ? 'Create club' : 'Save club'}</Button></div>
      </form>
    </Modal>
  </Card>;
}
