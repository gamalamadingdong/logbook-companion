import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bike, Check, Footprints, MountainSnow, Plus, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { newSegmentForm, type SegmentForm } from '../components/completed-workout/segmentForm';
import { SegmentGrid } from '../components/completed-workout/SegmentGrid';
import { mergePlannedSegments } from '../components/completed-workout/segmentPlan';
import { useAuth } from '../hooks/useAuth';
import { createCompletedWorkout, getCompletedWorkout, updateCompletedWorkout } from '../services/completedWorkoutEntryService';
import { developmentConcept2 } from '../services/concept2Auth';
import { searchTemplatesForCompletion, type CompletionTemplateMatch } from '../services/templateService';
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
  plannedTemplate: { id: string; name: string } | null;
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
    notes: '', plannedRwn: '', plannedTemplate: null, detailCoverage: 'none', segments: [],
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
    plannedTemplate: result.plannedTemplate ?? null,
    detailCoverage: result.detailCoverage,
    segments: result.segments.map((segment) => ({
      id: crypto.randomUUID(), role: segment.role, intervalKind: segment.intervalKind ?? 'none', label: segment.label ?? '',
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
    ...(segment.role === 'work' && segment.intervalKind !== 'none' ? { intervalKind: segment.intervalKind } : {}),
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
  const fullDetail = form.detailCoverage === 'full' && form.segments.length > 0;
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
      ...(!fullDetail && form.distance.trim() ? { distanceMeters: meters(form.distance, form.distanceUnit) } : {}),
      ...(!fullDetail && form.duration.trim() ? { durationSeconds: seconds(form.duration) } : {}),
      ...(!fullDetail && form.calories.trim() ? { calories: numeric(form.calories) } : {}),
      ...(form.watts.trim() ? { watts: numeric(form.watts) } : {}),
      ...(form.heartRate.trim() ? { heartRate: numeric(form.heartRate) } : {}),
      ...(form.strokeRate.trim() ? { strokeRate: numeric(form.strokeRate) } : {}),
      ...(form.perceivedExertion.trim() ? { perceivedExertion: numeric(form.perceivedExertion) } : {}),
    },
    detailCoverage: form.segments.length ? form.detailCoverage : 'none',
    segments,
    notes: form.notes,
    plannedRwn: form.plannedRwn || null,
    plannedTemplate: form.plannedTemplate,
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
  const [editLock, setEditLock] = useState<'none' | 'published' | 'outcome_unknown' | 'unavailable'>('none');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rwnError, setRwnError] = useState('');
  const [rwnInput, setRwnInput] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateResults, setTemplateResults] = useState<CompletionTemplateMatch[]>([]);
  const [templateSearchError, setTemplateSearchError] = useState('');
  const [templateSearching, setTemplateSearching] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    getCompletedWorkout(id, user.id).then(async (saved) => {
      if (cancelled) return;
      if (!saved) {
        setErrors({ page: 'This manual workout was not found.' });
        return;
      }
      if (saved.result.activity === 'indoor_row' && saved.result.equipment?.brand === 'concept2') {
        try {
          const publications = await developmentConcept2('publications');
          if (cancelled) return;
          const status = publications.publications?.find((item) => item.workout_id === id)?.status;
          setEditLock(status === 'published' || status === 'outcome_unknown' ? status : 'none');
        } catch {
          if (cancelled) return;
          setEditLock('unavailable');
        }
      }
      if (cancelled) return;
      setOriginal(saved.result);
      setForm(fromResult(saved.result));
      setRwnInput(saved.result.plannedRwn ?? '');
      setShowSegments(saved.result.segments.length > 0);
    }).catch(() => {
      if (!cancelled) setErrors({ page: 'Could not load this workout. Try again.' });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user]);

  useEffect(() => {
    if (templateSearch.trim().length < 2) { setTemplateResults([]); setTemplateSearchError(''); setTemplateSearching(false); return; }
    let cancelled = false;
    setTemplateSearching(true);
    setTemplateSearchError('');
    setTemplateResults([]);
    const timer = window.setTimeout(() => {
      void searchTemplatesForCompletion(templateSearch).then((matches) => {
        if (!cancelled) { setTemplateResults(matches); setTemplateSearchError(''); }
      }).catch(() => {
        if (!cancelled) setTemplateSearchError('Could not search templates. Try again.');
      }).finally(() => { if (!cancelled) setTemplateSearching(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [templateSearch]);

  const update = (patch: Partial<EntryForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    if (Object.keys(errors).length) setErrors({});
  };

  const segmentTotals = useMemo(() => form.segments.reduce((total, segment) => {
    const group = segment.role === 'work' ? total.work : total.rest;
    group.distance += meters(segment.distance, form.distanceUnit) || 0;
    group.duration += seconds(segment.duration) || 0;
    group.calories += numeric(segment.calories) || 0;
    return total;
  }, { work: { distance: 0, duration: 0, calories: 0 }, rest: { distance: 0, duration: 0, calories: 0 } }), [form.segments, form.distanceUnit]);
  const fullDetail = form.detailCoverage === 'full' && form.segments.length > 0;
  const workRows = form.segments.filter((segment) => segment.role === 'work');
  const hasAllWorkDistances = workRows.length > 0 && workRows.every((segment) => segment.distance.trim() !== '');
  const hasAllSegmentTimes = form.segments.length > 0 && form.segments.every((segment) => segment.duration.trim() !== '');
  const hasAllWorkCalories = workRows.length > 0 && workRows.every((segment) => segment.calories.trim() !== '');
  const measuredDistance = segmentTotals.work.distance + segmentTotals.rest.distance;
  const measuredDuration = segmentTotals.work.duration + segmentTotals.rest.duration;
  const rwnPreview = useMemo(() => rwnInput.trim() ? scaffoldSegmentsFromRwn(rwnInput) : null, [rwnInput]);

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

  const applyPlan = (rwn: string, template: EntryForm['plannedTemplate']): boolean => {
    const scaffold = scaffoldSegmentsFromRwn(rwn);
    if (scaffold === null) {
      setRwnError('This notation is not recognized. You can still enter the workout without it.');
      return false;
    }
    const merged = mergePlannedSegments(form.segments, scaffold);
    if (merged.discardedActualRows > 0 &&
        !window.confirm('This plan would replace ' + merged.discardedActualRows + ' rows with entered results. Continue?')) return false;
    setRwnError('');
    setRwnInput(rwn);
    update({
      plannedRwn: rwn, plannedTemplate: template,
      detailCoverage: scaffold.length ? 'full' : 'none',
      segments: merged.segments,
    });
    setShowSegments(scaffold.length > 0);
    toast.success(scaffold.length ? 'Planned intervals added. Enter what you actually did.' : 'Workout notation saved as the plan.');
    return true;
  };

  const chooseTemplate = (template: CompletionTemplateMatch) => {
    const notation = [template.rwn, template.canonical_name].find(value => value && scaffoldSegmentsFromRwn(value) !== null);
    if (!notation) {
      setTemplateSearchError('This template has no supported RWN. You can still paste notation or enter the result directly.');
      return;
    }
    if (applyPlan(notation, { id: template.id, name: template.name })) {
      setTemplateSearch(''); setTemplateResults([]); setTemplateSearchError('');
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || saving || (id && editLock !== 'none')) return;
    if (rwnInput.trim() !== form.plannedRwn.trim()) {
      setRwnError('Set up intervals to apply this RWN before saving, or restore the saved plan.');
      document.getElementById('manual-entry-rwn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const normalized = normalizeCompletedWorkoutDraft(formToDraft(form, original), { requireConcept2IntervalTypes: true });
    if (!normalized.ok) {
      setErrors(normalized.errors);
      const hasSegmentError = Object.keys(normalized.errors).some((field) => field.startsWith('segments.'));
      if (hasSegmentError || normalized.errors.segments || normalized.errors.detailCoverage) setShowSegments(true);
      if (hasSegmentError) {
        window.requestAnimationFrame(() => document.querySelector('[data-segment-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
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
        ) : id && editLock !== 'none' ? (
          <Card>
            <CardHeader title="This result is read-only" />
            <p className="text-sm text-content-secondary" role="status">{editLock === 'unavailable'
              ? 'Could not check this workout’s Concept2 publication status. Reload to try again before editing.'
              : 'This result has a Concept2 development publication. Keep the saved LC result aligned with the published snapshot; a revision flow is needed for corrections.'}</p>
            <Link to={`/completed-workout/${id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent-primary underline">Back to workout</Link>
          </Card>
        ) : (
          <form onSubmit={(event) => { void save(event); }} className="space-y-5" noValidate>
            {errors.page && <Card><p className="text-accent-danger" role="alert">{errors.page}</p></Card>}
            {Object.keys(errors).length > 0 && !errors.page && (
              <p className="rounded-lg border border-accent-danger bg-surface-card p-3 text-sm text-accent-danger" role="alert">Check the highlighted values before saving.</p>
            )}

            <Card className="max-w-3xl">
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
                  {form.activity === 'indoor_row' && form.equipmentChoice === 'unspecified' && (
                    <p className="text-xs text-content-muted">If you used a Concept2 RowErg and want the option to publish later, choose it here. Your result saves in LC either way.</p>
                  )}
                  {form.equipmentChoice === 'other' && <Input label="Machine name" value={form.equipmentName} onChange={(event) => update({ equipmentName: event.target.value })} error={errors.equipment} className="min-h-11" placeholder="Gym rower, home erg…" />}
                </div>
              )}
            </Card>

            <Card className="max-w-3xl">
              <CardHeader title="Start from a plan" subtitle="Find a saved template or paste workout notation. Either way, you enter the actual result below." />
              {form.plannedTemplate && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-secondary p-3 text-sm">
                <span>Template: <span className="font-medium text-content-primary">{form.plannedTemplate.name}</span></span>
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => update({ plannedTemplate: null })}>Remove link</Button>
              </div>}
              <Input label="Find a saved template" value={templateSearch} onChange={event => setTemplateSearch(event.target.value)} placeholder="Search by name or RWN" className="min-h-11" />
              {templateSearching && <p role="status" className="mt-2 text-xs text-content-muted">Searching templates…</p>}
              {templateSearchError && <p role="alert" className="mt-2 text-xs text-accent-danger">{templateSearchError}</p>}
              {templateSearch.trim().length >= 2 && !templateSearching && !templateSearchError && templateResults.length === 0 && <p className="mt-2 text-xs text-content-muted">No matching templates. Paste notation or enter the result directly.</p>}
              {templateResults.length > 0 && <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1" aria-label="Matching templates">
                {templateResults.map(template => <li key={template.id}><button type="button" className="flex min-h-11 w-full flex-col rounded-md px-3 py-2 text-left hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus" onClick={() => chooseTemplate(template)}>
                  <span className="text-sm font-medium text-content-primary">{template.name}</span><span className="text-xs text-content-muted">{template.rwn || template.canonical_name || 'No RWN available'}</span>
                </button></li>)}
              </ul>}
              <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1"><Input id="manual-entry-rwn" label="Or paste workout notation (RWN)" value={rwnInput} onChange={(event) => { setRwnInput(event.target.value); setRwnError(''); }} placeholder="4x500m/1:00r" error={rwnError || errors.plannedTemplate} className="min-h-11" /></div>
                <Button type="button" variant="secondary" className="min-h-11" disabled={!rwnInput.trim()} onClick={() => applyPlan(rwnInput, rwnInput.trim() === form.plannedRwn.trim() ? form.plannedTemplate : null)}>Set up intervals</Button>
              </div>
              {form.plannedRwn && <Button type="button" variant="ghost" className="mt-2 min-h-11" onClick={() => { update({ plannedRwn: '', plannedTemplate: null }); setRwnInput(''); setRwnError(''); }}>Detach RWN, keep rows</Button>}
              {rwnPreview && <p className="mt-2 text-sm text-content-secondary" role="status">
                Preview: {rwnPreview.length ? rwnPreview.filter((segment) => segment.role === 'work').length + ' work and ' + rwnPreview.filter((segment) => segment.role === 'rest').length + ' rest rows' : 'single-piece plan'}. Planned targets never fill in actual results.
              </p>}
              <p className="mt-2 text-xs text-content-muted">The plan sets targets only. Enter measured distance and time for each interval after the workout.</p>
            </Card>

            <Card className="max-w-3xl">
              <CardHeader title="Your result" subtitle="A quick entry only needs the measurements you know." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label={`Finished at · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'}`} type="datetime-local" value={form.finishedLocal} onChange={(event) => update({ finishedLocal: event.target.value })} error={errors.completedAt} className="min-h-11" />
                <Select label="Completion" value={form.status} onChange={(event) => update({ status: event.target.value as EntryForm['status'] })} className="min-h-11">
                  <option value="completed">Completed</option>
                  <option value="stopped_early">Stopped early</option>
                </Select>
                <div>
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1"><Input label={`Distance (${form.distanceUnit})`} inputMode="decimal" value={fullDetail ? hasAllWorkDistances && measuredDistance ? String(measuredDistance / (form.distanceUnit === 'km' ? 1000 : 1)) : '' : form.distance} readOnly={fullDetail} onChange={(event) => update({ distance: event.target.value })} error={errors['summary.distanceMeters']} className="min-h-11" /></div>
                    <Select aria-label="Distance unit" value={form.distanceUnit} onChange={(event) => {
                      const next = event.target.value as DistanceUnit;
                      const factor = next === 'km' ? 1 / 1000 : 1000;
                      update({ distanceUnit: next, distance: form.distance ? String(Number(form.distance) * factor) : '', segments: form.segments.map((segment) => ({ ...segment, distance: segment.distance ? String(Number(segment.distance) * factor) : '' })) });
                    }} className="min-h-11 w-20"><option value="m">m</option><option value="km">km</option></Select>
                  </div>
                </div>
                <Input label="Time" inputMode="decimal" value={fullDetail ? hasAllSegmentTimes && measuredDuration ? displayTime(measuredDuration) : '' : form.duration} readOnly={fullDetail} onChange={(event) => update({ duration: event.target.value })} placeholder="20:10 or 1:02:03" hint={fullDetail ? "Calculated when every work and rest row has a time." : "For intervals, include rest if this is the full elapsed time."} error={errors['summary.durationSeconds']} className="min-h-11" />
                {fullDetail && <p className="text-xs text-content-muted sm:col-span-2">Session totals appear when the relevant rows have measurements. Blank values stay unknown. To enter a separate session total, choose partial detail.</p>}
              </div>
              {errors.summary && <p className="mt-3 text-sm text-accent-danger" role="alert">{errors.summary}</p>}
              <details className="mt-4 border-t border-border-subtle pt-4" open={Object.keys(errors).some((field) => ['summary.calories', 'summary.watts', 'summary.heartRate', 'summary.strokeRate', 'summary.perceivedExertion'].includes(field)) || undefined}>
                <summary className="cursor-pointer text-sm font-medium text-content-secondary">More measurements and notes</summary>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Calories" inputMode="numeric" value={fullDetail ? hasAllWorkCalories && segmentTotals.work.calories ? String(segmentTotals.work.calories) : '' : form.calories} readOnly={fullDetail} onChange={(event) => update({ calories: event.target.value })} error={errors['summary.calories']} className="min-h-11" />
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
              <CardHeader title="Intervals or splits" subtitle="Optional detail for repeats, variable work, warmups and rest. Choose each work interval type when you know it." action={form.segments.length ? <span className="text-xs text-content-muted">{form.segments.length} segments</span> : undefined} />
              {!showSegments ? (
                <Button type="button" variant="secondary" className="min-h-11" icon={<Plus size={16} />} onClick={() => { if (!form.segments.length) update({ segments: [newSegmentForm()], detailCoverage: 'full' }); setShowSegments(true); }}>{form.segments.length ? `Show ${form.segments.length} intervals` : 'Add intervals or splits'}</Button>
              ) : (
                <div className="space-y-4">
                  <Select label="How much of the workout do these segments cover?" value={form.detailCoverage} onChange={(event) => update({ detailCoverage: event.target.value as EntryForm['detailCoverage'] })} error={errors.detailCoverage} className="min-h-11">
                    <option value="full">The whole workout</option>
                    <option value="partial">Only part of it</option>
                  </Select>
                  {form.segments.length > 0 && <div className="rounded-lg border border-border bg-surface-secondary p-3 text-sm" aria-live="polite">
                    <p className="font-medium text-content-primary">Entered row subtotals {form.detailCoverage === 'partial' ? '(partial detail)' : '(whole workout detail)'}</p>
                    <p className="mt-1 text-content-secondary">
                      Work: {segmentTotals.work.distance.toLocaleString()} m · {displayTime(segmentTotals.work.duration)}
                      {'  ·  '}Rest: {segmentTotals.rest.distance.toLocaleString()} m · {displayTime(segmentTotals.rest.duration)}
                      {'  ·  '}Elapsed: {displayTime(measuredDuration)}
                    </p>
                  </div>}
                  <SegmentGrid
                    segments={form.segments}
                    onChange={(segments, planChanged) => { if (planChanged) setRwnInput(''); update({
                      segments,
                      detailCoverage: segments.length ? (form.detailCoverage === 'none' ? 'full' : form.detailCoverage) : 'none',
                      ...(planChanged ? { plannedRwn: '', plannedTemplate: null } : {}),
                    }); }}
                    distanceUnit={form.distanceUnit}
                    errors={errors}
                    hasLinkedPlan={Boolean(form.plannedRwn || form.plannedTemplate)}
                  />
                  {errors.segments && <p className="text-sm text-accent-danger" role="alert">{errors.segments}</p>}
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowSegments(false)}>Hide interval detail</Button>
                </div>
              )}
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
