import assert from 'node:assert/strict';
import handler from './api/updates.mjs';

let payload;
handler({
  method: 'POST',
  body: {
    app_id: 'org.readyall.logbookcompanion',
    platform: 'ios',
    version_build: '1.0',
    version_name: 'builtin',
    is_prod: true,
    is_emulator: false,
  },
}, {
  setHeader() {},
  status() { return this; },
  json(value) { payload = value; return this; },
  end() { return this; },
});

assert.equal(payload.message, 'channel_halted');
assert.equal(payload.kind, 'blocked');
assert.equal(payload.error, 'channel_halted');
assert.equal(payload.url, undefined);
console.log('[ota-smoke] Halted channel returned no update URL.');
