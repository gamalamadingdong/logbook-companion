export interface VerifiableReleaseManifest {
  enabled: boolean;
  channel: string;
  version: string;
  bundleSha256: string;
  capgoPlaintextChecksum: string;
  capgo: {
    checksum: string;
    session_key: string;
  };
}

export function verifyReleaseArtifacts(
  manifest: VerifiableReleaseManifest,
  bundle: Buffer,
  publicKey: string,
): void;
