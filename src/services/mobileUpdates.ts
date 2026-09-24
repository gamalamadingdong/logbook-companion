import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import type { PM5CapturePersistenceState } from './pm5CapturePersistence';
import { diagnosticBuildInfo, recordDiagnostic } from './appDiagnostics';

const PENDING_BUNDLE_KEY = 'lc_ota_pending_bundle_v1';

export interface PendingUpdateBundle {
  id: string;
  version: string;
}

export interface MobileUpdateDiagnostics {
  native: boolean;
  build: string;
  mode: string;
  currentBundle: { source: 'builtin' | 'ota'; version: string; status: string } | null;
  nativeVersion: string | null;
  pluginVersion: string | null;
  pendingBundle: PendingUpdateBundle | null;
  downloadedBundles: Array<{ version: string; status: string }>;
  updateCheck: { kind: string | null; error: string | null; message: string | null; version: string | null } | null;
  errors: string[];
}

export function selectInstallableBundle(
  bundles: readonly BundleInfo[],
  currentBundleId: string,
): BundleInfo | null {
  return bundles
    .filter((bundle) => bundle.id !== 'builtin'
      && bundle.id !== currentBundleId
      && (bundle.status === 'success' || bundle.status === 'pending'))
    .sort((left, right) => Date.parse(right.downloaded) - Date.parse(left.downloaded))[0] ?? null;
}

const SAFE_UPDATE_ERRORS = new Set([
  'channel_halted',
  'development_build_not_allowed',
  'emulator_not_allowed',
  'incompatible_native_version',
  'malformed_current_version',
  'malformed_emulator_state',
  'no_new_version_available',
  'production_build_not_allowed',
  'unsupported_platform',
  'wrong_app',
]);

export function safeUpdateCheckDiagnostic(result: {
  kind?: string;
  error?: string;
  statusCode?: number;
  version?: string;
}): {
  code: string;
  summary: string;
  level: 'info' | 'warning' | 'error';
  detail: { kind: string; error: string | null; status: number | null; version: string | null };
} {
  const kind = result.kind === 'up_to_date' || result.kind === 'blocked' || result.kind === 'failed'
    ? result.kind
    : 'unknown';
  const safeError = result.error && SAFE_UPDATE_ERRORS.has(result.error) ? result.error : result.error ? 'unrecognized' : null;
  return {
    code: `OTA_CHECK_${kind.toUpperCase()}`,
    summary: kind === 'up_to_date'
      ? 'No OTA update is available'
      : kind === 'blocked'
        ? 'OTA update check was blocked safely'
        : 'OTA update check failed',
    level: kind === 'failed' || kind === 'unknown' ? 'error' : kind === 'blocked' ? 'warning' : 'info',
    detail: {
      kind,
      error: safeError,
      status: result.statusCode ?? null,
      version: result.version || null,
    },
  };
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

export function clearPendingBundleIfActive(
  activeBundle: Pick<BundleInfo, 'version'>,
  storage: UpdateStorage = localStorage,
): boolean {
  const pending = readPendingBundle(storage);
  if (!pending || pending.version !== activeBundle.version) return false;
  storage.removeItem(PENDING_BUNDLE_KEY);
  return true;
}

export function nativeUpdaterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CapacitorUpdater');
}

/** Confirm bundle boot before auth, network, or route initialization can delay it. */
export function notifyNativeBundleReady(): void {
  if (!nativeUpdaterAvailable()) return;
  void CapacitorUpdater.notifyAppReady()
    .then(({ bundle }) => {
      clearPendingBundleIfActive(bundle);
      recordDiagnostic('ota', 'OTA_APP_READY', 'Active app bundle acknowledged', {
        detail: { version: bundle.version, source: bundle.id === 'builtin' ? 'builtin' : 'ota' },
      });
    })
    .catch(() => {
      recordDiagnostic('ota', 'OTA_APP_READY_FAILED', 'Could not acknowledge the active app bundle', { level: 'error' });
      console.error('[mobile-update] Could not acknowledge the active app bundle.');
    });
}

export async function getMobileUpdateDiagnostics(): Promise<MobileUpdateDiagnostics> {
  const build = diagnosticBuildInfo();
  const pendingBundle = typeof localStorage === 'undefined' ? null : readPendingBundle();
  if (!nativeUpdaterAvailable()) {
    return {
      native: false,
      ...build,
      currentBundle: null,
      nativeVersion: null,
      pluginVersion: null,
      pendingBundle,
      downloadedBundles: [],
      updateCheck: null,
      errors: [],
    };
  }

  const [current, builtin, plugin, bundles, latest] = await Promise.allSettled([
    CapacitorUpdater.current(),
    CapacitorUpdater.getBuiltinVersion(),
    CapacitorUpdater.getPluginVersion(),
    CapacitorUpdater.list(),
    CapacitorUpdater.getLatest(),
  ]);
  const errors = [current, builtin, plugin, bundles, latest]
    .flatMap((result, index) => result.status === 'rejected' ? [`OTA_DIAGNOSTIC_${index + 1}`] : []);
  const currentValue = current.status === 'fulfilled' ? current.value : null;
  const latestValue = latest.status === 'fulfilled' ? latest.value : null;
  const latestDiagnostic = latestValue ? safeUpdateCheckDiagnostic(latestValue) : null;
  const installableBundles = bundles.status === 'fulfilled' && currentValue
    ? bundles.value.bundles.filter((bundle) => selectInstallableBundle([bundle], currentValue.bundle.id) !== null)
    : [];

  return {
    native: true,
    ...build,
    currentBundle: currentValue ? {
      source: currentValue.bundle.id === 'builtin' ? 'builtin' : 'ota',
      version: currentValue.bundle.version,
      status: currentValue.bundle.status,
    } : null,
    nativeVersion: builtin.status === 'fulfilled' ? builtin.value.version : currentValue?.native ?? null,
    pluginVersion: plugin.status === 'fulfilled' ? plugin.value.version : null,
    pendingBundle,
    downloadedBundles: installableBundles.map((bundle) => ({ version: bundle.version, status: bundle.status })),
    updateCheck: latestDiagnostic ? {
      kind: latestDiagnostic.detail.kind,
      error: latestDiagnostic.detail.error,
      message: latestDiagnostic.summary,
      version: latestDiagnostic.detail.version,
    } : null,
    errors,
  };
}

export async function triggerMobileUpdateCheck(): Promise<string> {
  if (!nativeUpdaterAvailable()) throw new Error('OTA_NATIVE_UNAVAILABLE');
  const result = await CapacitorUpdater.triggerUpdateCheck();
  recordDiagnostic('ota', 'OTA_CHECK_TRIGGERED', 'Manual update check requested', {
    detail: { status: result.status },
  });
  return result.status;
}

export async function installLatestDownloadedUpdateNow(busy: boolean): Promise<string> {
  if (!nativeUpdaterAvailable()) throw new Error('OTA_NATIVE_UNAVAILABLE');
  if (busy) throw new Error('OTA_INSTALL_BUSY');
  const [current, list] = await Promise.all([
    CapacitorUpdater.current(),
    CapacitorUpdater.list(),
  ]);
  const bundle = selectInstallableBundle(list.bundles, current.bundle.id);
  if (!bundle) throw new Error('OTA_NO_DOWNLOADED_BUNDLE');
  recordDiagnostic('ota', 'OTA_INSTALL_NOW', 'Installing authenticated OTA bundle now', {
    detail: { version: bundle.version },
  });
  await CapacitorUpdater.set({ id: bundle.id });
  return bundle.version;
}
