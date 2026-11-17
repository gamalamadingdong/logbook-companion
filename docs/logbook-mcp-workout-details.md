# Workout detail, sample access and exports

Implemented locally on `feature/mcp-workout-detail` from main `3cbbcd0`. No database migration, Edge Function deployment, Concept2 sync change or OAuth scope change is required. The new tools become available after deploying the web/Vercel API changes and refreshing the connector's tool discovery.

## MCP tools

The original seven read tools remain. MCP server version is `0.3.0`.

| Tool | Inputs | Response |
| --- | --- | --- |
| `get_workout` | `id` | Existing flat summary and legacy interval fields, plus saved/manual structure, template ID, normalized `recorded_splits` and `recorded_intervals`, sample counts, units and provenance. No sample array. |
| `get_workout_samples` | `id`, optional `offset`, `limit`, `startSeconds`, `endSeconds` | Normalized samples, availability and `pagination` with `total` and nullable `next_offset`. Default page 200, maximum 500. |
| `analyze_workout` | `id`, `thresholdBpm`, optional `maxGapSeconds` | Estimated seconds strictly above the threshold, measured coverage, excluded gaps/missing HR and observed sample span. Default maximum gap 10 seconds. |

All three accept an LC UUID, numeric Concept2 result ID, or `https://logbook.readyall.org/workout/ID`. Other hosts and malformed IDs fail before the database query. Time windows are inclusive and applied before pagination; follow `next_offset` using the same window. Times are local to each segment, so a window applies to every segment after clock resets.

Each request uses the caller JWT with the anon-key Supabase client and existing RLS. There is no user selector, service-role key or new permission grant. An inaccessible or absent row returns the same workout-not-found result. Database errors remain errors.

Existing `get_workout.intervals` retains its original payload and `duration_minutes` remains available. `legacy_interval_units` identifies Concept2 legacy time/rest-time as deciseconds and distance as meters. New `recorded_intervals` and `recorded_splits` use explicitly named fields in seconds/meters; measurement splits do not become work/rest intervals.

Example calls after deployment:

```json
{"name":"get_workout","arguments":{"id":"https://logbook.readyall.org/workout/98848028"}}
```

```json
{"name":"get_workout_samples","arguments":{"id":"98848028","limit":500}}
```

```json
{"name":"analyze_workout","arguments":{"id":"98848028","thresholdBpm":190}}
```

## Shared data representation

`shared/workoutDetail.ts` defines JSON schema version 1 and normalization for both consumers. It preserves summary metrics including measured rest distance, manual RWN, template ID and stored workout structure. It does not fetch template records or fabricate unsaved structure.

Concept2 `raw_data.strokes` converts `t` from deciseconds, `d` from decimeters and `p` from deciseconds per 500m. Watts use an explicit positive sample watt value, otherwise the erg pace formula. A numeric `p` is always pace, never guessed as watts. HR and stroke-rate zero become missing values. Invalid timestamps reject samples; source order and original sequence indices remain. Clock decreases start a new segment.

Availability is `available`, `missing`, `unsupported` or `invalid`, with original/accepted/rejected counts. Other source encodings are unsupported until mapped explicitly. This implementation exposes existing stored samples; it does not download missing strokes or change ingestion.

HR duration uses linear interpolation between adjacent valid HR samples within one segment. Threshold equality contributes zero time. Gaps exceeding the configured maximum, missing HR, rejected source records, clock resets and non-increasing times do not contribute. Gap and missing-HR exclusions are disjoint; excessive gaps take priority. No time is extrapolated before the first sample or after the last. `secondsAboveThreshold: null` means unavailable; zero means usable measured coverage with no time above the threshold. This is a sampled estimate and its coverage may be shorter than the workout duration.

## Browser export

The workout detail page offers JSON and numeric-sample CSV with a separate export action. It fetches the persisted row only when requested, constrained by `user_id` and workout ID under browser RLS. JSON contains summary, structure, splits, intervals, samples, availability, units and provenance. CSV includes numeric fields only, with unit-bearing headers and sequence/segment indices; notes cannot enter CSV cells.

Missing or unsupported samples produce an explicit CSV message and leave JSON available. Export errors support retry. Pending downloads are discarded when the account, workout, guest status or mounted component changes. No writes occur.

## Evidence and limits

Read-only inspection of workout `98848028` before implementation found 748 stored samples and six measurement splits. Its missing detail in the prior MCP response was an exposure limitation, not proof of absent data.

Verification covers shared conversion/analysis fixtures, API query/JWT boundaries, real HTTP MCP discovery and dispatch, missing-bearer behavior, export serialization, owner filtering, cancellation and retry. These automated checks do not establish live role-by-role RLS behavior or a rendered desktop/mobile download walkthrough. Browser discovery returned no connected browsers. This implementation has not been deployed or tested through the live connector yet.
