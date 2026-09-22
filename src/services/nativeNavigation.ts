export const NATIVE_APP_SCHEME = 'logbookcompanion:';
export const NATIVE_APP_HOST = 'app';

function hasUnsafePathCharacters(value: string): boolean {
  return [...value].some(character => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
}

export function parseNativeAppUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== NATIVE_APP_SCHEME || url.hostname !== NATIVE_APP_HOST) return null;
    const path = decodeURIComponent(url.pathname);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (url.username || url.password || url.port || path.startsWith('//')
      || hasUnsafePathCharacters(path)
      || path.startsWith('/auth/bootstrap')
      || ['access_token', 'refresh_token'].some(key => url.searchParams.has(key) || fragment.has(key))) return null;
    return `${url.pathname || '/'}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function safeLocalRoute(raw: string | null, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || hasUnsafePathCharacters(raw)) return fallback;
  try {
    const url = new URL(raw, 'https://local.invalid');
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://local.invalid' || decodedPath.startsWith('//')
      || hasUnsafePathCharacters(decodedPath)
      || /^\/(?:auth|login)(?:\/|$)/i.test(decodedPath)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function nativeAuthCallbackUrl(next = '/'): string {
  const safeNext = safeLocalRoute(next);
  return `logbookcompanion://app/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
