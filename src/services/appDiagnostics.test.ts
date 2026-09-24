import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./concept2Environment', () => ({ legacyConcept2Enabled: false }));

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);
vi.stubGlobal('dispatchEvent', vi.fn());
vi.stubGlobal('addEventListener', vi.fn());
vi.stubGlobal('removeEventListener', vi.fn());
const diagnostics = await import('./appDiagnostics');

describe('staging diagnostics', () => {
  beforeEach(() => storage.clear());

  it('records bounded sanitized events newest first', () => {
    diagnostics.recordDiagnostic('network', 'NET_SLOW', 'Slow request', {
      durationMs: 1234.4,
      detail: { path: '/rest/v1/training_block_templates', status: 200 },
    });
    diagnostics.recordDiagnostic('training-block', 'TB_READY', 'Ready');

    const events = diagnostics.readDiagnosticEvents();
    expect(events.map((event) => event.code)).toEqual(['TB_READY', 'NET_SLOW']);
    expect(events[1].durationMs).toBe(1234);
  });

  it('clears diagnostic history', () => {
    diagnostics.recordDiagnostic('ota', 'OTA_READY', 'Ready');
    diagnostics.clearDiagnosticEvents();
    expect(diagnostics.readDiagnosticEvents()).toEqual([]);
  });
});
