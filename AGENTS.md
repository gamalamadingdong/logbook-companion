# Logbook Companion Agent Instructions

## Bottom Line

Keep this file compact. It is a repo-local overlay, not a full knowledge base. Load broad context only when the task needs it.

## Startup Order

1. Use the shared global operating rules from `~/apps/codex-config` when available.
2. Read this file.
3. Read `working-memory/activeContext.md` for the current task state. Prefer the newest/current section; do not mine old history unless needed.
4. Read `working-memory/systemPatterns.md` before implementation or architecture changes.
5. Load local skills from `.github/skills/*/SKILL.md` only when their domain matches the task.

## Repo Map

- Current repo: `/home/gamalamadingdong/apps/logbook-companion`
- Repo: `gamalamadingdong/logbook-companion`
- App: React + Vite workout logging, RWN, templates, Concept2 sync, analytics, coaching, training blocks, and support work.
- Related local repos that may matter: `/home/gamalamadingdong/apps/readyall`, `/home/gamalamadingdong/apps/spark`, `/home/gamalamadingdong/apps/scheduleboardv2`, `/home/gamalamadingdong/apps/codex-config`.

Older docs may mention `LogbookCompanion/`, `erg-link/`, or `train-better-hub/`. Treat those as historical until verified from the current filesystem, git remotes, and live service config.

## Context Budget Rules

- Do not preload every instruction, memory, skill, and doc file.
- Start with the smallest useful context: current memory, system patterns, exact files under change, and matching skill files.
- Use `rg` to find precise references instead of reading large files end to end.
- Prefer summaries and pointers in `working-memory/activeContext.md`; use `implementationLog.md` and `decisionLog.md` only for historical detail.
- If an instruction repeats another instruction, keep the stricter or more local version and ignore the duplicate.
- When adding instructions, add routing rules or durable constraints, not long explanations.

## Project Fit Check

Before meaningful product, schema, architecture, or major UX changes, do a short self-critique:

1. Does this serve the user current request?
2. Does it fit the long-term direction: clean training-block architecture, reliable rowing data, focused support-work management, and MCP-first schema safety?
3. Is there an existing component, service, table, pattern, or local skill to reuse?
4. What could break: RLS, data integrity, mobile UX, Concept2/RWN semantics, analytics, or current workflows?
5. What verification is proportionate?

If the check exposes weak fit or excess scope, adjust before editing.

## Local Skill Routing

Read only the matching skill files:

- DB, migrations, generated types, RLS: `.github/skills/supabase-schema-guard/`, `.github/skills/migration-safety-guard/`
- UI styling/layout/components: `.github/skills/ui-design-reviewer/`
- UX flows/forms/dialogs/mobile behavior: `.github/skills/ux-flow-reviewer/`
- Concept2 sync: `.github/skills/concept2-reliability-guard/`
- RWN syntax/parser/serializer: `.github/skills/rwn-spec-guardian/`
- Rowing zones/training claims: `.github/skills/rowing-domain-validator/`
- Analytics/distance/volume/matching logic: `.github/skills/analytics-integrity-guard/`
- Coaching access and team/org RLS: `.github/skills/coaching-rls-guard/`
- Edge Functions: `.github/skills/edge-function-operability-guard/`
- Pre-handoff checks: `.github/skills/preflight-test-gate/`

## Data And Verification

- Use Supabase MCP first for live schema, SQL, migrations, and RLS checks.
- Generated DB types live at `src/types/database.types.ts`.
- Typed Supabase client lives at `src/services/supabase.ts`.
- For code changes, run the smallest meaningful focused verification and report any skipped broader checks.
