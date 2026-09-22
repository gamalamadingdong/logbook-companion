export const NATIVE_DEVELOPMENT_STATE_PREFIX = 'lc-dev-mobile-v1.';
export const NATIVE_DEVELOPMENT_STATE_TTL_MS = 10 * 60 * 1000;
export const NATIVE_WEBVIEW_ORIGINS = ['http://localhost', 'capacitor://localhost'] as const;

export function isNativeDevelopmentState(state: unknown): state is string {
  return typeof state === 'string' &&
    new RegExp(`^${NATIVE_DEVELOPMENT_STATE_PREFIX.replaceAll('.', '\\.')}[a-f0-9]{64}$`).test(state);
}

export function nativeDevelopmentReturn(params: URLSearchParams): string | null {
  const state = params.get('state');
  if (!isNativeDevelopmentState(state)) return null;
  const permitted = ['code', 'state', 'error', 'error_description'];
  if ([...params.keys()].some(key => !permitted.includes(key) || params.getAll(key).length !== 1)) {
    throw new Error('Invalid Concept2 return. Reconnect from the app.');
  }
  const code = params.get('code');
  const error = params.get('error');
  if (Boolean(code) === Boolean(error) || (code && code.length > 4096)) {
    throw new Error('Invalid Concept2 return. Reconnect from the app.');
  }
  const url = new URL('logbookcompanion://app/callback');
  url.searchParams.set('state', state);
  if (error) url.searchParams.set('error', 'access_denied');
  else url.searchParams.set('code', code!);
  return url.href;
}
