# Concept2 Publishing Implementation Plan and Specification

> **For agentic workers:** Use `executing-plans` or `subagent-driven-development` when authorized to implement, task-by-task. Checkboxes below are future work, not completed validation.

**Goal:** Manually publish one eligible, durably saved fixed-distance rowing workout to Concept2 development and re-import it without duplication or loss of origin.

**Architecture:** LC owns the workout and a small Concept2-specific publication record. A server-side Supabase Edge Function owns authorization, mapping and the remote POST; ordinary imports resolve exact publication links before legacy fuzzy reconciliation.

**Tech stack:** Existing React/Vite/TypeScript, Supabase/Postgres/Edge Functions, Vitest and Concept2 OAuth/API. No new generalized synchronization framework.

## Global constraints

- Preserve LC row identity, `source = erg_link_live`, original raw capture/strokes and template/assignment links. Publication is a reference, not an origin upgrade.
- Only the authenticated owner can publish their completed workout to their connected Concept2 account. Anonymous/coached attribution is a prerequisite, not permission to publish on someone else's behalf.
- First slice is a completed fixed-distance row only, explicitly requested by the user, normal/unverified, development-only until production approval. Reject unsupported/incomplete shapes; do not flatten them.
- No remote edits/deletes, automatic retries after uncertain POSTs, automatic publishing, force curves or native PM5 implementation.
- All database changes require current schema/RLS discovery with the local guards and MCP-first workflow. This plan does not assert the live schema matches generated types.

## Existing surfaces and specific gaps

| Read before implementation | Observed behavior / implication |
|---|---|
| [ErgLink types](../../src/types/ergSession.types.ts) | `ActiveWorkoutSpec` is prescription; `ErgLinkUploadMeta` carries session/participant IDs and strokes but no explicit capture version/ID or final-summary contract. Column comments use elapsed time and last-stroke SPM/watts. These are not proof of actual work time or true averages. |
| [Reconciliation](../../src/utils/reconciliation.ts), [sync hook](../../src/hooks/useConcept2Sync.ts) | Utility priority uses `erg_link`, whereas shared types use `erg_link_live`. Sync applies broad fuzzy matching, sets `source: concept2`, stores provider raw data, and can reuse a matched row ID. Existing-ID skipping also needs review. This is unsafe as the write-back round-trip policy. |
| [Workout service](../../src/services/workoutService.ts) | Supports `external_id` and raw-data reads that assume Concept2 shapes in some paths. Preserve rich original capture while keeping detail/stroke rendering compatible. |
| [Concept2 client](../../src/api/concept2.ts), [callback](../../src/pages/Callback.tsx) | Browser code references `VITE_CONCEPT2_CLIENT_SECRET`, refreshes with read scopes, persists browser/DB tokens and uses only browser-local refresh coordination. A comment mentions future `publish-to-c2`; no such function exists in the inspected functions directory. |
| [Schema reference](../../working-memory/concept2_schema.md), [API types](../../src/api/concept2.types.ts) | Useful mapping references, not evidence of accepted uploads or production approval. |
| [Server sync batch](../../supabase/functions/run-c2-sync-batch/index.ts), [sync starter](../../supabase/functions/start-c2-sync/index.ts) | Include server import entry points in exact-ID/provenance review; fixing browser sync alone is not enough. |

## Prerequisites and decisions to close

1. **Provider access:** operator confirms development OAuth app/callback, connected development account, granted `results:write`, applicable privacy and weight-class fields. Requested scope is not evidence of granted scope; refresh cannot upgrade consent. Confirm current [Concept2 documentation](https://log.concept2.com/developers/documentation/) and validator requirements before API work. Production/trusted-client approvals are unknown.
2. **Actual capture evidence:** obtain one consented/redacted completed fixed-distance capture and one aborted/incomplete capture. Establish actual PM summary availability, work/rest/elapsed meanings, finish timestamp/timezone, distance rounding, and whether the upload survives restart. Never generate a fixture and label it a real capture.
3. **Identity:** choose a stable capture ID generated once and retained across upload retries, scoped to the authenticated athlete; add a capture contract version. Session/participant IDs alone must not collapse multiple workouts. Resolve null-owner legacy rows through a verified ownership flow before eligibility, not a client-supplied `user_id`.
4. **Storage decision:** prefer one Concept2-specific publication table over many mutable raw JSON fields. Verify actual `external_id` constraints and choose how to mirror known IDs for existing readers. Development and production result IDs/account tokens must be isolated. Record the chosen migration and import rule before enabling POST.
5. **OAuth safety:** move confidential exchange/refresh to server-side code, bind authorization state to user and environment, validate return destinations, and coordinate refresh per account across browsers/workers. Do not package a `VITE_*` secret into web/native bundles. Assess deployed exposure and operator-led rotation separately; this inspection did not access credentials.

## Completed-workout and mapping specification

The minimal contract needs capture ID/version, owned LC workout ID, source, completion status (`completed`, `aborted`, `incomplete_capture`), machine type, actual finish instant plus original timezone, measured work distance/time and retained prescription references. The owner comes from authenticated persistence, not untrusted request data. Store the original measured input; use a versioned immutable payload snapshot for each publication attempt.

Eligibility requires an owned durable row, actual completed fixed-distance rowing evidence, positive finite measured distance/work time, known time convention, required profile fields, and no existing/uncertain publication for the target account/environment. Legacy rows missing final-summary evidence remain ineligible until safely resolved. An athlete stopping early has not completed the prescribed piece even if the RWN still says `5000m`.

| Destination | First-slice rule |
|---|---|
| `type` | `rower` only. |
| `date`, `timezone` | Actual workout end, formatted under the provider's verified date contract with recorded timezone; test DST and UTC boundary cases. Do not substitute upload time. |
| `distance`, `time` | Actual work meters and work time in deciseconds. Define rounding once in the mapper and test boundaries; do not use rest-inclusive elapsed time. |
| `workout_type` / splits | Confirm the accepted fixed-distance representation with development/validator evidence. Do not manufacture split records from a prescription; block release if the selected shape requires unavailable measured splits. |
| `weight_class`, `privacy` | Explicit account/user-confirmed values under current API requirements; no inferred athlete weight class or silently public default. |
| Optional SPM/HR/watts/rest | Omit unsupported/unreliable fields; never send final-stroke values as session averages. First no-rest slice does not need interval conversion. |
| Strokes, targets, verification | Omit stroke/interval/target richness until separately validated; omit trusted verification claims. Preserve strokes locally regardless. |

## Publication state and failure contract

Proposed durable identity: unique `(owner, workout, Concept2 account, environment)` publication, plus unique remote ID scoped to account/environment when known. Store mapper version, payload snapshot/hash, workout revision, attempt ID/generation, lease times, state, remote ID, timestamps and sanitized failure category. The hash is an internal consistency check, not a provider idempotency key.

| State | Meaning / permitted next action |
|---|---|
| `not_requested` | No publication; validate before claim. |
| `pending` | Validated request durably recorded; may be claimed once. |
| `publishing` | One atomic claim/generation owns the attempt. Persist a dispatch marker before the remote POST. |
| `published` | Remote result ID committed to the publication and linked LC row; repeat requests return this existing result without POST. |
| `failed` | Definitively rejected/not dispatched. Show validation/reconnect/retry guidance appropriate to the category. |
| `outcome_unknown` | POST may have succeeded; disable Publish/Retry and enter reconciliation/operator review. |

Use a database transaction/conditional claim to prevent double-click and multi-device races. Fenced writes must match attempt generation so a stale worker cannot overwrite a newer state. A stale claim before any dispatch marker may be reclaimed; after the marker it is conservatively unknown even if the process actually died before sending. Timeout, disconnect, malformed success response, remote acceptance followed by local save failure, or an unproven provider 5xx are unknown, not ordinary retryable failures.

Recovery is **not** exactly-once guaranteed by a local lock. If a verified provider lookup can identify the accepted result, validate account/environment and measured identity, then link the remote ID without POST. Attribute similarity alone is not a unique identifier; multiple candidates require review. Until a dependable lookup/correlation mechanism is demonstrated, use explicit operator review in Concept2 and an audited link action. No result seen immediately is not proof of non-acceptance. A reset for resubmission requires evidence of non-acceptance or explicit informed duplicate-risk resolution; do not release a blind retry button. Record who resolved the case, evidence and remote ID, excluding tokens.

Edits after publication are local-only in this slice: display divergence from the published snapshot and do not automatically republish. Remote deletion is likewise not propagated; retain link history and surface unavailable remote results. Disconnecting/replacing the account must not silently change an existing publication's target identity.

## Implementation tasks

### P1 — Establish safe owned input and server auth

**Files:** modify `src/types/ergSession.types.ts`, `src/pages/Callback.tsx`, `src/api/concept2.ts`; inspect OAuth entry points in `src/components/Layout.tsx`, `src/pages/Sync.tsx`, `src/components/ReconnectPrompt.tsx`. Proposed new server auth helper: `supabase/functions/_shared/concept2-auth.ts`; focused tests adjacent to it. Coordinate any capture-producer change in a separately authorized ErgLink task, not this repo by assumption.

- [ ] Resolve prerequisite evidence and record the minimal actual-capture mapping; reject missing ownership/final-summary cases.
- [ ] Write failing tests for repeated capture identity, aborted completion, secret-free exchange, state mismatch, cross-user access, read-only consent, revoked/rotated tokens and concurrent refresh.
- [ ] Implement the narrow versioned input and server auth boundary; ensure refresh cannot silently downscope a publisher or race older browser token writes.
- [ ] Run focused tests and `npm run build`; inspect built assets for confidential configuration references without printing secret values. Commit this prerequisite separately.

**Exit:** a testable owned actual-workout input and server-side development credentials flow; no POST feature yet. Mobile may reuse this auth boundary.

### P2 — Add durable publication identity and exact-ID import preservation

**Files:** proposed reviewed migration in `supabase/migrations/` (choose timestamp when implementing), regenerate `src/types/database.types.ts`; modify `src/utils/reconciliation.ts`, `src/hooks/useConcept2Sync.ts`, `src/services/workoutService.ts` and server sync paths above. Proposed tests: `src/utils/reconciliation.test.ts` plus local database/RLS integration tests.

- [ ] Inspect live constraints/RLS through approved MCP access; write migration and rollback/forward-fix notes, avoiding destructive raw-data rewrites.
- [ ] Test unique owner/capture and publication claims, cross-user denials, stale-generation fencing, development/live ID collisions, and re-import of an exact linked result.
- [ ] Implement a small publication relation/claim operation and exact-ID import path. Store provider enrichment separately from the immutable origin capture; preserve assignment/template links and original LC UUID.
- [ ] Test two similar but distinct workouts are not auto-linked, all browser/server sync entry points preserve provenance, and detail/stroke readers still work. Run focused Vitest and local DB tests before a separate commit.

**Exit:** publication/import identity and recovery storage are tested before external writes. No generic multi-provider model.

### P3 — Prove the manual development publishing slice

**Files:** create `supabase/functions/publish-to-c2/index.ts`, adjacent `index.test.ts`, `supabase/functions/_shared/concept2-payload.ts` and adjacent tests; add `src/services/concept2PublishService.ts`; modify `src/pages/WorkoutDetail.tsx` for owner-only action and explicit states.

**Boundary:** request contains LC workout ID only; server derives owner, account, environment and actual payload. Return durable publication state, sanitized reason and remote ID when known, never credentials. A second request reads/claims the same publication rather than issuing another POST.

- [ ] Write mapper fixtures for the supported actual row and invalid/incomplete/wrong-machine/timezone/rounding cases. Write function tests with injected provider responses: double request, lost response, accepted-but-save-failed, stale worker, revoked token, and confirmed validation rejection.
- [ ] Implement mapping, fenced dispatch and state persistence; keep production endpoint selection server-owned and disabled. Do not accept arbitrary provider URLs or token/payload overrides from the browser.
- [ ] Implement Publish confirmation showing target account, actual result and privacy; show Saved to LC separately from Published to Concept2. Display unknown outcome as review required, not retryable. UI must never promise offline capture safety it cannot verify.
- [ ] Run `npm run test:run -- src/utils/reconciliation.test.ts`, focused mapper/function tests using the chosen Edge Function test runner, `npm run lint` and `npm run build`. Record real commands/results in the implementation PR.
- [ ] With explicit development-call authorization, publish the consented capture, save the remote ID, import it through normal sync and verify one unchanged LC identity with strokes/links retained. Exercise unknown-outcome recovery with controlled fault injection and operator review. Commit evidence without personal data/tokens.

**Exit:** one real development round trip plus all failure/ownership cases, not a broad mapping library.

### P4 — Production gate, not automatic activation

- [ ] Record redacted development evidence, supported shape, OAuth scopes, privacy/verification behavior, duplicate/unknown recovery and reconnect tests. Use the roadmap's Concept2 contact process after checking current provider guidance.
- [ ] Sam/operator requests and records production write approval; do not claim it exists from requested scope alone. Resolve production credentials, granted consent and account/environment routing independently.
- [ ] Approve a narrowly enabled production rollout only after all checks below pass. Document the switch to halt new POSTs while keeping saved workouts/imports intact; never delete remote results as rollback.

## Release acceptance / evidence checklist

- [ ] Upload retry retains one owned LC row; actual totals differ safely from prescription and final-stroke estimates.
- [ ] Supported fixed-distance record accepted in development; unsupported/incomplete records clearly rejected.
- [ ] Double-clicks/concurrent calls create at most one attempted dispatch per valid claim; stale workers cannot overwrite it.
- [ ] Unknown POST/save outcomes resolve without blind retransmission, including abandoned claims and ambiguous lookup candidates.
- [ ] Re-import through browser and server paths preserves LC identity/origin/strokes/template/assignment links and renders correctly.
- [ ] Missing scope/expiry/revocation/reconnect/account switching produce correct states without token leakage or cross-user access.
- [ ] Local capture, LC upload and external publication are separate states; local durability is not inferred from stroke-buffer comments.
- [ ] Production remains disabled until documented provider and operator approval. Native delivery is not a dependency.

[Back to resumption guide](README.md) · [Roadmap](../logbook-concept2-mobile-roadmap.md)
