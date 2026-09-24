import { createHash, generateKeyPairSync, privateEncrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyReleaseArtifacts, type VerifiableReleaseManifest } from '../../updates/lib/release-verification.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const bundle = Buffer.from('encrypted OTA bundle fixture');
const plaintextChecksum = createHash('sha256').update('plain OTA zip fixture').digest('hex');
const authenticatedChecksum = privateEncrypt(privateKey, Buffer.from(plaintextChecksum, 'hex')).toString('hex');
const manifest: VerifiableReleaseManifest = {
  enabled: true,
  channel: 'beta',
  version: '1.0.0-beta.1',
  bundleSha256: createHash('sha256').update(bundle).digest('hex'),
  capgoPlaintextChecksum: plaintextChecksum,
  capgo: {
    checksum: authenticatedChecksum,
    session_key: 'iv:encrypted-session-key',
  },
};

describe('OTA release artifact verification', () => {
  it('accepts a bundle whose hash and authenticated checksum match', () => {
    expect(() => verifyReleaseArtifacts(manifest, bundle, publicKey)).not.toThrow();
  });

  it('rejects changed bundle bytes', () => {
    expect(() => verifyReleaseArtifacts(manifest, Buffer.from('tampered bundle'), publicKey))
      .toThrow('bundle_hash_mismatch');
  });

  it('rejects a forged checksum signature', () => {
    const forged = {
      ...manifest,
      capgo: { ...manifest.capgo, checksum: `00${manifest.capgo.checksum.slice(2)}` },
    };
    expect(() => verifyReleaseArtifacts(forged, bundle, publicKey))
      .toThrow('checksum_authentication_failed');
  });
});
