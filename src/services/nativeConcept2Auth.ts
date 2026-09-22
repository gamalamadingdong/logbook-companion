import {
  isNativeDevelopmentState, nativeDevelopmentReturn, NATIVE_DEVELOPMENT_STATE_TTL_MS,
} from '../../supabase/functions/_shared/concept2/nativeAuth';
import type { AuthStorage } from './nativeAuthStorage';

export const NATIVE_CONCEPT2_PENDING_KEY = 'lc-native-concept2-development';
type Pending = { state: string; owner: string; startedAt: number };
type Listener = { remove(): Promise<void> };
export interface NativeConcept2Dependencies {
  storage: AuthStorage;
  owner(): Promise<string | null>;
  begin(): Promise<{ authorization_url?: string }>;
  exchange(code: string, state: string): Promise<unknown>;
  open(url: string): Promise<void>;
  close(): Promise<void>;
  onDismiss(callback: () => void): Promise<Listener>;
  notify(message: string): void;
  now?: () => number;
}

export function createNativeConcept2Auth(deps: NativeConcept2Dependencies) {
  let starting = false;
  let completing = false;
  let epoch = 0;
  let listener: Listener | undefined;
  const now = deps.now ?? Date.now;
  async function pending(): Promise<Pending | null> {
    const stored = await deps.storage.getItem(NATIVE_CONCEPT2_PENDING_KEY);
    if (!stored) return null;
    let value: unknown;
    try { value = JSON.parse(stored); }
    catch { throw new Error('Saved connection state is invalid. Sign out and reconnect.'); }
    if (!value || typeof value !== 'object' || !('state' in value) || !isNativeDevelopmentState(value.state)
      || !('owner' in value) || typeof value.owner !== 'string'
      || !('startedAt' in value) || typeof value.startedAt !== 'number' || !Number.isFinite(value.startedAt)) {
      throw new Error('Saved connection state is invalid. Sign out and reconnect.');
    }
    return { state: value.state, owner: value.owner, startedAt: value.startedAt };
  }
  async function detach() {
    const current = listener;
    listener = undefined;
    await current?.remove();
  }
  async function clear() {
    epoch++;
    await detach();
    await deps.storage.removeItem(NATIVE_CONCEPT2_PENDING_KEY);
  }
  return {
    clear,
    async start() {
      if (starting || completing) throw new Error('A Concept2 connection is already in progress.');
      starting = true;
      const currentEpoch = ++epoch;
      try {
        await detach();
        const owner = await deps.owner();
        if (!owner) throw new Error('Sign in before connecting Concept2.');
        const result = await deps.begin();
        const url = new URL(result.authorization_url || '');
        const state = url.searchParams.get('state');
        if (url.origin !== 'https://log-dev.concept2.com' || url.pathname !== '/oauth/authorize'
          || url.username || url.password || !isNativeDevelopmentState(state)) {
          throw new Error('Native Concept2 connection is not configured. Update the development backend.');
        }
        if (currentEpoch !== epoch || await deps.owner() !== owner) {
          throw new Error('Your sign-in changed. Start the connection again.');
        }
        await deps.storage.setItem(NATIVE_CONCEPT2_PENDING_KEY, JSON.stringify({ state, owner, startedAt: now() }));
        listener = await deps.onDismiss(() => {
          void (async () => {
            if (currentEpoch !== epoch) return;
            const saved = await pending();
            if (currentEpoch !== epoch || saved?.state !== state) return;
            await detach();
            // Closing the browser can race a valid app return; retain state until consumed or expired.
            deps.notify('Browser closed. Return to Sync to check your connection or reconnect.');
          })().catch(() => deps.notify('Could not check the pending connection. Return to Sync to check its status.'));
        });
        if (currentEpoch !== epoch) {
          await clear();
          throw new Error('Your sign-in changed. Start the connection again.');
        }
        await deps.open(url.href);
      } catch (error) {
        await clear();
        throw error;
      } finally {
        starting = false;
      }
    },
    async complete(params: URLSearchParams) {
      if (completing) throw new Error('This Concept2 return is already being processed.');
      completing = true;
      try {
        if (!nativeDevelopmentReturn(params)) throw new Error('Start this connection from the mobile app.');
        const saved = await pending();
        if (!saved || saved.state !== params.get('state')) {
          throw new Error('This connection was not started on this device, or has already been used. Reconnect from Sync.');
        }
        const owner = await deps.owner();
        if (!owner || owner !== saved.owner) throw new Error('Sign in with the account that started the connection.');
        if (now() < saved.startedAt || now() - saved.startedAt >= NATIVE_DEVELOPMENT_STATE_TTL_MS) {
          await clear();
          throw new Error('This connection expired. Reconnect from Sync.');
        }
        // Consume locally before dispatch; the server independently consumes user-bound state.
        await clear();
        await deps.close().catch(() => deps.notify('The browser could not close. Return to Logbook Companion to finish.'));
        if (params.has('error')) throw new Error('Concept2 authorization was canceled. Reconnect from Sync.');
        await deps.exchange(params.get('code')!, saved.state);
        if (await deps.owner() !== owner) throw new Error('Your sign-in changed. Sign in and check connection status.');
      } finally {
        completing = false;
      }
    },
  };
}
