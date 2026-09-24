import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { usePM5 } from '../hooks/usePM5';
import {
  isUpdateActivationBusy,
  nativeUpdaterAvailable,
  rememberPendingBundle,
  schedulePendingBundleIfSafe,
} from '../services/mobileUpdates';

/** Downloads arrive silently; activation is scheduled only at a safe background boundary. */
export function NativeUpdateBridge() {
  const { rowing, captureState } = usePM5();
  const busyRef = useRef(isUpdateActivationBusy(rowing, captureState));
  busyRef.current = isUpdateActivationBusy(rowing, captureState);

  useEffect(() => {
    if (!nativeUpdaterAvailable()) return;
    let active = true;
    const reportFailure = () => {
      console.error('[mobile-update] Update activation was deferred after a native updater failure.');
    };
    const handles = [
      CapacitorUpdater.addListener('updateAvailable', ({ bundle }) => {
        if (active) rememberPendingBundle(bundle);
      }),
      App.addListener('appStateChange', state => {
        if (!active || state.isActive) return;
        void schedulePendingBundleIfSafe({
          appIsActive: false,
          busy: busyRef.current,
        }).catch(reportFailure);
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
