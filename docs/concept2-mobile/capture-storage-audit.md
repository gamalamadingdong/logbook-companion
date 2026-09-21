# Completed result storage and Concept2 boundary audit

Status: 2026-09-21 checkpoint after PRs #179–#189. Manual/development integrity, shared PM5 packages, direct LC programming code, Capacitor projects, and unsigned Android/iOS compilation are merged. This document separates that implementation evidence from physical-device, capture-ingestion, provider-association, and release proof that remains.

## Durable contracts now in place

- General manual entry saves a versioned `completed_result` in the owner's `workout_logs.raw_data`, alongside searchable summary columns. Its LC workout UUID remains the source identity.
- Ordered work/rest measurements, actual completion time/timezone, completion status, optional template/RWN plan references, and manual result detail survive save/reopen.
- Development publication stores an immutable, mapper-versioned Concept2 payload and exact returned provider result ID in service-owned tables. The original workout's production `external_id`, `source`, and `raw_data` remain untouched.
- Exact-ID development read-back and repeat import update the same provider result ID without another publication dispatch.
- Legacy Concept2 import updates an existing provider row only when the exact provider ID matches. A nearby manual or ErgLink row is no longer rewritten as Concept2.
- Incomplete manual interval measurements remain unknown rather than being presented as complete aggregate totals.
- Published or uncertain general manual development results are protected from result-bearing edits by migration `20260918210000_guard_published_manual_results`; Sam reports applying it after PR #181 merged.

## Distance semantics

Keep prescription, performance, and accumulated training volume distinct:

| Value | Stored meaning | Consumers |
| --- | --- | --- |
| `manual_rwn` / plan detail | Prescribed workout structure | Template matching, plan display, canonical naming |
| `distance_meters` | Measured work distance | Pace, watts, PRs, interval comparison, Concept2 `distance` |
| `rest_distance_meters` | Measured recovery distance | Recovery detail, Concept2 `rest_distance` |
| Work + recovery | Total meters physically covered | Lifetime meters, weekly volume, goals, reports, training load |

For a result with 1,000 m of work and 400 m measured during recovery, LC retains a 1,000 m work result and counts 1,400 m toward accumulated volume. RWN does not invent recovery meters; only completed measurements do.

## PM5 connectivity and capture result

The ErgLink PM5 path was audited against Concept2 CSAFE revision 0.34 and exercised on a real RowErg PM5. Proven evidence now includes:

- GATT capability discovery plus public CSAFE `GETSTATUS` write/notify responses;
- live time, distance, pace, stroke rate, and watts;
- actual stroke (`0x0035`), split (`0x0037`), base summary (`0x0039`), and additional summary (`0x003A`) notifications;
- two completed 100 m captures with exact distance/time/pace/watts/stroke-rate reconciliation;
- twenty stroke notifications representing ten actual strokes, requiring deduplication by PM5 `strokeCount` while retaining all raw notifications;
- paired end summaries as the authoritative final result rather than the final live or stroke sample.

ErgLink now produces `PM5CompletedCaptureV1`, retained in one `CaptureStore` lifecycle. Browser/boathouse operation uses IndexedDB; Capacitor mobile uses SQLite following the proven ScheduleBoard pattern. Both retain pending/attempt/failed/acknowledged states keyed by capture ID. The protocol/capture core and PM5 Capacitor driver are published in `@readyall/erglink`; LC consumes the driver for direct programming but does not yet persist, ingest, or acknowledge this completed-capture envelope.

## PM5 result validity, verification and ranking

Treat these as three separate gates:

1. **LC evidence-valid:** the captured PM5 notifications and summaries form one internally consistent completed workout.
2. **Concept2 API-valid:** the projected payload satisfies the official result schema/validator and is accepted by the development API, then read back by exact provider ID.
3. **Concept2 verified/ranked:** Concept2 accepts trusted-client verification or a matching PM verification code, and the user/result satisfies Concept2's separate ranking rules. API acceptance alone proves neither.

For a fixed 2,000 m RowErg result, LC should require before publication:

- intended and observed PM workout type is fixed distance rather than Just Row or intervals;
- natural completed state rather than abort/terminate/incomplete capture;
- authoritative paired end summaries with exactly `2,000 m` work distance, positive work time, and zero interval rest;
- final split and cumulative telemetry reconcile to the same work distance/time within documented PM rounding;
- stroke identities are nonzero, monotonic/deduplicated, and fit within the completed time/distance window;
- average pace equals `workTime × 500 / 2000` within PM resolution, and reported watts reconcile with Concept2's pace/power relationship after rounding;
- PM log date/time is preserved as the workout end time, because the Concept2 API requires the monitor's end timestamp rather than LC capture start time;
- machine type is RowErg and weight class is supplied when projecting to Concept2;
- payload totals and optional splits/strokes use Concept2 units exactly: meters, tenths of seconds, integer SPM, and decimeter stroke distances.

Concept2's API documentation recommends its Online Validator, especially for intervals. The POST schema accepts optional `verified` only for trusted clients, or a `verification_code` whose date, time, distance, workout type and machine type match. LC must never set `verified: true` merely because its own checks pass. After POST, exact-ID read-back from Concept2 is authoritative for the provider's `verified` and `ranked` fields.

Ranking is separate from verification. Concept2's published rules say ranking pieces are fixed-duration pieces started from a non-moving flywheel; intervals are not ranking pieces. Concept2 also states that ranked results need not be verified, although rankings can be filtered to verified-only results. The API POST schema does not expose a `ranked` write field and examples return `ranked: false`, so LC should describe a valid fixed 2,000 m upload as **ranking-eligible**, not **ranked**, until Concept2 read-back says otherwise or the athlete ranks it in the Concept2 Logbook.

Current gaps before LC can claim ranking-grade capture evidence:

- subscribe to and parse PM5 end-of-workout additional summary characteristic 2 (`0x003C`), retaining its upper-nibble Workout Verified flag and erg machine type;
- retain initial PM workout/rowing/flywheel-state evidence sufficient to evaluate the non-moving-flywheel rule;
- determine through official documentation/Concept2 approval whether a PM verification code is programmatically available to LC, or whether trusted-client status is required;
- implement the deterministic evidence validator and Concept2 payload projection as separate pure steps;
- exercise accepted, rejected and deliberately inconsistent fixtures against the Concept2 development Online Validator/API;
- read back the created result by exact ID and preserve Concept2's `verified`/`ranked` response without rewriting LC provenance.

Primary references: the repository's [official Logbook API snapshot](concept2-logbook-api-reference.md), Concept2's live [ranking rules](https://log.concept2.com/rankings), and Concept2's [PM5 verification-code instructions](https://www.concept2.com/support/monitors/pm5/how-to-use). Recheck the live sources before implementation or production claims.

The field-level contract and ordered implementation slices for closing these gaps now live in the [PM5 evidence pipeline](pm5-evidence-pipeline.md).

Heart-rate compatibility is preserved: PM5 live status and end summaries already carry optional live, ending, average, minimum, maximum, and recovery HR. Normalized HR fields can be added after an HR-belt hardware run without changing capture identity.

## Boundaries that still need work

| Boundary | Current evidence | Required next step |
| --- | --- | --- |
| Post-merge manual behavior | Unit and integration tests cover incomplete totals, work/rest normalization, edit guarding, and cumulative volume. | Smoke the merged behavior in staging: published versus unpublished editing, save/reopen of complete and incomplete rows, and a recovery-distance result across all volume displays. |
| Provider association | Exact provider IDs are preserved and nearby LC rows retain origin evidence. One real session can temporarily appear as an LC row plus a Concept2 provider row. | Prove same-ID refresh and near-match preservation end to end, then add an explicit provider link/display rule without rewriting source identity. |
| Remote Concept2 edits | Provider-owned imported rows can refresh by exact ID. LC-originated published rows retain immutable publication snapshots. | Refresh the linked provider snapshot, detect divergence, and offer an explicit auditable LC revision/adoption flow. Do not silently overwrite or repost. |
| PM5 capture envelope | Stable ID/version, raw evidence, deduplicated strokes, splits, paired summaries, lifecycle, and browser/mobile durable stores are implemented and proven for completed 100 m workouts. | Add idempotent owner + capture ID/version LC ingestion and return an owned workout UUID before device acknowledgement. Do not reuse legacy last-sample upload. |
| PM5 programming | Published RWN/ErgLink packages, direct LC `/pm5` flow, Android/iOS projects, explicit acknowledgement receipts, real browser/PM5 fixed-distance and initial variable-interval evidence, Android debug compilation, and iOS simulator compilation are proven. | Install LC on physical Android/iOS hardware; prove auth/deep links and the exact/prompt-only/unsupported, rejection/not-ready, interval, and reconnect matrix through the LC-built app. Retire `ergLinkAdapter.ts` rather than extending the duplicate path. |
| Detailed result | `CompletedWorkoutV2` reserves source-evidence and normalized-sample fields; PM5 capture now supplies trustworthy raw and normalized detail. | Normalize the accepted capture into the shared completed-workout model, preserving raw evidence outside provider projection. |
| Rich metrics | Concept2 pages may calculate calories and watts even when LC did not send measured values. | Add calories, watt-minutes, watts, SPM, stroke count, drag, HR, and samples only from trustworthy PM5 summary/telemetry evidence. |
| Provider equivalence | Exact-ID summary read-back works. It does not prove interval/stroke equivalence. | Compare each immutable submitted payload with exact-ID provider detail, including intervals, rest, and `stroke_data` when present. |

## Next verification sequence

1. **Manual integrity smoke:** published edit block, allowed template association, unpublished edit, complete/incomplete save/reopen, and 1,000 m work + 400 m recovery = 1,400 m accumulated volume.
2. **Import identity:** exact-ID refresh plus near-time manual/ErgLink match; original source/raw evidence must survive and provider detail must remain available under the exact ID.
3. **Association and revision:** define provider linking, duplicate display, remote divergence, and explicit adoption as an auditable LC revision.
4. **LC capture ingestion:** accept `PM5CompletedCaptureV1` idempotently by owner + capture ID/version; return the owned workout UUID for device acknowledgement.
5. **Ranking-grade evidence:** add `0x003C`, start-state evidence, and a deterministic fixed-piece validator; keep LC-valid, API-valid, verified and ranked states distinct.
6. **LC installed-device PM5 matrix:** install the LC native build, prove authentication/deep links, then exercise exact/prompt-only/unsupported lowering, PM5 acknowledgement, rejection/not-ready, and reconnect deduplication on physical Android/iOS hardware.
7. **Adverse-path evidence:** aborted, interrupted, retried, interval-with-rest, and HR-belt captures.
8. **Detailed projection:** map proven normalized detail into Concept2 intervals and `stroke_data`, validate on the development API, then compare exact-ID provider detail.

## Operational boundaries

- Production publishing remains disabled pending Concept2 and operator approval.
- The legacy production `publish-to-c2` function is separate, unmodified, absent from source control, and must not become the completed-result path.
- Manual and synthetic development results are application/provider conformance evidence, not PM5 capture evidence.
- Concept2 provider association must enrich the LC source record without replacing its provenance.
