---
applyTo: "**"
---

# Logbook Companion Copilot Instructions

This is a compact router. Do not duplicate the full project memory here.

## Load Order

1. Read `AGENTS.md` for repo-local operating rules, context budget rules, workspace map, and skill routing.
2. Read `working-memory/activeContext.md` for current state. Prefer the newest/current section and avoid historical mining unless needed.
3. Read `working-memory/systemPatterns.md` before implementation or architecture changes.
4. Load only the matching `.github/skills/*/SKILL.md` files for the task domain.
5. Use `implementationLog.md`, `decisionLog.md`, and feature specs only when the current task needs historical detail.

## Current Repo Facts

- Repo path: `/home/gamalamadingdong/apps/logbook-companion`
- Repo: `gamalamadingdong/logbook-companion`
- App: React + Vite SPA for workout logging, RWN, templates, Concept2 sync, analytics, coaching, training blocks, and support work.
- Generated Supabase types: `src/types/database.types.ts`
- Typed Supabase client: `src/services/supabase.ts`

Historical references to `LogbookCompanion/`, `erg-link/`, or `train-better-hub/` are not enough to establish current workspace truth. Verify from the current filesystem, git remotes, and live service config before cross-app changes.

## Context Budget Rules

- Load narrow context first: current memory, system patterns, exact files under change, and matching skills.
- Do not read every working-memory file or every skill file by default.
- Prefer `rg` and targeted reads over broad file dumps.
- Keep new instructions short. Add durable routing rules, not long explanations.
- If two instruction files overlap, prefer the more local and more specific instruction.

## Project Fit Check

Before meaningful product, schema, architecture, or major UX changes, ask:

1. Does this solve the current user request?
2. Does it preserve clean training-block architecture, reliable rowing data, focused support-work management, and MCP-first schema safety?
3. What existing component, service, table, pattern, or local skill should be reused?
4. What could break: RLS, data integrity, mobile UX, Concept2/RWN semantics, analytics, or current workflows?
5. What verification is proportionate?

## Skill Routing

Read only matching local skills:

- DB/migrations/types/RLS: `.github/skills/supabase-schema-guard/`, `.github/skills/migration-safety-guard/`
- UI: `.github/skills/ui-design-reviewer/`
- UX: `.github/skills/ux-flow-reviewer/`
- Concept2: `.github/skills/concept2-reliability-guard/`
- RWN: `.github/skills/rwn-spec-guardian/`
- Rowing domain: `.github/skills/rowing-domain-validator/`
- Analytics/matching/distance: `.github/skills/analytics-integrity-guard/`
- Coaching RLS: `.github/skills/coaching-rls-guard/`
- Edge Functions: `.github/skills/edge-function-operability-guard/`
- Pre-handoff: `.github/skills/preflight-test-gate/`
