import { describe, expect, it } from 'vitest';
import { resolvedAuthorizationRedirect } from './oauthConsentFlow';

describe('resolvedAuthorizationRedirect', () => {
    it('returns the redirect URI when Supabase reports that authorization is already resolved', () => {
        expect(resolvedAuthorizationRedirect({
            redirect_url: 'https://chatgpt.com/connector/oauth/callback?code=abc&state=xyz',
        })).toBe('https://chatgpt.com/connector/oauth/callback?code=abc&state=xyz');
    });

    it('returns null for a still-pending authorization request', () => {
        expect(resolvedAuthorizationRedirect({})).toBeNull();
    });
});
