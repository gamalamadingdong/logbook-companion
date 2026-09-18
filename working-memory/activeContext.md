# Active Context

Last updated: 2026-09-18

## Current staging slice — saved manual RowErg development publication

PR #167 merged into staging at `685535b`. The general completed-workout result page now offers an explicit Concept2 development publish action for completed, single-piece Concept2 RowErg summaries with measured distance and decisecond time. It uses the shared server-side mapper, an exact service-role database claim, and a returned-result-ID GET/readback; LC remains the source record. The shared backend migration was applied through Supabase MCP and recorded live as `20260918142512`; the development Edge Function is version 8 with JWT verification. The Git migration file was renamed to that recorded version. Vercel staging passed. Sam completed two staging-account manual publications: 7,500 m / 1,800 s became development result `86932`, and 10,000 m / 2,535 s became `86933`. Live records show one attempt and mapper version 1 for each, exact-ID readback summaries saved in LC, and untouched original LC production Concept2 fields. Further functional testing remains open. After that testing, remove the repeated weight-class and visibility prompts by using reliable connected Concept2 profile values when available or account-scoped LC settings; keep publication explicit and never assume public visibility. No production publishing or legacy production function change occurred. Other machines and interval-shaped manual entries remain LC-only until their result mappings are defined.

## Current product slice — general completed workout entry

PR #165 merged the approved [general entry design](../docs/completed-workout-entry-design.md) into staging. It adds a global activity-first manual completion flow, versioned result detail in owned `workout_logs.raw_data`, measured variable intervals with full/partial coverage, optional RWN target prefill, save/read/edit, and a dedicated LC result detail. Runs, non-Concept2 ergs, and named Other activities remain LC records. The first staging save exposed an overbroad client request guard that blocked all `workout_logs` writes; the follow-up fix permits only versioned general manual-entry saves/edits while preserving legacy Concept2 sync blocks. The plan picker/link, Concept2 publication bridge, and ErgLink capture remain later work. No migration, Edge deployment, Concept2 POST, or production enablement is part of this slice. Staging phone/desktop visual and live save/reopen checks remain pending.

## Current effort — Concept2 production-write approval readiness

The auth slice merged into staging. Sam reports deploying its migration/function, configuring the three server-side secrets, registering `https://logbook-dev.readyall.org/callback`, and successfully connecting a Concept2 development account. A genuine expired-token refresh now passes. Production retains its existing connection flow.

PR #140 merged into staging; Sam reports applying its migration and deploying the updated function. User-confirmed smoke passed: empty import, result import/re-import/reload, three LC-originated writes, exact-ID read-back and real expired-token refresh. Normal staging history still reads shared production records; development summaries use their own service-only table. Multi-page behavior remains unverified.

PRs #141 and #142 are merged into staging. The targeted development write migrations and Edge Function version 5 are live. Sam saved LC workout `f7e75f35-2dda-4a5a-87b8-bbbecf1e8013` (8455 m / 2400 s) and Concept2 development accepted exactly one POST as result `86800`. Import page 1 returned that result with the exact original LC UUID; repeat import retained one record per provider result ID and total remained two. Live publication state is `published` with `attempt_count = 1`; the original LC row's production Concept2 fields remain untouched. The initial test-entry failure was traced to an old workout-statistics trigger's unqualified table reference under the restricted function path and fixed by targeted migration `20260917130000`, verified with a rolled-back live insert. Unknown provider outcomes still cannot POST again automatically; service-only recovery records operator evidence.

The real refresh path also passed: after the development expiry was deliberately moved into the past, Sam used **Check / refresh connection** and live verification showed a fresh expiry, retained write scope, no reconnect requirement and no stuck operation.

Refreshed-token writes also produced results `86805` and `86807`; import retained one snapshot per provider ID and exact LC links. Sam then identified missing provider-side LC provenance and confusing post-success form state. Targeted migration `20260917134500` is live and adds `Logbook Companion workout ID: <uuid>` to future Concept2 comments; a rolled-back live claim verified it without leaving data or a lock. Existing results were not edited. PR #145 merged the paired form reset/status fix.

Post-fix result `86817` completed the final fixed-distance check: Concept2 displayed `Logbook Companion workout ID: 733e80e4-cfef-44c8-b851-d097fda0f432`, the form cleared after success, and import persisted five total snapshots with result `86817` linked to that exact LC UUID. Fixed-distance development writing is complete.

The [publishing specification](../docs/concept2-mobile/publishing.md) now replaces form-by-form expansion with one server-side canonical completed-workout model, pure mapper/validator, provider adapter and existing durable publication state machine. ErgLink is a capture producer: reuse its PM5 workout vocabulary, IndexedDB stroke buffer, session/participant/template/assignment provenance and raw samples, but first add stable capture identity/version, completion state, true finish/timezone, final summary, measured intervals and real aggregates. The deployed legacy production `publish-to-c2` function is not in source control and is unsafe as the foundation; audit and replace it only after the shared core is proven.
The completed-workout requirement includes the entire detailed result when available, not only summary totals: preserve versioned lossless PM5/ErgLink telemetry, derive provider-independent normalized samples/intervals, and generate Concept2 `stroke_data` as a projection. Current ErgLink buffer records must not be called one-per-stroke until PM5 sampling semantics are proven.

Sam sent the Concept2 production-write requirements inquiry to `ranking@concept2.com` on 2026-09-17; response is pending.

PR #153 merged into staging. Its frontend deployed at merge commit `1cf6443`. On 2026-09-17, the shared Supabase migration `concept2_shared_publication_core` was applied through MCP (recorded version `20260917172700`), and `concept2-development-auth` was deployed as version 6 with JWT verification on. The migration added `mapper_version` and replaced only the two development RPCs; four earlier publications remained `published` with version `0`, and both RPCs remained service-role only. A no-JWT endpoint request returned 401. The deployed legacy production `publish-to-c2` function remains untouched. Fixed-time development publication now has one provider round trip: result `86844` for LC workout `038c5e27-8220-4ff9-88cf-10555a20abe5` was published once with mapper version 1, read back through the development import, and linked by exact result ID. Concept2 displayed Fixed Time and the LC UUID comment. Repeat import refreshed the same result without a duplicate (six rows, six distinct IDs) or a second publication attempt. Fixed-time development publishing is complete for this manual test row; it is not ErgLink/PM5 capture evidence.

PRs #156–#159 merged the `CompletedWorkoutV2` interval contract, three named synthetic fixtures, mapper-generated validator JSON, Sam-reported strict Online Validator success, and the development UI/service-only fixture publishing path. The optional validator suggestions (overall stroke rate, stroke count, drag factor) remain absent because the fixtures contain no measured values. The user applied migration `20260917190000`; its live objects and service-only grants were verified, then its already-applied state was recorded in Supabase migration history. The merged `concept2-development-auth` function was deployed as version 7 with JWT verification on, and an unauthenticated request returned 401. All three synthetic interval fixtures were explicitly published to development and imported by exact ID: fixed distance `86847` / LC `a136492a-2205-41b1-8e60-2aed510d26ec`, fixed time `86848` / LC `b5d2250d-4962-4392-8317-e954420e7166`, and mixed variable `86849` / LC `1d6a4ebb-4ec0-4b5a-9169-a8df75d92386`. Sam reports that all three Concept2 interval breakdowns display correctly. Live state shows one attempt and mapper version 2 each, with original LC production Concept2 fields empty. Repeat import left nine saved development results with nine distinct IDs. The remaining approval matrix includes controlled duplicate `409` and invalid `422` evidence; future coverage explicitly includes calorie/watt-minute workout shapes and measured calorie/power data. Production publishing remains disabled; the legacy production `publish-to-c2` function remains untouched. See [interval rollout](../docs/concept2-mobile/development-interval-rollout.md).

**Resume at [Concept2 publishing handoff](../docs/concept2-mobile/resume-publishing.md).** Summary and three synthetic interval shapes now pass development publishing and exact-ID import. Next, complete controlled duplicate `409` and invalid `422` evidence, then prepare the formal production-write request unless Concept2 gives different instructions. Calorie/watt-minute workout shapes and measured calorie/power evidence are explicit later validation tracks; they are not established by the current synthetic fixtures. ErgLink capture hardening and occasional batched PM5 tests continue separately; production activation remains a later gate.


## Architecture references — Concept2/mobile

Specifications and bounded plans are in [docs/concept2-mobile/README.md](../docs/concept2-mobile/README.md), linked from the [roadmap](../docs/logbook-concept2-mobile-roadmap.md). The current handoff above governs implementation sequencing; older planning and slice documents contain historical status.

- [Publishing](../docs/concept2-mobile/publishing.md): prerequisite owned capture identity/version and completed-versus-prescribed data; preserve ErgLink origin/strokes and LC UUID through exact-ID import; manual single fixed-distance development publication first; durable claim plus explicit unknown-POST recovery, not blind retries. Concept2 production write approval is unverified.
- [Mobile delivery](../docs/concept2-mobile/mobile-delivery.md): independent Apple registration/signing/archive/TestFlight track, then signed compatible OTA and rollback. Sam confirms ScheduleBoard's GitHub Actions native pipeline and self-hosted Capgo/Vercel updates are reliable; Appflow was retired for cost and must not return. ScheduleBoard was read as reference only and not modified.
- Inspected gaps to resolve before code enablement: shared types use `erg_link_live` but reconciliation priority uses `erg_link`; current import can replace origin/raw data with Concept2 data; `publish-to-c2` is mentioned in client comments but absent from inspected functions; OAuth callback/refresh reference a browser `VITE_CONCEPT2_CLIENT_SECRET`. No secret values were read. Capture completion/final-summary semantics and live database constraints require evidence.
- Current priority is development publishing, not the mobile shell. Embedded PM5, force curves, automatic publication and broad platform/machine expansion remain deferred.

## Prior Product Focus — Support work (retained from 2026-07-09)

Support-work management is the current product slice after the training-block scheduling/config work. The intended direction is a reusable support-work library for strength, core, mobility, stretching, and similar prescriptions, without turning this into a general workout builder.

## Current Implementation State

- Added user-owned support-work library schema in `supabase/migrations/20260709165000_add_user_owned_support_library.sql`.
- Live Supabase migration was applied and verified through MCP-first checks.
- Regenerated DB types in `src/types/database.types.ts`.
- Added `<meta name="mobile-web-app-capable" content="yes" />` in `index.html`.
- Added support-work service layer in `src/services/supportWorkService.ts`.
- Added Support Work Library page in `src/pages/SupportWorkLibrary.tsx`.
- Expanded the support exercise/template seed to 120 canonical rows and added starter standard sessions in `supabase/migrations/20260709190000_seed_expanded_support_work_library.sql`.
- Wired the route in `src/App.tsx` and navigation in `src/components/Layout.tsx`.
- Fixed Vercel SPA rewrites in `vercel.json` so `/assets/*` chunk requests are no longer rewritten to `index.html`, resolving module MIME errors on production.
- Added support-work equipment compatibility filtering and family-ranked alternatives in `src/pages/SupportWorkLibrary.tsx`.
- Applied live Supabase metadata migrations through MCP for strict Landmine Press equipment, strict Weighted Pull-Up equipment, and support-work alternative families.

## Instruction Cleanup State

- `AGENTS.md` is now a real repo-local file, not a symlink into `~/apps/codex-config`.
- Repo instructions now include context budget rules, a corrected workspace map, local skill routing, and a Project Fit Check.
- `.github/copilot-instructions.md` and `.github/instructions/copilot-instructions.md` are compact mirrors that route to `AGENTS.md`, current working memory, system patterns, and matching skills only.
- `.github/skills/supabase-schema-guard/SKILL.md` now points at `src/types/database.types.ts`.
- The shared global instruction file keeps only generic behavior and the generic Project Fit Check; Logbook-specific skill routing is repo-local.

## Verified Checks

- `npm run types:supabase` passed after migration.
- `npm run build` passed after support-work compatibility and alternative-family changes.
- Supabase MCP verified new live migrations: `set_landmine_press_required_equipment`, `set_strict_required_equipment_for_weighted_pull_up`, and `set_support_work_alternative_families`.
- `npm run lint` passed with existing warnings only.
- Focused training-block tests passed.
- `git diff --check` passed.
- Copilot instruction mirrors are byte-for-byte identical.

## Current Risks And Notes

- The Support Work Library UX still needs an in-browser review before deeper product expansion.
- Support-work compatibility is intentionally metadata-light: strict equipment only for truly strict cases, and alternatives are ranked by `support_work_family`, movement pattern, and equipment profile.
- The recent production path issue was routing-related (rewrites), not data-model related; support-work data remains unchanged by the fix.
- Support-work templates should remain reusable support prescriptions. Do not add arbitrary erg workout building here.
- Next likely architecture decision: whether training-block support prescriptions should link to support-session templates directly, or whether the support library needs one more edit/review polish pass first.
- Historical working-memory and decision-log entries contain older multi-app names and paths. Treat those as historical until verified against the current filesystem and live service config.

## Next Small Step For Fresh Session

1. Confirm in-browser on both desktop and mobile that the library route is stable after the routing fix, then do a focused browser UX pass on the Support Work Library (empty state, list/detail scanning, create/edit flows, and deletion safety).
2. Make only small polish fixes from that UX pass unless a blocking data bug appears.
3. After UX polish, decide whether the next product slice should link training-block support prescriptions to support-session templates. Do not start that linking work before the UX pass.

## Ongoing Context Hygiene

- Keep future instruction additions short: routing rules and durable constraints only, not long background essays.
- Keep `activeContext.md` current-state only. Move history to `implementationLog.md` or `decisionLog.md`.
