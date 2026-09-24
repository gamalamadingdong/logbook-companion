import { useEffect } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
  nativeUpdaterAvailable,
  rememberPendingBundle,
  safeUpdateCheckDiagnostic,
} from '../services/mobileUpdates';
import { recordDiagnostic } from '../services/appDiagnostics';

/** Downloads arrive silently; beta activation is an explicit PM5-safe action in Diagnostics. */
export function NativeUpdateBridge() {
  useEffect(() => {
    if (!nativeUpdaterAvailable()) return;
    let active = true;
    const reportFailure = () => {
      console.error('[mobile-update] Update activation was deferred after a native updater failure.');
    };
    const handles = [
      CapacitorUpdater.addListener('updateAvailable', ({ bundle }) => {
        if (!active) return;
        rememberPendingBundle(bundle);
        recordDiagnostic('ota', 'OTA_UPDATE_AVAILABLE', 'Authenticated update downloaded', {
          detail: { version: bundle.version },
        });
      }),
      CapacitorUpdater.addListener('updateCheckResult', result => {
        if (!active) return;
        const diagnostic = safeUpdateCheckDiagnostic(result);
        recordDiagnostic('ota', diagnostic.code, diagnostic.summary, {
          level: diagnostic.level,
          detail: diagnostic.detail,
        });
      }),
      CapacitorUpdater.addListener('downloadFailed', ({ version }) => {
        if (active) recordDiagnostic('ota', 'OTA_DOWNLOAD_FAILED', 'Update download failed', {
          level: 'error', detail: { version },
        });
      }),
    ];
    void Promise.all(handles).catch(reportFailure);
    return () => {
      active = false;
      void Promise.allSettled(handles).then(items => Promise.all(items.flatMap(item =>
        item.status === 'fulfilled' ? [item.value.remove()] : [],
      ))).catch(reportFailure);
    };
  }, []);

  return null;
}
