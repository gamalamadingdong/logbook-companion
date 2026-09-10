export interface AuthorizationDetailsLike {
    redirect_url?: string;
}

export interface AuthorizationDecisionResponse {
    data: { redirect_url?: string } | null;
    error: unknown;
}

export interface AuthorizationDecisionApi {
    approveAuthorization: (
        authorizationId: string,
        options: { skipBrowserRedirect: boolean },
    ) => Promise<AuthorizationDecisionResponse>;
    denyAuthorization: (
        authorizationId: string,
        options: { skipBrowserRedirect: boolean },
    ) => Promise<AuthorizationDecisionResponse>;
}

/**
 * Supabase returns redirect_url when this authorization request is already
 * resolved (for example, an existing grant). The consent page must continue to
 * that URL instead of attempting to approve the non-pending request again.
 */
export function resolvedAuthorizationRedirect(
    details: AuthorizationDetailsLike | null | undefined,
): string | null {
    const redirectUrl = details?.redirect_url?.trim();
    return redirectUrl || null;
}

/**
 * Keep browser navigation under the consent page's control. Supabase's SDK
 * redirects automatically unless skipBrowserRedirect is true; allowing that
 * and then redirecting again can consume the one-time callback code twice.
 */
export function submitAuthorizationDecision(
    oauth: AuthorizationDecisionApi,
    authorizationId: string,
    approve: boolean,
): Promise<AuthorizationDecisionResponse> {
    const options = { skipBrowserRedirect: true };
    return approve
        ? oauth.approveAuthorization(authorizationId, options)
        : oauth.denyAuthorization(authorizationId, options);
}
