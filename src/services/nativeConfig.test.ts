import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
it('registers the same LC return scheme on Android and iOS', () => {
  expect(read('android/app/src/main/AndroidManifest.xml')).toContain('android:scheme="logbookcompanion" android:host="app"');
  expect(read('ios/App/App/Info.plist')).toContain('<string>logbookcompanion</string>');
  expect(read('ios/App/App/AppDelegate.swift')).toContain('ApplicationDelegateProxy.shared.application');
});
it('keeps native shell identity and no remote server URL', () => {
  const config = read('capacitor.config.ts');
  expect(config).toContain("appId: 'com.readyall.logbookcompanion'");
  expect(config).not.toContain('server: { url:');
});
