# Isolated Concept2 development read-sync

## Scope and current state

Local implementation on `feature/concept2-development-sync`, based on staging. No new live changes. Sam reports the prior auth migration/function and three `C2_DEVELOPMENT_*` secrets are deployed, the registered callback is `https://logbook-dev.readyall.org/callback`, and the app returned connected to a development account. Actual refresh-after-expiry and this new import remain unverified live.

This slice imports **result summaries**, not a full production workout normalization pipeline. The development Sync page saves and browses one page at a time (25 results). It refreshes credentials before each import through the existing server-only auth path. The home-page production connection warning is hidden in staging and replaced with an explanatory link.

## Isolation and data contract

- Only `https://log-dev.concept2.com/api/users/me/results` is read, using the authenticated LC user's server-held development token. No caller-supplied user, environment, URL or token. Redirects and provider pagination URLs are not followed.
- New `c2_development_results` stores summaries under `(user_id, provider_user_id, result_id)`. The environment is constrained to development. Re-import updates those rows; changing linked accounts does not show the prior account's snapshots.
- New `c2_development_sync_operation` RPC is service-role-only, as is direct table access; RLS is enabled. Browser reads also go through the authenticated function. No new frontend table grants.
- Stored fields: external result ID, original provider date string, machine type, distance (metres), time (**tenths of seconds**). Extra payload fields are discarded. Display divides time by ten; dates remain provider-local strings without fabricated timezones.
- No writes to `workout_logs`, `user_integrations`, production jobs, analytics, coaching or assignment data. Staging still displays existing production history elsewhere because the database remains shared; this does not make the rest of the app an isolated sandbox.
- Explicit page progression uses validated numeric metadata. If pagination metadata is absent, a full page offers the next page; empty/short pages finish. No automatic background jobs or full-history promise. Rechecking page 1 and paging again is safe after reload; changing remote page contents can require another pass.
- Snapshots are not authoritative deletion sync: deleted/reset Concept2 development results remain stored. Provider development accounts/results may reset. Purge/reconciliation, result detail/strokes, publishing and production cutover are future work.

## Failure and concurrency behavior

The sync RPC locks the existing development credential row and uses the same operation token/mutex as auth. It refuses expired credentials, reconnect-required states and concurrent auth/import. It never reads legacy credentials. Save is atomic for the page and releases only its matching claim. The UI performs the existing refresh action before claiming each read.

A provider 401 marks the access token expired and releases the GET claim; the user retries through refresh, not an immediate repeated request. Other GET failures release only that attempt's claim. Error responses omit tokens and provider payloads. Retrying an uncertain save remains an upsert rather than a duplicate insert. A hard process termination can leave the conservative non-expiring mutex pending; stop and use operator recovery from [the auth runbook](staging-auth-slice.md), never clear a lock on a timer. Verify the worker has stopped before clearing its exact claim; unlike refresh, a results GET cannot rotate provider credentials.

## Rollout — approval required on shared Supabase

1. Confirm target project, installed `c2_development_auth` schema/RPC, grants, and function version using Supabase MCP/live inspection. **No MCP tools were available during this implementation; local migrations are not evidence of current live schema.** Record current auth function deployment/source and a rollback handle without exporting credentials.
2. Review/apply only `supabase/migrations/20260916160000_concept2_development_results.sql` after the prior auth migration. Do not blindly apply unrelated migration history. Regenerate database types from verified live schema afterward; this slice uses the Edge Function RPC boundary, not frontend generated-table access.
3. Redeploy `concept2-development-auth` including `handler.ts`, `results.ts`, and `index.ts`, retaining its existing reviewed gateway/auth configuration. The handler continues to validate Supabase bearer authentication and the configured origin itself. No new secrets; production functions/settings stay unchanged. Old staging frontend remains compatible with the extended function.
4. Merge the frontend change into staging after backend readiness. Do not promote to main yet.
5. Run the smoke checklist below; record results, not assumed success.

Rollback: redeploy the auth-only function from PR #139 and revert the staging frontend to its prior deployment. Leave the unused development results table/RPC in place (no production readers); preserve snapshots rather than dropping data. If a read worker died, recover its exact claim only after verifying it is no longer running. Never remove or reset production data/credentials.

## Live acceptance checklist

Operator-confirmed smoke evidence: Sam applied the migration and deployed the updated function after PR #140 merged into staging. Empty-account import returned zero without errors. After adding a development workout, import displayed result `86742`, `2026-09-16 00:00:00`, rower, 5000 m, 1200 seconds. Re-import retained exactly one saved result, and Sam confirmed persistence after reload. These are user-observed live results, not an independently inspected browser or database session.

- [ ] Unauthenticated requests rejected; a second LC user cannot retrieve the first user's development snapshots.
- [x] Empty and nonempty import: operator confirmed the test workout's ID, date, distance and time.
- [x] Re-import unchanged page: count stays at one; reload preserves the result.
- [ ] Edit a provider summary and verify re-import updates it.
- [ ] Import another page if available and browse saved pages.
- [ ] Check / refresh then import; separately exercise a genuinely expired token before claiming refresh rotation verified.
- [ ] Provider failure and concurrent clicks return clear errors without duplicates or production fallback.
- [ ] Compare production connections and workout counts before/after, without displaying credential values.
- [ ] Staging dashboard no longer says production connection lost; production dashboard behavior stays unchanged.

## Local verification

- Full Vitest suite: 446 tests passed (including 15 new read-sync tests).
- Disposable PostgreSQL fixture: both development migrations compile; table/RPC access denied to anon/authenticated; repeated import idempotent; user/account boundaries; eight concurrent imports yield one claim; refresh blocked during import; stale release rejected; expired-token import blocked; production sentinel unchanged. This is not a full live Supabase test.
- Existing production sync Node contract tests: 2 files pass.
- Lint and Deno function type check pass; staging build and bundle isolation scan pass. Existing build chunk-size warnings remain.
- Implementation-time checks did not include a live deployment or browser import. Subsequent operator-confirmed live smoke evidence is recorded above; unchecked live acceptance items remain unverified.

Official API pagination reference inspected: [Concept2 documentation](https://log.concept2.com/developers/documentation/) (`number`, 1-based `page`, `meta.pagination`).
