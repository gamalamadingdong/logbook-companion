import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { PM5_SERVICES } from '@readyall/erglink/pm5';
import type { PM5Device } from '@readyall/erglink/pm5';

/**
 * Browser discovery for a PM5.
 *
 * The shared driver discovers monitors with `requestLEScan`, which native
 * platforms support directly. In a browser that maps to
 * `navigator.bluetooth.requestLEScan`, an experimental API that needs a Chrome
 * flag and does not exist in Safari, so scanning silently finds nothing.
 *
 * Browsers instead use `requestDevice`, the standard chooser, which is the path
 * the hardware-proven browser harness used. The chooser returns a single device
 * the athlete picked rather than a list, and it must be opened from a user
 * gesture.
 */

/**
 * Every PM5 service the driver talks to after connecting.
 *
 * Web Bluetooth only grants access to services declared up front, so these must
 * be requested here or later GATT access is blocked.
 */
const PM5_OPTIONAL_SERVICES = [
  PM5_SERVICES.DEVICE_INFO,
  PM5_SERVICES.C2_DEVICE_INFO,
  PM5_SERVICES.PM_CONTROL,
  PM5_SERVICES.ROWING,
  PM5_SERVICES.HEART_RATE,
];

/** Whether PM5 discovery must go through the browser chooser. */
export function usesBrowserDeviceChooser(
  isNative: boolean = Capacitor.isNativePlatform(),
): boolean {
  return !isNative;
}

/** Whether this browser can talk to Bluetooth at all. */
export function browserSupportsBluetooth(
  bluetooth: unknown = (globalThis.navigator as { bluetooth?: unknown } | undefined)?.bluetooth,
): boolean {
  return Boolean(bluetooth);
}

/**
 * Open the browser's Bluetooth chooser and return the selected PM5.
 *
 * Must be called from a user gesture. Returns null when the athlete dismisses
 * the chooser, which is a cancellation rather than a failure.
 */
export async function requestPM5FromBrowser(): Promise<PM5Device | null> {
  if (!browserSupportsBluetooth()) {
    throw new Error('This browser cannot connect to a PM5 over Bluetooth. Use the app, or Chrome on desktop.');
  }

  try {
    const device = await BleClient.requestDevice({
      namePrefix: 'PM5',
      optionalServices: PM5_OPTIONAL_SERVICES,
    });
    return { id: device.deviceId, name: device.name || 'PM5' };
  } catch (error) {
    if (isChooserDismissed(error)) return null;
    throw error;
  }
}

/**
 * The chooser reports dismissal as an error. Treat it as a cancellation so the
 * athlete is not shown a failure for closing a dialog.
 */
function isChooserDismissed(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return true;
    return /cancell?ed|user cancel|no device selected/i.test(error.message);
  }
  return false;
}
