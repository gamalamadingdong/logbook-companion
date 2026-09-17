# Controlled development error evidence

## What is already established

Concept2 documents `409` for a result whose date, time and distance match an existing result, and `422` for a well-formed request that fails validation. Its example `409` response has no result ID. See the [Concept2 Logbook API documentation](https://log.concept2.com/developers/documentation/).

LC's development publisher classifies a provider `409` as `outcome_unknown`: it keeps the attempt blocked because the response does not identify which remote result exists. It classifies a definite `422` as `rejected`, which permits correction and a new explicit attempt. Focused tests in `src/services/concept2Auth.test.ts` cover both classifications without another provider request; disposable PostgreSQL tests cover unknown-outcome fencing and rejected-attempt retry. These are local behavior checks, not observed development HTTP responses.

The normal development UI cannot exercise either provider response on demand. It fences an already published LC workout against a second POST, and the server mapper and database claim reject unsupported or malformed payloads before POST. This is intended behavior.

## Remaining evidence and safe sequence

1. Record Concept2's response to the pending requirements inquiry. Keep the live `409` and `422` cases open in the evidence matrix until their HTTP responses are actually observed or Concept2 says they are unnecessary for approval.
2. If live error evidence is needed, review a **development-only, LC-owned server-side conformance path** before deployment. It must use the existing development OAuth account and endpoint, require a deliberate operator action, keep tokens server-side, and emit sanitized status/evidence only. The browser and ErgLink remain outside Concept2 transport.
3. For `409`, use an explicitly selected existing development result identity only after confirming its stored date, time and distance. Record the payload hash, provider account/environment, HTTP status and before/after result inventory. A duplicate response without a remote ID must never create a new LC publication link or release an unknown attempt for blind retry. Keep this provider conformance check separate from a normal LC workout publication.
4. For `422`, use a separately reviewed invalid payload with a unique result identity so an unexpected acceptance is identifiable. Record the same evidence plus sanitized validation fields. Confirm that no remote result was created before calling the outcome a definite rejection.
5. Verify the LC state handling with local/disposable-database tests against the observed response shape. The live provider check establishes HTTP behavior; the tests establish the durable LC transition. Record both in the evidence matrix.

Do not use production credentials or the legacy `publish-to-c2` function for these tests. Keep the normal publication UI free of malformed-payload and forced-replay controls. Any live conformance request is a separate reviewed operation; this file authorizes no provider POST.
