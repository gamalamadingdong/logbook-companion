import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { recordDiagnostic } from './appDiagnostics';

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createNativeAuthStorage(
  store: Pick<typeof SecureStorage, 'get' | 'set' | 'remove'>,
  available: () => boolean,
  removePlaintext: (key: string) => void,
): AuthStorage {
  function requireSecureStorage() {
    if (!available()) throw new Error('Secure session storage is unavailable. Install a current mobile build.');
  }
  return {
    async getItem(key) {
      requireSecureStorage();
      const startedAt = Date.now();
      try {
        const value = await store.get(key, false, false);
        if (value !== null && typeof value !== 'string') throw new Error('Stored session is invalid. Sign in again.');
        removePlaintext(key);
        recordDiagnostic('auth', 'AUTH_STORAGE_GET', 'Secure session read completed', { durationMs: Date.now() - startedAt });
        return value;
      } catch (error) {
        recordDiagnostic('auth', 'AUTH_STORAGE_GET_FAILED', 'Secure session read failed', { level: 'error', durationMs: Date.now() - startedAt });
        throw error;
      }
    },
    async setItem(key, value) {
      requireSecureStorage();
      const startedAt = Date.now();
      try {
        await store.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
        removePlaintext(key);
        recordDiagnostic('auth', 'AUTH_STORAGE_SET', 'Secure session write completed', { durationMs: Date.now() - startedAt });
      } catch (error) {
        recordDiagnostic('auth', 'AUTH_STORAGE_SET_FAILED', 'Secure session write failed', { level: 'error', durationMs: Date.now() - startedAt });
        throw error;
      }
    },
    async removeItem(key) {
      requireSecureStorage();
      const startedAt = Date.now();
      try {
        await store.remove(key, false);
        removePlaintext(key);
        recordDiagnostic('auth', 'AUTH_STORAGE_REMOVE', 'Secure session removal completed', { durationMs: Date.now() - startedAt });
      } catch (error) {
        recordDiagnostic('auth', 'AUTH_STORAGE_REMOVE_FAILED', 'Secure session removal failed', { level: 'error', durationMs: Date.now() - startedAt });
        throw error;
      }
    },
  };
}

export const nativeAuthStorage = createNativeAuthStorage(
  SecureStorage,
  () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SecureStorage'),
  key => globalThis.localStorage?.removeItem(key),
);
