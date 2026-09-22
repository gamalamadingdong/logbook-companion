export const NATIVE_APP_SCHEME = 'logbookcompanion:';
export const NATIVE_APP_HOST = 'app';

export function parseNativeAppUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== NATIVE_APP_SCHEME || url.hostname !== NATIVE_APP_HOST) return null;
    if (url.username || url.password || url.port || url.pathname.startsWith('//')) return null;
    return `${url.pathname || '/'}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function safeLocalRoute(raw: string | null, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.startsWith('/auth') || raw.startsWith('/login')) return fallback;
  return raw;
}

export function nativeAuthCallbackUrl(next = '/'): string {
  const safeNext = safeLocalRoute(next);
  return `logbookcompanion://app/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
