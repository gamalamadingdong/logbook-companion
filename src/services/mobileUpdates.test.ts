import { describe, expect, it, vi } from 'vitest';
import {
  isUpdateActivationBusy,
  getMobileUpdateDiagnostics,
  readPendingBundle,
  rememberPendingBundle,
  safeUpdateCheckDiagnostic,
  schedulePendingBundleIfSafe,
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

  it('retains a downloaded bundle until the app backgrounds at a safe boundary', async () => {
    const storage = memoryStorage();
    const schedule = vi.fn(async () => undefined);
    rememberPendingBundle({ id: 'bundle-1', version: '1.0.0-beta.2' }, storage);

    await expect(schedulePendingBundleIfSafe({ appIsActive: true, busy: false, storage, schedule })).resolves.toBe(false);
    await expect(schedulePendingBundleIfSafe({ appIsActive: false, busy: true, storage, schedule })).resolves.toBe(false);
    expect(schedule).not.toHaveBeenCalled();
    expect(readPendingBundle(storage)?.id).toBe('bundle-1');

    await expect(schedulePendingBundleIfSafe({ appIsActive: false, busy: false, storage, schedule })).resolves.toBe(true);
    expect(schedule).toHaveBeenCalledWith('bundle-1');
    expect(readPendingBundle(storage)).toBeNull();
  });

  it('keeps the pending bundle when native scheduling fails', async () => {
    const storage = memoryStorage();
    rememberPendingBundle({ id: 'bundle-2', version: '1.0.0-beta.3' }, storage);

    await expect(schedulePendingBundleIfSafe({
      appIsActive: false,
      busy: false,
      storage,
      schedule: async () => { throw new Error('native failure'); },
    })).rejects.toThrow('native failure');
    expect(readPendingBundle(storage)?.id).toBe('bundle-2');
  });

  it('drops malformed pending metadata rather than scheduling an unknown bundle', () => {
    const storage = memoryStorage();
    storage.setItem('lc_ota_pending_bundle_v1', '{bad json');
    expect(readPendingBundle(storage)).toBeNull();
  });
});
