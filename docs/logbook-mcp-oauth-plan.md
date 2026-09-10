# Logbook MCP — OAuth 2.1 (Supabase-native) Reference Design

**Status:** code complete, verified pre-deploy. Supabase OAuth 2.1 Server enabled; asymmetric
JWT signing keys migrated (ES256 key live in JWKS); `workout_logs` RLS confirmed against the
live DB (anon read → 0 rows; 2 real users present). Remaining: deploy + real-token round-trip.
**Why this doc exists:** the Logbook ChatGPT connector is the *reference implementation*
for the V2 Evidence Platform's Phase 7 ChatGPT integration. It must be spec-correct and
reusable. This supersedes both the shared-bearer-token cut and the WorkOS cut.

## TL;DR of how we got here

1. First cut used a shared bearer token + `401 WWW-Authenticate: Bearer`. That header makes
   ChatGPT attempt OAuth discovery, find nothing, and report *"doesn't implement OAuth."*
2. ChatGPT's plugin connector requires a real OAuth 2.1 authorization server (Auth/Token/
   Registration URLs, issuer, resource) with Dynamic Client Registration + PKCE.
3. Supabase now ships an **OAuth 2.1 Server** (beta) that turns the project into exactly
   that identity provider — no third-party auth provider (WorkOS/Stytch) needed. This is the
   chosen design: everything stays in the existing Supabase project.

## Architecture: Supabase is the authorization server; /api/mcp is the resource server

```
ChatGPT ──OAuth 2.1 (DCR + PKCE)──▶ Supabase Auth (authorization server)
   │                                   - /.well-known/oauth-authorization-server
   │                                   - /auth/v1/oauth/authorize, /oauth/token
   │                                   - JWKS, refresh rotation, DCR
   │                                   - redirects consent to our /oauth/consent
   │                                            │
   │        user approves in our SPA consent UI ┘ (getAuthorizationDetails/approve/deny)
   │
   └──Bearer (Supabase JWT: sub, user_id, client_id)──▶ /api/mcp (resource server)
                                   - serves /.well-known/oauth-protected-resource
                                   - validates JWT via Supabase JWKS
                                   - creates a per-request Supabase client bound to that
                                     user token → RLS scopes every query automatically
```

**Why this is better than the WorkOS design:**
- Tokens are standard Supabase JWTs with `sub`/`user_id`/`client_id` — **no identity→user
  map to invent**; the token *is* a Supabase user token.
- **RLS applies automatically.** The resource server queries with the user's token, so the
  database scopes rows to that user. No service-role key, no code-level `.eq(user_id)`,
  no allowlist. This is the proper multi-user-safe shape, for free.
- Single project, single issuer that can front Logbook now and the Evidence Platform later.

## Live values (from Sam's dashboard)

- Project ref: `vmlhcbkyonemmlawnqqr`
- Authorization endpoint: `https://vmlhcbkyonemmlawnqqr.supabase.co/auth/v1/oauth/authorize`
- Token endpoint: `https://vmlhcbkyonemmlawnqqr.supabase.co/auth/v1/oauth/token`
- JWKS: `https://vmlhcbkyonemmlawnqqr.supabase.co/auth/v1/.well-known/jwks.json`
- OAuth AS discovery: `https://vmlhcbkyonemmlawnqqr.supabase.co/.well-known/oauth-authorization-server/auth/v1`
- Issuer (JWT `iss`): `https://vmlhcbkyonemmlawnqqr.supabase.co/auth/v1`
- Site URL: `https://logbook.readyall.org`  ·  Authorization Path: `/oauth/consent`
- Dynamic registration: enabled ("Allow Dynamic OAuth Apps")

## Components to build

### 1. `/oauth/consent` (SPA route)
Supabase redirects the user here with `?authorization_id=...` after validating the client's
`/oauth/authorize` request. The page (dark theme, matches existing auth pages):
1. read `authorization_id` from query.
2. if not signed in, redirect to `/login?next=/oauth/consent?...` preserving params.
3. `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` → client name + `scope`.
4. render consent: what app (ChatGPT), which scopes, approve/deny buttons.
5. approve → `approveAuthorization(id)` → returns `redirect_url` → `window.location = it`.
   deny → `denyAuthorization(id)` → redirect back with error.
Route must be PUBLIC in App.tsx (not behind ProtectedRoute), but itself requires a session
before it can approve — so it gates on session and bounces to /login if absent.

### 2. `/api/mcp` (resource server) — rewrite
- Drop shared-bearer gate, service-role key, and email allowlist.
- On each request: read `Authorization: Bearer <jwt>`; verify via Supabase JWKS
  (`jose.createRemoteJWKSet`), checking `iss` and `exp`.
- Build a per-request Supabase client with `global.headers.Authorization = Bearer <jwt>` and
  the anon key, so PostgREST runs under the user's identity and **RLS scopes queries**.
- On missing/invalid token return:
  `401` + `WWW-Authenticate: Bearer resource_metadata="https://logbook.readyall.org/.well-known/oauth-protected-resource"`
  (this is the CORRECT use of the header — it now points at real metadata).

### 3. Protected-resource metadata
`GET /.well-known/oauth-protected-resource` →
```json
{
  "resource": "https://logbook.readyall.org/api/mcp",
  "authorization_servers": ["https://vmlhcbkyonemmlawnqqr.supabase.co/auth/v1"],
  "scopes_supported": ["openid", "email"]
}
```
Served by a Vercel function; `vercel.json` rewrites the well-known path to it.

### 4. Tools — modernize
Keep the 7 read tools but move to `server.registerTool(name, {title, description,
inputSchema, outputSchema, annotations:{readOnlyHint:true, openWorldHint:false,
destructiveHint:false}}, handler)`. Queries use the per-request user-scoped client.

## RLS prerequisite (Sam / DB)

`workout_logs` must have an RLS policy allowing the authenticated user to SELECT their own
rows. OAuth tokens carry `client_id`; a plain `auth.uid() = user_id` SELECT policy is enough
for read. If we want to *restrict* which OAuth clients can read, add a `client_id` check.
Verify current policies before trusting RLS to scope (MCP-first: check live).

## Verification

- `npx @modelcontextprotocol/inspector@latest` against deployed `/api/mcp`: confirm it
  advertises the resource metadata, runs the Supabase OAuth flow (browser consent at
  `/oauth/consent`), and returns tool results under the issued token.
- ChatGPT: Developer mode → chatgpt.com/plugins → add `https://logbook.readyall.org/api/mcp`
  → it discovers Supabase AS, runs OAuth, shows our consent screen, then lists tools.

## Reusability for the Evidence Platform (Phase 7)

Same Supabase-OAuth pattern: that project enables its own OAuth 2.1 server (or shares one),
builds a `/oauth/consent`, and its `/api/mcp` validates JWT + relies on RLS. The auth
middleware (`api/_lib/mcpAuth.ts`) is copyable across repos. Evidence data is profile-
agnostic, so its RLS can be scope/`client_id`-based rather than per-user — a simpler subset
of what Logbook proves here.

## Decision log

- Rejected capability-URL/anonymous: not a valid reference pattern; leaves health data behind
  a URL secret. Sam: "do it completely and correctly."
- Rejected WorkOS/Stytch/self-hosted AS: unnecessary once Supabase OAuth 2.1 Server exists;
  Supabase-native keeps one project, gives RLS-scoped tokens for free.
- Provider: **Supabase OAuth 2.1 Server** (beta, free during beta).
