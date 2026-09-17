# Concept2 production-write approval evidence

This folder holds sanitized evidence for Concept2 production result-write approval. Never store client secrets, access/refresh tokens, user credentials, or private user data here.

Official contacts and tools:

- API questions / production approval: `ranking@concept2.com`
- Online Validator: https://log.concept2.com/developers/validator
- API documentation: ../concept2-logbook-api-reference.md

Provider reference fixture:

- [`validator-default-variable-interval.json`](validator-default-variable-interval.json) is the default payload Sam observed in the live Online Validator input on 2026-09-17. It is preserved verbatim as provider reference evidence, not as an LC-generated or validated fixture.
- The example combines top-level work/rest totals, mixed completed intervals, HR summaries and `stroke_data`, supporting the requirement that LC's completed-workout model retain full detail rather than summaries alone.
- The example uses `verified: true`; LC must use normal unverified results unless Concept2 separately grants trusted-client status.
- The example does not establish that current ErgLink buffer records are one-per-stroke or settle PM5-to-Concept2 unit/reset semantics.

## Evidence matrix

| Case | Local contract | Online Validator | Development POST/read-back | LC exact-ID re-import | Evidence |
|---|---:|---:|---:|---:|---|
| Fixed-distance summary | Passed | Not required for proven simple shape | Passed | Passed | Results `86800`, `86805`, `86807`, `86817`; result `86817` includes provider-visible LC UUID comment. |
| Fixed-time summary | Passed | Passed with strict checking | Passed: result `86844` | Passed on first and repeat import | [`fixed-time-summary-validator.json`](fixed-time-summary-validator.json), SHA-256 `efd0702c9fddbed88918352b09869982814ce21a2d8e6e961298dfdd300158e5`; validator fixture was 7,321 m / 30:00. Live development result `86844` was 5,000 m / 50:00. |
| Fixed-distance intervals + rest | Passed | Passed with strict checking (Sam-reported) | Passed: result `86847`; Concept2 breakdown confirmed by Sam | Passed; exact LC ID and one imported row | Named synthetic fixture; [exact validator input](interval-validator-inputs.md). |
| Fixed-time intervals + rest | Passed | Passed with strict checking (Sam-reported) | Passed: result `86848`; Concept2 breakdown confirmed by Sam | Passed; exact LC ID and one imported row | Named synthetic fixture; [exact validator input](interval-validator-inputs.md). |
| Variable intervals | Passed | Passed with strict checking (Sam-reported) | Passed: result `86849`; Concept2 breakdown confirmed by Sam | Passed; exact LC ID and one imported row | Named synthetic fixture; [exact validator input](interval-validator-inputs.md). |
| Duplicate `409` | Automated behavior covered | N/A | Pending controlled development evidence | N/A | Must not be marked published without a proven remote ID. |
| Invalid `422` | Automated behavior covered | Validator should reject matching invalid fixture | Pending controlled development evidence | N/A | Must permit correction without treating outcome as unknown. |
| Expired-token rotating refresh | Passed | N/A | Passed | N/A | Real expired access-token refresh retained `results:write` with no reconnect or stuck operation. |
| Uncertain POST outcome | Automated/disposable-DB coverage passed | N/A | Do not induce against provider without an approved fault-injection method | N/A | No blind retry; explicit review/recovery. |

## Interval strict validator evidence

On 2026-09-17, Sam reported that all three [single-line fixture payloads](interval-validator-inputs.md) passed Concept2 Online Validator with **Use Strict Checking** enabled. This is user-observed validator evidence; no validator response export was captured. The validator also recommended an overall stroke rate, stroke count and drag factor. Those fields are optional and absent because the synthetic fixtures contain no measured aggregates; LC must not invent them.

SHA-256 below is over the UTF-8 bytes of each compact JSON line inside the Markdown code block, excluding the newline and code fences:

| Fixture | Work/rest summary | SHA-256 |
|---|---|---|
| `fixed_distance_intervals_2x500m` | 1,000 m / 240.0 s work; 60.0 s rest | `569d9b40d3eaa8d95b898fb6dceb0a6b72e4e6ecbf0d02a9736274af38689be5` |
| `fixed_time_intervals_3x120s` | 1,500 m / 360.0 s work; 90.0 s rest | `ff88ef972b0f5e8b0fb03faf2ad1280900ed75b31a8551b0ab465fa759a6f4fd` |
| `variable_intervals_mixed` | 1,200 m / 300.0 s work; 45.0 s rest and 40 m rest distance | `1c59b55e61a492f232d36dbf3cb1253bc016265295968c3547c7aa40c58e7c90` |

The fixture UUIDs in the validator inputs are placeholders. The development publisher binds each named fixture to a new owned, labelled LC test row and saves an immutable service-only snapshot before the fenced publication claim. The local disposable PostgreSQL suite checks all three mapper payloads, tampered row and payload rejection, duplicate dispatch blocking, and exact-ID import linkage. Migration `20260917190000` and `concept2-development-auth` version 7 are live; production publishing remains disabled.

## Interval development results

On 2026-09-17, Sam explicitly published the three synthetic fixtures to Concept2 development and reported that their provider-side interval breakdowns display correctly. Live LC state shows one publication attempt and mapper version 2 for each result. The original LC rows retain empty production Concept2 fields.

| Fixture | Concept2 result | LC workout UUID | Saved payload and import evidence |
|---|---:|---|---|
| 2 × 500 m fixed-distance intervals | `86847` | `a136492a-2205-41b1-8e60-2aed510d26ec` | `FixedDistanceInterval`; 1,000 m / 240 s work, 60 s rest; exact-ID import stored one row, and repeat import retained that row. |
| 3 × 120 s fixed-time intervals | `86848` | `b5d2250d-4962-4392-8317-e954420e7166` | `FixedTimeInterval`; 480 + 500 + 520 m / 360 s work, 90 s rest; exact-ID import stored one row. |
| Mixed distance/time intervals | `86849` | `1d6a4ebb-4ec0-4b5a-9169-a8df75d92386` | `VariableInterval`; 500 m / 120 s then 700 m / 180 s, 45 s and 40 m total rest; provider display reported correct; exact-ID LC import stored one row. |

The development import currently persists a result summary. Sam's inspection of the Concept2 result pages supplies the provider-side interval-display evidence; the imported summary alone does not prove that detail. After repeat import, the development account had nine saved rows with nine distinct result IDs; all three interval results retained their exact LC links and one publication attempt each.

## Fixed-time development result 86844

On 2026-09-17, Sam explicitly published development test row `038c5e27-8220-4ff9-88cf-10555a20abe5`. The durable publication is `published` with one attempt, mapper version 1 and Concept2 result ID `86844`. Its payload used `FixedTimeSplits`, 5,000 m, 30,000 deciseconds (50:00), the saved completion date and the exact LC workout UUID in `comments`.

Sam observed the Concept2 result page display **Fixed Time**, RowErg, heavyweight, unverified/unranked, entered by Logbook Companion and the same LC UUID comment. A development first-page API import stored one snapshot for result `86844`; the exact publication result ID linked it to the LC workout. The repeat first-page import refreshed result `86844` at 2026-09-17 17:42:19 UTC (after the first save at 17:37:24 UTC). Six development snapshots still had six distinct provider IDs, result `86844` still had one saved row and the same exact LC link, and its publication still had one attempt. The original LC workout remained a manual row with its production Concept2 fields unset. This closes the live fixed-time duplicate check.

This manual development row and Concept2's displayed pace, calorie and watt calculations are not PM5 capture or LC detailed telemetry evidence.

## Approval boundaries

- Requirements inquiry sent by Sam to `ranking@concept2.com` on 2026-09-17; response pending.
- Formal production-write request follows the compact device-free matrix unless Concept2 gives different instructions.
- Provider permission does not activate production writes.
- Production replacement still requires source-controlled implementation, operator approval, backup/rollback and one bounded smoke path.
- Trusted/verified-result status is not part of this request.
- Stroke data, HR/aggregates, extra machines, update/delete/bulk/webhook support and real PM5 capture are not approval prerequisites unless Concept2 explicitly says otherwise.

## Correspondence status

| Date | Direction | Status | Purpose |
|---|---|---|---|
| 2026-09-17 | Sam → `ranking@concept2.com` | Sent; awaiting response | Ask which development shapes, validator outputs or payload evidence Concept2 expects before formal production-write approval. |
