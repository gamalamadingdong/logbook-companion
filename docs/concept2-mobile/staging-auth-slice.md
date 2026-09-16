# Concept2 development auth slice — local implementation, not deployed

## Scope and branch

`feature/concept2-staging-auth` was created from freshly fetched `origin/staging` (`b409ef6`). Local `main` and its unpushed setup-notes commit `92471af` were preserved, not cherry-picked. The setup checklist and newer active context were read directly from that commit. No commit, push, PR, deployment, live migration, secret change, or provider account mutation was performed. Intended eventual PR base: **staging**, not main.

This slice connects a development Concept2 account, keeps exchange/refresh credentials on the server, and reports connection state. **Development read-sync and publishing are disabled.** Mobile and production auth replacement are not implemented.

## Traced paths and isolation

- OAuth launches: Layout, CommandPalette, OnboardingWizard, Dashboard, Sync; all now use one environment-aware launcher. ReconnectPrompt routes to Sync.
- Callback: development calls authenticated `concept2-development-auth`, strips callback query parameters, and does not put tokens in browser storage. Production retains its prior callback behavior.
- Browser refresh/API: original implementation moved unchanged except for a defensive guard to `concept2Legacy.ts`; a facade excludes that module entirely from staging bundles. Read/detail/stroke/export callers, AutoSync and dashboard consumers cannot reach production through that facade.
- AuthContext: staging does not restore/backfill `user_integrations` tokens and removes stale C2 local-storage keys.
- Manual/background sync: `useConcept2Sync` and `startC2SyncJob` reject staging. `/sync` renders a development connection panel instead of the legacy tools. Supabase client transport additionally denies legacy integration/job access, legacy sync/publish function invocation, and workout analytics writes in staging.
- Existing shared server jobs: `start-c2-sync` and `run-c2-sync-batch` still use production `user_integrations`, production provider URLs and production workouts. They are deliberately unchanged; they cannot discover the separate development table. Development tokens are never copied into that table. Existing queued production jobs are untouched.
- The new table is development-only, service-role-only, RLS enabled with no client policies. It does not reference/write workout tables. Provider identity has a uniqueness constraint: one LC owner per development Concept2 account. Development and legacy production provider IDs may overlap safely.

Client transport guards prevent accidental application paths; they are **not** a replacement for RLS or a general sandbox for the shared database. The same signed-in LC user still has their existing production permissions through other clients. This auth-only slice does not claim full app/database tenant separation.

## Auth protocol

Server configuration chooses the single allowed origin and callback, provider is fixed to `https://log-dev.concept2.com`, and request environment/URL/user/token overrides are rejected. The caller must have a Supabase user verified by `auth.getUser(jwt)`; CORS alone is not authorization.

State is cryptographically random, stored as a SHA-256 hash, user-bound and intrinsically development-bound, with a ten-minute TTL. A row lock consumes it and claims exchange atomically. Exchange fetches `/api/users/me` server-side and saves the verified development identity. Only status/identity is returned. Scopes are `user:read,results:read`; write consent and publishing are intentionally deferred. Refresh does not request a changed scope.

The database provides one durable operation claim per account and generation-fenced saves/rejections. No timeout automatically steals a refresh lock: network ambiguity, malformed provider responses, identity lookup failure or save failure leave it pending. Explicit `400 invalid_grant` invalidates credentials and permits reconnect. All other failures are sanitized, with no provider payload/token/code logging or automatic retry.

## Operator rollout gate — not authorized by this implementation

1. Inspect the actual shared Supabase project `vmlhcbkyonemmlawnqqr` through approved MCP: schema/ledger, new-name collisions, roles/default grants/RLS, legacy token access and function configuration. **MCP was unavailable in this tool session**, so live schema, advisors and migration state were not verified. Local generated types are not evidence of live state and were not falsely regenerated.
2. Confirm hostname/DNS/HTTPS and Vercel custom-target metadata. `logbook-dev.readyall.org` remains only a **candidate** (test fixture), not a configured default. `C2_DEVELOPMENT_ORIGIN` is mandatory and is the single exact server allowlist entry. It must be a clean HTTPS origin with `logbook-dev.` hostname prefix, no path/port/credentials, or local test origin `http://localhost:5173`. A different naming scheme needs an explicit reviewed validator change. Do not set a production origin.
3. Register the exact `<confirmed-origin>/callback` on the **development** OAuth application and confirm development account/client access. Configure only the new server names `C2_DEVELOPMENT_CLIENT_ID`, `C2_DEVELOPMENT_CLIENT_SECRET`, `C2_DEVELOPMENT_ORIGIN`; Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No fallback to production variable names exists. Do not put development secrets in VITE variables.
4. Obtain separate approval for additive migration `20260916150000_concept2_development_auth.sql`, new function deployment and new server configuration. Apply only the reviewed migration, not a blind push of historical migrations. Deploy only `concept2-development-auth`; keep its JWT gateway verification enabled and its in-handler `getUser` verification. Do not alter legacy functions or production credentials.
5. Build staging with correct Vercel metadata: legacy production is enabled only for `VERCEL_ENV=production`, production/absent `VERCEL_TARGET_ENV`, and main/absent git ref. Custom targets/staging branches/default local builds fail closed. Review imported staging variables and remove copied production C2 credentials; current production variables remain untouched. Confirm Vercel exposes system build variables.
6. After approval, smoke-test missing config/auth, wrong origin, denied consent, cross-user/replayed callback, connection, refresh and two-tab concurrency. Inspect only sanitized status. Verify browser requests/storage contain no C2 tokens and no production provider traffic; verify no development workouts were inserted. No real OAuth round trip has yet been run.
7. Follow-on read-sync must consume the server-held token under the same claim mechanism and write to explicitly environment-scoped workout/result storage with matching query/analytics isolation. Do not pass tokens to the browser or re-enable the legacy sync jobs for development. Production secret rotation belongs after a separate server-auth cutover; existing exposed VITE secret remains a known production risk.

## Rollback and pending-operation recovery

First disable/remove the new function's configuration (fails closed); do not roll staging back to a version that can reach production Concept2. Leave the additive table/RPC in place unless reviewed removal is necessary. Legacy production is unaffected. Approved full removal, after disabling traffic and deciding whether development connections must be retained: drop `public.c2_development_auth_operation(uuid,text,jsonb)` then `public.c2_development_auth`. This discards development connections only; never drop/change `user_integrations` or workout tables.

For a pending operation, stop development auth traffic, ensure every prior worker has terminated, review the sanitized operation ID/start time and provider outcome, then explicitly invalidate the development row's tokens/state/claim and require new consent. Never merely expire/steal the lock or retry its old refresh token. No automated operator reset endpoint is exposed. Keep an audit record without credentials. Development-provider resets and account relinking are operator concerns in this bounded slice.

## Verification evidence

- `npm run test:run -- src/services/concept2Auth.test.ts src/utils/concept2SyncRange.test.ts`: **27 tests pass** (19 auth/isolation + 8 range).
- `node --test tests/start-c2-sync-contract.test.ts tests/run-c2-sync-batch-contract.test.ts`: **2 contract files pass**.
- `python3 scripts/test_c2_development_auth.py`: disposable network-isolated PostgreSQL 16, real migration applied; anon/authenticated table/RPC denied, state ownership/mismatch/missing/TTL/replay, fenced writes, account/environment constraints, **8 concurrent refresh calls yield 1 claim**, no stale-lock stealing, revoked-token reconnect tested. Fixture auth schema is not a Supabase full-stack/live-schema test.
- `deno check supabase/functions/concept2-development-auth/index.ts`: passes.
- `npm run lint`: passes with existing warnings (includes pre-existing worktrees); no errors.
- `npm run build`: passes. Also built production metadata with synthetic sentinel credentials to verify legacy production chunk remains; custom staging metadata with inherited sentinel credentials builds without that chunk. `python3 scripts/check_c2_staging_bundle.py` verifies no sentinel, production OAuth/API endpoint or legacy refresh module in staging assets. No real credential values inspected or printed.
- Build emits existing large-chunk warnings. Browser UI smoke and real provider exchange remain unverified; browser harness could not attach to a running Chromium instance.

Official endpoint evidence fetched from [Concept2 documentation](https://log.concept2.com/developers/documentation/): it identifies `https://log-dev.concept2.com` as development, `/oauth/authorize`, `/oauth/access_token` and the user API. The docs warn development users/results can reset. Vercel target handling references its [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables). No authenticated provider requests were made.
