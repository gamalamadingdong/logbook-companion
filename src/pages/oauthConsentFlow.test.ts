import { describe, expect, it, vi } from 'vitest';
import { resolvedAuthorizationRedirect, submitAuthorizationDecision } from './oauthConsentFlow';

describe('resolvedAuthorizationRedirect', () => {
    it('returns the redirect URL when Supabase reports that authorization is already resolved', () => {
        expect(resolvedAuthorizationRedirect({
            redirect_url: 'https://chatgpt.com/connector/oauth/callback?code=abc&state=xyz',
        })).toBe('https://chatgpt.com/connector/oauth/callback?code=abc&state=xyz');
    });

    it('returns null for a still-pending authorization request', () => {
        expect(resolvedAuthorizationRedirect({})).toBeNull();
    });
});

describe('submitAuthorizationDecision', () => {
    it('disables the SDK browser redirect when approving so the page redirects exactly once', async () => {
        const approveAuthorization = vi.fn().mockResolvedValue({
            data: { redirect_url: 'https://chatgpt.com/callback?code=abc' },
            error: null,
        });
        const denyAuthorization = vi.fn();

        const result = await submitAuthorizationDecision(
            { approveAuthorization, denyAuthorization },
            'authorization-id',
            true,
        );

        expect(approveAuthorization).toHaveBeenCalledWith(
            'authorization-id',
            { skipBrowserRedirect: true },
        );
        expect(denyAuthorization).not.toHaveBeenCalled();
        expect(result.data?.redirect_url).toBe('https://chatgpt.com/callback?code=abc');
    });
});
