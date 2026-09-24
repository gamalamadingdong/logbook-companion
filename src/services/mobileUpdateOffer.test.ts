import { describe, expect, it } from 'vitest';
import { evaluateUpdateOffer, validateReleaseOffer } from '../../updates/lib/update-offer.mjs';

const release = {
  enabled: true,
  channel: 'beta',
  version: '1.0.0-beta.2',
  releaseSequence: 2,
  compatibleNativeVersions: ['1.0'],
  platforms: ['ios', 'android'],
  allowProductionBuilds: true,
  allowDevelopmentBuilds: false,
  allowEmulators: false,
  capgo: {
    url: 'https://updates.logbook.readyall.org/releases/beta/1.0.0-beta.2/bundle.zip',
    checksum: 'signed-checksum',
    session_key: 'iv:encrypted-key',
  },
};

const request = {
  app_id: 'org.readyall.logbookcompanion',
  platform: 'ios',
  version_build: '1.0',
  version_name: 'builtin',
  is_prod: true,
  is_emulator: false,
};

const blocked = (message: string) => ({ kind: 'blocked', error: message, message });
const upToDate = {
  kind: 'up_to_date',
  error: 'no_new_version_available',
  message: 'up_to_date',
};

describe('self-hosted mobile update offer', () => {
  it('offers an authenticated immutable bundle to a compatible beta shell', () => {
    expect(evaluateUpdateOffer(request, release)).toEqual({
      version: release.version,
      ...release.capgo,
    });
  });

  it('allows TestFlight-classified development builds on beta but still blocks emulators', () => {
    const testFlightRelease = { ...release, allowDevelopmentBuilds: true };
    expect(evaluateUpdateOffer({ ...request, is_prod: false, version_name: '1.0' }, testFlightRelease)).toEqual({
      version: release.version,
      ...release.capgo,
    });
    expect(evaluateUpdateOffer({ ...request, is_prod: false, is_emulator: true }, testFlightRelease))
      .toEqual(blocked('emulator_not_allowed'));
  });

  it('halts cleanly and rejects missing authentication material', () => {
    expect(evaluateUpdateOffer(request, { ...release, enabled: false })).toEqual(blocked('channel_halted'));
    expect(validateReleaseOffer({ ...release, capgo: { ...release.capgo, session_key: '' } }, 'beta'))
      .toBe('missing_bundle_authentication');
  });

  it('rejects mutable, cross-origin, and wrong-channel bundle metadata', () => {
    expect(validateReleaseOffer({ ...release, capgo: { ...release.capgo, url: 'https://evil.test/bundle.zip' } }, 'beta'))
      .toBe('mutable_or_untrusted_bundle_url');
    expect(validateReleaseOffer({ ...release, capgo: { ...release.capgo, url: 'https://updates.logbook.readyall.org/bundle.zip' } }, 'beta'))
      .toBe('mutable_or_untrusted_bundle_url');
    expect(validateReleaseOffer(release, 'production')).toBe('wrong_channel');
  });

  it('rejects the wrong app, native shell, platform, build type, and emulator', () => {
    expect(evaluateUpdateOffer({ ...request, app_id: 'other.app' }, release)).toEqual(blocked('wrong_app'));
    expect(evaluateUpdateOffer({ ...request, version_build: '1.1' }, release)).toEqual(blocked('incompatible_native_version'));
    expect(evaluateUpdateOffer({ ...request, platform: 'electron' }, release)).toEqual(blocked('unsupported_platform'));
    expect(evaluateUpdateOffer({ ...request, is_prod: false }, release)).toEqual(blocked('development_build_not_allowed'));
    expect(evaluateUpdateOffer({ ...request, is_emulator: true }, release)).toEqual(blocked('emulator_not_allowed'));
    expect(evaluateUpdateOffer({ ...request, is_emulator: undefined }, release)).toEqual(blocked('malformed_emulator_state'));
  });

  it('does not replay the installed release or downgrade a newer one', () => {
    expect(evaluateUpdateOffer({ ...request, version_name: release.version }, release)).toEqual(upToDate);
    expect(evaluateUpdateOffer({ ...request, version_name: '1.0.0-beta.3' }, release)).toEqual(upToDate);
    expect(evaluateUpdateOffer({ ...request, version_name: 'invalid' }, release)).toEqual(blocked('malformed_current_version'));
  });
});
