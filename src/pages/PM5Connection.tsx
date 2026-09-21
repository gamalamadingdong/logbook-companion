import { useEffect, useMemo, useState } from 'react';
import type { PM5Data, PM5Device, PM5Diagnostic } from '@readyall/erglink/pm5';
import { toast } from 'sonner';
import { Breadcrumb } from '../components/ui';
import {
  PM5ConnectState,
  PM5ConnectionNotice,
  PM5ErrorNotice,
  PM5FlowStepper,
  PM5LiveState,
  PM5PreflightState,
  PM5ReadyState,
  PM5SummaryState,
  derivePM5FlowState,
} from '../components/pm5/PM5Flow';
import { createPM5ProgrammingRequest, type PM5ProgrammingRequestResult } from '../services/pm5ProgrammingService';
import { directPM5Service } from '../services/pm5DirectService';
import type { PM5CapturePersistenceState } from '../services/pm5CapturePersistence';
import type { ActiveWorkoutSpec, PM5ProgrammingReceiptV1 } from '../types/ergSession.types';
import { useAuth } from '../hooks/useAuth';

type ConnectionStatus = 'idle' | 'initializing' | 'scanning' | 'connecting' | 'connected' | 'error';

export function PM5Connection() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>(directPM5Service.isConnected() ? 'connected' : 'idle');
  const [devices, setDevices] = useState<PM5Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<PM5Device | null>(directPM5Service.getConnectedDevice());
  const [rwn, setRwn] = useState('2000m');
  const [translation, setTranslation] = useState<PM5ProgrammingRequestResult | null>(null);
  const [receipt, setReceipt] = useState<PM5ProgrammingReceiptV1 | null>(null);
  const [diagnostic, setDiagnostic] = useState<PM5Diagnostic | null>(null);
  const [liveData, setLiveData] = useState<PM5Data | null>(null);
  const [captureState, setCaptureState] = useState<PM5CapturePersistenceState | null>(directPM5Service.getCapturePersistenceState());
  const [error, setError] = useState<string | null>(null);
  const [programming, setProgramming] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [diagnosticPending, setDiagnosticPending] = useState(false);
  const [captureRetrying, setCaptureRetrying] = useState(false);

  useEffect(() => {
    directPM5Service.onDeviceDiscovered(device => {
      setDevices(current => [
        ...current.filter(candidate => candidate.id !== device.id),
        device,
      ].sort((left, right) => left.name.localeCompare(right.name)));
    });
    directPM5Service.onData(setLiveData);
  }, []);

  useEffect(() => directPM5Service.onCapturePersistenceState(setCaptureState), []);

  useEffect(() => {
    const ownerId = user?.id;
    directPM5Service.setCaptureOwner(ownerId ?? null);
    if (!ownerId) return;
    void directPM5Service.retryPendingCaptures().catch(retryError => {
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

  const flowState = useMemo(() => derivePM5FlowState({
    translation,
    connected: status === 'connected',
    receipt,
    captureState,
  }), [captureState, receipt, status, translation]);

  const reviewWorkout = () => {
    setReviewing(true);
    setError(null);
    setReceipt(null);
    setCaptureState(null);
    try {
      const result = createPM5ProgrammingRequest(rwn.trim());
      setTranslation(result);
      if (result.mode === 'unsupported' || !result.request) {
        setError(result.notes.join(' ') || 'This workout cannot be programmed on a PM5.');
      }
    } finally {
      setReviewing(false);
    }
  };

  const startScan = async () => {
    setError(null);
    setDevices([]);
    setStatus('initializing');
    try {
      await directPM5Service.initialize();
      if (!(await directPM5Service.isAvailable())) throw new Error('Bluetooth is unavailable. Enable Bluetooth and try again.');
      setStatus('scanning');
      await directPM5Service.startScan();
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : 'Could not scan for a PM5.';
      setError(message);
      setStatus('error');
      toast.error(message);
    }
  };

  const connect = async (deviceId: string) => {
    setStatus('connecting');
    setError(null);
    try {
      await directPM5Service.stopScan();
      await directPM5Service.connect(deviceId);
      setConnectedDevice(directPM5Service.getConnectedDevice());
      setStatus('connected');
      setDiagnostic(await directPM5Service.getDiagnostics().catch(() => null));
      toast.success('PM5 connected');
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : 'Could not connect to the PM5.';
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
    setCaptureState(null);
    setError(null);
    try {
      const nextReceipt = await directPM5Service.program(request);
      setReceipt(nextReceipt);
      if (nextReceipt.status === 'programmed') toast.success('PM5 programmed');
      else {
        const message = nextReceipt.error ?? `PM5 programming ended with ${nextReceipt.status}`;
        setError(message);
        toast.error(message);
      }
    } finally {
      setProgramming(false);
    }
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

  const changeRwn = (value: string) => {
    setRwn(value);
    setTranslation(null);
    setReceipt(null);
    setCaptureState(null);
    setError(null);
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <Breadcrumb items={[{ label: 'Log Dashboard', to: '/' }, { label: 'Connect PM5' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-content-primary sm:text-3xl">Train with PM5</h1>
        <p className="mt-1 text-sm text-content-secondary">Review the workout first, then connect, program, row, and save the measured result.</p>
      </div>

      <PM5FlowStepper state={flowState} />

      {status === 'scanning' && <PM5ConnectionNotice message="Scanning for nearby PM5 monitors…" />}
      {status === 'connecting' && <PM5ConnectionNotice message="Connecting to the selected PM5…" />}
      {error && <PM5ErrorNotice message={error} />}

      {flowState === 'preflight' && (
        <PM5PreflightState rwn={rwn} translation={translation} reviewing={reviewing} onRwnChange={changeRwn} onReview={reviewWorkout} />
      )}
      {flowState === 'connect' && (
        <PM5ConnectState devices={devices} scanning={status === 'initializing' || status === 'scanning'} connecting={status === 'connecting'} onScan={() => void startScan()} onConnect={deviceId => void connect(deviceId)} />
      )}
      {flowState === 'ready' && translation?.request && (
        <PM5ReadyState
          device={connectedDevice}
          translation={translation}
          programming={programming}
          diagnosticPending={diagnosticPending}
          diagnostic={diagnostic}
          onProgram={() => void programRequest(translation.request!)}
          onDiagnostic={() => void readDiagnostic()}
          onDisconnect={() => void disconnect()}
        />
      )}
      {flowState === 'live' && (
        <PM5LiveState data={liveData} diagnostic={diagnostic} onDisconnect={() => void disconnect()} />
      )}
      {flowState === 'summary' && captureState && (
        <PM5SummaryState state={captureState} retrying={captureRetrying} onRetry={() => void retryCapture()} />
      )}
    </main>
  );
}
