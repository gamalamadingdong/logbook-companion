---
name: supabase-schema-guard
description: Validate Supabase schema alignment and type safety. Use when a task touches DB schema, SQL, RPCs, RLS, or generated Supabase types.
---

Use this skill for any database-affecting change.

## Goals
- Treat live Supabase schema as source of truth.
- Detect and prevent drift between live schema and TypeScript types.
- Keep migrations, service code, and types aligned.

## Procedure
1. Inspect live schema with Supabase MCP first (`list_tables`, `list_migrations`, `execute_sql`) and never assume local SQL snapshots are current.
2. If task changes DDL, apply via migration workflow (not ad-hoc SQL) and verify resulting schema via MCP query.
3. Compare live table/column names, nullability, and key fields against `src/types/database.types.ts` and service query projections.
4. Validate impacted joins/RPC expectations in service code under `src/services/`.
5. If drift exists, report exact mismatches and required follow-up (type regeneration, query updates, migration adjustments).

## Output Contract
- List checked tables/RPCs.
- State whether schema and types are aligned.
- If not aligned, provide a minimal actionable fix list in priority order.
