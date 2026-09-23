import { describe, expect, it } from 'vitest';
import { browserSupportsBluetooth, usesBrowserDeviceChooser } from './pm5WebBluetooth';

describe('pm5 browser bluetooth', () => {
  it('uses the driver scan on native platforms', () => {
    expect(usesBrowserDeviceChooser(true)).toBe(false);
  });

  it('uses the platform chooser in a browser', () => {
    // requestLEScan maps to an experimental browser API that needs a Chrome
    // flag and does not exist in Safari, so scanning would find nothing.
    expect(usesBrowserDeviceChooser(false)).toBe(true);
  });

  it('reports Bluetooth as unavailable when the browser has no support', () => {
    expect(browserSupportsBluetooth(undefined)).toBe(false);
  });

  it('reports Bluetooth as available when the browser exposes it', () => {
    expect(browserSupportsBluetooth({})).toBe(true);
  });
});
