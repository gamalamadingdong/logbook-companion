import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.readyall.logbookcompanion',
  appName: 'Logbook Companion',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
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
