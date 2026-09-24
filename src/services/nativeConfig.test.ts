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
  expect(config).toContain("appId: 'org.readyall.logbookcompanion'");
  expect(config).not.toContain('server: { url:');
});
it('matches the registered identifier across iOS and Android', () => {
  const id = 'org.readyall.logbookcompanion';
  const project = read('ios/App/App.xcodeproj/project.pbxproj');
  expect(project.match(/PRODUCT_BUNDLE_IDENTIFIER = org\.readyall\.logbookcompanion;/g)).toHaveLength(2);
  expect(read('android/app/build.gradle')).toContain(`namespace "${id}"`);
  expect(read('android/app/build.gradle')).toContain(`applicationId "${id}"`);
  expect(read('android/app/src/main/java/org/readyall/logbookcompanion/MainActivity.java')).toContain(`package ${id};`);
  expect(read('android/app/src/main/res/values/strings.xml')).toContain(`<string name="package_name">${id}</string>`);
});
it('includes browser and secure storage in both native projects', () => {
  const android = read('android/capacitor.settings.gradle');
  expect(android).toContain("include ':capacitor-browser'");
  expect(android).toContain("include ':aparajita-capacitor-secure-storage'");
  const ios = read('ios/App/Podfile');
  expect(ios).toContain("pod 'CapacitorBrowser'");
  expect(ios).toContain("pod 'AparajitaCapacitorSecureStorage'");
  expect(ios).toContain("config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'");
});
it('uses the development-only mobile build for synchronization and manual native CI', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  expect(scripts['mobile:build']).toContain('vite build --mode mobile');
  expect(scripts['mobile:sync']).toContain('npm run mobile:build');
  expect(read('.github/workflows/mobile-native-checks.yml').match(/npm run mobile:build/g)).toHaveLength(2);
  expect(read('vite.config.ts')).toContain("legacyProduction && mode !== 'mobile'");
  expect(read('vite.config.ts')).toContain("mode === 'mobile'");
  expect(read('vite.config.ts')).toContain('Mobile builds require VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
});
