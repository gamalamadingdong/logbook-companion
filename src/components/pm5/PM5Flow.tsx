import type { PM5Data, PM5Device, PM5Diagnostic } from '@readyall/erglink/pm5';
import { useState } from 'react';
import { Activity, AlertTriangle, Bluetooth, CheckCircle2, Radio, Unplug } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PM5ProgrammingReceiptV1 } from '../../types/ergSession.types';
import type { PM5ProgrammingRequestResult } from '../../services/pm5ProgrammingService';
import type { PM5CapturePersistenceState } from '../../services/pm5CapturePersistence';
import { buildRwnFromSpec, type WorkoutBuilderSpec } from '../../utils/workoutBuilder';
import { Badge, Button, Card, CardHeader, Input, Select } from '../ui';

export type PM5FlowState = 'connect' | 'workout' | 'ready' | 'live' | 'summary';

export interface PM5FlowStateInput {
  translation: PM5ProgrammingRequestResult | null;
  connected: boolean;
  receipt: PM5ProgrammingReceiptV1 | null;
  captureState: PM5CapturePersistenceState | null;
}

/**
 * Connecting comes first.
 *
 * The monitor is the thing the athlete walks up to, and the connection now
 * outlives navigation, so it is established once and reused. Choosing the
 * workout follows, and a validated workout on a connected monitor is the only
 * state that offers the single action that starts the piece.
 */
export function derivePM5FlowState(input: PM5FlowStateInput): PM5FlowState {
  if (input.captureState) return 'summary';
  if (input.receipt?.status === 'programmed') return 'live';
  if (!input.connected) return 'connect';
  if (!input.translation?.request || input.translation.mode === 'unsupported') return 'workout';
  return 'ready';
}

const flowOrder: PM5FlowState[] = ['connect', 'workout', 'ready', 'live', 'summary'];
const flowLabels: Record<PM5FlowState, string> = {
  connect: 'Connect',
  workout: 'Workout',
  ready: 'Ready',
  live: 'Live',
  summary: 'Summary',
};

export function PM5FlowStepper({ state }: { state: PM5FlowState }) {
  const activeIndex = flowOrder.indexOf(state);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="PM5 workout progress">
      {flowOrder.map((step, index) => (
        <li
          key={step}
          aria-current={step === state ? 'step' : undefined}
          className={twMerge(clsx(
            'rounded-lg px-1 py-2 text-center text-[10px] font-medium sm:text-xs',
            index <= activeIndex
              ? 'bg-accent-primary-surface text-accent-primary-text'
              : 'bg-surface-secondary text-content-muted',
          ))}
        >
          <span className="block text-xs sm:text-sm">{index + 1}</span>
          {flowLabels[step]}
        </li>
      ))}
    </ol>
  );
}

export function PM5WorkoutState({
  rwn,
  translation,
  reviewing,
  builderSpec,
  onRwnChange,
  onReview,
  onBuilderChange,
}: {
  rwn: string;
  translation: PM5ProgrammingRequestResult | null;
  reviewing: boolean;
  builderSpec: WorkoutBuilderSpec;
  onRwnChange: (value: string) => void;
  onReview: (rwnOverride?: string) => void;
  onBuilderChange: (spec: WorkoutBuilderSpec) => void;
}) {
  const [entryMode, setEntryMode] = useState<'rwn' | 'builder'>('rwn');
  const built = buildRwnFromSpec(builderSpec);

  const update = (patch: Partial<WorkoutBuilderSpec>) => onBuilderChange({ ...builderSpec, ...patch });

  return (
    <Card>
      <CardHeader title="Choose the workout" subtitle="Write it in RWN, or build it step by step." />

      <div className="inline-flex w-full rounded-lg border border-border bg-surface-secondary p-1" role="tablist" aria-label="Workout entry method">
        {(['rwn', 'builder'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={entryMode === mode}
            onClick={() => setEntryMode(mode)}
            className={twMerge(clsx(
              'min-h-11 flex-1 rounded-md px-3 text-sm font-medium transition-colors',
              entryMode === mode
                ? 'bg-accent-primary-surface text-accent-primary-text'
                : 'text-content-muted',
            ))}
          >
            {mode === 'rwn' ? 'RWN' : 'Build it'}
          </button>
        ))}
      </div>

      {entryMode === 'rwn' ? (
        <div className="mt-4 space-y-4">
          <Input
            label="Rowing Workout Notation"
            value={rwn}
            onChange={event => onRwnChange(event.target.value)}
            placeholder="Example: 8x500m/3:30r"
            className="min-h-11 font-mono"
            disabled={reviewing}
          />
          <Button className="min-h-11 w-full" size="lg" onClick={() => onReview()} loading={reviewing} disabled={!rwn.trim()}>
            Check workout
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              value={builderSpec.mode}
              onChange={event => update({ mode: event.target.value as WorkoutBuilderSpec['mode'] })}
            >
              <option value="steady">Steady state</option>
              <option value="intervals">Intervals</option>
            </Select>
            <Select
              label="Measured by"
              value={builderSpec.measure}
              onChange={event => update({ measure: event.target.value as WorkoutBuilderSpec['measure'] })}
            >
              <option value="distance">Distance</option>
              <option value="time">Time</option>
            </Select>
          </div>

          {builderSpec.mode === 'intervals' && (
            <Input
              label="How many intervals"
              type="number"
              min={1}
              value={String(builderSpec.repeats)}
              onChange={event => update({ repeats: Number(event.target.value) })}
              className="min-h-11"
            />
          )}

          {builderSpec.measure === 'distance' ? (
            <Input
              label="Distance each interval (metres)"
              type="number"
              min={1}
              value={String(builderSpec.distanceMeters)}
              onChange={event => update({ distanceMeters: Number(event.target.value) })}
              className="min-h-11"
            />
          ) : (
            <Input
              label="Time each interval (seconds)"
              type="number"
              min={1}
              value={String(builderSpec.durationSeconds)}
              onChange={event => update({ durationSeconds: Number(event.target.value) })}
              className="min-h-11"
            />
          )}

          {builderSpec.mode === 'intervals' && (
            <Input
              label="Rest between intervals (seconds)"
              type="number"
              min={1}
              value={String(builderSpec.restSeconds)}
              onChange={event => update({ restSeconds: Number(event.target.value) })}
              className="min-h-11"
            />
          )}

          <div className="rounded-lg border border-border bg-surface-secondary p-3 text-sm" role="status">
            {built.rwn ? (
              <>
                <p className="text-content-secondary">This builds</p>
                <p className="mt-1 font-mono text-base text-content-primary">{built.rwn}</p>
              </>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-accent-danger-text">
                {built.errors.map(message => <li key={message}>{message}</li>)}
              </ul>
            )}
          </div>

          <Button
            className="min-h-11 w-full"
            size="lg"
            onClick={() => {
              if (!built.rwn) return;
              // Pass the notation explicitly: the state update above has not
              // been applied yet when this handler runs.
              onRwnChange(built.rwn);
              onReview(built.rwn);
            }}
            loading={reviewing}
            disabled={!built.rwn}
          >
            Check workout
          </Button>
        </div>
      )}

      {translation && (
        <div className={twMerge(clsx(
          'mt-4 rounded-lg border p-4 text-sm',
          translation.mode === 'unsupported'
            ? 'border-accent-danger bg-accent-danger/10 text-accent-danger-text'
            : 'border-border bg-surface-secondary text-content-secondary',
        ))} role="status">
          <div className="flex items-center gap-2">
            {translation.mode === 'unsupported' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <p className="font-medium text-content-primary">
              {translation.mode === 'exact' ? 'Exact PM5 workout' : translation.mode === 'prompt_only' ? 'PM5-native core plus athlete guidance' : 'Unsupported on PM5'}
            </p>
          </div>
          {translation.notes.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {translation.notes.map(note => <li key={note}>{note}</li>)}
            </ul>
          )}
          {translation.mode === 'unsupported' && (
            <p className="mt-2 font-medium">This workout cannot be programmed onto a PM5. Adjust it and check again.</p>
          )}
        </div>
      )}
    </Card>
  );
}

export function PM5ConnectState({
  devices,
  scanning,
  connecting,
  onScan,
  onConnect,
}: {
  devices: PM5Device[];
  scanning: boolean;
  connecting: boolean;
  onScan: () => void;
  onConnect: (deviceId: string) => void;
}) {
  return (
    <Card>
      <CardHeader title="Connect PM5" subtitle="Find the monitor you are about to row on. It stays connected until you disconnect." />
      <Button className="min-h-11 w-full" size="lg" icon={<Bluetooth size={20} />} onClick={onScan} loading={scanning}>
        Find PM5
      </Button>
      {devices.length > 0 && (
        <div className="mt-4 space-y-2">
          {devices.map(device => (
            <Button key={device.id} variant="secondary" className="min-h-11 w-full justify-between" onClick={() => onConnect(device.id)} disabled={connecting}>
              <span>{device.name}</span><span className="text-xs text-content-muted">Connect</span>
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PM5ReadyState({
  device,
  translation,
  programming,
  diagnosticPending,
  diagnostic,
  onProgram,
  onDiagnostic,
  onDisconnect,
}: {
  device: PM5Device | null;
  translation: PM5ProgrammingRequestResult;
  programming: boolean;
  diagnosticPending: boolean;
  diagnostic: PM5Diagnostic | null;
  onProgram: () => void;
  onDiagnostic: () => void;
  onDisconnect: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Ready to row"
        subtitle={`${device?.name ?? 'PM5'} is connected and the workout is set.`}
        action={<Badge variant="success">Connected</Badge>}
      />
      {translation.notes.length > 0 && (
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-content-secondary">
          {translation.notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
      <Button className="min-h-11 w-full" size="lg" onClick={onProgram} loading={programming}>
        {programming ? 'Sending to PM5…' : 'Row'}
      </Button>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Button className="min-h-11" variant="ghost" onClick={onDiagnostic} loading={diagnosticPending}>Diagnostics</Button>
        <Button className="min-h-11" variant="ghost" icon={<Unplug size={18} />} onClick={onDisconnect}>Disconnect</Button>
      </div>
      {diagnostic && <p className="mt-3 text-xs text-content-muted">Firmware {diagnostic.firmwareRevision ?? 'unknown'} · {diagnostic.controlValueLimit}-byte control limit</p>}
    </Card>
  );
}

function formatPace(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}/500m`;
}

export function PM5LiveState({ data, diagnostic, onDisconnect }: { data: PM5Data | null; diagnostic: PM5Diagnostic | null; onDisconnect: () => void }) {
  return (
    <Card>
      <CardHeader title="Workout live" subtitle="Measured PM5 data; the monitor remains the workout authority." action={<Badge variant="success">Programmed</Badge>} />
      <div className="rounded-xl bg-surface-secondary p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-content-muted">Pace</p>
        <p className="mt-1 text-4xl font-semibold text-content-primary">{formatPace(data?.pace)}</p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-content-muted">Distance</dt><dd className="font-medium text-content-primary">{data ? `${data.distance.toFixed(0)} m` : '—'}</dd></div>
        <div><dt className="text-content-muted">Elapsed</dt><dd className="font-medium text-content-primary">{data ? `${data.elapsedTime.toFixed(1)} s` : '—'}</dd></div>
        <div><dt className="text-content-muted">Rate</dt><dd className="font-medium text-content-primary">{data ? `${data.strokeRate} spm` : '—'}</dd></div>
      </dl>
      {diagnostic && <p className="mt-3 text-xs text-content-muted">{diagnostic.model ?? 'PM5'} · firmware {diagnostic.firmwareRevision ?? 'unknown'}</p>}
      <Button className="mt-4 min-h-11 w-full" variant="ghost" icon={<Unplug size={18} />} onClick={onDisconnect}>End connection</Button>
    </Card>
  );
}

const capturePhaseLabel: Record<PM5CapturePersistenceState['phase'], string> = {
  saved: 'Saved on device',
  ingesting: 'Saving to LC',
  ingested: 'Saved to LC',
  failed: 'Retry pending',
  held: 'Capture retained',
};

export function PM5SummaryState({ state, retrying, onRetry }: { state: PM5CapturePersistenceState; retrying: boolean; onRetry: () => void }) {
  const summary = state.capture.summary;
  return (
    <Card>
      <CardHeader
        title="Workout summary"
        subtitle="PM5 evidence is retained locally before and during LC ingestion."
        action={<Badge variant={state.phase === 'ingested' ? 'success' : state.phase === 'failed' ? 'danger' : 'info'}>{capturePhaseLabel[state.phase]}</Badge>}
      />
      {summary ? (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-content-muted">Distance</dt><dd className="font-medium text-content-primary">{Math.round(summary.workDistanceMeters)} m</dd></div>
          <div><dt className="text-content-muted">Work time</dt><dd className="font-medium text-content-primary">{summary.workTimeSeconds.toFixed(1)} s</dd></div>
          <div><dt className="text-content-muted">Average pace</dt><dd className="font-medium text-content-primary">{formatPace(summary.averagePaceSecondsPer500m)}</dd></div>
          <div><dt className="text-content-muted">Stroke rate</dt><dd className="font-medium text-content-primary">{Math.round(summary.averageStrokeRate)} spm</dd></div>
        </dl>
      ) : <p className="text-sm text-content-secondary">The incomplete capture is retained for review.</p>}
      {state.workoutId && <p className="mt-3 text-xs text-content-muted">LC workout: {state.workoutId}</p>}
      {state.error && <p className="mt-3 text-sm text-accent-danger-text" role="alert">{state.error}. The local capture remains retryable.</p>}
      {state.phase === 'failed' && <Button className="mt-4 min-h-11" onClick={onRetry} loading={retrying}>Retry saving to LC</Button>}
    </Card>
  );
}

export function PM5ConnectionNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-secondary p-3 text-sm text-content-secondary" role="status">
      <Radio size={18} className="mt-0.5 shrink-0" /><span>{message}</span>
    </div>
  );
}

export function PM5ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-danger bg-accent-danger/10 p-3 text-sm text-accent-danger-text" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" /><span>{message}</span>
    </div>
  );
}

export function PM5LiveIcon() {
  return <Activity aria-hidden="true" size={18} />;
}
