import { useEffect, useRef, useState } from 'react';
import { Button, Card, EmptyState, Input } from '../ui';
import { Modal } from '../ui/Modal';
import { canCreateCoachingSpace, createOrganization, getOrganizationMembershipsForUser, getOrganizationsForUser, updateOrganization } from '../../services/coaching/coachingService';
import { ClubDeletionDialog } from './ClubDeletionDialog';
import { ClubPeopleAccess } from './ClubPeopleAccess';
import type { Organization, OrganizationMember, UserTeamInfo } from '../../services/coaching/types';

interface Props { userId: string | null; onChanged: () => Promise<void>; teams: UserTeamInfo[]; isLoadingTeams?: boolean; onManageTeam: (teamId: string) => void }

/** Mount keyed by account so drafts and late responses cannot cross accounts. */
export function ClubManagement({ userId, onChanged, teams, isLoadingTeams = false, onManageTeam }: Props) {
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const [lastChange, setLastChange] = useState('saved');
  const [canCreate, setCanCreate] = useState(false);
  const [peopleClub, setPeopleClub] = useState<string | null>(null);
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
    setLoading(true); setLoadError(false); setCanCreate(false);
    if (!userId) { setClubs([]); setMemberships([]); setLoading(false); return; }
    Promise.all([getOrganizationsForUser(userId), getOrganizationMembershipsForUser(userId), canCreateCoachingSpace()])
      .then(([orgs, roles, allowed]) => { if (!cancelled) { setClubs(orgs); setMemberships(roles); setCanCreate(allowed === true); } })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, retry]);
  const refresh = async () => {
    try { await onChanged(); if (mounted.current) setRefreshFailed(false); }
    catch { if (mounted.current) setRefreshFailed(true); }
  };
  const open = (club: Organization | 'new') => {
    if (club === 'new' ? !canCreate : !memberships.some(m => m.org_id === club.id && (m.role === 'owner' || m.role === 'admin'))) return;
    setEditing(club); setName(club === 'new' ? '' : club.name);
    setDescription(club === 'new' ? '' : club.description ?? ''); setError(null);
  };
  const save = async () => {
    if (!userId || !editing || name.trim().length < 3 || savingLock.current) return;
    if (editing === 'new' ? !canCreate : !memberships.some(m => m.org_id === editing.id && (m.role === 'owner' || m.role === 'admin'))) return;
    savingLock.current = true; setSaving(true); setError(null);
    try {
      const saved = editing === 'new'
        ? await createOrganization(userId, { name: name.trim(), description: description.trim() || undefined })
        : await updateOrganization(editing.id, { name: name.trim(), description: description.trim() || null });
      if (!mounted.current) return;
      setClubs(prev => [...prev.filter(c => c.id !== saved.id), saved]);
      if (editing === 'new') setMemberships(prev => [...prev, { org_id: saved.id, user_id: userId, role: 'owner' } as OrganizationMember]);
      setLastChange('saved'); setEditing(null);
      await refresh();
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Unable to save club. Please try again.');
    } finally { savingLock.current = false; if (mounted.current) setSaving(false); }
  };
  const clubAdmin = (id: string) => memberships.some(m => m.org_id === id && (m.role === 'owner' || m.role === 'admin'));
  const groups: { id: string; name: string; club?: Organization }[] = [...clubs.map(club => ({ id: club.id, name: club.name, club }))];
  for (const team of teams) {
    if (team.org_id && !groups.some(group => group.id === team.org_id)) groups.push({ id: team.org_id, name: team.org_name || 'Club', club: undefined });
  }
  const teamRows = (rows: UserTeamInfo[]) => <ul className="space-y-2">{rows.map(team => <li key={team.team_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
    <div className="min-w-0"><h4 className="font-medium text-content-primary break-words">{team.team_name}</h4><p className="text-sm text-content-muted">{team.role === 'coxswain' ? 'Coxswain' : team.role === 'coach' ? 'Coach' : 'Member'}{team.is_admin === true ? ' · Admin' : ''}</p></div>
    {team.is_admin === true ? <Button variant="secondary" className="min-h-11" aria-label={`Manage team ${team.team_name}`} onClick={() => onManageTeam(team.team_id)} disabled={isLoadingTeams}>Manage team</Button> : <p className="text-sm text-content-muted">Admin access is required to manage team settings.</p>}
  </li>)}</ul>;
  return <Card className="p-4 sm:p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-content-primary">Clubs &amp; teams</h2>
        <p className="text-sm text-content-secondary">Manage club details and choose an accessible team to change its settings.</p></div>
      {canCreate && <Button variant="secondary" className="min-h-11" onClick={() => open('new')} disabled={!userId || saving || loading}>Add club</Button>}
    </div>
    {loading ? <p role="status" className="text-content-muted">Loading clubs…</p> : loadError ? <div role="alert" className="text-content-secondary">Unable to load clubs. <Button variant="ghost" className="min-h-11" onClick={() => setRetry(v => v + 1)}>Retry</Button></div> : <div className="space-y-5">
      {groups.map(({ id, name: clubName, club }) => <section key={id} className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><h3 className="font-semibold text-content-primary break-words">{clubName}</h3>{club?.description && <p className="text-sm text-content-muted break-words">{club.description}</p>}</div>
          {club && clubAdmin(id) ? <div className="flex flex-wrap gap-2"><Button variant="secondary" className="min-h-11" aria-label={`Edit club ${clubName}`} onClick={() => open(club)} disabled={saving}>Edit club</Button>
            <Button variant="secondary" className="min-h-11" aria-label={`People & access for ${clubName}`} aria-expanded={peopleClub === id} onClick={() => setPeopleClub(value => value === id ? null : id)}>People &amp; access</Button>
            <Button variant="danger" className="min-h-11" aria-label={`Delete club ${clubName}`} disabled={saving} onClick={() => setDeleting(club)}>Delete club</Button></div>
          : <p className="text-xs text-content-muted">Club owners and admins can edit details.</p>}
        </div>
        {peopleClub === id && clubAdmin(id) && <ClubPeopleAccess key={`${userId}:${id}`} orgId={id} userId={userId} onChanged={onChanged} />}
        {!isLoadingTeams && teamRows(teams.filter(team => team.org_id === id))}
        {!isLoadingTeams && !teams.some(team => team.org_id === id) && <p className="text-sm text-content-muted">No accessible teams in this club.</p>}
      </section>)}
      {teams.some(team => !team.org_id) && <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold text-content-primary">Standalone teams</h3>{!isLoadingTeams && teamRows(teams.filter(team => !team.org_id))}</section>}
      {!groups.length && !teams.length && !isLoadingTeams && <EmptyState title="No clubs or teams yet" description="You haven't joined or created a club yet. Add a club or team to get started." />}
    </div>}
    {isLoadingTeams && <p role="status" className="text-content-muted">Loading teams…</p>}
    {deleting && clubAdmin(deleting.id) && <ClubDeletionDialog key={deleting.id} club={deleting} onClose={() => setDeleting(null)} onDeleted={async () => {
      setClubs(previous => previous.filter(club => club.id !== deleting.id));
      setMemberships(previous => previous.filter(membership => membership.org_id !== deleting.id));
      setDeleting(null); setLastChange('deleted'); await refresh();
    }} />}
    {refreshFailed && <div role="status" className="text-sm text-content-secondary">Club {lastChange}. The scope selector could not refresh. <Button variant="ghost" className="min-h-11" onClick={() => void refresh()}>Retry refresh</Button></div>}
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
