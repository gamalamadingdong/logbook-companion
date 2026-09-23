import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PM5Data, PM5Device, PM5Diagnostic } from '@readyall/erglink/pm5';
import { directPM5Service } from '../services/pm5DirectService';
import type { PM5CapturePersistenceState } from '../services/pm5CapturePersistence';
import {
  ROWING_IDLE_TIMEOUT_MS,
  applyRowingSample,
  expireRowingActivity,
  initialRowingActivityState,
  resetRowingActivity,
  type RowingActivityState,
} from '../services/pm5ActivityDetection';
import { useAuth } from '../hooks/useAuth';

export type PM5ConnectionStatus =
  | 'idle'
  | 'initializing'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export interface PM5ContextValue {
  status: PM5ConnectionStatus;
  devices: PM5Device[];
  connectedDevice: PM5Device | null;
  diagnostic: PM5Diagnostic | null;
  liveData: PM5Data | null;
  captureState: PM5CapturePersistenceState | null;
  error: string | null;
  /** True while telemetry shows the athlete rowing, however the piece began. */
  rowing: boolean;
  scan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  readDiagnostic: () => Promise<void>;
  clearError: () => void;
  setCaptureState: (state: PM5CapturePersistenceState | null) => void;
  setDiagnostic: (diagnostic: PM5Diagnostic | null) => void;
}

export const PM5Context = createContext<PM5ContextValue | null>(null);

/**
 * Owns the PM5 connection for the whole application.
 *
 * Connection is application state rather than route state. Previously the
 * connection lived in the `/pm5` page and its cleanup disconnected the monitor,
 * so navigating away ended the session. Holding it here lets a piece continue
 * while the athlete moves around the app.
 *
 * The driver exposes a single data callback and a single discovery callback, so
 * this provider must be their only subscriber and fan values out through React.
 */
export function PM5Provider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<PM5ConnectionStatus>(
    directPM5Service.isConnected() ? 'connected' : 'idle',
  );
  const [devices, setDevices] = useState<PM5Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<PM5Device | null>(
    directPM5Service.getConnectedDevice(),
  );
  const [diagnostic, setDiagnostic] = useState<PM5Diagnostic | null>(null);
  const [liveData, setLiveData] = useState<PM5Data | null>(null);
  const [captureState, setCaptureState] = useState<PM5CapturePersistenceState | null>(
    directPM5Service.getCapturePersistenceState(),
  );
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<RowingActivityState>(initialRowingActivityState);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    directPM5Service.onDeviceDiscovered(device => {
      setDevices(current => [
        ...current.filter(candidate => candidate.id !== device.id),
        device,
      ].sort((left, right) => left.name.localeCompare(right.name)));
    });
    directPM5Service.onData(data => {
      setLiveData(data);
      setActivity(current => applyRowingSample(current, data, Date.now()));
    });
  }, []);

  useEffect(() => directPM5Service.onCapturePersistenceState(setCaptureState), []);

  // Telemetry simply stops when a piece pauses or ends, so rowing is cleared by
  // elapsed silence rather than by an incoming sample.
  useEffect(() => {
    if (!activity.rowing) return;
    const timer = setInterval(() => {
      setActivity(current => expireRowingActivity(current, Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [activity.rowing]);

  // Hold the screen awake for the duration of a piece. The Screen Wake Lock API
  // is available in the iOS web view, so this needs no additional plugin.
  useEffect(() => {
    if (!activity.rowing) return;
    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock?.request('screen') ?? null;
        // The effect may have torn down while the request was in flight.
        if (cancelled) {
          void lock?.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
      } catch {
        // A denied wake lock must not interrupt a workout.
      }
    };

    // The system drops the lock whenever the page is hidden, so it has to be
    // taken again each time the athlete returns mid-piece.
    const reacquire = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', reacquire);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', reacquire);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [activity.rowing]);

  // Release the monitor when the owning athlete changes or signs out. This is
  // deliberately not tied to route changes.
  useEffect(() => {
    const ownerId = user?.id;
    directPM5Service.setCaptureOwner(ownerId ?? null);
    if (!ownerId) return;
    void directPM5Service.retryPendingCaptures().catch(() => undefined);
    return () => {
      void directPM5Service.disconnect()
        .catch(() => undefined)
        .finally(() => {
          directPM5Service.clearCaptureOwner(ownerId);
          setActivity(resetRowingActivity());
        });
    };
  }, [user?.id]);

  const scan = useCallback(async () => {
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
      setError(scanError instanceof Error ? scanError.message : 'Could not scan for a PM5.');
      setStatus('error');
      throw scanError;
    }
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    setStatus('connecting');
    setError(null);
    try {
      await directPM5Service.stopScan();
      await directPM5Service.connect(deviceId);
      setConnectedDevice(directPM5Service.getConnectedDevice());
      setStatus('connected');
      setDiagnostic(await directPM5Service.getDiagnostics().catch(() => null));
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not connect to the PM5.');
      setStatus('error');
      throw connectError;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await directPM5Service.disconnect();
    } finally {
      setConnectedDevice(null);
      setDiagnostic(null);
      setLiveData(null);
      setActivity(resetRowingActivity());
      setStatus('idle');
    }
  }, []);

  const readDiagnostic = useCallback(async () => {
    setError(null);
    try {
      setDiagnostic(await directPM5Service.getDiagnostics());
    } catch (diagnosticError) {
      setError(diagnosticError instanceof Error ? diagnosticError.message : 'Could not read PM5 diagnostics.');
      throw diagnosticError;
    }
  }, []);

  const value = useMemo<PM5ContextValue>(() => ({
    status,
    devices,
    connectedDevice,
    diagnostic,
    liveData,
    captureState,
    error,
    rowing: activity.rowing,
    scan,
    connect,
    disconnect,
    readDiagnostic,
    clearError: () => setError(null),
    setCaptureState,
    setDiagnostic,
  }), [
    status, devices, connectedDevice, diagnostic, liveData, captureState, error,
    activity.rowing, scan, connect, disconnect, readDiagnostic,
  ]);

  return <PM5Context.Provider value={value}>{children}</PM5Context.Provider>;
}

export { ROWING_IDLE_TIMEOUT_MS };
