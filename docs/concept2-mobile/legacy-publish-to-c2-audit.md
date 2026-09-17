# Legacy production `publish-to-c2` audit

Status: read-only inspection; do not redeploy or treat as the publication foundation.

## Live artifact

- Supabase function: `publish-to-c2`
- Live version: `9`
- Last updated (UTC): `2026-02-26 01:27:57`
- Downloaded source SHA-256: `e822365eb03d6beb93e54762bedf6f414f030947f1a9c5ef4b45570944dbf28a`
- Inspection date: `2026-09-17`

The live source was downloaded read-only for inspection. No credentials or secret values were printed or committed.

## Observed risks

- Allows `Access-Control-Allow-Origin: *`.
- Uses the production Concept2 endpoint directly.
- Implements a separate token-refresh path without the serialized generation fencing proven by the development integration.
- Hard-codes `weight_class: "H"`.
- Maps unknown workout types to `JustRow`, which can misrepresent unsupported evidence.
- Names interval workout types but sends only top-level summary fields; it does not emit measured intervals/rest.
- Uses current row fields directly instead of a versioned completed-workout contract and pure validated mapper.
- Does not preserve the provider-side LC UUID provenance now used by the development path.
- Does not use the durable publication attempt/unknown-outcome state machine.
- Treats provider duplicate behavior without the exact-result-ID recovery and review rules established by the development path.
- Updates production Concept2 fields directly, risking divergence from exact-ID import/reconciliation policy.

## Replacement rule

Do not incrementally extend this live function. The eventual source-controlled `supabase/functions/publish-to-c2/index.ts` must be a thin authenticated production wrapper around the shared completed-workout mapper, provider transport and durable publication state machine proven in development.

Production replacement remains disabled until:

1. Concept2 grants production result-write approval;
2. the shared core and required result shapes pass local and development conformance;
3. live schema/config/permissions are re-inspected;
4. current function source and schema are backed up with a one-line rollback;
5. an operator approves one bounded production smoke write.
