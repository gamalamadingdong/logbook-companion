// Deliberately development-only: never accepts an environment, provider URL,
// callback, credentials, user ID, or tokens from the caller.
import { developmentResults } from './results.ts';
export const PROVIDER = 'https://log-dev.concept2.com';
// Operator must explicitly configure the confirmed staging origin. No hostname default.
function permittedOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && !url.username && !url.password
      && (value === 'http://localhost:5173'
        || (url.protocol === 'https:' && url.hostname.startsWith('logbook-dev.') && !url.port));
  } catch { return false; }
}
export type Config = { origin: string; clientId: string; clientSecret: string };
type Row = Record<string, unknown>;
export type Dependencies = {
  config: Config | null;
  authenticate: (jwt: string) => Promise<string | null>;
  operation: (user: string, action: string, values?: Row) => Promise<Row>;
  syncOperation?: (user: string, action: string, values?: Row) => Promise<Row>;
  fetch: typeof fetch;
};
export function configuration(get: (name: string) => string | undefined): Config | null {
  const origin = get('C2_DEVELOPMENT_ORIGIN');
  const clientId = get('C2_DEVELOPMENT_CLIENT_ID');
  const clientSecret = get('C2_DEVELOPMENT_CLIENT_SECRET');
  return origin && permittedOrigin(origin) && clientId && clientSecret
    ? { origin, clientId, clientSecret } : null;
}
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const config = deps.config;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    const reply = (status: number, body: Row) => new Response(JSON.stringify(body), { status, headers });
    if (!config) return reply(503, { error: 'Development Concept2 is not configured.' });
    if (req.headers.get('Origin') !== config.origin) return reply(403, { error: 'Origin not allowed.' });
    headers['Access-Control-Allow-Origin'] = config.origin;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
    try {
      const auth = req.headers.get('Authorization');
      if (!auth?.startsWith('Bearer ')) return reply(401, { error: 'Sign in first.' });
      const user = await deps.authenticate(auth.slice(7));
      if (!user) return reply(401, { error: 'Sign in first.' });
      const body = await req.json();
      if (!body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).some(k => !['action', 'code', 'state', 'page'].includes(k))) {
        return reply(400, { error: 'Invalid request.' });
      }
      const callback = `${config.origin}/callback`;
      if (body.action === 'sync' || body.action === 'results') {
        try { return reply(200, await developmentResults(deps, user, body.action, body.page)); }
        catch { return reply(409, { error: 'Development import unavailable or failed. Check / refresh connection and retry this page. If operation is pending, stop and request operator recovery.' }); }
      }
      if (body.action === 'status') return reply(200, await deps.operation(user, 'status'));
      if (body.action === 'begin') {
        const state = crypto.randomUUID() + crypto.randomUUID();
        await deps.operation(user, 'begin', { state_hash: await hash(state) });
        const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: callback,
          response_type: 'code', scope: 'user:read,results:read', state });
        return reply(200, { authorization_url: `${PROVIDER}/oauth/authorize?${query}` });
      }
      if (!['exchange', 'refresh'].includes(body.action)) return reply(400, { error: 'Unsupported action. Publishing is disabled.' });
      if (body.action === 'exchange' && (typeof body.code !== 'string' || !body.code || body.code.length > 4096 ||
          typeof body.state !== 'string' || body.state.length !== 72)) return reply(400, { error: 'Invalid callback.' });
      // DB consumes state and acquires a non-expiring mutex in one transaction.
      const claim = await deps.operation(user, body.action,
        body.action === 'exchange' ? { state_hash: await hash(body.state) } : {});
      if (claim.fresh) return reply(200, { connected: true, environment: 'development' });
      const form = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
        grant_type: body.action === 'exchange' ? 'authorization_code' : 'refresh_token' });
      if (body.action === 'exchange') { form.set('code', body.code); form.set('redirect_uri', callback); }
      else form.set('refresh_token', String(claim.refresh_token));
      // Never retry a rotating credential request after an ambiguous outcome.
      const response = await deps.fetch(`${PROVIDER}/oauth/access_token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form, redirect: 'error', signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const rejection = await response.json().catch(() => null);
        if (response.status === 400 && rejection?.error === 'invalid_grant') {
          await deps.operation(user, 'reject', { operation_id: claim.operation_id });
          return reply(409, { error: 'Development authorization expired or was revoked. Reconnect your development account.' });
        }
        throw new Error('provider');
      }
      const tokens = await response.json();
      const refresh = tokens.refresh_token ?? (body.action === 'refresh' ? claim.refresh_token : null);
      if (typeof tokens.access_token !== 'string' || !tokens.access_token ||
          typeof refresh !== 'string' || !refresh || typeof tokens.expires_in !== 'number' ||
          !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('Invalid provider response');
      let identity = claim.provider_user_id;
      if (body.action === 'exchange') {
        const profile = await deps.fetch(`${PROVIDER}/api/users/me`, {
          headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/vnd.c2logbook.v1+json' },
          redirect: 'error', signal: AbortSignal.timeout(20_000),
        });
        if (!profile.ok) throw new Error('Identity lookup failed');
        const result = await profile.json();
        identity = (result.data ?? result).id;
        if (!identity || !['string', 'number'].includes(typeof identity)) throw new Error('Missing identity');
      }
      await deps.operation(user, 'save', { operation_id: claim.operation_id,
        access_token: tokens.access_token, refresh_token: refresh,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), provider_user_id: String(identity) });
      return reply(200, { connected: true, environment: 'development', provider_user_id: String(identity) });
    } catch {
      // Do not return/log provider payloads, credentials, authorization codes or DB errors.
      return reply(409, { error: 'Connection failed or operation pending. Check connection status; a pending operation requires operator recovery before reconnecting.' });
    }
  };
}
