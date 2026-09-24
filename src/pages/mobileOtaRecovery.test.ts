import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('beta OTA recovery controls', () => {
  it('does not queue updates from the iOS background callback', () => {
    const bridge = source('../components/NativeUpdateBridge.tsx');
    expect(bridge).not.toContain("App.addListener('appStateChange'");
    expect(bridge).not.toContain('CapacitorUpdater.next');
  });

  it('offers explicit native check and verified immediate install controls', () => {
    const page = source('./Diagnostics.tsx');
    const service = source('../services/mobileUpdates.ts');
    expect(page).toContain('Check for update');
    expect(page).toContain('Install downloaded update');
    expect(page).toContain('isUpdateActivationBusy');
    expect(service).toContain('CapacitorUpdater.triggerUpdateCheck()');
    expect(service).toContain('CapacitorUpdater.set({ id: bundle.id })');
  });
});
