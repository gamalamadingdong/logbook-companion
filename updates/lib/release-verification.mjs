import { createHash, publicDecrypt, timingSafeEqual } from 'node:crypto';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function sameHex(left, right) {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right) || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function verifyReleaseArtifacts(manifest, bundle, publicKey) {
  if (!manifest.enabled) throw new Error('release_halted');
  if (!manifest.capgo.session_key) throw new Error('missing_session_key');
  if (!sameHex(sha256(bundle), manifest.bundleSha256)) throw new Error('bundle_hash_mismatch');

  let recoveredChecksum;
  try {
    recoveredChecksum = publicDecrypt(publicKey, Buffer.from(manifest.capgo.checksum, 'hex')).toString('hex');
  } catch {
    throw new Error('checksum_authentication_failed');
  }
  if (!sameHex(recoveredChecksum, manifest.capgoPlaintextChecksum)) {
    throw new Error('checksum_authentication_failed');
  }
}
