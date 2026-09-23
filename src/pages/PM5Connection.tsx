import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Breadcrumb } from '../components/ui';
import {
  PM5ConnectState,
  PM5ConnectionNotice,
  PM5ErrorNotice,
  PM5FlowStepper,
  PM5LiveState,
  PM5WorkoutState,
  PM5ReadyState,
  PM5SummaryState,
  derivePM5FlowState,
} from '../components/pm5/PM5Flow';
import { createPM5ProgrammingRequest, type PM5ProgrammingRequestResult } from '../services/pm5ProgrammingService';
import { directPM5Service } from '../services/pm5DirectService';
import { defaultWorkoutBuilderSpec, type WorkoutBuilderSpec } from '../utils/workoutBuilder';
import { readTrainRwn } from '../utils/trainLink';
import type { ActiveWorkoutSpec, PM5ProgrammingReceiptV1 } from '../types/ergSession.types';
import { usePM5 } from '../hooks/usePM5';

export function PM5Connection() {
  const {
    status,
    devices,
    connectedDevice,
    diagnostic,
    liveData,
    captureState,
    error: connectionError,
    scan,
    connect,
    disconnect,
    readDiagnostic,
    clearError,
    setCaptureState,
  } = usePM5();

  const [rwn, setRwn] = useState('2000m');
  const [builderSpec, setBuilderSpec] = useState<WorkoutBuilderSpec>(defaultWorkoutBuilderSpec);
  const [translation, setTranslation] = useState<PM5ProgrammingRequestResult | null>(null);
  const [receipt, setReceipt] = useState<PM5ProgrammingReceiptV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programming, setProgramming] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [diagnosticPending, setDiagnosticPending] = useState(false);
  const [captureRetrying, setCaptureRetrying] = useState(false);

  const visibleError = error ?? connectionError;

  const flowState = useMemo(() => derivePM5FlowState({
    translation,
    connected: status === 'connected',
    receipt,
    captureState,
  }), [captureState, receipt, status, translation]);

  const reviewWorkout = (rwnOverride?: string) => {
    const candidate = (rwnOverride ?? rwn).trim();
    setReviewing(true);
    setError(null);
    clearError();
    setReceipt(null);
    setCaptureState(null);
    try {
      const result = createPM5ProgrammingRequest(candidate);
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
    try {
      await scan();
    } catch (scanError) {
      toast.error(scanError instanceof Error ? scanError.message : 'Could not scan for a PM5.');
    }
  };

  const connectDevice = async (deviceId: string) => {
    setError(null);
    try {
      await connect(deviceId);
      toast.success('PM5 connected');
    } catch (connectError) {
      toast.error(connectError instanceof Error ? connectError.message : 'Could not connect to the PM5.');
    }
  };

  const disconnectDevice = async () => {
    setReceipt(null);
    await disconnect();
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

  const runDiagnostic = async () => {
    setDiagnosticPending(true);
    setError(null);
    try {
      await readDiagnostic();
    } catch (diagnosticError) {
      toast.error(diagnosticError instanceof Error ? diagnosticError.message : 'Could not read PM5 diagnostics.');
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
    clearError();
  };

  // A workout handed over from a suggestion arrives already written, so accept
  // it and validate it rather than making the athlete retype it. Applied once
  // per handoff so it never overwrites edits made afterwards.
  const location = useLocation();
  const handedOverRwn = readTrainRwn(location.search);
  const appliedHandoffRef = useRef<string | null>(null);

  useEffect(() => {
    if (!handedOverRwn || appliedHandoffRef.current === handedOverRwn) return;
    appliedHandoffRef.current = handedOverRwn;
    setRwn(handedOverRwn);
    reviewWorkout(handedOverRwn);
    // reviewWorkout is recreated each render and intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedOverRwn]);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <Breadcrumb items={[{ label: 'Log Dashboard', to: '/' }, { label: 'Train' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-content-primary sm:text-3xl">Train with PM5</h1>
        <p className="mt-1 text-sm text-content-secondary">Review the workout first, then connect, program, row, and save the measured result.</p>
      </div>

      <PM5FlowStepper state={flowState} />

      {status === 'scanning' && <PM5ConnectionNotice message="Scanning for nearby PM5 monitors…" />}
      {status === 'connecting' && <PM5ConnectionNotice message="Connecting to the selected PM5…" />}
      {visibleError && <PM5ErrorNotice message={visibleError} />}

      {flowState === 'connect' && (
        <PM5ConnectState devices={devices} scanning={status === 'initializing' || status === 'scanning'} connecting={status === 'connecting'} onScan={() => void startScan()} onConnect={deviceId => void connectDevice(deviceId)} />
      )}
      {flowState === 'workout' && (
        <PM5WorkoutState
          rwn={rwn}
          translation={translation}
          reviewing={reviewing}
          builderSpec={builderSpec}
          onRwnChange={changeRwn}
          onReview={reviewWorkout}
          onBuilderChange={setBuilderSpec}
        />
      )}
      {flowState === 'ready' && translation?.request && (
        <PM5ReadyState
          device={connectedDevice}
          translation={translation}
          programming={programming}
          diagnosticPending={diagnosticPending}
          diagnostic={diagnostic}
          onProgram={() => void programRequest(translation.request!)}
          onDiagnostic={() => void runDiagnostic()}
          onDisconnect={() => void disconnectDevice()}
        />
      )}
      {flowState === 'live' && (
        <PM5LiveState data={liveData} diagnostic={diagnostic} onDisconnect={() => void disconnectDevice()} />
      )}
      {flowState === 'summary' && captureState && (
        <PM5SummaryState state={captureState} retrying={captureRetrying} onRetry={() => void retryCapture()} />
      )}
    </main>
  );
}
