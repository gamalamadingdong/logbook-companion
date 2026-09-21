import { Capacitor } from '@capacitor/core';
import type { CaptureStore } from '@readyall/erglink';
import { indexedDBCaptureStore } from '@readyall/erglink/pm5/storage/indexeddb';
import { mobileSQLiteCaptureStore } from '@readyall/erglink/pm5/storage/sqlite';

export function selectPM5CaptureStore(platform: string = Capacitor.getPlatform()): CaptureStore {
  return platform === 'ios' || platform === 'android'
    ? mobileSQLiteCaptureStore
    : indexedDBCaptureStore;
}

export const pm5CaptureStore = selectPM5CaptureStore();
