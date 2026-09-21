import { describe, expect, it } from 'vitest';
import { indexedDBCaptureStore } from '@readyall/erglink/pm5/storage/indexeddb';
import { mobileSQLiteCaptureStore } from '@readyall/erglink/pm5/storage/sqlite';
import { selectPM5CaptureStore } from './pm5CaptureStore';

describe('PM5 capture store selection', () => {
  it('uses IndexedDB on the web', () => {
    expect(selectPM5CaptureStore('web')).toBe(indexedDBCaptureStore);
  });

  it('uses SQLite in installed iOS and Android apps', () => {
    expect(selectPM5CaptureStore('ios')).toBe(mobileSQLiteCaptureStore);
    expect(selectPM5CaptureStore('android')).toBe(mobileSQLiteCaptureStore);
  });
});
