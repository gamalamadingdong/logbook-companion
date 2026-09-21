# E5 PM5 projection development rollback

Use only if the PM5 projection fixture path causes a development-publication regression.

## Scope

This rollback affects only the `concept2-development-auth` development function and server-owned synthetic fixture creation. It does not touch the production `publish-to-c2` function or production Concept2 credentials.

## Edge Function rollback

Deploy the pre-E5 implementation from merged `staging` in a clean temporary checkout:

```bash
git worktree add /tmp/lc-e5-rollback a3570a83bd3037f5a2472ec48dbf161bcd18268a
cd /tmp/lc-e5-rollback
npx supabase functions deploy concept2-development-auth --project-ref vmlhcbkyonemmlawnqqr
cd -
git worktree remove /tmp/lc-e5-rollback
```

## Database rollback

Reapply the pre-E5 definitions of these two functions from the cited migrations through the approved SQL editor/MCP path:

1. `public.c2_development_create_fixture_workout(uuid,text,jsonb)` from `supabase/migrations/20260917190000_concept2_development_interval_fixtures.sql`.
2. `public.c2_development_publish_operation(uuid,text,jsonb)` from `supabase/migrations/20260918160118_concept2_general_manual_interval_publication.sql`.

Leave the expanded fixture-name check constraint in place. Restoring the two functions makes the new names unreachable while avoiding destructive deletion of fixture rows or publication evidence.

## Verification

- `create_fixture` rejects `pm5_fixed_2000m`, `pm5_8x500m`, and `pm5_invalid_stroke_data`.
- Existing manual and interval fixture publication remains available.
- No production Concept2 function or token row changes.
- Do not delete already-created development results from Concept2 automatically; they are synthetic evidence and deletion is a separate explicit operator action.
