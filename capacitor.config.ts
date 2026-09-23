import type { CapacitorConfig } from '@capacitor/cli';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const OTA_PUBLIC_KEY_SHA256 = 'ecdfe83ab9deee3bb0c74af3bc2bceeca90a5495f7a5e910f857a8fad7e36b97';
const otaPublicKeyPath = path.resolve('.capgo_key_v2.pub');
if (!existsSync(otaPublicKeyPath)) {
  throw new Error('Missing committed LC OTA public key. Native configuration cannot be generated safely.');
}
const otaPublicKeyFile = readFileSync(otaPublicKeyPath);
const otaPublicKeyFingerprint = createHash('sha256').update(otaPublicKeyFile).digest('hex');
if (otaPublicKeyFingerprint !== OTA_PUBLIC_KEY_SHA256) {
  throw new Error('LC OTA public key fingerprint does not match the reviewed native trust anchor.');
}
const otaPublicKey = otaPublicKeyFile.toString('utf8').trim();

const config: CapacitorConfig = {
  appId: 'org.readyall.logbookcompanion',
  appName: 'Logbook Companion',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: 'onlyDownload',
      directUpdate: false,
      updateUrl: 'https://updates.logbook.readyall.org/updates/beta',
      statsUrl: '',
      appReadyTimeout: 10_000,
      resetWhenUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: false,
      allowModifyUrl: false,
      publicKey: otaPublicKey,
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
