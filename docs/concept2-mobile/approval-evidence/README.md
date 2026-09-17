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
| Fixed-time summary | Pending | Pending if useful | Pending | Pending | Device-free canonical fixture. |
| Fixed-distance intervals + rest | Pending | Pending | Pending | Pending | Device-free canonical fixture with measured intervals and reconciled totals. |
| Fixed-time intervals + rest | Pending | Pending | Pending | Pending | Device-free canonical fixture with measured interval distances and reconciled totals. |
| Variable intervals | Pending | Pending | Pending | Pending | Device-free canonical fixture with ordered mixed work/rest records. |
| Duplicate `409` | Automated behavior covered | N/A | Pending controlled development evidence | N/A | Must not be marked published without a proven remote ID. |
| Invalid `422` | Automated behavior covered | Validator should reject matching invalid fixture | Pending controlled development evidence | N/A | Must permit correction without treating outcome as unknown. |
| Expired-token rotating refresh | Passed | N/A | Passed | N/A | Real expired access-token refresh retained `results:write` with no reconnect or stuck operation. |
| Uncertain POST outcome | Automated/disposable-DB coverage passed | N/A | Do not induce against provider without an approved fault-injection method | N/A | No blind retry; explicit review/recovery. |

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
