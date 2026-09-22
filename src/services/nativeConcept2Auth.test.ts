import { describe, expect, it, vi } from 'vitest';
import { createNativeConcept2Auth, NATIVE_CONCEPT2_PENDING_KEY, type NativeConcept2Dependencies } from './nativeConcept2Auth';
import { nativeDevelopmentReturn, NATIVE_DEVELOPMENT_STATE_PREFIX } from '../../supabase/functions/_shared/concept2/nativeAuth';

const state = NATIVE_DEVELOPMENT_STATE_PREFIX + 'a'.repeat(64);
const callback = () => new URLSearchParams({ code: 'one-use-code', state });
function fixture() {
  const data = new Map<string, string>();
  let dismiss = () => {};
  const deps: NativeConcept2Dependencies = {
    storage: {
      getItem: vi.fn(async key => data.get(key) ?? null),
      setItem: vi.fn(async (key, value) => { data.set(key, value); }),
      removeItem: vi.fn(async key => { data.delete(key); }),
    },
    owner: vi.fn(async () => 'owner'),
    begin: vi.fn(async () => ({ authorization_url: `https://log-dev.concept2.com/oauth/authorize?state=${state}` })),
    exchange: vi.fn(async () => ({ connected: true })),
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    onDismiss: vi.fn(async callback => { dismiss = callback; return { remove: vi.fn(async () => {}) }; }),
    notify: vi.fn(),
    now: () => 1_000_000,
  };
  return { data, deps, client: createNativeConcept2Auth(deps), dismiss: () => dismiss() };
}

describe('native Concept2 authentication', () => {
  it('persists owner and state before opening the system browser; consumes before exchange', async () => {
    const f = fixture();
    f.deps.open = vi.fn(async () => {
      expect(JSON.parse(f.data.get(NATIVE_CONCEPT2_PENDING_KEY)!)).toEqual({ owner: 'owner', state, startedAt: 1_000_000 });
    });
    f.deps.exchange = vi.fn(async () => { expect(f.data.size).toBe(0); });
    await f.client.start();
    await f.client.complete(callback());
    expect(f.deps.exchange).toHaveBeenCalledExactlyOnceWith('one-use-code', state);
    await expect(f.client.complete(callback())).rejects.toThrow(/already been used/);
    expect(f.deps.exchange).toHaveBeenCalledTimes(1);
  });
  it('survives a cold restart without relying on in-memory state', async () => {
    const f = fixture();
    await f.client.start();
    await createNativeConcept2Auth(f.deps).complete(callback());
    expect(f.deps.exchange).toHaveBeenCalledOnce();
  });
  it('rejects a mismatched state without consuming the legitimate pending attempt', async () => {
    const f = fixture();
    await f.client.start();
    await expect(f.client.complete(new URLSearchParams({ code: 'other', state: NATIVE_DEVELOPMENT_STATE_PREFIX + 'b'.repeat(64) })))
      .rejects.toThrow(/not started/);
    expect(f.data.size).toBe(1);
    expect(f.deps.exchange).not.toHaveBeenCalled();
  });
  it('requires the initiating user, including after account switching', async () => {
    const f = fixture();
    await f.client.start();
    f.deps.owner = async () => 'different-owner';
    await expect(f.client.complete(callback())).rejects.toThrow(/account that started/);
    expect(f.deps.exchange).not.toHaveBeenCalled();
  });
  it.each([600_000, -1])('rejects expired/future local state at offset %i', async offset => {
    const f = fixture();
    await f.client.start();
    f.data.set(NATIVE_CONCEPT2_PENDING_KEY, JSON.stringify({ state, owner: 'owner', startedAt: 1_000_000 - offset }));
    await expect(f.client.complete(callback())).rejects.toThrow(/expired/);
    expect(f.deps.exchange).not.toHaveBeenCalled();
    expect(f.data.size).toBe(0);
  });
  it('denied consent clears the attempt without exchanging a code', async () => {
    const f = fixture();
    await f.client.start();
    await expect(f.client.complete(new URLSearchParams({ state, error: 'access_denied' }))).rejects.toThrow(/canceled/);
    expect(f.deps.exchange).not.toHaveBeenCalled();
    expect(f.data.size).toBe(0);
  });
  it('does not confuse browser dismissal with a canceled deep-link return', async () => {
    const f = fixture();
    await f.client.start();
    f.dismiss();
    await vi.waitFor(() => expect(f.deps.notify).toHaveBeenCalledWith(expect.stringContaining('Browser closed')));
    await f.client.complete(callback());
    expect(f.deps.exchange).toHaveBeenCalledOnce();
  });
  it('clears local authorization on logout and does not open the browser after logout during begin', async () => {
    const f = fixture();
    let resolve!: (value: { authorization_url: string }) => void;
    f.deps.begin = () => new Promise(r => { resolve = r; });
    const start = f.client.start();
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    await f.client.clear();
    resolve({ authorization_url: `https://log-dev.concept2.com/oauth/authorize?state=${state}` });
    await expect(start).rejects.toThrow(/sign-in changed/);
    expect(f.deps.open).not.toHaveBeenCalled();
    expect(f.data.size).toBe(0);
  });
  it('cleans up an unsuccessful browser launch and reports the failure', async () => {
    const f = fixture();
    f.deps.open = async () => { throw new Error('Browser unavailable'); };
    await expect(f.client.start()).rejects.toThrow('Browser unavailable');
    expect(f.data.size).toBe(0);
  });
  it('does not retry a lost exchange response, including after a restart', async () => {
    const f = fixture();
    await f.client.start();
    f.deps.exchange = vi.fn(async () => { throw new Error('Connection failed or operation pending'); });
    await expect(f.client.complete(callback())).rejects.toThrow(/pending/);
    await expect(createNativeConcept2Auth(f.deps).complete(callback())).rejects.toThrow(/already been used/);
    expect(f.deps.exchange).toHaveBeenCalledOnce();
  });
  it('never opens production or arbitrary authorization endpoints', async () => {
    const f = fixture();
    f.deps.begin = async () => ({ authorization_url: `https://log.concept2.com/oauth/authorize?state=${state}` });
    await expect(f.client.start()).rejects.toThrow(/not configured/);
    expect(f.deps.open).not.toHaveBeenCalled();
  });
  it('rejects concurrent completion before a second exchange', async () => {
    const f = fixture();
    await f.client.start();
    const first = f.client.complete(callback());
    await expect(f.client.complete(callback())).rejects.toThrow(/already being processed/);
    await first;
    expect(f.deps.exchange).toHaveBeenCalledOnce();
  });
  it('refuses corrupt persisted state rather than inventing a new connection', async () => {
    const f = fixture();
    f.data.set(NATIVE_CONCEPT2_PENDING_KEY, '{"state":null}');
    await expect(f.client.complete(callback())).rejects.toThrow(/invalid/);
    expect(f.deps.exchange).not.toHaveBeenCalled();
  });
});

describe('HTTPS-to-app return', () => {
  it('returns only the one-use provider code and opaque state to the fixed app route', () => {
    const url = new URL(nativeDevelopmentReturn(callback())!);
    expect(url.origin).toBe('null');
    expect(url.protocol).toBe('logbookcompanion:');
    expect(url.host).toBe('app');
    expect(url.pathname).toBe('/callback');
    expect([...url.searchParams.keys()]).toEqual(['state', 'code']);
  });
  it('does not reinterpret an ordinary web authorization state as native', () => {
    expect(nativeDevelopmentReturn(new URLSearchParams({ code: 'web', state: 's'.repeat(72) }))).toBeNull();
  });
  it.each(['access_token=secret', 'refresh_token=secret', 'redirect_uri=https://evil.test', 'code=another'])(
    'rejects injected %s without constructing a handoff', extra => {
      expect(() => nativeDevelopmentReturn(new URLSearchParams(`${callback()}&${extra}`))).toThrow(/Invalid/);
    },
  );
  it('does not echo provider descriptions or allow code/error ambiguity', () => {
    const url = new URL(nativeDevelopmentReturn(new URLSearchParams({ state, error: 'denied', error_description: 'sensitive' }))!);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.has('error_description')).toBe(false);
    expect(() => nativeDevelopmentReturn(new URLSearchParams({ state, code: 'code', error: 'denied' }))).toThrow();
  });
});
