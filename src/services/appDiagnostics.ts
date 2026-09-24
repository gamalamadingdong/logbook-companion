import { legacyConcept2Enabled } from './concept2Environment';

const STORAGE_KEY = 'lc_staging_diagnostics_v1';
const EVENT_NAME = 'lc:diagnostic-recorded';
const MAX_EVENTS = 100;

export const appDiagnosticsEnabled = !legacyConcept2Enabled;

export type DiagnosticLevel = 'info' | 'warning' | 'error';
export type DiagnosticDetail = Record<string, string | number | boolean | null>;

export interface DiagnosticEvent {
  id: string;
  at: string;
  scope: string;
  code: string;
  level: DiagnosticLevel;
  summary: string;
  durationMs?: number;
  detail?: DiagnosticDetail;
}

function storageAvailable(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

export function readDiagnosticEvents(): DiagnosticEvent[] {
  if (!appDiagnosticsEnabled || !storageAvailable()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) as DiagnosticEvent[] : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function recordDiagnostic(
  scope: string,
  code: string,
  summary: string,
  options: { level?: DiagnosticLevel; durationMs?: number; detail?: DiagnosticDetail } = {},
): DiagnosticEvent | null {
  if (!appDiagnosticsEnabled || !storageAvailable()) return null;
  const event: DiagnosticEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    scope,
    code,
    level: options.level ?? 'info',
    summary,
    ...(options.durationMs === undefined ? {} : { durationMs: Math.round(options.durationMs) }),
    ...(options.detail ? { detail: options.detail } : {}),
  };
  try {
    const next = [event, ...readDiagnosticEvents()].slice(0, MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    globalThis.dispatchEvent?.(new CustomEvent(EVENT_NAME, { detail: event }));
  } catch {
    // Diagnostics must never interfere with the app path they observe.
  }
  return event;
}

export function clearDiagnosticEvents(): void {
  if (!storageAvailable()) return;
  localStorage.removeItem(STORAGE_KEY);
  globalThis.dispatchEvent?.(new CustomEvent(EVENT_NAME));
}

export function subscribeToDiagnostics(listener: () => void): () => void {
  globalThis.addEventListener?.(EVENT_NAME, listener);
  return () => globalThis.removeEventListener?.(EVENT_NAME, listener);
}

export function diagnosticBuildInfo(): { build: string; mode: string } {
  return {
    build: import.meta.env.VITE_LC_BUILD_SHA,
    mode: import.meta.env.VITE_LC_BUILD_MODE,
  };
}
