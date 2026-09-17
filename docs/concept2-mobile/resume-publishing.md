# Resume: Concept2 development publishing

## Where we stopped

Concept2 is effort #1; native mobile is deferred. Staging auth and isolated summary import are implemented and merged. The development write schema and Edge Function are deployed; the staging UI change is awaiting merge/release. No provider POST or full round trip has occurred.

- Repository: `~/apps/logbook-companion`.
- Checked-out branch at handoff: `staging`, matching `origin/staging` at `973b675` (PR #140). Re-check before work.
- PR #139 added server-side development OAuth and credential isolation; PR #140 added isolated manual summary import and staging dashboard messaging.
- Sam reports applying both slices' migrations and deploying the updated `concept2-development-auth` function.
- Staging: `https://logbook-dev.readyall.org`, Vercel Custom Environment tracking `staging`; deployment protection may require login.
- Registered development callback: `https://logbook-dev.readyall.org/callback`.
- Sam configured `C2_DEVELOPMENT_ORIGIN`, `C2_DEVELOPMENT_CLIENT_ID`, and `C2_DEVELOPMENT_CLIENT_SECRET` in Supabase Edge Function secrets. Do not read/print values or put them in browser variables.
- **Shared live Supabase project:** staging is not a separate database sandbox. Existing production history is visible in staging; new development imports use their own service-only table.
- Production still uses the legacy connection path, including its existing Production-only `VITE_CONCEPT2_CLIENT_ID` / `VITE_CONCEPT2_CLIENT_SECRET`. Do not remove/rotate these until the server-side production cutover is explicitly prepared. Their exposure in frontend builds is known technical debt, not an acceptable final design.
- This handoff and smoke-evidence edits are local documentation changes, not yet committed. Preserve them when branching. The local `main` setup-note commit from the earlier session must also be preserved; inspect Git rather than resetting branches.

## What actually worked live

User-observed, not independently inspected by the agent:

1. Development OAuth returned connected to account `2266`.
2. Empty-account import returned zero with no errors.
3. Sam created one workout in Concept2 development, then imported it: result `86742`, `2026-09-16 00:00:00`, rower, 5000 m, 1200 seconds.
4. Re-import retained exactly one saved result.
5. Reload preserved that result.

This establishes the basic read path and persistence, not full production readiness. The test workout originated in Concept2; it is **not** proof of an ErgLink/LC-originated capture or a publish-and-reimport identity link.

Local verification at the import slice: 446 Vitest tests, disposable PostgreSQL permission/idempotency/concurrency/isolation tests, two production sync contract files, lint, Deno type check, staging and production builds, and staging bundle-isolation scan passed. See [read-sync handoff](development-sync-slice.md).

## Current local continuation (2026-09-16)

On `feature/concept2-development-publishing`, the development write backend is deployed and the staging UI is awaiting release. The server-owned action publishes one owned completed fixed-distance manual row using measured distance/work time, completion date, weight class, privacy and explicit confirmation; it never accepts provider URLs, account IDs or tokens from the browser. A development-only publication table records the attempt before POST. Unknown outcomes remain blocked pending evidence-based service-only operator resolution. Definite provider rejections may be retried with a new fenced attempt after correction; 401/403 also clear the invalid connection and require reconnect. A known result ID is projected into saved development summaries as `lc_workout_id`; the original LC row and its production Concept2 fields are untouched.

Read-only live inspection found no `erg_link_live` workout rows, and there is no general direct manual-entry UX. The staging slice therefore adds a tightly bounded development-only form that saves one authenticated, owned, completed fixed-distance row through the Edge Function before publication. It does not reopen general staging writes or recycle production Concept2 results. The saved row remains an ordinary LC manual workout with RWN matching its measured meters, positive measured work time and no rest.

Verification: 455 Vitest tests; disposable PostgreSQL permission, ownership, bounded manual-entry, write-scope, single-dispatch, exact-ID link, definite-rejection retry, reconnect and unknown-outcome recovery checks; Deno type check; staging and production builds; staging bundle isolation scan; lint with no errors. On 2026-09-17 the three targeted migrations were applied and recorded, and Edge Function version 5 was deployed. Live verification found three write-scope columns, an empty publication table, an empty publication history, and service-role-only access to both new RPCs. No reconnect or provider POST was attempted. Next: release the staging UI, reconnect for development write scope, save one completed test row, publish once and import it. Rollback of application/function code does not remove published Concept2 results; additive tables/columns can remain.


## Agreed next slice

Implement **manual publication of one eligible, completed fixed-distance rowing workout to Concept2 development**, then link its imported representation back to its original LC identity. Use [publishing.md](publishing.md) as the specification, bounded by this current sequencing decision.

1. Inspect current auth, import, capture contracts and schema. Confirm the official Concept2 development POST schema and error/duplicate semantics; do not assume an idempotency-key API exists.
2. Establish the smallest owned, stable completed-workout identity and valid mapping for one supported workout shape. Use actual completed data, not prescription alone; reject unsupported or incomplete workouts visibly. Inspect existing `workout_logs`/ErgLink contracts before inventing another model.
3. Define development-only publication state and exact-result-ID linkage. Do not attach development result IDs to production Concept2 ID fields or let production reconciliation consume them. Preserve origin, LC UUID, strokes, notes and assignment links. The current development summary table is an isolated snapshot store, not already-completed canonical workout reconciliation.
4. Add development `results:write` authorization and an explicit reconnect path. Deployed authorization requests `user:read,results:read`; existing tokens cannot acquire write permission by refresh alone. Sam will reconnect after the updated code is deployed. No speculative new credentials are needed now; actual write access remains to be confirmed.
5. Add a server-owned manual publish action. Authenticate and authorize ownership, reload canonical data, validate payload, persist an attempt before POST, serialize concurrent requests and record the returned result ID. Do not expose tokens or accept caller-supplied provider URLs/user IDs.
6. Handle the critical ambiguous outcome: Concept2 may accept POST while LC loses the response. No blind POST retry. Use supported reconciliation evidence if available; otherwise retain an explicit unknown/review-required state. Do not claim exactly-once delivery based on local status alone.
7. Add minimal staging UI for eligibility, publish status, reconnect and recovery. Keep unsupported actions disabled with clear explanations.
8. Run focused automated checks and document rollout/rollback. Prepare a PR targeting **staging**, not main, following user authorization for publication of the branch. Human merges; no auto-merge.

A new server function or extension of the current development function should follow the simplest existing pattern. Avoid a general multi-provider job framework or redoing the mobile plan. If eligible capture data is unavailable, identify that exact missing input rather than fabricating a successful publish.

## Testing agreement — avoid repeated manual ceremonies

Sam wants stability, but explicitly agreed to complete write capability before a broader manual end-to-end pass. **Do not gate starting the write slice on repeating read smoke tests or completing the entire previous live checklist.**

Keep meaningful automated tests during implementation: ownership, environment boundaries, units/payload validation, idempotency/concurrency and uncertain publish outcomes. Once the loop exists, test together:

`durable LC workout → manual development publish → development sync → same LC identity with original rich data retained`

At that point cover reconnect/write scope, genuinely expired-token refresh, pagination, repeat publish/re-import, provider/DB failures, and absence of production contamination. Pending manual tests are deferred, not waived or claimed passed. No promotion to production before this verification and Concept2 production write approval.

## Starting files and commands

Read `AGENTS.md`, `working-memory/activeContext.md`, `working-memory/systemPatterns.md`, this handoff, and `publishing.md`; load relevant repo-local Concept2/schema/migration/Edge Function skills. Use Supabase MCP first for live schema inspection if available. Prior implementation lacked MCP; disposable SQL fixtures are not live schema proof.

Code entry points:
- `supabase/functions/concept2-development-auth/{handler,index,results}.ts`
- `supabase/migrations/20260916150000_concept2_development_auth.sql`
- `supabase/migrations/20260916160000_concept2_development_results.sql`
- `src/services/concept2Auth.ts`, `concept2Environment.ts`
- `src/pages/DevelopmentConcept2.tsx`
- `src/types/ergSession.types.ts`, `src/services/workoutService.ts`, `src/utils/reconciliation.ts`
- `src/services/concept2Auth.test.ts`, `concept2DevelopmentSync.test.ts`

Checks to reuse/extend:
- `npm run test:run`
- `npm run lint`
- `python3 scripts/test_c2_development_auth.py` (Docker, disposable local PostgreSQL only)
- `node --test tests/start-c2-sync-contract.test.ts tests/run-c2-sync-batch-contract.test.ts`
- `deno check --no-lock supabase/functions/concept2-development-auth/index.ts`
- `VERCEL_ENV=preview VERCEL_TARGET_ENV=staging VERCEL_GIT_COMMIT_REF=staging npm run build`
- `python3 scripts/check_c2_staging_bundle.py` (after the staging build)
- `VERCEL_ENV=production VERCEL_TARGET_ENV=production VERCEL_GIT_COMMIT_REF=main npm run build`
- `git diff --check`

## Working style and approval boundaries

Work directly in the foreground for this single task; do not delegate the entire effort and leave Sam waiting for status. Provide brief meaningful progress updates and surface blockers. Avoid another broad planning document or per-task review ceremony.

Branch from current staging, preserve unrelated/local edits, and keep production unchanged. Live migrations/functions touch shared infrastructure: stage the exact change and rollback, inspect compatibility, and obtain approval before applying. Do not expose secrets, alter existing credentials, email Concept2, merge PRs, or publish real production workouts without authorization. This documentation task itself makes no new deployment changes.
