import { useEffect, useMemo, useState } from 'react';
import type { PM5Data, PM5Device, PM5Diagnostic } from '@readyall/erglink/pm5';
import { Activity, AlertTriangle, Bluetooth, CheckCircle2, Radio, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Breadcrumb, Button, Card, CardHeader, Input } from '../components/ui';
import { createPM5ProgrammingRequest, type PM5ProgrammingRequestResult } from '../services/pm5ProgrammingService';
import { directPM5Service } from '../services/pm5DirectService';
import type { PM5CapturePersistenceState } from '../services/pm5CapturePersistence';
import type { ActiveWorkoutSpec, PM5ProgrammingReceiptV1 } from '../types/ergSession.types';
import { useAuth } from '../hooks/useAuth';

type ConnectionStatus = 'idle' | 'initializing' | 'scanning' | 'connecting' | 'connected' | 'error';

const statusLabel: Record<ConnectionStatus, string> = {
  idle: 'Not connected',
  initializing: 'Checking Bluetooth',
  scanning: 'Scanning',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Connection error',
};

const capturePhaseLabel: Record<PM5CapturePersistenceState['phase'], string> = {
  saved: 'Saved on device',
  ingesting: 'Saving to LC',
  ingested: 'Saved to LC',
  failed: 'Retry pending',
  held: 'Capture retained',
};

function formatPace(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}/500m`;
}

export function PM5Connection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>(directPM5Service.isConnected() ? 'connected' : 'idle');
  const [devices, setDevices] = useState<PM5Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<PM5Device | null>(directPM5Service.getConnectedDevice());
  const [rwn, setRwn] = useState('2000m');
  const [translation, setTranslation] = useState<PM5ProgrammingRequestResult | null>(null);
  const [pendingPromptRequest, setPendingPromptRequest] = useState<ActiveWorkoutSpec | null>(null);
  const [receipt, setReceipt] = useState<PM5ProgrammingReceiptV1 | null>(null);
  const [diagnostic, setDiagnostic] = useState<PM5Diagnostic | null>(null);
  const [liveData, setLiveData] = useState<PM5Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programming, setProgramming] = useState(false);
  const [diagnosticPending, setDiagnosticPending] = useState(false);
  const [captureRetrying, setCaptureRetrying] = useState(false);
  const [captureState, setCaptureState] = useState<PM5CapturePersistenceState | null>(
    directPM5Service.getCapturePersistenceState(),
  );

  useEffect(() => {
    directPM5Service.onDeviceDiscovered((device) => {
      setDevices((current) => {
        const withoutDevice = current.filter((candidate) => candidate.id !== device.id);
        return [...withoutDevice, device].sort((left, right) => left.name.localeCompare(right.name));
      });
    });
    directPM5Service.onData(setLiveData);
  }, []);

  useEffect(() => directPM5Service.onCapturePersistenceState(setCaptureState), []);

  useEffect(() => {
    const ownerId = user?.id;
    directPM5Service.setCaptureOwner(ownerId ?? null);
    if (!ownerId) return;
    void directPM5Service.retryPendingCaptures().catch((retryError) => {
      const message = retryError instanceof Error ? retryError.message : 'Could not retry saved PM5 captures.';
      setError(message);
      toast.error(message);
    });
    return () => {
      void directPM5Service.disconnect()
        .catch(() => undefined)
        .finally(() => directPM5Service.clearCaptureOwner(ownerId));
    };
  }, [user?.id]);

  const statusVariant = useMemo(() => {
    if (status === 'connected') return 'success' as const;
    if (status === 'error') return 'danger' as const;
    if (status === 'idle') return 'muted' as const;
    return 'info' as const;
  }, [status]);

  const startScan = async () => {
    setError(null);
    setDevices([]);
    setStatus('initializing');
    try {
      await directPM5Service.initialize();
      if (!(await directPM5Service.isAvailable())) {
        throw new Error('Bluetooth is unavailable. Enable Bluetooth and try again.');
      }
      setStatus('scanning');
      await directPM5Service.startScan();
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : 'Could not scan for a PM5.';
      setError(message);
      setStatus('error');
      toast.error(message);
    }
  };

  const stopScan = async () => {
    try {
      await directPM5Service.stopScan();
    } finally {
      setStatus('idle');
    }
  };

  const connect = async (device: PM5Device) => {
    setError(null);
    setStatus('connecting');
    try {
      await directPM5Service.stopScan();
      await directPM5Service.connect(device.id);
      const activeDevice = directPM5Service.getConnectedDevice() ?? device;
      setConnectedDevice(activeDevice);
      setStatus('connected');
      toast.success(`Connected to ${activeDevice.name}`);
    } catch (connectionError) {
      const message = connectionError instanceof Error ? connectionError.message : 'Could not connect to the PM5.';
      setError(message);
      setStatus('error');
      toast.error(message);
    }
  };

  const disconnect = async () => {
    try {
      await directPM5Service.disconnect();
    } finally {
      setConnectedDevice(null);
      setDiagnostic(null);
      setLiveData(null);
      setReceipt(null);
      setStatus('idle');
    }
  };

  const programRequest = async (request: ActiveWorkoutSpec) => {
    setProgramming(true);
    setReceipt(null);
    setError(null);
    try {
      const nextReceipt = await directPM5Service.program(request);
      setReceipt(nextReceipt);
      if (nextReceipt.status === 'programmed') {
        toast.success('PM5 programmed');
      } else {
        const message = nextReceipt.error ?? `PM5 programming ended with ${nextReceipt.status}`;
        setError(message);
        toast.error(message);
      }
    } finally {
      setProgramming(false);
      setPendingPromptRequest(null);
    }
  };

  const prepareProgramming = async () => {
    if (status !== 'connected') {
      setError('Connect a PM5 before programming a workout.');
      return;
    }

    const result = createPM5ProgrammingRequest(rwn.trim());
    setTranslation(result);
    setReceipt(null);
    setError(null);

    if (!result.request || result.mode === 'unsupported') {
      setError(result.notes.join(' ') || 'This workout cannot be programmed on a PM5.');
      return;
    }

    if (result.mode === 'prompt_only') {
      setPendingPromptRequest(result.request);
      return;
    }

    await programRequest(result.request);
  };

  const readDiagnostic = async () => {
    setDiagnosticPending(true);
    setError(null);
    try {
      setDiagnostic(await directPM5Service.getDiagnostics());
    } catch (diagnosticError) {
      const message = diagnosticError instanceof Error ? diagnosticError.message : 'Could not read PM5 diagnostics.';
      setError(message);
      toast.error(message);
    } finally {
      setDiagnosticPending(false);
    }
  };

  const retryCapture = async () => {
    setCaptureRetrying(true);
    setError(null);
    try {
      await directPM5Service.retryPendingCaptures();
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : 'Could not retry the saved PM5 capture.';
      setError(message);
      toast.error(message);
    } finally {
      setCaptureRetrying(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <Breadcrumb items={[{ label: 'Log Dashboard', to: '/' }, { label: 'Connect PM5' }]} />

      <div>
        <h1 className="text-2xl font-semibold text-content-primary sm:text-3xl">Connect PM5</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Program a nearby monitor directly from RWN. No coach session or network relay is required.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Monitor connection"
          subtitle={connectedDevice ? connectedDevice.name : 'Bluetooth stays local to this device.'}
          action={<Badge variant={statusVariant}>{statusLabel[status]}</Badge>}
        />

        {status === 'connected' ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="min-h-11 flex-1" variant="secondary" onClick={readDiagnostic} loading={diagnosticPending} icon={<Activity size={18} />}>
              Read diagnostic
            </Button>
            <Button className="min-h-11 flex-1" variant="danger" onClick={disconnect} icon={<Unplug size={18} />}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="min-h-11 flex-1" onClick={startScan} loading={status === 'initializing'} disabled={status === 'scanning'} icon={<Bluetooth size={18} />}>
                {status === 'scanning' ? 'Scanning for PM5…' : 'Find PM5'}
              </Button>
              {status === 'scanning' && (
                <Button className="min-h-11" variant="secondary" onClick={stopScan}>Stop scan</Button>
              )}
            </div>

            {devices.length > 0 && (
              <div className="space-y-2" aria-label="Discovered PM5 monitors">
                {devices.map((device) => (
                  <Button
                    type="button"
                    key={device.id}
                    onClick={() => void connect(device)}
                    variant="secondary"
                    className="min-h-11 w-full justify-between px-4 py-3 text-left"
                  >
                    <span className="flex items-center gap-3"><Radio size={18} className="text-accent-primary" />{device.name}</span>
                    <span className="text-xs text-content-muted">Connect</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent-danger bg-accent-danger/10 p-3 text-sm text-accent-danger-text" role="alert">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Program workout" subtitle="RWN remains the complete prescription; only the PM5-native portion is sent." />
        <div className="space-y-4">
          <Input
            label="Rowing Workout Notation"
            value={rwn}
            onChange={(event) => {
              setRwn(event.target.value);
              setTranslation(null);
              setPendingPromptRequest(null);
              setReceipt(null);
            }}
            placeholder="Example: 8x500m/3:30r"
            className="min-h-11 font-mono"
            disabled={programming}
          />
          <Button className="min-h-11 w-full" size="lg" onClick={() => void prepareProgramming()} loading={programming} disabled={status !== 'connected' || !rwn.trim()}>
            Program PM5
          </Button>
        </div>

        {translation && translation.notes.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-surface-secondary p-3 text-sm text-content-secondary">
            <p className="font-medium">{translation.mode === 'prompt_only' ? 'Athlete guidance required' : 'Translation notes'}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {translation.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        )}

        {pendingPromptRequest && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-secondary p-4">
            <p className="text-sm text-content-secondary">
              The PM5 can program the native workout core, but you must follow the guidance above manually.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="min-h-11 flex-1" onClick={() => void programRequest(pendingPromptRequest)} loading={programming}>
                Program PM5-native portion
              </Button>
              <Button className="min-h-11" variant="secondary" onClick={() => setPendingPromptRequest(null)} disabled={programming}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {receipt && (
          <div className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${receipt.status === 'programmed' ? 'border-accent-primary bg-accent-primary-surface text-accent-primary-text' : 'border-border bg-surface-secondary text-content-secondary'}`} role="status">
            {receipt.status === 'programmed' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
            <span>{receipt.status === 'programmed' ? 'PM5 acknowledged the programmed workout.' : receipt.error ?? receipt.status}</span>
          </div>
        )}
      </Card>

      {(liveData || diagnostic) && (
        <Card>
          <CardHeader title="Monitor evidence" subtitle="Current connection and live PM5 data." />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-content-muted">Distance</dt><dd className="font-medium text-content-primary">{liveData ? `${liveData.distance.toFixed(0)} m` : '—'}</dd></div>
            <div><dt className="text-content-muted">Elapsed</dt><dd className="font-medium text-content-primary">{liveData ? `${liveData.elapsedTime.toFixed(1)} s` : '—'}</dd></div>
            <div><dt className="text-content-muted">Pace</dt><dd className="font-medium text-content-primary">{formatPace(liveData?.pace)}</dd></div>
            <div><dt className="text-content-muted">Stroke rate</dt><dd className="font-medium text-content-primary">{liveData ? `${liveData.strokeRate} spm` : '—'}</dd></div>
            <div><dt className="text-content-muted">Model</dt><dd className="font-medium text-content-primary">{diagnostic?.model ?? '—'}</dd></div>
            <div><dt className="text-content-muted">Firmware</dt><dd className="font-medium text-content-primary">{diagnostic?.firmwareRevision ?? '—'}</dd></div>
            <div><dt className="text-content-muted">Control limit</dt><dd className="font-medium text-content-primary">{diagnostic ? `${diagnostic.controlValueLimit} bytes` : '—'}</dd></div>
            <div><dt className="text-content-muted">Read errors</dt><dd className="font-medium text-content-primary">{diagnostic ? diagnostic.readErrors.length : '—'}</dd></div>
          </dl>
        </Card>
      )}

      {captureState && (
        <Card>
          <CardHeader
            title="Completed PM5 capture"
            subtitle="The PM5 evidence is saved locally before Logbook Companion ingestion."
            action={(
              <Badge variant={captureState.phase === 'ingested' ? 'success' : captureState.phase === 'failed' ? 'danger' : 'info'}>
                {capturePhaseLabel[captureState.phase]}
              </Badge>
            )}
          />
          {captureState.capture.summary ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-content-muted">Distance</dt><dd className="font-medium text-content-primary">{Math.round(captureState.capture.summary.workDistanceMeters)} m</dd></div>
              <div><dt className="text-content-muted">Work time</dt><dd className="font-medium text-content-primary">{captureState.capture.summary.workTimeSeconds.toFixed(1)} s</dd></div>
              <div><dt className="text-content-muted">Average pace</dt><dd className="font-medium text-content-primary">{formatPace(captureState.capture.summary.averagePaceSecondsPer500m)}</dd></div>
              <div><dt className="text-content-muted">Stroke rate</dt><dd className="font-medium text-content-primary">{Math.round(captureState.capture.summary.averageStrokeRate)} spm</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-content-secondary">The capture ended without a complete PM5 summary and is being retained for review.</p>
          )}
          {captureState.workoutId && (
            <p className="mt-3 text-xs text-content-muted">LC workout: {captureState.workoutId}</p>
          )}
          {captureState.error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent-danger bg-accent-danger/10 p-3 text-sm text-accent-danger-text" role="alert">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{captureState.error}. The local capture remains available for retry.</span>
            </div>
          )}
          {captureState.phase === 'failed' && (
            <Button className="mt-3 min-h-11" onClick={() => void retryCapture()} loading={captureRetrying}>
              Retry saving to LC
            </Button>
          )}
        </Card>
      )}
    </main>
  );
}
