# Completed result storage and Concept2 boundary audit

Status: 2026-09-18 code and live-schema review. The legacy import guard in PR #179 is not merged or deployed. This is the next capture and persistence work list, not a claim that PM5 capture or production publishing is ready.

## What is already durable

- General manual entry saves a versioned `completed_result` in the owner's `workout_logs.raw_data`, alongside searchable summary columns. Its LC workout UUID stays the source identity. Ordered work/rest rows, actual measurements, targets, plan RWN, template link, completion status, finish instant, and timezone are in that result.
- Development publication stores an immutable, mapper-versioned Concept2 payload and the exact returned Concept2 result ID in separate service-owned tables. The original workout's production `external_id`, `source`, and `raw_data` are untouched. A development import reuses the same result ID rather than adding another result row.
- The live schema matches the checked generated types for `workout_logs`, `c2_development_publications`, and `c2_development_results`. Owner RLS covers `workout_logs`; the development publication/result tables have service-only writes.

## Boundaries that need work

| Boundary | Current evidence | Required next step |
| --- | --- | --- |
| Legacy Concept2 import | The browser sync and `run-c2-sync-batch` previously used a nearby date/distance/time match to replace a manual or ErgLink row with Concept2 `source` and `raw_data`. | PR #179 changes replacement so only an already imported Concept2 row with the same exact provider result ID can be updated. After rollout, nearby LC-owned rows will be preserved and skipped. A later provider-link table can associate a legitimate manual/capture result with its provider result without rewriting source evidence. |
| ErgLink upload | The buffer is keyed by session; the upload lacks a stable workout capture ID, can use upload time as finish time, and can resolve after a failed owned-row insert. BLE notifications currently produce aggregate snapshots. | Persist one capture UUID and version at workout start; retain raw notifications, actual start/finish and timezone, completion state, and assignment/template provenance. LC ingestion must be idempotent by owner and capture ID and acknowledge a durable workout UUID before ErgLink clears the buffer. Treat source records as telemetry samples until PM5 sampling semantics are verified. |
| Detailed result | `CompletedWorkoutV2` reserves source evidence and normalized sample fields, but the manual path has only entered intervals and the PM5 path is not wired. Development read-back stores a Concept2 summary by exact ID. | Store immutable raw capture evidence separately from normalized intervals/samples and from a Concept2 projection. Fetch provider detail and strokes for comparison when that validation is needed; a summary read-back does not prove detailed equivalence. |
| Published corrections | The manual edit path can change a published source row while its publication payload snapshot stays immutable. The UI warns that Concept2 will not update automatically. | Add an owned revision/audit trail and a clear correction workflow, with database enforcement, before production write approval. Do not silently mutate or repost the Concept2 result. |
| Manual full-detail totals | A partially filled row can currently be summed into a claimed whole-session total. | Only derive a metric when all rows needed for that metric have measured values. Show incomplete totals as unknown in the form. Keep entered partial detail separate from a user-provided session total. |

Concept2's [Logbook API documentation](https://log.concept2.com/developers/documentation/) distinguishes work distance/time from rest distance/time and defines `stroke_data` as timed, distance-based telemetry values. PM5 notification records should not be projected as strokes until their sampling and interval reset behavior is verified on a device.

## Next verification sequence

1. Verify manual save/reopen for complete and incomplete work/rest rows, a run, a non-Concept2 erg, and a Concept2 RowErg; check that blank metrics remain unknown in stored JSON and indexed columns.
2. Exercise a same-ID Concept2 resync and a near-time manual/ErgLink match against the import paths. The original LC `source` and `raw_data` must survive. A skipped near match must be visible as such, not reported as a successful detailed import.
3. Define the capture envelope and retry acknowledgement in ErgLink and LC, then prove interruption/retry with one capture ID and one owned LC workout UUID. Retain the unmodified raw stream and map only verified sample semantics.
4. For each supported Concept2 shape, compare the immutable submitted payload with the exact-ID provider detail response, including intervals, rest, and stroke data when present. Keep the existing device-independent validator and development POST evidence distinct from PM5 capture proof.

Production publishing remains disabled pending Concept2 and operator approval. The legacy production `publish-to-c2` function is a separate, unmodified function and must not be used as the completed-result path.
