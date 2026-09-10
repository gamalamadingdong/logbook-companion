# Logbook Companion — ChatGPT MCP Connector — superseded

**This document described the initial bearer-token / service-role scaffold and has been superseded by [`logbook-mcp-oauth-plan.md`](./logbook-mcp-oauth-plan.md), the canonical design.**

Why it was superseded:

1. **Auth model.** The first scaffold used a single shared bearer token with the Supabase **service-role key** and a hardcoded `LOGBOOK_USER_ID`, scoping queries in code. ChatGPT's current plugins flow does not accept a static token — it performs OAuth 2.1 discovery (DCR + PKCE) against a real authorization server. A `401 + WWW-Authenticate: Bearer` with no discoverable authorization server produced the "doesn't implement OAuth" error.
2. **Correct design.** Supabase Auth's **OAuth 2.1 Server** is now the authorization server; `/api/mcp` is a resource server that verifies the Supabase-issued JWT against the project JWKS and queries under the user's identity so **Row Level Security** performs the scoping. No service-role key, no shared secret, no hardcoded user id.
3. **Reusability.** The OAuth design is the reference pattern for the V2 Evidence Platform's Phase 7 ChatGPT integration; the auth middleware (`api/_lib/mcpAuth.ts`) is written generic so a second resource server can reuse it.

See the canonical doc for architecture, the OAuth flow, env vars, the ChatGPT connect click-path, and verification steps.
