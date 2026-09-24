import { describe, expect, it } from 'vitest';
import {
  clearPendingBundleIfActive,
  isUpdateActivationBusy,
  getMobileUpdateDiagnostics,
  readPendingBundle,
  safeUpdateCheckDiagnostic,
  selectInstallableBundle,
} from './mobileUpdates';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const capture = {
  _v: 2 as const,
  captureId: 'capture-1',
} as never;

describe('mobile OTA activation guard', () => {
  it('clears a pending marker once that version is active', () => {
    const storage = memoryStorage();
    storage.setItem('lc_ota_pending_bundle_v1', JSON.stringify({ id: 'ready', version: '1.0.0-beta.2' }));
    expect(clearPendingBundleIfActive({ version: '1.0.0-beta.2' }, storage)).toBe(true);
    expect(readPendingBundle(storage)).toBeNull();
  });

  it('selects the newest verified downloaded bundle and ignores current or incomplete bundles', () => {
    const bundle = selectInstallableBundle([
      { id: 'current', version: '1.0.0-beta.1', status: 'success', downloaded: '2026-09-24T10:00:00Z', checksum: 'a' },
      { id: 'failed', version: '1.0.0-beta.2', status: 'error', downloaded: '2026-09-24T11:00:00Z', checksum: 'b' },
      { id: 'ready', version: '1.0.0-beta.3', status: 'success', downloaded: '2026-09-24T12:00:00Z', checksum: 'c' },
    ], 'current');
    expect(bundle?.id).toBe('ready');
  });

  it('never persists or displays raw updater backend text', () => {
    const diagnostic = safeUpdateCheckDiagnostic({
      kind: 'blocked',
      error: 'token=secret-value',
      version: '1.0.0-beta.2',
    });
    expect(diagnostic.detail.error).toBe('unrecognized');
    expect(JSON.stringify(diagnostic)).not.toContain('secret-value');
    expect(diagnostic.summary).toBe('OTA update check was blocked safely');
  });

  it('reports build identity without pretending a web session has a native updater', async () => {
    const snapshot = await getMobileUpdateDiagnostics();
    expect(snapshot.native).toBe(false);
    expect(snapshot.currentBundle).toBeNull();
    expect(snapshot.build).toBeTruthy();
  });

  it('defers while rowing or while a completed capture is still being persisted', () => {
    expect(isUpdateActivationBusy(true, null)).toBe(true);
    expect(isUpdateActivationBusy(false, { phase: 'saved', capture })).toBe(true);
    expect(isUpdateActivationBusy(false, { phase: 'ingesting', capture })).toBe(true);
    expect(isUpdateActivationBusy(false, { phase: 'ingested', capture })).toBe(false);
    expect(isUpdateActivationBusy(false, { phase: 'held', capture })).toBe(false);
  });


  it('drops malformed pending metadata rather than scheduling an unknown bundle', () => {
    const storage = memoryStorage();
    storage.setItem('lc_ota_pending_bundle_v1', '{bad json');
    expect(readPendingBundle(storage)).toBeNull();
  });
});
