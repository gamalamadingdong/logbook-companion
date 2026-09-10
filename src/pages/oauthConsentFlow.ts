export interface AuthorizationDetailsLike {
    redirect_url?: string;
}

/**
 * Supabase returns redirect_uri when this authorization request is already
 * resolved (for example, an existing grant). The consent page must continue to
 * that URI instead of attempting to approve the non-pending request again.
 */
export function resolvedAuthorizationRedirect(
    details: AuthorizationDetailsLike | null | undefined,
): string | null {
    const redirectUri = details?.redirect_url?.trim();
    return redirectUri || null;
}
