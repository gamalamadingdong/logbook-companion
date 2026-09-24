import assert from 'node:assert/strict';
import handler from './api/updates.mjs';

function invoke(body) {
  let statusCode = 200;
  let payload;
  const headers = new Map();
  const response = {
    setHeader(name, value) { headers.set(name, value); },
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
    end() { return this; },
  };
  handler({ method: 'POST', body }, response);
  return { statusCode, payload, headers };
}

const compatible = invoke({
  app_id: 'org.readyall.logbookcompanion',
  platform: 'ios',
  version_build: '1.0',
  version_name: 'builtin',
  is_prod: true,
  is_emulator: false,
});
assert.equal(compatible.statusCode, 200);
assert.match(compatible.payload.url, /^https:\/\/updates\.logbook\.readyall\.org\/releases\/beta\//);
assert.ok(compatible.payload.checksum);
assert.ok(compatible.payload.session_key);
assert.equal(compatible.headers.get('Cache-Control'), 'private, no-store');

const testFlight = invoke({
  app_id: 'org.readyall.logbookcompanion',
  platform: 'ios',
  version_build: '1.0',
  version_name: '1.0',
  is_prod: false,
  is_emulator: false,
});
assert.equal(testFlight.payload.url, compatible.payload.url);

const incompatible = invoke({
  app_id: 'org.readyall.logbookcompanion',
  platform: 'ios',
  version_build: '2.0',
  version_name: 'builtin',
  is_prod: true,
  is_emulator: false,
});
assert.equal(incompatible.statusCode, 200);
assert.equal(incompatible.payload.message, 'incompatible_native_version');
assert.equal(incompatible.payload.kind, 'blocked');
assert.equal(incompatible.payload.error, 'incompatible_native_version');
assert.equal(incompatible.payload.url, undefined);

console.log('[ota-smoke] Compatible shell received an authenticated immutable offer; incompatible shell received no URL.');
