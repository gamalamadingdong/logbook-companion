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
| Fixed-distance intervals + rest | Pending | Pending | Pending | Pending | Device-free canonical fixture with measured intervals and reconciled totals. |
| Fixed-time intervals + rest | Pending | Pending | Pending | Pending | Device-free canonical fixture with measured interval distances and reconciled totals. |
| Variable intervals | Pending | Pending | Pending | Pending | Device-free canonical fixture with ordered mixed work/rest records. |
| Duplicate `409` | Automated behavior covered | N/A | Pending controlled development evidence | N/A | Must not be marked published without a proven remote ID. |
| Invalid `422` | Automated behavior covered | Validator should reject matching invalid fixture | Pending controlled development evidence | N/A | Must permit correction without treating outcome as unknown. |
| Expired-token rotating refresh | Passed | N/A | Passed | N/A | Real expired access-token refresh retained `results:write` with no reconnect or stuck operation. |
| Uncertain POST outcome | Automated/disposable-DB coverage passed | N/A | Do not induce against provider without an approved fault-injection method | N/A | No blind retry; explicit review/recovery. |

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
