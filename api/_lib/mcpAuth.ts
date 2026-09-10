// OAuth 2.1 bearer-token verification for the MCP resource server.
//
// The authorization server is Supabase Auth (OAuth 2.1 Server). It issues JWTs
// signed with the project's asymmetric keys, published at the JWKS endpoint.
// We verify the token's signature + issuer + expiry via that JWKS, then hand the
// raw token to the data layer so PostgREST/RLS scope queries to the user.
//
// This middleware is intentionally generic so the V2 Evidence Platform can reuse
// it: only the issuer / JWKS / resource URL differ per deployment.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface McpAuthEnv {
    /** JWT `iss` claim, e.g. https://<ref>.supabase.co/auth/v1 */
    issuer: string;
    /** JWKS URL, e.g. https://<ref>.supabase.co/auth/v1/.well-known/jwks.json */
    jwksUrl: string;
    /** Canonical resource identifier advertised in protected-resource metadata. */
    resourceUrl: string;
    /** Base URL of this app, used to build the metadata URL for challenges. */
    siteUrl: string;
}

export function readAuthEnv(): McpAuthEnv {
    const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
    const issuer = process.env.MCP_OAUTH_ISSUER ?? (supabaseUrl ? `${supabaseUrl}/auth/v1` : '');
    const jwksUrl = process.env.MCP_OAUTH_JWKS_URL ?? (supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '');
    const siteUrl = (process.env.MCP_SITE_URL ?? 'https://logbook.readyall.org').replace(/\/$/, '');
    const resourceUrl = process.env.MCP_RESOURCE_URL ?? `${siteUrl}/api/mcp`;

    const missing = [
        !issuer && 'MCP_OAUTH_ISSUER (or SUPABASE_URL)',
        !jwksUrl && 'MCP_OAUTH_JWKS_URL (or SUPABASE_URL)',
    ].filter(Boolean) as string[];
    if (missing.length > 0) {
        throw new Error(`Missing required env vars for MCP auth: ${missing.join(', ')}`);
    }

    return { issuer, jwksUrl, resourceUrl, siteUrl };
}

// Cache the remote JWKS across warm invocations (jose handles fetch + rotation).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksForUrl: string | null = null;

function getJwks(url: string) {
    if (!jwks || jwksForUrl !== url) {
        jwks = createRemoteJWKSet(new URL(url));
        jwksForUrl = url;
    }
    return jwks;
}

export interface VerifiedToken {
    token: string;
    payload: JWTPayload & { sub?: string; email?: string; client_id?: string };
}

export class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Extract and verify the bearer token. Throws UnauthorizedError when absent or
 * invalid; the caller turns that into a 401 + WWW-Authenticate challenge.
 */
export async function verifyBearer(authorizationHeader: string | undefined, env: McpAuthEnv): Promise<VerifiedToken> {
    const header = authorizationHeader ?? '';
    if (!header.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing bearer token');
    }
    const token = header.slice(7).trim();
    if (!token) throw new UnauthorizedError('Empty bearer token');

    try {
        const { payload } = await jwtVerify(token, getJwks(env.jwksUrl), {
            issuer: env.issuer,
        });
        return { token, payload };
    } catch (err) {
        throw new UnauthorizedError(`Invalid token: ${(err as Error).message}`);
    }
}

/** The WWW-Authenticate value pointing ChatGPT at our protected-resource metadata. */
export function challengeHeader(env: McpAuthEnv): string {
    const metadataUrl = `${env.siteUrl}/.well-known/oauth-protected-resource`;
    return `Bearer resource_metadata="${metadataUrl}"`;
}

/** The protected-resource metadata document (RFC 9728). */
export function protectedResourceMetadata(env: McpAuthEnv): Record<string, unknown> {
    return {
        resource: env.resourceUrl,
        authorization_servers: [env.issuer],
        scopes_supported: ['openid', 'email'],
        bearer_methods_supported: ['header'],
    };
}
