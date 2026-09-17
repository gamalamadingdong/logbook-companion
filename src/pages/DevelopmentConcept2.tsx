import { useEffect, useState } from 'react';
import { connectConcept2, developmentConcept2, getDevelopmentPublishBlockers, validateDevelopmentWorkoutDraft,
  type DevelopmentConnection, type DevelopmentResult, type DevelopmentPublication, type DevelopmentWorkoutDraftErrors } from '../services/concept2Auth';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Button, Input, Select } from '../components/ui';

type ManualRow = { id: string; completed_at: string; distance_meters: number | null; duration_seconds: number | null; manual_rwn: string | null; raw_data: unknown };

export function DevelopmentConcept2() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<DevelopmentConnection | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<DevelopmentResult[]>([]);
  const [total, setTotal] = useState(0);
  const [viewPage, setViewPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [publications, setPublications] = useState<DevelopmentPublication[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [weightClass, setWeightClass] = useState<'' | 'H' | 'L'>('');
  const [privacy, setPrivacy] = useState<'private' | 'partners' | 'logged_in' | 'everyone'>('private');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const [confirmed, setConfirmed] = useState(false);
  const [newDistance, setNewDistance] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newCompletedAt, setNewCompletedAt] = useState('');
  const [draftErrors, setDraftErrors] = useState<DevelopmentWorkoutDraftErrors>({});
  useEffect(() => {
    let active = true;
    if (user) void developmentConcept2('status').then(async data => {
      if (!active) return;
      setConnection(data);
      if (data.connected) {
        const published = await developmentConcept2('publications');
        if (active) setPublications(published.publications ?? []);
        const saved = await developmentConcept2('results');
        if (active) { setResults(saved.results ?? []); setTotal(saved.total ?? 0); }
      }
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    if (user) void supabase.from('workout_logs')
      .select('id,completed_at,distance_meters,duration_seconds,manual_rwn,raw_data')
      .eq('user_id', user.id).eq('source', 'manual').eq('workout_type', 'row')
      .order('completed_at', { ascending: false }).limit(25)
      .then(({ data }) => { if (active) setManualRows((data ?? []).filter(row => {
        const raw = row.raw_data as { source?: string; mode?: string } | null;
        return raw?.source === 'training_block_manual_entry' && raw.mode === 'row'
          && row.distance_meters && row.duration_seconds
          && row.manual_rwn === `${row.distance_meters}m`;
      })); });
    return () => { active = false; };
  }, [user]);
  async function refresh() {
    setPending(true); setError('');
    try { await developmentConcept2('refresh'); setConnection(await developmentConcept2('status')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Refresh failed.'); }
    finally { setPending(false); }
  }
  async function loadPage(page: number) {
    const saved = await developmentConcept2('results', { page });
    setResults(saved.results ?? []); setTotal(saved.total ?? 0); setViewPage(page);
  }
  async function importPage(page: number) {
    setPending(true); setError(''); setMessage('');
    try {
      await developmentConcept2('refresh');
      const saved = await developmentConcept2('sync', { page });
      setNextPage(saved.next_page ?? null);
      setMessage(`Saved ${saved.imported ?? 0} results from development page ${page}. Re-importing updates existing records without duplicates.`);
      await loadPage(1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed. Retry the same page.'); }
    finally {
      try { setConnection(await developmentConcept2('status')); } catch { /* Original error remains visible. */ }
      setPending(false);
    }
  }
  async function publish() {
    if (!selectedId || !weightClass || !confirmed) return;
    setPending(true); setError(''); setMessage('');
    try {
      await developmentConcept2('refresh');
      const result = await developmentConcept2('publish', { workout_id: selectedId,
        timezone, weight_class: weightClass, privacy, confirmed_completed: true });
      setPublications((await developmentConcept2('publications')).publications ?? []);
      setConnection(await developmentConcept2('status'));
      setMessage(result.status === 'published' ? `Published development result ${result.result_id}. Import to link it back to this LC workout.` :
        result.status === 'rejected' ? 'Concept2 rejected the result. Correct the workout or reconnect if required, then you may retry this definite rejection.' :
        'Publication outcome is uncertain. Do not retry; review the development logbook and request operator recovery.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Publication failed.'); }
    finally { setPending(false); }
  }
  async function createWorkout() {
    const distance = Number(newDistance); const duration = Number(newDuration);
    const completed = new Date(newCompletedAt);
    const validation = validateDevelopmentWorkoutDraft({ distance: newDistance, duration: newDuration, completedAt: newCompletedAt });
    setDraftErrors(validation);
    if (!user || Object.keys(validation).length) return;
    setPending(true); setError(''); setMessage('');
    try {
      const created = await developmentConcept2('create_workout', {
        distance_meters: distance, duration_seconds: duration, completed_at: completed.toISOString(),
      });
      const { data, error: queryError } = await supabase.from('workout_logs')
        .select('id,completed_at,distance_meters,duration_seconds,manual_rwn,raw_data')
        .eq('id', created.workout_id).eq('user_id', user.id).single();
      if (queryError || !data) throw new Error('Workout was saved but could not be reloaded.');
      setManualRows(rows => [data, ...rows.filter(row => row.id !== data.id)]);
      setSelectedId(data.id); setConfirmed(false);
      setDraftErrors({});
      setMessage('Saved the completed LC row. Review the publishing options below, then publish it once.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the completed row.'); }
    finally { setPending(false); }
  }
  async function browse(page: number) {
    setPending(true); setError('');
    try { await loadPage(page); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load saved results.'); }
    finally { setPending(false); }
  }
  const selectedPublication = publications.find(publication => publication.workout_id === selectedId);
  const publishBlockers = getDevelopmentPublishBlockers({ connection, selectedId, weightClass, timezone,
    confirmed, existingStatus: selectedPublication?.status });
  return <section className="max-w-xl mx-auto p-6 space-y-4 text-neutral-100">
    <h1 className="text-2xl font-bold">Concept2 development connection</h1>
    <p>Development imports and publication links are stored separately from production Concept2 history, analytics, and assignments.</p>
    {!user ? <p>Sign in to Logbook Companion before connecting.</p> : <>
      <p role="status">{loading ? 'Checking development connection…' : connection?.busy ? 'Operation pending. Operator recovery required; do not retry.' :
        connection?.connected ? `Connected to development account ${connection.provider_user_id}.` : 'Not connected to development.'}</p>
      {connection?.connected && !connection.can_publish && <p>Current connection has read-only access. Reconnect to request Concept2 development publishing permission.</p>}
      {connection?.can_publish && <p className="text-emerald-300">Development write permission is ready.</p>}
      <button className="px-4 min-h-11 rounded bg-emerald-700 disabled:opacity-50" disabled={loading || pending || connection?.busy}
        onClick={() => void connectConcept2()}>{connection?.connected ? 'Reconnect for publishing' : 'Connect development account'}</button>
      <button className="ml-3 px-4 min-h-11 rounded bg-neutral-700 disabled:opacity-50" disabled={!connection?.connected || pending || connection?.busy}
        onClick={() => void refresh()}>Check / refresh connection</button>
      <div className="space-y-3 rounded border border-neutral-700 p-4">
        <h2 className="text-lg font-semibold">Publish a saved manual row to Concept2 development</h2>
        <p>For this development test, first save one completed fixed-distance LC row. This does not publish anything until you confirm the separate publish action below.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Distance (meters)" type="number" min="1" step="1" inputMode="numeric" value={newDistance}
            onChange={event => { setNewDistance(event.target.value); setDraftErrors(errors => ({ ...errors, distance: undefined })); }}
            placeholder="5000" error={draftErrors.distance} />
          <Input label="Work time (seconds)" type="number" min="0.1" step="0.1" inputMode="decimal" value={newDuration}
            onChange={event => { setNewDuration(event.target.value); setDraftErrors(errors => ({ ...errors, duration: undefined })); }}
            placeholder="1200" error={draftErrors.duration} />
          <Input label="Completed at" type="datetime-local" className="sm:col-span-2" value={newCompletedAt}
            onChange={event => { setNewCompletedAt(event.target.value); setDraftErrors(errors => ({ ...errors, completedAt: undefined })); }}
            error={draftErrors.completedAt} />
        </div>
        <Button variant="secondary" size="lg" loading={pending} disabled={!connection?.connected} onClick={() => void createWorkout()}>Save completed LC row</Button>
        <Select label="Workout" value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirmed(false); }}>
            <option value="">Select a saved workout</option>
            {manualRows.map(row => <option key={row.id} value={row.id}>{new Date(row.completed_at).toLocaleString()} · {row.distance_meters} m · {row.duration_seconds} s</option>)}
        </Select>
        <Input label="Workout timezone" value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="America/New_York" />
        <Select label="Concept2 weight class" value={weightClass} onChange={event => setWeightClass(event.target.value as '' | 'H' | 'L')}>
            <option value="">Select weight class</option><option value="H">Heavyweight</option><option value="L">Lightweight</option>
        </Select>
        <Select label="Concept2 visibility" value={privacy} onChange={event => setPrivacy(event.target.value as typeof privacy)}>
            <option value="private">Private</option><option value="partners">Training partners</option>
            <option value="logged_in">Logged-in users</option><option value="everyone">Everyone</option>
        </Select>
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          <span>I completed this row at the saved distance and work time, and I want to publish it to my connected Concept2 development account.</span></label>
        {publishBlockers.length > 0 && <div role="status" className="rounded border border-amber-600/50 bg-amber-950/30 p-3 text-sm text-amber-200">
          <p className="font-medium">Before you can publish:</p><ul className="list-disc pl-5">{publishBlockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>
        </div>}
        <Button size="lg" loading={pending} disabled={publishBlockers.length > 0} onClick={() => void publish()}>{selectedPublication?.status === 'rejected' ? 'Retry rejected publication' : 'Publish to development'}</Button>
        {selectedId && selectedPublication && <p role="status">Publication: {selectedPublication.status} · Result {selectedPublication.result_id ?? 'pending review'}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="min-h-11 px-4 rounded bg-emerald-700 disabled:opacity-50" disabled={!connection?.connected || pending || connection?.busy}
          onClick={() => void importPage(1)}>Import / recheck first page</button>
        {nextPage !== null && nextPage > 1 && <button className="min-h-11 px-4 rounded bg-neutral-700 disabled:opacity-50"
          disabled={!connection?.connected || pending || connection?.busy} onClick={() => void importPage(nextPage)}>Import next page ({nextPage})</button>}
      </div>
      <p role="status">{pending ? 'Working…' : message}</p>
      <h2 className="text-lg font-semibold">Saved development results ({total})</h2>
      {!loading && !results.length && <p>No saved development results. Import a page after connecting; an empty Concept2 development account will return zero results.</p>}
      <ul className="space-y-3">{results.map(result => <li key={result.id} className="rounded border border-neutral-700 p-3">
        <p>{result.date} · {result.type}</p>
        <p>{result.distance} m · {result.time / 10} seconds · Result {result.id}</p>
        {result.lc_workout_id && <p>Linked to LC workout {result.lc_workout_id}</p>}
      </li>)}</ul>
      <div className="flex gap-3">
        <button className="min-h-11 px-3 disabled:opacity-50" disabled={pending || viewPage === 1} onClick={() => void browse(viewPage - 1)}>Previous saved page</button>
        <button className="min-h-11 px-3 disabled:opacity-50" disabled={pending || viewPage * 25 >= total} onClick={() => void browse(viewPage + 1)}>Next saved page</button>
      </div>
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
