import { describe, expect, it } from 'vitest';
import { nativeAuthCallbackUrl, parseNativeAppUrl, safeLocalRoute } from './nativeNavigation';

describe('native navigation', () => {
  it('maps the LC custom scheme to a local route', () => {
    expect(parseNativeAppUrl('logbookcompanion://app/auth/callback?code=abc&next=%2Fpm5')).toBe('/auth/callback?code=abc&next=%2Fpm5');
  });
  it.each(['https://evil.example/pm5', 'other://app/pm5', 'logbookcompanion://evil/pm5', 'not a url'])('rejects %s', value => {
    expect(parseNativeAppUrl(value)).toBeNull();
  });
  it('allows only local non-auth next routes', () => {
    expect(safeLocalRoute('/pm5')).toBe('/pm5');
    expect(safeLocalRoute('//evil.example')).toBe('/');
    expect(safeLocalRoute('/auth/callback')).toBe('/');
    expect(safeLocalRoute('https://evil.example')).toBe('/');
  });
  it('builds the installed reset callback', () => {
    expect(nativeAuthCallbackUrl('/reset-password')).toBe('logbookcompanion://app/auth/callback?next=%2Freset-password');
  });
});
