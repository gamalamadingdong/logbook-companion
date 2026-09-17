# Resume: Concept2 development publishing

## Where we stopped

Concept2 is effort #1; native mobile is deferred. Development auth, isolated import, bounded LC test entry and manual publishing are deployed in staging. The first LC-originated development write and exact-ID read-back round trip passed as result `86800`.

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

Initial read smoke, user-observed:

1. Development OAuth returned connected to account `2266`.
2. Empty-account import returned zero with no errors.
3. Sam created one workout in Concept2 development, then imported it: result `86742`, `2026-09-16 00:00:00`, rower, 5000 m, 1200 seconds.
4. Re-import retained exactly one saved result.
5. Reload preserved that result.

This established the basic read path and persistence. The later write evidence below closes the earlier "no LC-originated publication" and publish-and-reimport linkage gaps for the first bounded fixed-distance shape.

### First live development write — 2026-09-17

1. Sam saved LC workout `f7e75f35-2dda-4a5a-87b8-bbbecf1e8013`: completed manual row, 8455 m, 2400 seconds, RWN `8455m`.
2. The initial save exposed an existing `workout_logs` statistics trigger using an unqualified `user_profiles` reference under the new function's restricted search path. Targeted migration `20260917130000` fixed that function path; a rolled-back live insert verified the repair before Sam retried.
3. Concept2 development accepted exactly one POST and returned result `86800`.
4. Live LC verification shows publication status `published`, `attempt_count = 1`, and the exact original LC workout ID. The original row's production `external_id` and `c2_published_at` remain null as intended.
5. Import page 1 saved two development results and returned result `86800` with `lc_workout_id = f7e75f35-2dda-4a5a-87b8-bbbecf1e8013`. A repeat import retained one row per provider result ID; total remained two (`86800` plus older result `86742`).
6. Live read-contract verification independently returned exactly those two summaries, with result `86800` linked to the original LC UUID and result `86742` unlinked as expected.
7. The development token expiry was deliberately moved into the past after recording a rollback value. Sam clicked **Check / refresh connection**; live verification showed a fresh expiry more than 30 minutes ahead, retained `user:read,results:write`, no reconnect requirement and no stuck operation. The real rotating refresh-token path passed.
8. Additional refreshed-token writes succeeded as development results `86805` and `86807`; import returned four total provider results with each LC-originated result linked to its exact LC UUID and no duplicate snapshots.
9. Sam identified two follow-ups: Concept2 itself lacked visible LC provenance, and the completed form immediately presented the already-published row as a validation problem. Migration `20260917134500` now adds `Logbook Companion workout ID: <uuid>` to the outgoing Concept2 `comments` field for future writes. A live rollback claim verified the exact payload and left no row, publication or lock. Existing results `86800`, `86805` and `86807` were not silently modified. The staging UI now clears completed fields and presents any reselected published row as status rather than a new-attempt error.
10. The post-fix live write produced result `86817` for LC workout `733e80e4-cfef-44c8-b851-d097fda0f432` (2000 m / 480 s). Concept2 visibly displayed the exact LC UUID in its comments, the staging form cleared after success, and import returned five total snapshots with result `86817` linked to the same LC UUID. This closes fixed-distance development write validation.

Local verification at the import slice: 446 Vitest tests, disposable PostgreSQL permission/idempotency/concurrency/isolation tests, two production sync contract files, lint, Deno type check, staging and production builds, and staging bundle-isolation scan passed. See [read-sync handoff](development-sync-slice.md).

## Current local continuation (2026-09-16)

PRs #141 and #142 are merged into staging. The server-owned action publishes one owned completed fixed-distance manual row using measured distance/work time, completion date, weight class, privacy and explicit confirmation; it never accepts provider URLs, account IDs or tokens from the browser. A development-only publication table records the attempt before POST. Unknown outcomes remain blocked pending evidence-based service-only operator resolution. Definite provider rejections may be retried with a new fenced attempt after correction; 401/403 also clear the invalid connection and require reconnect. A known result ID is projected into saved development summaries as `lc_workout_id`; the original LC row and its production Concept2 fields are untouched.

Read-only live inspection found no `erg_link_live` workout rows, and there is no general direct manual-entry UX. The staging slice therefore adds a tightly bounded development-only form that saves one authenticated, owned, completed fixed-distance row through the Edge Function before publication. It does not reopen general staging writes or recycle production Concept2 results. The saved row remains an ordinary LC manual workout with RWN matching its measured meters, positive measured work time and no rest.

Verification: 457 Vitest tests; disposable PostgreSQL permission, ownership, bounded manual-entry, write-scope, single-dispatch, exact-ID link, definitive-rejection retry, reconnect and unknown-outcome recovery checks; Deno type check; staging and production builds; staging bundle isolation scan; lint with no errors. On 2026-09-17 five targeted migrations were applied and recorded, and Edge Function version 5 was deployed. Both new RPCs remain service-only. Multiple fixed-distance writes, exact-ID import, repeat-import idempotency, real expired-token refresh, provider-side LC provenance and clean post-success form reset pass live. Fixed-distance development writing is complete. Use the official API snapshot to choose the next result shape deliberately rather than broadening several payload classes at once. Rollback of application/function code does not remove published Concept2 results; additive tables/columns can remain.

PR #153 merged into staging at `1cf6443`; its frontend deployed successfully. The first shared-core slice includes versioned `CompletedWorkoutV1`, server-only manual row normalization, pure fixed-distance/fixed-time payload mapping, mapper-versioned durable payload snapshots and a thin fixed-time development selector. Fixed distance retains its proven payload. Fixed time passes strict Online Validator checking as `FixedTimeSplits` for 30:00 / 7,321 m. On 2026-09-17, the shared Supabase migration was applied through MCP as version `20260917172700`, and `concept2-development-auth` version 6 was deployed with JWT verification on. Focused post-merge checks passed: 36 Vitest tests, Deno check and the disposable PostgreSQL publication suite. The live endpoint rejected a no-JWT request with 401. No fixed-time development POST/read-back/re-import has occurred.


## Agreed next phase

Stop adding workout-type logic to the manual test form. Use [publishing.md](publishing.md) as the authoritative revised plan:

1. Send Concept2 a requirements inquiry now: summarize the proven fixed-distance flow and ask what additional development shapes or Online Validator evidence they expect.
2. Freeze the proven fixed-distance payload/state behavior and audit the deployed, unsourced production `publish-to-c2` function without redeploying it.
3. Define one versioned completed-workout publication model and extract a pure mapper/validator/provider adapter; route fixed distance through it unchanged.
4. Complete the device-free approval matrix: fixed time, fixed-distance intervals, fixed-time intervals and variable intervals, plus `409` duplicate and `422` invalid behavior. Run interval payloads through the Online Validator and development POST/read-back/re-import.
5. Submit the formal production-write request with the evidence; permission does not activate production writes.
6. While waiting, harden ErgLink capture separately: stable capture ID/version, completion state, true finish/timezone, final summary, measured intervals, aggregates and retry-safe IndexedDB persistence.
7. Add real PM5 evidence and richer aggregate/stroke capabilities when device access permits. Keep unsupported evidence blocked rather than flattened.
8. Replace the legacy production publisher with a source-controlled wrapper around the proven core only after Concept2 production approval and a separate operator gate.

ErgLink remains a capture producer, not a Concept2 client. Reuse its PM5 workout vocabulary, local stroke buffer, session/participant identity and assignment/template provenance. Do not reuse upload-time completion, last-stroke “averages,” or prescription as proof of completion.

## Testing agreement

Use three separate layers:

1. **Local contract tests:** all supported shapes/fields, unit conversions, evidence validation and provider failure categories.
2. **Disposable database/reliability tests:** ownership, fencing, refresh, retries, unknown outcomes, exact-ID linkage and provenance preservation.
3. **Gated development conformance:** representative named fixtures or real consented captures published sequentially to Concept2 development, read back and re-imported. The approval matrix uses device-free synthetic canonical fixtures labeled as such and does not run automatically in ordinary CI.

Testing the provider specification does not mean implementing every endpoint. Create/read-back is required; update/delete/bulk/webhook and trusted verification remain out of scope until an LC product requirement and provider approval exist.

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
