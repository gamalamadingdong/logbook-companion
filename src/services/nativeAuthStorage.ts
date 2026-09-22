import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

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
      const value = await store.get(key, false, false);
      if (value !== null && typeof value !== 'string') throw new Error('Stored session is invalid. Sign in again.');
      removePlaintext(key);
      return value;
    },
    async setItem(key, value) {
      requireSecureStorage();
      await store.set(key, value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
      removePlaintext(key);
    },
    async removeItem(key) {
      requireSecureStorage();
      await store.remove(key, false);
      removePlaintext(key);
    },
  };
}

export const nativeAuthStorage = createNativeAuthStorage(
  SecureStorage,
  () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SecureStorage'),
  key => globalThis.localStorage?.removeItem(key),
);
