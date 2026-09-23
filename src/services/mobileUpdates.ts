import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import type { PM5CapturePersistenceState } from './pm5CapturePersistence';

const PENDING_BUNDLE_KEY = 'lc_ota_pending_bundle_v1';

export interface PendingUpdateBundle {
  id: string;
  version: string;
}

interface UpdateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isUpdateActivationBusy(
  rowing: boolean,
  captureState: PM5CapturePersistenceState | null,
): boolean {
  return rowing || captureState?.phase === 'saved' || captureState?.phase === 'ingesting';
}

export function rememberPendingBundle(
  bundle: Pick<BundleInfo, 'id' | 'version'>,
  storage: UpdateStorage = localStorage,
): PendingUpdateBundle {
  const pending = { id: bundle.id, version: bundle.version };
  storage.setItem(PENDING_BUNDLE_KEY, JSON.stringify(pending));
  return pending;
}

export function readPendingBundle(
  storage: UpdateStorage = localStorage,
): PendingUpdateBundle | null {
  const value = storage.getItem(PENDING_BUNDLE_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingUpdateBundle>;
    if (typeof parsed.id !== 'string' || !parsed.id || typeof parsed.version !== 'string' || !parsed.version) {
      storage.removeItem(PENDING_BUNDLE_KEY);
      return null;
    }
    return { id: parsed.id, version: parsed.version };
  } catch {
    storage.removeItem(PENDING_BUNDLE_KEY);
    return null;
  }
}

export async function schedulePendingBundleIfSafe(options: {
  appIsActive: boolean;
  busy: boolean;
  storage?: UpdateStorage;
  schedule?: (bundleId: string) => Promise<unknown>;
}): Promise<boolean> {
  const {
    appIsActive,
    busy,
    storage = localStorage,
    schedule = bundleId => CapacitorUpdater.next({ id: bundleId }),
  } = options;
  if (appIsActive || busy) return false;
  const pending = readPendingBundle(storage);
  if (!pending) return false;
  await schedule(pending.id);
  storage.removeItem(PENDING_BUNDLE_KEY);
  return true;
}

export function nativeUpdaterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CapacitorUpdater');
}

/** Confirm bundle boot before auth, network, or route initialization can delay it. */
export function notifyNativeBundleReady(): void {
  if (!nativeUpdaterAvailable()) return;
  void CapacitorUpdater.notifyAppReady().catch(() => {
    console.error('[mobile-update] Could not acknowledge the active app bundle.');
  });
}
