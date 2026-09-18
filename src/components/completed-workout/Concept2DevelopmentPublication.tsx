import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Select } from '../ui/Input';
import { developmentConcept2, getDevelopmentPublishBlockers, type DevelopmentConnection, type DevelopmentPublication } from '../../services/concept2Auth';
import type { CompletedWorkoutEntryV1 } from '../../types/completedWorkoutEntry';
import { formatCompletedDuration } from '../../utils/completedWorkoutEntry';

type PublicationPreview = { label: string; distance: number; seconds: number; restSeconds: number; restDistance: number };

function decisecond(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Number.isInteger(Math.round(value * 10))
    && Math.abs(value * 10 - Math.round(value * 10)) < 1e-7;
}

export function manualConcept2Preview(result: CompletedWorkoutEntryV1): PublicationPreview | null {
  const { distanceMeters: distance, durationSeconds: seconds } = result.summary;
  try { new Intl.DateTimeFormat('en', { timeZone: result.timezone }).format(); } catch { return null; }
  if (result.activity !== 'indoor_row' || result.equipment?.brand !== 'concept2' ||
      result.equipment.name !== 'RowErg' || result.status !== 'completed' ||
      !Number.isSafeInteger(distance) || Number(distance) <= 0 || Number(distance) > 1_000_000 ||
      typeof seconds !== 'number' || seconds <= 0 || seconds > 86_400 || !decisecond(seconds) ||
      !Number.isFinite(new Date(result.completedAt).getTime()) ||
      new Date(result.completedAt).getTime() > Date.now()) return null;
  if (result.detailCoverage === 'none' && result.segments.length === 0 && result.workTimeSeconds === undefined) {
    return { label: 'Single RowErg piece', distance: distance!, seconds, restSeconds: 0, restDistance: 0 };
  }
  if (result.detailCoverage !== 'full' || result.segments.length < 2) return null;
  let workDistance = 0, workTime = 0, restDistance = 0, restSeconds = 0, workCount = 0;
  let previousRole: string | undefined;
  const workSegments = result.segments.filter(segment => segment.role === 'work');
  for (const segment of result.segments) {
    if (segment.role === 'work') {
      if (!['distance', 'time'].includes(segment.intervalKind ?? '') ||
          !Number.isSafeInteger(segment.distanceMeters) || !segment.distanceMeters || segment.distanceMeters <= 0 ||
          segment.durationSeconds === undefined || segment.durationSeconds <= 0 || !decisecond(segment.durationSeconds)) return null;
      workDistance += segment.distanceMeters; workTime += segment.durationSeconds; workCount += 1;
    } else {
      if (previousRole !== 'work' || segment.intervalKind !== undefined ||
          (segment.distanceMeters === undefined && segment.durationSeconds === undefined) ||
          (segment.distanceMeters !== undefined && (!Number.isSafeInteger(segment.distanceMeters) || segment.distanceMeters < 0)) ||
          (segment.durationSeconds !== undefined && !decisecond(segment.durationSeconds))) return null;
      restDistance += segment.distanceMeters ?? 0; restSeconds += segment.durationSeconds ?? 0;
    }
    previousRole = segment.role;
  }
  if (workCount < 2 || workDistance > 1_000_000 || workDistance + restDistance !== distance ||
      Math.abs(workTime + restSeconds - seconds) > 1e-7 ||
      result.workTimeSeconds === undefined || Math.abs(workTime - result.workTimeSeconds) > 1e-7) return null;
  const fixedDistance = restDistance === 0 && workSegments.every(segment => segment.intervalKind === 'distance' && segment.distanceMeters === workSegments[0].distanceMeters);
  const fixedTime = restDistance === 0 && workSegments.every(segment => segment.intervalKind === 'time' && segment.durationSeconds === workSegments[0].durationSeconds);
  return { label: `${workCount} ${fixedDistance ? 'fixed-distance' : fixedTime ? 'fixed-time' : 'variable'} intervals`,
    distance: workDistance, seconds: workTime, restSeconds, restDistance };
}

export function canPublishManualRowErg(result: CompletedWorkoutEntryV1): boolean {
  return manualConcept2Preview(result) !== null;
}

type Props = { workoutId: string; result: CompletedWorkoutEntryV1 };
type Privacy = 'private' | 'partners' | 'logged_in' | 'everyone';

export function Concept2DevelopmentPublication({ workoutId, result }: Props) {
  const [connection, setConnection] = useState<DevelopmentConnection | null>(null);
  const [publication, setPublication] = useState<DevelopmentPublication | null>(null);
  const [weightClass, setWeightClass] = useState<'' | 'H' | 'L'>('');
  const [privacy, setPrivacy] = useState<Privacy>('private');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readBack, setReadBack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([developmentConcept2('status'), developmentConcept2('publications')]).then(([status, rows]) => {
      if (cancelled) return;
      setConnection(status);
      setPublication(rows.publications?.find(item => item.workout_id === workoutId) ?? null);
    }).catch(() => { if (!cancelled) setError('Could not check the development connection. Reload this page to try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workoutId]);

  async function checkResult(resultId: number) {
    try {
      await developmentConcept2('read_result', { result_id: resultId });
      setReadBack(true);
      setError('');
      toast.success('Concept2 development result read back into LC.');
    } catch (cause) {
      setReadBack(false);
      setError(cause instanceof Error ? cause.message : 'Could not read back the result. Retry this check without publishing again.');
    }
  }

  async function publish() {
    if (!weightClass || pending || !confirmed || publication?.status === 'published' || publication?.status === 'outcome_unknown') return;
    setPending(true); setError('');
    // If the request outcome is unclear, keep this page from offering another POST.
    setPublication({ workout_id: workoutId, status: 'outcome_unknown' });
    try {
      await developmentConcept2('refresh');
      const response = await developmentConcept2('publish', {
        workout_id: workoutId, timezone: result.timezone, weight_class: weightClass,
        privacy, confirmed_completed: true,
      });
      setPublication({ workout_id: workoutId, status: response.status ?? 'outcome_unknown', result_id: response.result_id });
      if (response.status === 'published' && response.result_id) {
        await checkResult(response.result_id);
      } else if (response.status === 'rejected') {
        setError('Concept2 rejected this result. Check its saved measurements and connection before retrying.');
      } else {
        setError('The publication outcome needs review. Do not publish this workout again.');
      }
      setConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? `${cause.message} Reload to check its publication status before any retry.` : 'Could not confirm publication. Reload to check its status.');
      try {
        const rows = await developmentConcept2('publications');
        setPublication(rows.publications?.find(item => item.workout_id === workoutId) ?? { workout_id: workoutId, status: 'outcome_unknown' });
      } catch { /* Keep the conservative local unknown state. */ }
    } finally { setPending(false); }
  }

  const preview = manualConcept2Preview(result);
  const blockers = getDevelopmentPublishBlockers({ connection, selectedId: workoutId, weightClass,
    timezone: result.timezone, confirmed, existingStatus: publication?.status });
  const canSend = !loading && !pending && blockers.length === 0;
  return <Card>
    <CardHeader title="Publish to Concept2 development" subtitle="Your saved LC result remains the training record. Publishing is a separate, explicit step." />
    <div className="space-y-4 text-sm text-content-secondary">
      <p>{preview?.label} · {preview?.distance.toLocaleString()} m work · {formatCompletedDuration(preview?.seconds ?? 0)} work{preview?.restSeconds ? ` · ${formatCompletedDuration(preview.restSeconds)} rest` : ''}{preview?.restDistance ? ` · ${preview.restDistance.toLocaleString()} m rest` : ''} · {result.timezone}</p>
      {loading ? <p role="status">Checking development connection and publication status…</p> : <>
        {publication?.status === 'published' ? <div role="status" className="rounded-lg border border-border bg-surface-secondary p-3">
          <p className="font-medium text-content-primary">Published as Concept2 development result {publication.result_id}.</p>
          <p>{readBack ? 'Read back into LC by this exact result ID.' : 'The result is published. Check its exact ID to refresh the LC copy.'}</p>
          {publication.result_id && <Button variant="secondary" size="lg" className="mt-3 min-h-11" loading={pending}
            onClick={() => { setPending(true); void checkResult(publication.result_id!).finally(() => setPending(false)); }}>Recheck result {publication.result_id}</Button>}
        </div> : publication?.status === 'outcome_unknown' ? <p role="status" className="rounded-lg border border-amber-600/50 p-3">Publication outcome needs operator review. Do not send this workout again.</p> : <>
          <p>{connection?.connected ? connection.can_publish ? 'Development account connected with write access.' : 'Reconnect your development account to grant write access.' : 'Connect your Concept2 development account before publishing.'} <Link to="/sync" className="text-accent-primary underline">Connection settings</Link></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Concept2 weight class" value={weightClass} onChange={event => setWeightClass(event.target.value as '' | 'H' | 'L')}>
              <option value="">Select weight class</option><option value="H">Heavyweight</option><option value="L">Lightweight</option>
            </Select>
            <Select label="Concept2 visibility" value={privacy} onChange={event => setPrivacy(event.target.value as Privacy)}>
              <option value="private">Private</option><option value="partners">Training partners</option><option value="logged_in">Logged-in users</option><option value="everyone">Everyone</option>
            </Select>
          </div>
          <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" className="mt-1 size-5 accent-accent-primary" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
            <span>I completed this row with the saved measurements, and I want to publish it to my Concept2 development Logbook.</span>
          </label>
          {blockers.length > 0 && <p role="status">{blockers[0]}</p>}
          <Button size="lg" className="min-h-11 w-full sm:w-auto" loading={pending} disabled={!canSend} onClick={() => void publish()}>
            {publication?.status === 'rejected' ? 'Retry rejected publication' : 'Publish to development'}
          </Button>
        </>}
        {error && <p role="alert" className="text-accent-danger">{error}</p>}
      </>}
    </div>
  </Card>;
}
