const APP_ID = 'org.readyall.logbookcompanion';
const UPDATE_ORIGIN = 'https://updates.logbook.readyall.org';

function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value ?? '');
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.') ?? [],
  };
}

function compareIdentifiers(left, right) {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : null;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : null;
  if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
  if (leftNumber !== null) return -1;
  if (rightNumber !== null) return 1;
  return left.localeCompare(right);
}

export function compareSemver(leftValue, rightValue) {
  const left = parseSemver(leftValue);
  const right = parseSemver(rightValue);
  if (!left || !right) return null;
  for (const key of ['major', 'minor', 'patch']) {
    const difference = left[key] - right[key];
    if (difference) return difference;
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const difference = compareIdentifiers(left.prerelease[index], right.prerelease[index]);
    if (difference) return difference;
  }
  return 0;
}

function normalizeNativeVersion(value) {
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(value ?? '');
  return match ? `${Number(match[1])}.${Number(match[2])}` : null;
}

export function validateReleaseOffer(release, channel) {
  if (!release || release.enabled !== true) return 'channel_halted';
  if (release.channel !== channel) return 'wrong_channel';
  if (!parseSemver(release.version)) return 'malformed_release_version';
  if (!Number.isSafeInteger(release.releaseSequence) || release.releaseSequence < 1) return 'invalid_release_sequence';
  if (!release.capgo?.checksum || !release.capgo?.session_key) return 'missing_bundle_authentication';
  let bundleUrl;
  try {
    bundleUrl = new URL(release.capgo.url);
  } catch {
    return 'invalid_bundle_url';
  }
  const expectedPath = `/releases/${encodeURIComponent(channel)}/${encodeURIComponent(release.version)}/bundle.zip`;
  if (bundleUrl.origin !== UPDATE_ORIGIN || bundleUrl.pathname !== expectedPath || bundleUrl.search || bundleUrl.hash) {
    return 'mutable_or_untrusted_bundle_url';
  }
  return null;
}

function blocked(message) {
  return { kind: 'blocked', error: message, message };
}

function upToDate() {
  return {
    kind: 'up_to_date',
    error: 'no_new_version_available',
    message: 'up_to_date',
  };
}

export function evaluateUpdateOffer(request, release, channel = 'beta') {
  const invalidRelease = validateReleaseOffer(release, channel);
  if (invalidRelease) return blocked(invalidRelease);
  if (!request || request.app_id !== APP_ID) return blocked('wrong_app');
  if (!release.platforms.includes(request.platform)) return blocked('unsupported_platform');
  if (typeof request.is_emulator !== 'boolean') return blocked('malformed_emulator_state');
  if (request.is_emulator && !release.allowEmulators) return blocked('emulator_not_allowed');
  if (request.is_prod === true && !release.allowProductionBuilds) return blocked('production_build_not_allowed');
  if (request.is_prod !== true && !release.allowDevelopmentBuilds) return blocked('development_build_not_allowed');

  const nativeVersion = normalizeNativeVersion(request.version_build);
  if (!nativeVersion || !release.compatibleNativeVersions.includes(nativeVersion)) {
    return blocked('incompatible_native_version');
  }

  const currentIsBuiltin = request.version_name === 'builtin'
    || (/^\d+\.\d+$/.test(request.version_name ?? '') && request.version_name === request.version_build);
  if (!currentIsBuiltin) {
    const comparison = compareSemver(request.version_name, release.version);
    if (comparison === null) return blocked('malformed_current_version');
    if (comparison >= 0) return upToDate();
  }

  return {
    version: release.version,
    url: release.capgo.url,
    checksum: release.capgo.checksum,
    session_key: release.capgo.session_key,
  };
}

export const updateContract = { appId: APP_ID, origin: UPDATE_ORIGIN };
