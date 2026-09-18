# Concept2 Publishing Implementation Plan and Specification

> **For agentic workers:** Use `executing-plans` or `subagent-driven-development` when authorized to implement, task-by-task. Checkboxes below are future work, not completed validation.

**Goal:** Build one server-side Concept2 publication core that maps durable completed LC workouts from manual, ErgLink and future capture sources into explicitly supported Concept2 result shapes, with local contract tests and gated development-API conformance tests.

**Architecture:** Capture producers persist versioned measured evidence; LC owns the canonical completed-workout publication model and durable publication state. A pure mapper/validator creates Concept2 payloads, while a server-side provider adapter owns OAuth, dispatch and read-back. Product UI and development test UI both call this same core.

**Tech stack:** Existing React/Vite/TypeScript, Supabase/Postgres/Edge Functions, Vitest, disposable PostgreSQL tests and Concept2 OAuth/API. Keep this Concept2-specific; do not create a generalized provider framework.

**Current status:** Fixed-distance and fixed-time summaries, three synthetic interval classes, two saved general manual RowErg summaries, and three manually entered interval results are proven in Concept2 development with exact-ID readback/import. Sam confirmed provider-side synthetic interval breakdowns and supplied the mixed manual result page, which displays Variable Interval, 1,200 m / 5:00 work, 1:00 rest, 6:00 overall, and the two correct interval rows. The saved manual results are development IDs `86932` (7,500 m), `86933` (10,000 m), `86935` (1,000 m / 240 s work, fixed-distance intervals), `86936` (1,200 m / 300 s work, mixed intervals), and `86937` (2,250 m / 540 s work, fixed-time intervals). Live verification found one publication attempt and one imported row for each manually entered interval result. These tests do not prove real PM5 capture. The general manual result page now uses the shared core; functional testing continues.

## Manual interval bridge in staging (2026-09-18)

The general LC completion flow now separates plan from result: searchable saved LC templates and pasted RWN set only planned targets, while manually entered work/rest measurements form the durable result. The optional template link and RWN snapshot stay with the LC row. Complete Concept2 RowErg distance, time, and variable intervals normalize server-side into `CompletedWorkoutV2` and use the existing mapper, publication fence, immutable payload snapshot, and exact-ID read-back. A new service-only SQL claim checks a payload reconstructed from the saved measurements. Local mapping, disposable PostgreSQL, full Vitest, Deno, lint, and staging build checks pass. Migration `20260918160118` and development Edge Function version 9 are live, with JWT verification on; the Vercel staging merge deployment passed. The first manually entered fixed-distance interval result, LC workout `4f037c45-e792-4896-9b90-bcbbb4c4e997`, became result `86935` with one dispatch, mapper version 2, and a `FixedDistanceInterval` payload. The mixed manual interval result, LC workout `f4704481-8523-48de-bdbf-097634b3745f`, became result `86936` with one dispatch, mapper version 2, and an ordered `VariableInterval` payload. Concept2 also displays 66 calories and 179 average watts; these were not in the LC publication payload and are not evidence of measured power or calorie capture. Its unusual generated page title is not the LC row name or planned RWN; the payload has no title field. After correcting an omitted interval type on the same LC row, Sam published manually entered fixed-time intervals as result `86937`; exact-ID readback succeeded. Live state shows one dispatch, mapper version 2, and one imported row. Provider-page inspection and template selection remain to be checked. Form validation for missing interval types is proposed in PR #173 and is not yet live. Production publishing remains disabled, and ErgLink capture/telemetry proof is a separate track.

## Global constraints

- Preserve LC row identity, source, original raw capture/strokes and template/assignment links. Publication is a reference, not an origin upgrade; manual and ErgLink inputs use the same publication core after source-specific normalization.
- Preserve the complete detailed workout evidence whenever the capture source provides it. Summary totals are an index/view of the workout, not a substitute for raw PM5 telemetry, normalized samples or completed interval detail.
- Only the authenticated owner can publish their completed workout to their connected Concept2 account. Anonymous/coached attribution is a prerequisite, not permission to publish on someone else's behalf.
- Fixed distance is the proven baseline. Add one result shape at a time through the support matrix; reject unsupported/incomplete shapes rather than flattening them to `JustRow` or summary-only records.
- No remote edits/deletes, bulk publication, automatic retries after uncertain POSTs, automatic publishing, force curves or trusted/verified claims without separate product need and provider approval.
- All database changes require current schema/RLS discovery with the local guards and MCP-first workflow. This plan does not assert the live schema matches generated types.

## Existing surfaces and specific gaps

| Surface | Current reality / implication |
|---|---|
| [`concept2-development-auth`](../../supabase/functions/concept2-development-auth/) | Proven server-side development OAuth, rotating refresh, summary import, fenced publication, explicit unknown outcomes, provider-visible LC UUID comments and exact-ID read-back. This is the reliability foundation to extract and reuse. |
| [ErgLink/LC contract](../../src/types/ergSession.types.ts) | `ActiveWorkoutSpec` describes prescription; `ErgLinkUploadMeta` carries session/participant/template/assignment identity and a full stroke buffer. It has no stable capture ID/version, completion status, original timezone, final-summary contract or completed interval summaries. |
| ErgLink `src/services/sessionService.ts` | Uploads `completed_at` at upload time and uses the last stroke's SPM/watts as apparent averages. Those values are not sufficient for rich Concept2 publication. ErgLink should produce measured evidence, not Concept2 payloads. |
| ErgLink `src/services/strokeBuffer.ts` | IndexedDB buffering and retry-preserving capture are useful foundations. Current store contains strokes only; it needs a stable capture record/status before it can prove one durable completed workout across retries. |
| [Reconciliation](../../src/utils/reconciliation.ts), [sync hook](../../src/hooks/useConcept2Sync.ts) | Legacy browser and server read paths remain fragmented. Exact publication IDs must win before fuzzy matching, and original ErgLink/manual evidence must not be replaced by provider snapshots. |
| [Server sync batch](../../supabase/functions/run-c2-sync-batch/index.ts) | Richer production import already parses summaries/details/strokes, but it has its own types and mappings. Consolidate provider types/units without coupling publication to batch scheduling. |
| Deployed `publish-to-c2` function | A live production function exists but is absent from source control. Inspected code hard-codes heavyweight, sends summary-only payloads, falls back to `JustRow`, does not serialize refresh, treats `409` without an ID as published and lacks unknown-outcome fencing. Audit and replace it; do not extend or redeploy it as the core. |
| [API snapshot](concept2-logbook-api-reference.md), [legacy API types](../../src/api/concept2.types.ts) | Snapshot is the searchable provider reference. Existing types are incomplete and contain unit ambiguity (for example stroke distance/pace comments); new server types must be derived and tested explicitly. |

## Prerequisites and decisions to close

1. **Provider access:** development OAuth, write consent and rotating refresh are proven. Production/trusted-client approval remains unknown and must stay a separate gate.
2. **Actual ErgLink evidence:** obtain consented completed, aborted and incomplete captures. Establish authoritative PM5 work/rest/elapsed meanings, interval summaries, finish timestamp/timezone, averaging semantics and restart durability. Never label a synthetic fixture as a real capture.
3. **Capture identity:** add a stable ErgLink capture ID/version generated once and retained across upload retries. Session/participant IDs alone must not collapse multiple workouts.
4. **Canonical input:** define one versioned completed-workout publication model. Manual and ErgLink adapters normalize into it; neither builds provider JSON.
5. **OAuth convergence:** retain the proven server-side development flow and design production cutover around it. Browser-bundled production secret/refresh paths remain technical debt until an approved cutover.
6. **Support matrix:** explicitly classify each Concept2 shape/field as proven, next, planned enrichment, product-deferred or provider-blocked. API documentation does not imply LC support.

## Revised responsibility boundaries

1. **ErgLink and other capture producers:** persist measured evidence, stable capture identity, completion status, actual timing/timezone, final summary, completed intervals and the complete raw telemetry/sample stream. They do not know Concept2 payload rules or credentials.
2. **LC source adapters:** convert manual/ErgLink rows into one completed-workout publication model while preserving source, raw evidence, normalized detail, assignment/template/session links and LC UUID.
3. **Pure mapper and validator:** deterministically emit an accepted Concept2 payload or a stable unsupported/incomplete reason. No database, OAuth or network calls.
4. **Publication state machine:** own eligibility, immutable payload snapshot/version, single dispatch, unknown outcome, audited recovery and exact remote ID.
5. **Provider adapter:** own environment-specific endpoint, OAuth/refresh, HTTP validation and safe response parsing.
6. **Read-back/reconciliation:** exact publication ID wins before fuzzy matching; provider enrichment must not replace original capture identity or rich raw data.
7. **UI:** product UI requests publication by LC workout ID. The development console selects a canonical workout or named server-owned fixture; neither accepts arbitrary provider JSON or maps fields.

## Support sequence

| Shape/capability | Status / next gate |
|---|---|
| Fixed-distance summary | Proven development baseline; preserve exact behavior through extraction. |
| Fixed-time summary | Proven in development: strict validator, one POST, exact-ID read-back and repeat import. |
| Just Row | Add after completion semantics are explicit. |
| Fixed-distance/time intervals | Synthetic development fixtures passed strict validator, POST, provider display and exact-ID import. Real capture still requires measured completed interval records, not prescription alone. |
| Variable intervals | Synthetic mixed distance/time fixture passed strict validator, POST, provider display and exact-ID LC import. Real capture requires ordered measured work/rest records and total reconciliation. |
| Fixed-calorie / fixed-watt-minute workouts and interval variants | Planned shape coverage after the current approval matrix. Establish actual PM5 completion units and work/rest semantics; test each chosen shape locally and in strict validator, then publish, inspect provider display and re-import one labelled development result. Do not infer these shapes from distance/time totals. |
| Measured calorie and power detail | Planned capture enrichment: validate workout and interval `calories_total`/`wattminutes_total`, normalized watt samples and any derived display values against trustworthy PM5 evidence. Keep units and averaging rules explicit; do not invent values from the current synthetic fixtures or final sample. |
| HR/SPM/drag/stroke count | Add only from true summary/aggregate evidence; never final-sample approximations. |
| Detailed samples / stroke data | Store the full source stream and normalized detailed samples in LC. Do not assume each current ErgLink sample is one PM5 stroke. After device evidence establishes sampling semantics, derive Concept2 incremental `stroke_data` in deciseconds/decimeters/pace and reconcile totals/interval boundaries. |
| Targets/metadata | Add when product-needed and validated through development read-back. |
| Trusted verification | Blocked pending Concept2 approval. |
| Update/delete/bulk/webhook | Documented API behavior, not planned LC product support. |

## Completed-workout and mapping specification

The minimal contract needs capture ID/version, owned LC workout ID, source, completion status (`completed`, `aborted`, `incomplete_capture`), machine type, actual finish instant plus original timezone, measured work distance/time and retained prescription references. The owner comes from authenticated persistence, not untrusted request data. Store the original measured input; use a versioned immutable payload snapshot for each publication attempt.

Eligibility requires an owned durable row, actual completed fixed-distance rowing evidence, positive finite measured distance/work time, known time convention, required profile fields, and no existing/uncertain publication for the target account/environment. Legacy rows missing final-summary evidence remain ineligible until safely resolved. An athlete stopping early has not completed the prescribed piece even if the RWN still says `5000m`.

### Detailed capture requirement

`CompletedWorkout` must be able to retain the whole completed workout, not only a summary payload. Keep three layers distinct:

1. **Lossless source evidence:** versioned PM5/ErgLink records exactly as captured, with stable capture ID, source timestamps, sampling/characteristic identity, schema version, count and integrity checksum/reference.
2. **Normalized workout detail:** provider-independent elapsed/work/rest timing, cumulative distance, pace/power/SPM/HR/calorie samples and completed interval boundaries. Normalization must remain reproducible from the lossless source evidence.
3. **Provider projection:** Concept2 summary/interval/`stroke_data` generated from the normalized model. Concept2 unit conversion or sampling limits must never overwrite or become LC's only detailed record.

The detailed stream may be absent for manual rows and should be retained for PM5-originated captures when available. Storage layout (versioned JSONB, child rows, object storage/compression or a hybrid) remains a schema decision after measuring representative capture sizes and query needs. Regardless of layout, retries must reference one immutable capture rather than duplicate or truncate samples.

| Destination | First-slice rule |
|---|---|
| `type` | `rower` only. |
| `date`, `timezone` | Actual workout end, formatted under the provider's verified date contract with recorded timezone; test DST and UTC boundary cases. Do not substitute upload time. |
| `distance`, `time` | Actual work meters and work time in deciseconds. Define rounding once in the mapper and test boundaries; do not use rest-inclusive elapsed time. |
| `workout_type` / splits | Confirm the accepted fixed-distance representation with development/validator evidence. Do not manufacture split records from a prescription; block release if the selected shape requires unavailable measured splits. |
| `weight_class`, `privacy` | Explicit account/user-confirmed values under current API requirements; no inferred athlete weight class or silently public default. |

**Post-functional-testing UX follow-up:** Stop asking for weight class and visibility on every publication. Prefer reliable values from the connected Concept2 profile when exposed by its API; otherwise use user-managed, account-scoped LC publication settings. Show the chosen values before the explicit publish action, allow correction in settings, and retain a safe private default only if the user has confirmed it. Do not change this flow during the current functional testing round.
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

Approval evidence is tracked in [`approval-evidence/README.md`](approval-evidence/README.md); external inquiry text is draft-only until Sam sends it.

### P1 — Start the approval conversation and freeze the proven baseline

**LC files:** `supabase/functions/concept2-development-auth/*`, `scripts/test_c2_development_auth.py`, `docs/concept2-mobile/legacy-publish-to-c2-audit.md`.

- [x] Send a requirements inquiry to `ranking@concept2.com`: describe the proven fixed-distance flow and ask which development shapes, Online Validator output or payload samples Concept2 expects before formal production-write approval.
- [x] Preserve fixed-distance payload, state-machine and exact-ID behavior as regression tests before refactoring.
- [x] Download the deployed `publish-to-c2` function read-only; record version/hash and sanitized behavior without adding secrets or redeploying it.
- [x] Add an explicit source-control/deployment guard explaining that the live legacy function is not the implementation base.
- [x] Verify no production endpoint or credential enters staging bundles.

**Exit:** Concept2's stated evidence expectations are recorded if they respond; fixed-distance behavior is frozen and the unsafe production baseline is auditable. Do not block device-free engineering while waiting for a reply.

### P2 — Define one completed-workout model and support matrix

**LC files:** create `supabase/functions/_shared/concept2/publication.ts` and focused tests; split it later only when type/adapter/mapper growth earns separate files.

- [ ] Define a versioned model containing LC workout/owner/source/capture IDs, completion status, machine/shape, actual finish/timezone, work distance/time, optional intervals/aggregates, a lossless source-evidence reference, normalized detailed samples and explicit privacy/weight class.
- [ ] Test fixed-distance and fixed-time requirements, interval total reconciliation, non-finite/unit boundaries, unsupported machines/shapes and incomplete evidence.
- [ ] Test detailed-evidence integrity: stable order/count/checksum, monotonic time/distance where required, explicit gaps/resets and summary/interval reconciliation. Do not equate periodic telemetry samples with strokes without PM5 evidence.
- [ ] Add manual and ErgLink row adapters; prescription classifies shape but measured evidence supplies published totals.
- [ ] Keep source-specific metadata/assignment/template/session identity outside provider mapping.

**Exit:** all sources normalize to one provider-independent completed-workout contract or a stable rejection reason.

### P3 — Extract pure Concept2 mapping and provider transport

**LC files:** extend `supabase/functions/_shared/concept2/publication.ts`, add fixtures/tests, and modify `concept2-development-auth/publish.ts` to use it. Extract a separate `provider.ts` when production/development transport actually shares the boundary.

- [x] Move the proven fixed-distance payload out of SQL without behavior change; persist mapper version and immutable payload snapshot before POST.
- [ ] Test exact units, rounding, DST/UTC date boundaries, provenance comment, enums and omitted unsupported fields.
- [ ] Isolate fixed development/production endpoints, timeout, redirects, response validation and sanitized errors in the provider adapter.
- [x] Preserve the existing fenced claim, definitive-rejection retry, unknown-outcome block and audited resolution semantics.

**Exit:** fixed distance uses the same pure core future shapes will use; UI and capture sources contain no Concept2 mapping.

### P4 — Complete the device-free production-approval conformance matrix

**LC files:** add named server-owned fixtures under `supabase/functions/_shared/concept2/fixtures/`; extend mapper/validator tests; keep `DevelopmentConcept2.tsx` a thin workout/fixture selector; record validator/development evidence under `docs/concept2-mobile/approval-evidence/`.

- [x] Add fixed-time failing tests using exact work time and measured distance; implement mapping and pass strict Online Validator checking.
- [x] Deploy the fixed-time slice, publish one development manual test row, read it back, import it twice and record the result ID/LC UUID/read-back differences. Result `86844` linked to LC workout `038c5e27-8220-4ff9-88cf-10555a20abe5`; validator fixture was separate from the published row.
- [x] Add one fixed-distance interval fixture with synthetic completed intervals/rest and reconciled totals; pass the Online Validator, publish to development and compare read-back. Result `86847`.
- [x] Add one fixed-time interval fixture with synthetic completed interval distances/rest and reconciled totals; pass validator/publish/read-back. Result `86848`.
- [x] Add one variable-interval fixture with ordered synthetic mixed work/rest records and reconciled totals; pass validator/publish/read-back. Result `86849`.
- [ ] Use the preserved Online Validator default variable-interval payload as provider reference for top-level totals, mixed intervals, HR and `stroke_data`; create an LC-owned unverified fixture rather than copying its `verified: true` claim or assuming its samples match ErgLink semantics.
- [ ] Exercise deliberate duplicate (`409`) and invalid (`422`) cases without blind retry or false published state.
- [x] Record sanitized fixture payload/hash, validator outcome, provider result ID, LC UUID and read-back differences for the three interval fixtures in the approval evidence. Never label synthetic fixtures as real ErgLink captures.
- [ ] Keep strokes, trusted verification, bulk/update/delete/webhook and non-rower machines out of this approval matrix unless Concept2 explicitly requests them.

**Exit:** fixed distance, fixed time and representative interval classes have local contracts, validator evidence and development API read-back suitable for a formal production-write approval request.

Interval fixture status (2026-09-17): the three named synthetic results and pure mappings exist under `supabase/functions/_shared/concept2/fixtures/`. `scripts/render_concept2_fixture.mjs` emits their current Concept2 payloads from the mapper. Their local reconciliation tests pass; Sam reported strict Online Validator success and confirmed the Concept2 interval breakdowns. Development results `86847`, `86848` and `86849` were each published once with mapper version 2, imported by exact result ID and re-imported without duplicate saved IDs. The validator recommended optional overall stroke rate, stroke count and drag factor; the synthetic fixtures have no measured values for those fields. The V2 interval contract has typed space for source evidence and normalized samples, but PM5 capture storage and sample integrity are not yet implemented. The manual summary path still uses V1 and the existing test form.

### P5 — Submit the formal production-write approval request

**Evidence:** use the recorded fixed-distance and conformance results; never include secrets, tokens or private user data.

- [ ] Send Concept2 the application/client identity, URLs/callbacks, intended user-initiated unverified workflow, supported shapes and GitHub/live links.
- [ ] Include representative development result IDs plus duplicate/validation/refresh/unknown-outcome safeguards.
- [ ] Ask whether `comments` or `metadata.other` is preferred for LC UUID provenance and whether additional rate-limit/client-identification evidence is required.
- [ ] Record the correspondence and any conditions in project documentation; treat permission as approval to prepare production rollout, not automatic activation.
- [ ] Continue device-free core/ErgLink contract work while waiting; do not enable production writes.

**Exit:** Concept2 has received a truthful evidence-backed request; approval status and provider conditions are explicit.

### P6 — Strengthen ErgLink completed capture

**ErgLink files:** `src/types/ergSession.types.ts`, `src/services/sessionService.ts`, `src/services/strokeBuffer.ts` and focused pure aggregation tests. Mirror accepted contract changes in LC `src/types/ergSession.types.ts`.

- [ ] Add `_capture_v`, stable `capture_id`, completion status, actual start/end/timezone and a final-summary object.
- [ ] Compute true workout aggregates; do not copy final-sample watts/SPM into average fields.
- [ ] Separate measured work time from elapsed/rest time and persist completed interval summaries when PM5 evidence supports them.
- [ ] Retain the complete raw telemetry stream and record sampling provenance (PM5 characteristic/message type, timestamp semantics, schema version, sample count and integrity checksum/reference).
- [ ] Retain the same capture ID across retries and clear strokes only after durable LC upload confirmation.
- [ ] Keep anonymous captures ineligible for publication until ownership is explicitly resolved.
- [ ] Add contract parity tests across the two repositories and coordinate separate compatible PRs.

**Exit:** ErgLink can produce trustworthy completed evidence; it still does not know Concept2 payloads or credentials.

### P7 — Map ErgLink detail and add richer shapes sequentially

- [ ] Convert cumulative ErgLink strokes into Concept2 incremental deciseconds/decimeters/pace; reject decreasing/invalid samples and reconcile totals.
- [ ] First establish whether each buffered ErgLink record represents a true stroke, a periodic telemetry sample or a mixture; preserve the original stream and derive provider `stroke_data` without destroying it.
- [ ] Replace synthetic evidence with consented real PM5 captures for fixed distance, fixed time and interval shapes as device access permits; document any mapper changes forced by actual evidence.
- [ ] Add Just Row only after its real completion semantics are explicit.
- [ ] Add HR/SPM/drag/stroke count only from validated aggregate evidence.
- [ ] Validate calorie and power evidence separately: reconcile measured workout/interval calories and watt-minutes with the raw capture, derive power summaries only from a proven sampling rule, and test the provider's integer fields and displayed values through strict validation, development write, provider inspection and exact-ID re-import. Provider-calculated calories or watts on today's summary pages are not PM5 measurements.
- [ ] Add fixed-calorie and fixed-watt-minute workout shapes, then their interval variants if supported by real LC/PM5 completion evidence; verify target-vs-actual units and rest semantics before mapper support. Use one labelled development fixture per chosen shape and keep unsupported cases blocked.
- [ ] Add targets/metadata only for a product requirement and after development validator/read-back evidence.
- [ ] For every shape: local failing tests → minimal mapper → reliability regression → one gated development publish/read-back/re-import → support-matrix update.

**Exit:** every enabled field/shape has both local contract coverage and representative provider evidence.

### P8 — Replace the legacy production publisher behind a hard gate

**LC files:** source-control `supabase/functions/publish-to-c2/index.ts` as a thin owner-authenticated wrapper around the shared core; add focused tests and reviewed migrations/config only after live discovery.

- [ ] Accept LC workout IDs only; server derives owner/account/environment/evidence/payload.
- [ ] Reuse serialized refresh, immutable attempt snapshot, fixed endpoints and unknown-outcome behavior.
- [ ] Treat `409` without a proven remote ID as duplicate review, not published.
- [ ] Keep production writes disabled until Concept2 production approval and operator rollout approval are documented.
- [ ] Stage live backup/checksum and one-line rollback before replacement; verify version/permissions and one approved smoke path afterward.

**Exit:** production publishing is source-controlled and uses the proven core, but remains off until explicitly approved.

## Release acceptance / evidence checklist

- [x] Fixed-distance development writes preserve owned LC identity, publish once, expose LC UUID in provider comments and re-import idempotently by exact result ID.
- [x] Double-click/concurrent claims, stale generations, definitive rejection retry and unknown-outcome blocking are covered by focused and disposable-Postgres tests.
- [x] Development write consent and a real rotating-token refresh pass without token leakage, reconnect or stuck operation.
- [ ] Shared-core extraction preserves the proven fixed-distance payload and state behavior exactly.
- [x] Fixed-time passes local mapping/validation plus one development publish/read-back/re-import.
- [ ] ErgLink retries retain one stable owned capture ID; actual completion/totals/averages are evidence-backed rather than prescription or final-sample estimates.
- [ ] Interval and stroke shapes remain blocked until completed interval/final-summary semantics and unit conversion are tested.
- [ ] Browser and server import paths preserve LC source/raw strokes/template/assignment links while exact IDs win over fuzzy matching.
- [ ] Controlled unknown-outcome recovery is exercised without blind retransmission, including abandoned claims and ambiguous lookup candidates.
- [ ] Production remains disabled until documented provider and operator approval. Native delivery is not a dependency.

[Back to resumption guide](README.md) · [Roadmap](../logbook-concept2-mobile-roadmap.md)
