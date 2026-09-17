# Development interval publishing rollout

## Purpose and current state

This slice takes the three strictly validated synthetic interval payloads through the same owned-row, fenced development publication flow already proven for fixed-distance and fixed-time summaries. The fixtures are invented conformance results. They are not athlete completions or PM5 captures. Because they are stored in `workout_logs`, they can appear in LC history and affect training analytics for the account used to test. Use an account where those test rows are acceptable; the UI discloses this before saving. The placeholder UUIDs in the validator evidence are replaced with newly created owned LC workout IDs before publication. Three synthetic interval results were published on 2026-09-17 and imported by exact ID; this document retains the operational procedure.

## Rollout order

The Supabase backend is shared by staging and production. Apply migration `20260917190000_concept2_development_interval_fixtures.sql` first. It adds a service-only snapshot table and fixture creation RPC, and extends only `c2_development_publish_operation`. The previous Edge Function version remains compatible: it continues to send `confirmed_completed` for manual summary rows. Verify the new table/RPC grants, existing manual claim behavior, and an empty fixture table before deploying the Edge Function. Then deploy `concept2-development-auth` with JWT verification on and release the staging UI. The production `publish-to-c2` function and production publishing switch remain untouched.

Use the development page to save each named fixture as a synthetic LC test row. The row's completion time is set to ten minutes before creation, in the fixture's `America/New_York` timezone. Check the saved row's label, totals, interval type, timezone, weight class and private visibility. The separate publish checkbox truthfully identifies it as synthetic. Publish once, then use **Import / recheck first page**. Record the exact returned Concept2 ID, the linked LC UUID, one attempt, mapper version 2, and no change to the source row's production Concept2 fields. Repeat the import to check that it refreshes the same snapshot. If the first page no longer contains a result, use pagination rather than publishing again.

If a POST outcome is uncertain, stop. The existing state machine prevents another dispatch until an operator resolves it with evidence. A definite rejection can be retried only after correcting the cause. Rolling back Edge/UI code leaves any provider results in Concept2; the additive table and migration may remain. Do not delete an uncertain publication or its source row to force a retry.

## Local evidence and remaining gates

The disposable PostgreSQL suite checks service-only access; all three payloads against the TypeScript mapper; changed source and payload rejection; one dispatch; mapper-versioned snapshots; and exact-ID import linkage. The full Vitest suite, build, Deno check and lint passed locally. Live development POST, provider display and exact-ID import have now passed for all three fixtures; repeat import retained nine distinct result IDs. Controlled duplicate `409`, invalid `422` and Concept2 approval response remain open. Types were regenerated from the live Supabase schema in PR #160.
