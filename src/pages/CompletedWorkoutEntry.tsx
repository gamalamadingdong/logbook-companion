import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bike, Check, Footprints, MountainSnow, Plus, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { SegmentEditor, newSegmentForm, type SegmentForm } from '../components/completed-workout/SegmentEditor';
import { useAuth } from '../hooks/useAuth';
import { createCompletedWorkout, getCompletedWorkout, updateCompletedWorkout } from '../services/completedWorkoutEntryService';
import type { CompletedActivity, CompletedSegment, CompletedWorkoutDraft, CompletedWorkoutEntryV1 } from '../types/completedWorkoutEntry';
import { formatCompletedDuration, normalizeCompletedWorkoutDraft, parseDurationInput, scaffoldSegmentsFromRwn } from '../utils/completedWorkoutEntry';

type DistanceUnit = 'm' | 'km';
type EquipmentChoice = 'unspecified' | 'concept2' | 'other';

interface EntryForm {
  activity: CompletedActivity;
  activityName: string;
  equipmentChoice: EquipmentChoice;
  equipmentName: string;
  status: 'completed' | 'stopped_early';
  finishedLocal: string;
  distanceUnit: DistanceUnit;
  distance: string;
  duration: string;
  calories: string;
  watts: string;
  heartRate: string;
  strokeRate: string;
  perceivedExertion: string;
  notes: string;
  plannedRwn: string;
  detailCoverage: 'none' | 'partial' | 'full';
  segments: SegmentForm[];
}

const activities = [
  { value: 'indoor_row', label: 'Indoor row', icon: Waves },
  { value: 'ski_erg', label: 'Ski erg', icon: MountainSnow },
  { value: 'bike_erg', label: 'Bike erg', icon: Bike },
  { value: 'run', label: 'Run', icon: Footprints },
  { value: 'other', label: 'Other', icon: Plus },
] as const;

const concept2Models: Partial<Record<CompletedActivity, string>> = {
  indoor_row: 'RowErg', ski_erg: 'SkiErg', bike_erg: 'BikeErg',
};

function localDateTime(date: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

function displayTime(seconds: number | undefined): string {
  return seconds === undefined ? '' : formatCompletedDuration(seconds);
}

function emptyForm(): EntryForm {
  return {
    activity: 'indoor_row', activityName: '', equipmentChoice: 'unspecified', equipmentName: '', status: 'completed',
    finishedLocal: localDateTime(new Date()), distanceUnit: 'm', distance: '', duration: '',
    calories: '', watts: '', heartRate: '', strokeRate: '', perceivedExertion: '',
    notes: '', plannedRwn: '', detailCoverage: 'none', segments: [],
  };
}

function fromResult(result: CompletedWorkoutEntryV1): EntryForm {
  const distanceUnit: DistanceUnit = result.activity === 'run' ? 'km' : 'm';
  return {
    activity: result.activity,
    activityName: result.activityName ?? '',
    equipmentChoice: result.equipment?.brand ?? 'unspecified',
    equipmentName: result.equipment?.brand === 'other' ? result.equipment.name : '',
    status: result.status,
    finishedLocal: localDateTime(new Date(result.completedAt)),
    distanceUnit,
    distance: result.summary.distanceMeters === undefined ? '' : String(result.summary.distanceMeters / (distanceUnit === 'km' ? 1000 : 1)),
    duration: displayTime(result.summary.durationSeconds),
    calories: result.summary.calories?.toString() ?? '',
    watts: result.summary.watts?.toString() ?? '',
    heartRate: result.summary.heartRate?.toString() ?? '',
    strokeRate: result.summary.strokeRate?.toString() ?? '',
    perceivedExertion: result.summary.perceivedExertion?.toString() ?? '',
    notes: result.notes,
    plannedRwn: result.plannedRwn ?? '',
    detailCoverage: result.detailCoverage,
    segments: result.segments.map((segment) => ({
      id: crypto.randomUUID(), role: segment.role, label: segment.label ?? '',
      targetKind: segment.target?.kind ?? 'none',
      targetValue: segment.target ? (segment.target.kind === 'time' ? displayTime(segment.target.value) : String(segment.target.value)) : '',
      distance: segment.distanceMeters === undefined ? '' : String(segment.distanceMeters / (distanceUnit === 'km' ? 1000 : 1)),
      duration: displayTime(segment.durationSeconds),
      calories: segment.calories?.toString() ?? '', watts: segment.watts?.toString() ?? '',
    })),
  };
}

function numeric(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function meters(value: string, unit: DistanceUnit): number | undefined {
  const entered = numeric(value);
  if (entered === undefined) return undefined;
  const result = entered * (unit === 'km' ? 1000 : 1);
  return Math.abs(result - Math.round(result)) < 0.000001 ? Math.round(result) : Number.NaN;
}

function seconds(value: string): number | undefined {
  return value.trim() === '' ? undefined : parseDurationInput(value) ?? Number.NaN;
}

function formToDraft(form: EntryForm, original?: CompletedWorkoutEntryV1 | null): CompletedWorkoutDraft {
  const finish = new Date(form.finishedLocal);
  const finishedUnchanged = original && localDateTime(new Date(original.completedAt)) === form.finishedLocal;
  const completedAt = finishedUnchanged ? original.completedAt : Number.isNaN(finish.getTime()) ? '' : finish.toISOString();
  const timezone = finishedUnchanged ? original.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const segments: CompletedSegment[] = form.segments.map((segment) => ({
    role: segment.role,
    ...(segment.label.trim() ? { label: segment.label.trim() } : {}),
    target: segment.targetKind === 'none' ? null : {
      kind: segment.targetKind,
      value: segment.targetKind === 'time' ? seconds(segment.targetValue) ?? Number.NaN : numeric(segment.targetValue) ?? Number.NaN,
    },
    ...(segment.distance.trim() ? { distanceMeters: meters(segment.distance, form.distanceUnit) } : {}),
    ...(segment.duration.trim() ? { durationSeconds: seconds(segment.duration) } : {}),
    ...(segment.calories.trim() ? { calories: numeric(segment.calories) } : {}),
    ...(segment.watts.trim() ? { watts: numeric(segment.watts) } : {}),
  }));
  return {
    activity: form.activity,
    activityName: form.activityName,
    equipment: form.equipmentChoice === 'unspecified' ? null : {
      brand: form.equipmentChoice,
      name: form.equipmentChoice === 'concept2' ? concept2Models[form.activity] ?? '' : form.equipmentName,
    },
    status: form.status,
    completedAt,
    timezone,
    summary: {
      ...(form.distance.trim() ? { distanceMeters: meters(form.distance, form.distanceUnit) } : {}),
      ...(form.duration.trim() ? { durationSeconds: seconds(form.duration) } : {}),
      ...(form.calories.trim() ? { calories: numeric(form.calories) } : {}),
      ...(form.watts.trim() ? { watts: numeric(form.watts) } : {}),
      ...(form.heartRate.trim() ? { heartRate: numeric(form.heartRate) } : {}),
      ...(form.strokeRate.trim() ? { strokeRate: numeric(form.strokeRate) } : {}),
      ...(form.perceivedExertion.trim() ? { perceivedExertion: numeric(form.perceivedExertion) } : {}),
    },
    detailCoverage: form.segments.length ? form.detailCoverage : 'none',
    segments,
    notes: form.notes,
    plannedRwn: form.plannedRwn || null,
  };
}

export function CompletedWorkoutEntry() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [original, setOriginal] = useState<CompletedWorkoutEntryV1 | null>(null);
  const [showSegments, setShowSegments] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rwnError, setRwnError] = useState('');

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    getCompletedWorkout(id, user.id).then((saved) => {
      if (cancelled) return;
      if (!saved) {
        setErrors({ page: 'This manual workout was not found.' });
      } else {
        setOriginal(saved.result);
        setForm(fromResult(saved.result));
        setShowSegments(saved.result.segments.length > 0);
      }
    }).catch(() => {
      if (!cancelled) setErrors({ page: 'Could not load this workout. Try again.' });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user]);

  const update = (patch: Partial<EntryForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    if (Object.keys(errors).length) setErrors({});
  };

  const segmentTotals = useMemo(() => form.segments.reduce((total, segment) => ({
    distance: total.distance + (meters(segment.distance, form.distanceUnit) || 0),
    duration: total.duration + (seconds(segment.duration) || 0),
    calories: total.calories + (numeric(segment.calories) || 0),
  }), { distance: 0, duration: 0, calories: 0 }), [form.segments, form.distanceUnit]);

  const changeActivity = (activity: CompletedActivity) => {
    if (activity === form.activity) return;
    const distanceUnit: DistanceUnit = activity === 'run' ? 'km' : 'm';
    const factor = distanceUnit === form.distanceUnit ? 1 : distanceUnit === 'km' ? 1 / 1000 : 1000;
    update({
      activity, distanceUnit, equipmentChoice: 'unspecified', equipmentName: '',
      watts: activity === 'run' ? '' : form.watts,
      strokeRate: activity === 'indoor_row' || activity === 'ski_erg' ? form.strokeRate : '',
      distance: form.distance ? String(Number(form.distance) * factor) : '',
      segments: form.segments.map((segment) => ({ ...segment, distance: segment.distance ? String(Number(segment.distance) * factor) : '' })),
    });
  };

  const applyRwn = () => {
    const scaffold = scaffoldSegmentsFromRwn(form.plannedRwn);
    if (scaffold === null) {
      setRwnError('This notation is not recognized. You can still enter the workout without it.');
      return;
    }
    if (form.segments.length && !window.confirm('Replace the current interval cards with this planned structure? Entered actual values in those cards will be lost.')) return;
    setRwnError('');
    update({
      detailCoverage: scaffold.length ? 'full' : 'none',
      segments: scaffold.map((segment) => ({
        ...newSegmentForm(segment.role),
        label: segment.label ?? '',
        targetKind: segment.target?.kind ?? 'none',
        targetValue: segment.target ? (segment.target.kind === 'time' ? displayTime(segment.target.value) : String(segment.target.value)) : '',
      })),
    });
    if (scaffold.length) setShowSegments(true);
    toast.success(scaffold.length ? 'Planned intervals added. Enter what you actually did.' : 'Workout notation saved as the plan.');
  };

  const useSegmentTotals = () => update({
    distance: segmentTotals.distance ? String(segmentTotals.distance / (form.distanceUnit === 'km' ? 1000 : 1)) : '',
    duration: segmentTotals.duration ? displayTime(segmentTotals.duration) : '',
    calories: segmentTotals.calories ? String(segmentTotals.calories) : form.calories,
  });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving) return;
    const normalized = normalizeCompletedWorkoutDraft(formToDraft(form, original));
    if (!normalized.ok) {
      setErrors(normalized.errors);
      if (Object.keys(normalized.errors).some((field) => field.startsWith('segments.') || field === 'segments' || field === 'detailCoverage')) setShowSegments(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      if (id) {
        await updateCompletedWorkout(id, user.id, normalized.value);
        toast.success('Workout updated in Logbook Companion');
        navigate(`/completed-workout/${id}`);
      } else {
        const savedId = await createCompletedWorkout(user.id, normalized.value);
        toast.success('Workout saved in Logbook Companion');
        navigate(`/completed-workout/${savedId}`);
      }
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message : 'Could not save this workout. Try again.';
      setErrors({ page: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <Breadcrumb items={[{ label: 'Log Dashboard', to: '/' }, { label: id ? 'Edit completed workout' : 'Add completed workout' }]} />
        <div>
          <h1 className="text-2xl font-semibold text-content-primary sm:text-3xl">{id ? 'Edit completed workout' : 'Add completed workout'}</h1>
          <p className="mt-1 text-sm text-content-secondary">Log what you actually did. Save it in LC first; sharing it elsewhere is a separate choice.</p>
        </div>

        {isGuest || !user ? (
          <Card><p className="text-content-secondary">Sign in to save workouts to your training record.</p><Link to="/login" className="mt-3 inline-block text-accent-primary underline">Sign in</Link></Card>
        ) : loading ? (
          <Card><p className="text-content-secondary" role="status">Loading workout…</p></Card>
        ) : errors.page && id && !original ? (
          <Card><p className="text-accent-danger" role="alert">{errors.page}</p></Card>
        ) : (
          <form onSubmit={(event) => { void save(event); }} className="space-y-5" noValidate>
            {errors.page && <Card><p className="text-accent-danger" role="alert">{errors.page}</p></Card>}
            {Object.keys(errors).length > 0 && !errors.page && (
              <p className="rounded-lg border border-accent-danger bg-surface-card p-3 text-sm text-accent-danger" role="alert">Check the highlighted values before saving.</p>
            )}

            <Card>
              <CardHeader title="What did you do?" subtitle="Choose the activity first. Equipment is optional." />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {activities.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={form.activity === value ? 'primary' : 'secondary'}
                    className="min-h-14 justify-start text-left"
                    aria-pressed={form.activity === value}
                    icon={<Icon size={18} aria-hidden="true" />}
                    onClick={() => changeActivity(value)}
                  >{label}</Button>
                ))}
              </div>
              {errors.activity && <p className="mt-2 text-sm text-accent-danger">{errors.activity}</p>}
              {form.activity === 'other' && <div className="mt-4"><Input label="Activity name" value={form.activityName} onChange={(event) => update({ activityName: event.target.value })} error={errors.activityName} placeholder="Hike, strength session, swim…" className="min-h-11" /></div>}
              {form.activity !== 'run' && form.activity !== 'other' && (
                <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
                  <Select label="Equipment (optional)" value={form.equipmentChoice} className="min-h-11" onChange={(event) => update({ equipmentChoice: event.target.value as EquipmentChoice })}>
                    <option value="unspecified">Not specified</option>
                    <option value="concept2">Concept2 {concept2Models[form.activity]}</option>
                    <option value="other">Another machine</option>
                  </Select>
                  {form.equipmentChoice === 'other' && <Input label="Machine name" value={form.equipmentName} onChange={(event) => update({ equipmentName: event.target.value })} error={errors.equipment} className="min-h-11" placeholder="Gym rower, home erg…" />}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Your result" subtitle="A quick entry only needs the measurements you know." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label={`Finished at · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'}`} type="datetime-local" value={form.finishedLocal} onChange={(event) => update({ finishedLocal: event.target.value })} error={errors.completedAt} className="min-h-11" />
                <Select label="Completion" value={form.status} onChange={(event) => update({ status: event.target.value as EntryForm['status'] })} className="min-h-11">
                  <option value="completed">Completed</option>
                  <option value="stopped_early">Stopped early</option>
                </Select>
                <div>
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1"><Input label={`Distance (${form.distanceUnit})`} inputMode="decimal" value={form.distance} onChange={(event) => update({ distance: event.target.value })} error={errors['summary.distanceMeters']} className="min-h-11" /></div>
                    <Select aria-label="Distance unit" value={form.distanceUnit} onChange={(event) => {
                      const next = event.target.value as DistanceUnit;
                      const factor = next === 'km' ? 1 / 1000 : 1000;
                      update({ distanceUnit: next, distance: form.distance ? String(Number(form.distance) * factor) : '', segments: form.segments.map((segment) => ({ ...segment, distance: segment.distance ? String(Number(segment.distance) * factor) : '' })) });
                    }} className="min-h-11 w-20"><option value="m">m</option><option value="km">km</option></Select>
                  </div>
                </div>
                <Input label="Time" inputMode="decimal" value={form.duration} onChange={(event) => update({ duration: event.target.value })} placeholder="20:10 or 1:02:03" hint="For intervals, include rest if this is the full elapsed time." error={errors['summary.durationSeconds']} className="min-h-11" />
              </div>
              {errors.summary && <p className="mt-3 text-sm text-accent-danger" role="alert">{errors.summary}</p>}
              <details className="mt-4 border-t border-border-subtle pt-4" open={Object.keys(errors).some((field) => ['summary.calories', 'summary.watts', 'summary.heartRate', 'summary.strokeRate', 'summary.perceivedExertion'].includes(field)) || undefined}>
                <summary className="cursor-pointer text-sm font-medium text-content-secondary">More measurements and notes</summary>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Calories" inputMode="numeric" value={form.calories} onChange={(event) => update({ calories: event.target.value })} error={errors['summary.calories']} className="min-h-11" />
                  {form.activity !== 'run' && <Input label="Average watts" inputMode="numeric" value={form.watts} onChange={(event) => update({ watts: event.target.value })} error={errors['summary.watts']} className="min-h-11" />}
                  <Input label="Average heart rate" inputMode="numeric" value={form.heartRate} onChange={(event) => update({ heartRate: event.target.value })} error={errors['summary.heartRate']} className="min-h-11" />
                  {(form.activity === 'indoor_row' || form.activity === 'ski_erg') && <Input label="Average stroke rate" inputMode="numeric" value={form.strokeRate} onChange={(event) => update({ strokeRate: event.target.value })} error={errors['summary.strokeRate']} className="min-h-11" />}
                  <Select label="Effort (optional)" error={errors['summary.perceivedExertion']} value={form.perceivedExertion} onChange={(event) => update({ perceivedExertion: event.target.value })} className="min-h-11"><option value="">Not entered</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / 10</option>)}</Select>
                  <div className="sm:col-span-2">
                    <label htmlFor="completed-notes" className="mb-1 block text-xs font-medium text-content-muted">Notes</label>
                    <textarea id="completed-notes" rows={3} value={form.notes} onChange={(event) => update({ notes: event.target.value })} className="w-full rounded-lg border border-border bg-surface-secondary p-3 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-focus" placeholder="How did it feel?" />
                  </div>
                </div>
              </details>
            </Card>

            <Card>
              <CardHeader title="Intervals or splits" subtitle="Optional detail for repeats, variable work, warmups and rest." action={form.segments.length ? <span className="text-xs text-content-muted">{form.segments.length} segments</span> : undefined} />
              {!showSegments ? (
                <Button type="button" variant="secondary" className="min-h-11" icon={<Plus size={16} />} onClick={() => { if (!form.segments.length) update({ segments: [newSegmentForm()], detailCoverage: 'full' }); setShowSegments(true); }}>{form.segments.length ? `Show ${form.segments.length} intervals` : 'Add intervals or splits'}</Button>
              ) : (
                <div className="space-y-4">
                  <Select label="How much of the workout do these segments cover?" value={form.detailCoverage} onChange={(event) => update({ detailCoverage: event.target.value as EntryForm['detailCoverage'] })} error={errors.detailCoverage} className="min-h-11">
                    <option value="full">The whole workout</option>
                    <option value="partial">Only part of it</option>
                  </Select>
                  {form.segments.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary p-3 text-sm">
                      <div><p className="font-medium text-content-primary">Entered segments total</p><p className="text-content-secondary">{segmentTotals.distance ? `${segmentTotals.distance.toLocaleString()} m` : 'no distance'} · {segmentTotals.duration ? displayTime(segmentTotals.duration) : 'no time'}{segmentTotals.calories ? ` · ${segmentTotals.calories} cal` : ''}</p></div>
                      {form.detailCoverage === 'full' && <Button type="button" variant="secondary" className="min-h-11" icon={<Check size={16} />} onClick={useSegmentTotals}>Use these totals</Button>}
                    </div>
                  )}
                  <SegmentEditor segments={form.segments} onChange={(segments) => update({ segments, detailCoverage: segments.length ? (form.detailCoverage === 'none' ? 'full' : form.detailCoverage) : 'none' })} distanceUnit={form.distanceUnit} errors={errors} />
                  {errors.segments && <p className="text-sm text-accent-danger" role="alert">{errors.segments}</p>}
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowSegments(false)}>Hide interval detail</Button>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="From a planned workout?" subtitle="Optional. Notation can set up targets, then you enter actual results." />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1"><Input label="Workout notation (RWN)" value={form.plannedRwn} onChange={(event) => { update({ plannedRwn: event.target.value }); setRwnError(''); }} placeholder="4x500m/1:00r" error={rwnError} className="min-h-11" /></div>
                <Button type="button" variant="secondary" className="min-h-11" disabled={!form.plannedRwn.trim()} onClick={applyRwn}>Set up intervals</Button>
              </div>
              <p className="mt-2 text-xs text-content-muted">You can save without notation. A planned target never counts as an actual measurement.</p>
            </Card>

            <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface-page/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
              <Link to={id ? `/completed-workout/${id}` : '/'} className="inline-flex min-h-11 items-center px-3 text-sm text-content-secondary hover:text-content-primary">Cancel</Link>
              <Button type="submit" loading={saving} className="min-h-11 min-w-36" icon={<Check size={16} />}>{id ? 'Save changes' : 'Save workout'}</Button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
