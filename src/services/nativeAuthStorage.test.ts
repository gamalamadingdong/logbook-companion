import { describe, expect, it, vi } from 'vitest';
import { KeychainAccess } from '@aparajita/capacitor-secure-storage';
import { createNativeAuthStorage } from './nativeAuthStorage';

function fixture(available = true) {
  const secure = {
    get: vi.fn(async () => '{"session":"fixture"}'),
    set: vi.fn(async () => {}),
    remove: vi.fn(async () => true),
  };
  const removePlaintext = vi.fn();
  return { secure, removePlaintext, store: createNativeAuthStorage(secure, () => available, removePlaintext) };
}
describe('native session storage', () => {
  it('uses device-local secure storage without cloud synchronization', async () => {
    const f = fixture();
    expect(await f.store.getItem('session')).toBe('{"session":"fixture"}');
    await f.store.setItem('session', 'serialized');
    expect(f.secure.get).toHaveBeenCalledWith('session', false, false);
    expect(f.secure.set).toHaveBeenCalledWith('session', 'serialized', false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
    expect(f.removePlaintext).toHaveBeenCalledWith('session');
  });
  it('removes secure and old plaintext storage on logout', async () => {
    const f = fixture();
    await f.store.removeItem('session');
    expect(f.secure.remove).toHaveBeenCalledWith('session', false);
    expect(f.removePlaintext).toHaveBeenCalledWith('session');
  });
  it('never falls back to WebView localStorage if the native plugin is absent', async () => {
    const f = fixture(false);
    await expect(f.store.getItem('session')).rejects.toThrow(/unavailable/);
    await expect(f.store.setItem('session', 'secret')).rejects.toThrow(/unavailable/);
    expect(f.secure.get).not.toHaveBeenCalled();
    expect(f.secure.set).not.toHaveBeenCalled();
  });
  it('surfaces OS/keychain errors instead of claiming a successful save', async () => {
    const f = fixture();
    f.secure.set.mockRejectedValue(new Error('Keychain locked'));
    await expect(f.store.setItem('session', 'secret')).rejects.toThrow(/locked/);
    expect(f.removePlaintext).not.toHaveBeenCalled();
  });
});
