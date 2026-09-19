# Completed result storage and Concept2 boundary audit

Status: 2026-09-19 checkpoint after PRs #179–#182. Sam reports applying the published-result edit-guard migration. This document separates proven manual/development behavior from remaining Concept2 association and PM5 capture work.

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

## Boundaries that still need work

| Boundary | Current evidence | Required next step |
| --- | --- | --- |
| Post-merge manual behavior | Unit and integration tests cover incomplete totals, work/rest normalization, edit guarding, and cumulative volume. | Smoke the merged behavior in staging: published versus unpublished editing, save/reopen of complete and incomplete rows, and a recovery-distance result across all volume displays. |
| Provider association | Exact provider IDs are preserved and nearby LC rows retain origin evidence. One real session can temporarily appear as an LC row plus a Concept2 provider row. | Prove same-ID refresh and near-match preservation end to end, then add an explicit provider link/display rule without rewriting source identity. |
| Remote Concept2 edits | Provider-owned imported rows can refresh by exact ID. LC-originated published rows retain immutable publication snapshots. | Refresh the linked provider snapshot, detect divergence, and offer an explicit auditable LC revision/adoption flow. Do not silently overwrite or repost. |
| ErgLink upload | Existing session/buffer concepts are useful, but there is no stable completed-capture ID/version, trustworthy finish time, completion state, or durable acknowledgement. BLE notifications currently look like aggregate snapshots. | Persist one capture UUID/version at workout start; retain raw notifications, actual timing/timezone, completion state, final summary, intervals, and provenance. Clear the buffer only after LC returns a durable owned workout UUID. |
| Detailed result | `CompletedWorkoutV2` reserves source-evidence and normalized-sample fields. Manual entry supplies intervals; PM5 detail is not wired. | Store immutable raw capture evidence separately from normalized intervals/samples and provider projection. Determine PM5 sampling semantics before calling records strokes. |
| Rich metrics | Concept2 pages may calculate calories and watts even when LC did not send measured values. | Add calories, watt-minutes, watts, SPM, stroke count, drag, HR, and samples only from trustworthy PM5 summary/telemetry evidence. |
| Provider equivalence | Exact-ID summary read-back works. It does not prove interval/stroke equivalence. | Compare each immutable submitted payload with exact-ID provider detail, including intervals, rest, and `stroke_data` when present. |

## Next verification sequence

1. **Manual integrity smoke:** published edit block, allowed template association, unpublished edit, complete/incomplete save/reopen, and 1,000 m work + 400 m recovery = 1,400 m accumulated volume.
2. **Import identity:** exact-ID refresh plus near-time manual/ErgLink match; original source/raw evidence must survive and provider detail must remain available under the exact ID.
3. **Association and revision:** define provider linking, duplicate display, remote divergence, and explicit adoption as an auditable LC revision.
4. **ErgLink capture envelope:** stable capture ID/version, actual timing, completion state, final summary, intervals, raw stream, provenance, and retry acknowledgement.
5. **Real PM5 evidence:** completed, aborted, interrupted, and retried captures; verify sampling and work/rest semantics before normalization.
6. **Detailed projection:** map proven normalized detail into Concept2 intervals and `stroke_data`, then compare exact-ID provider detail.

## Operational boundaries

- Production publishing remains disabled pending Concept2 and operator approval.
- The legacy production `publish-to-c2` function is separate, unmodified, absent from source control, and must not become the completed-result path.
- Manual and synthetic development results are application/provider conformance evidence, not PM5 capture evidence.
- Concept2 provider association must enrich the LC source record without replacing its provenance.
