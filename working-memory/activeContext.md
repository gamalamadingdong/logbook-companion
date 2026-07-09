# Active Context

Last updated: 2026-07-09

## Current Focus

Support-work management is the current product slice after the training-block scheduling/config work. The intended direction is a reusable support-work library for strength, core, mobility, stretching, and similar prescriptions, without turning this into a general workout builder.

## Current Implementation State

- Added user-owned support-work library schema in `supabase/migrations/20260709165000_add_user_owned_support_library.sql`.
- Live Supabase migration was applied and verified through MCP-first checks.
- Regenerated DB types in `src/types/database.types.ts`.
- Added support-work service layer in `src/services/supportWorkService.ts`.
- Added Support Work Library page in `src/pages/SupportWorkLibrary.tsx`.
- Wired the route in `src/App.tsx` and navigation in `src/components/Layout.tsx`.

## Instruction Cleanup State

- `AGENTS.md` is now a real repo-local file, not a symlink into `~/apps/codex-config`.
- Repo instructions now include context budget rules, a corrected workspace map, local skill routing, and a Project Fit Check.
- `.github/copilot-instructions.md` and `.github/instructions/copilot-instructions.md` are compact mirrors that route to `AGENTS.md`, current working memory, system patterns, and matching skills only.
- `.github/skills/supabase-schema-guard/SKILL.md` now points at `src/types/database.types.ts`.
- The shared global instruction file keeps only generic behavior and the generic Project Fit Check; Logbook-specific skill routing is repo-local.

## Verified Checks

- `npm run types:supabase` passed after migration.
- `npm run build` passed.
- `npm run lint` passed with existing warnings only.
- Focused training-block tests passed.
- `git diff --check` passed.
- Copilot instruction mirrors are byte-for-byte identical.

## Current Risks And Notes

- The Support Work Library UX still needs an in-browser review before deeper product expansion.
- Support-work templates should remain reusable support prescriptions. Do not add arbitrary erg workout building here.
- Next likely architecture decision: whether training-block support prescriptions should link to support-session templates directly, or whether the support library needs one more edit/review polish pass first.
- Historical working-memory and decision-log entries contain older multi-app names and paths. Treat those as historical until verified against the current filesystem and live service config.

## Next Small Step For Fresh Session

1. Start the app and do a focused browser UX pass on the new Support Work Library. Check desktop and mobile behavior, empty state, list/detail scanning, create/edit flows, deletion safety, and whether the page feels like a reusable support-work library rather than a full workout builder.
2. Make only small polish fixes from that UX pass unless a blocking data bug appears.
3. After UX polish, decide whether the next product slice should link training-block support prescriptions to support-session templates. Do not start that linking work before the UX pass.

## Ongoing Context Hygiene

- Keep future instruction additions short: routing rules and durable constraints only, not long background essays.
- Keep `activeContext.md` current-state only. Move history to `implementationLog.md` or `decisionLog.md`.
