import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Clock3, Pencil, Plus } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Concept2DevelopmentPublication } from '../components/completed-workout/Concept2DevelopmentPublication';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { Card, CardHeader } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { completedActivityName, getCompletedWorkout } from '../services/completedWorkoutEntryService';
import { developmentConcept2, type DevelopmentPublication } from '../services/concept2Auth';
import type { CompletedWorkoutEntryV1 } from '../types/completedWorkoutEntry';
import { formatCompletedDuration } from '../utils/completedWorkoutEntry';

function finishLabel(result: CompletedWorkoutEntryV1): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: result.timezone,
  }).format(new Date(result.completedAt));
}

function metric(value: number | undefined, unit: string): string | null {
  return value === undefined ? null : `${value.toLocaleString()} ${unit}`;
}

export function CompletedWorkoutEntryDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [result, setResult] = useState<CompletedWorkoutEntryV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publication, setPublication] = useState<DevelopmentPublication | null>(null);
  const [checkingPublication, setCheckingPublication] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    getCompletedWorkout(id, user.id).then((saved) => {
      if (cancelled) return;
      if (!saved) setError('This completed workout was not found.');
      else {
        setResult(saved.result);
        if (saved.result.activity === 'indoor_row' && saved.result.equipment?.brand === 'concept2') {
          setCheckingPublication(true);
          void developmentConcept2('publications').then((response) => {
            if (!cancelled) setPublication(response.publications?.find((item) => item.workout_id === id) ?? null);
          }).catch(() => { /* Publication panel reports connection failures; the DB guards edits. */ })
            .finally(() => { if (!cancelled) setCheckingPublication(false); });
        }
      }
    }).catch(() => {
      if (!cancelled) setError('Could not load this workout. Try again.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user]);

  return (
    <>
      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <Breadcrumb items={[{ label: 'Log Dashboard', to: '/' }, { label: 'Completed workout' }]} />
        {loading ? <Card><p className="text-content-secondary" role="status">Loading workout…</p></Card> : error || !result ? (
          <Card><p className="text-accent-danger" role="alert">{error || 'Workout not found.'}</p><Link to="/" className="mt-3 inline-block text-accent-primary underline">Back to dashboard</Link></Card>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-content-muted">Manually entered · Saved in LC</p>
                <h1 className="mt-1 text-2xl font-semibold text-content-primary sm:text-3xl">{completedActivityName(result.activity, result.activityName)}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-content-secondary">
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>{finishLabel(result)} · {result.timezone}</span>
                  <Badge variant={result.status === 'completed' ? 'success' : 'warning'}>{result.status === 'completed' ? 'Completed' : 'Stopped early'}</Badge>
                </div>
              </div>
              {publication?.status === 'published' || publication?.status === 'outcome_unknown' ? (
                <p className="rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-sm text-content-secondary">Published result · read-only</p>
              ) : checkingPublication ? <p className="text-sm text-content-muted" role="status">Checking publication…</p> : (
                <Link to={`/completed-workout/${id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-well focus:outline-none focus:ring-2 focus:ring-focus"><Pencil size={16} aria-hidden="true" />Edit</Link>
              )}
            </div>

            <Card>
              <CardHeader title="Result" subtitle={result.equipment ? `${result.equipment.brand === 'concept2' ? 'Concept2 ' : ''}${result.equipment.name}` : 'Equipment not specified'} />
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {metric(result.summary.distanceMeters, 'm') && <div><dt className="text-xs text-content-muted">Distance</dt><dd className="mt-1 text-lg font-semibold text-content-primary">{metric(result.summary.distanceMeters, 'm')}</dd></div>}
                {result.summary.durationSeconds !== undefined && <div><dt className="text-xs text-content-muted">Elapsed time</dt><dd className="mt-1 flex items-center gap-1 text-lg font-semibold text-content-primary"><Clock3 size={16} aria-hidden="true" />{formatCompletedDuration(result.summary.durationSeconds)}</dd></div>}
                {metric(result.summary.calories, 'cal') && <div><dt className="text-xs text-content-muted">Calories</dt><dd className="mt-1 text-lg font-semibold text-content-primary">{metric(result.summary.calories, 'cal')}</dd></div>}
                {metric(result.summary.watts, 'W') && <div><dt className="text-xs text-content-muted">Average watts</dt><dd className="mt-1 text-lg font-semibold text-content-primary">{metric(result.summary.watts, 'W')}</dd></div>}
                {metric(result.summary.heartRate, 'bpm') && <div><dt className="text-xs text-content-muted">Average heart rate</dt><dd className="mt-1 text-lg font-semibold text-content-primary">{metric(result.summary.heartRate, 'bpm')}</dd></div>}
                {metric(result.summary.strokeRate, 'spm') && <div><dt className="text-xs text-content-muted">Stroke rate</dt><dd className="mt-1 text-lg font-semibold text-content-primary">{metric(result.summary.strokeRate, 'spm')}</dd></div>}
                {result.summary.perceivedExertion !== undefined && <div><dt className="text-xs text-content-muted">Effort</dt><dd className="mt-1 text-lg font-semibold text-content-primary">{result.summary.perceivedExertion} / 10</dd></div>}
              </dl>
              {result.notes && <p className="mt-5 border-t border-border-subtle pt-4 text-sm text-content-secondary whitespace-pre-wrap">{result.notes}</p>}
            </Card>

            {result.segments.length > 0 && <Card>
              <CardHeader title="Intervals and splits" subtitle={result.detailCoverage === 'full' ? 'These segments cover the full workout.' : 'These segments cover part of the workout.'} />
              <ol className="space-y-2">
                {result.segments.map((segment, index) => (
                  <li key={index} className="rounded-lg border border-border-subtle bg-surface-secondary p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-content-primary">{index + 1}. {segment.label || (segment.role === 'work' ? 'Work' : 'Rest')}</span>
                      <Badge variant={segment.role === 'work' ? 'info' : 'muted'}>{segment.role === 'work' ? 'Work' : 'Rest'}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-content-secondary">
                      {[metric(segment.distanceMeters, 'm'), segment.durationSeconds !== undefined ? formatCompletedDuration(segment.durationSeconds) : null, metric(segment.calories, 'cal'), metric(segment.watts, 'W')].filter(Boolean).join(' · ')}
                    </p>
                    {segment.target && <p className="mt-1 text-xs text-content-muted">Planned: {segment.target.kind === 'time' ? formatCompletedDuration(segment.target.value) : `${segment.target.value.toLocaleString()} ${segment.target.kind === 'distance' ? 'm' : 'cal'}`}</p>}
                  </li>
                ))}
              </ol>
            </Card>}

            {id && result.activity === 'indoor_row' && result.equipment?.brand === 'concept2' &&
              <Concept2DevelopmentPublication workoutId={id} result={result} />}
            {(result.plannedRwn || result.plannedTemplate) && <Card><CardHeader title="Plan used" />{result.plannedTemplate && <Link to={`/library/${result.plannedTemplate.id}`} className="text-sm font-medium text-accent-primary underline">{result.plannedTemplate.name}</Link>}{result.plannedRwn && <p className="mt-1 text-sm text-content-secondary">Saved RWN: {result.plannedRwn}</p>}</Card>}
            <div className="flex flex-wrap gap-3">
              <Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface-secondary px-3.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-well focus:outline-none focus:ring-2 focus:ring-focus">Back to log</Link>
              <Link to="/completed-workout/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-primary-hover focus:outline-none focus:ring-2 focus:ring-focus"><Plus size={16} aria-hidden="true" />Add another</Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}
