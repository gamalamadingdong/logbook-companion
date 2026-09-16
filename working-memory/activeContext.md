# Active Context

Last updated: 2026-09-16

## Local implementation — Concept2 staging auth

Uncommitted `feature/concept2-staging-auth` starts at fetched `origin/staging` (`b409ef6`); local `main` setup-note commit `92471af` is preserved. See [staging auth slice](../docs/concept2-mobile/staging-auth-slice.md) for implementation, verification, traced legacy paths, rollout and rollback. Server-only development exchange/refresh and credential storage are implemented locally; development sync/publishing are explicitly blocked. Production legacy auth is retained only in production builds and excluded from staging bundles. No live changes, commit, push or PR performed. Live MCP/schema verification, confirmed staging hostname/development client, reviewed deployment approval and actual OAuth smoke remain outstanding. `logbook-dev.readyall.org` is a candidate only.


## Current Session — Concept2/mobile planning (2026-09-15)

Documentation-only specifications and bounded implementation plans are now in [docs/concept2-mobile/README.md](../docs/concept2-mobile/README.md), linked from the [roadmap](../docs/logbook-concept2-mobile-roadmap.md). The authorized pre-existing roadmap improvements are retained. This session prepares a documentation PR; implementation, live changes and merge are not authorized by it.

- [Publishing](../docs/concept2-mobile/publishing.md): prerequisite owned capture identity/version and completed-versus-prescribed data; preserve ErgLink origin/strokes and LC UUID through exact-ID import; manual single fixed-distance development publication first; durable claim plus explicit unknown-POST recovery, not blind retries. Concept2 production write approval is unverified.
- [Mobile delivery](../docs/concept2-mobile/mobile-delivery.md): independent Apple registration/signing/archive/TestFlight track, then signed compatible OTA and rollback. Sam confirms ScheduleBoard's GitHub Actions native pipeline and self-hosted Capgo/Vercel updates are reliable; Appflow was retired for cost and must not return. ScheduleBoard was read as reference only and not modified.
- Inspected gaps to resolve before code enablement: shared types use `erg_link_live` but reconciliation priority uses `erg_link`; current import can replace origin/raw data with Concept2 data; `publish-to-c2` is mentioned in client comments but absent from inspected functions; OAuth callback/refresh reference a browser `VITE_CONCEPT2_CLIENT_SECRET`. No secret values were read. Capture completion/final-summary semantics and live database constraints require evidence.
- Next implementation choice: publishing identity/auth/import prerequisites or the independent mobile shell/archive. Both have explicit operator prerequisites and testable gates. Embedded PM5, force curves, automatic publication and broad platform/machine expansion remain deferred.
- Validation for this documentation change: inspect local source/reference files, verify new relative links and roadmap references, run `git diff --check`, and review the exact staged documentation scope. Application/native/API behavior is not newly tested by this docs pass.

## Prior Product Focus — Support work (retained from 2026-07-09)

Support-work management is the current product slice after the training-block scheduling/config work. The intended direction is a reusable support-work library for strength, core, mobility, stretching, and similar prescriptions, without turning this into a general workout builder.

## Current Implementation State

- Added user-owned support-work library schema in `supabase/migrations/20260709165000_add_user_owned_support_library.sql`.
- Live Supabase migration was applied and verified through MCP-first checks.
- Regenerated DB types in `src/types/database.types.ts`.
- Added `<meta name="mobile-web-app-capable" content="yes" />` in `index.html`.
- Added support-work service layer in `src/services/supportWorkService.ts`.
- Added Support Work Library page in `src/pages/SupportWorkLibrary.tsx`.
- Expanded the support exercise/template seed to 120 canonical rows and added starter standard sessions in `supabase/migrations/20260709190000_seed_expanded_support_work_library.sql`.
- Wired the route in `src/App.tsx` and navigation in `src/components/Layout.tsx`.
- Fixed Vercel SPA rewrites in `vercel.json` so `/assets/*` chunk requests are no longer rewritten to `index.html`, resolving module MIME errors on production.
- Added support-work equipment compatibility filtering and family-ranked alternatives in `src/pages/SupportWorkLibrary.tsx`.
- Applied live Supabase metadata migrations through MCP for strict Landmine Press equipment, strict Weighted Pull-Up equipment, and support-work alternative families.

## Instruction Cleanup State

- `AGENTS.md` is now a real repo-local file, not a symlink into `~/apps/codex-config`.
- Repo instructions now include context budget rules, a corrected workspace map, local skill routing, and a Project Fit Check.
- `.github/copilot-instructions.md` and `.github/instructions/copilot-instructions.md` are compact mirrors that route to `AGENTS.md`, current working memory, system patterns, and matching skills only.
- `.github/skills/supabase-schema-guard/SKILL.md` now points at `src/types/database.types.ts`.
- The shared global instruction file keeps only generic behavior and the generic Project Fit Check; Logbook-specific skill routing is repo-local.

## Verified Checks

- `npm run types:supabase` passed after migration.
- `npm run build` passed after support-work compatibility and alternative-family changes.
- Supabase MCP verified new live migrations: `set_landmine_press_required_equipment`, `set_strict_required_equipment_for_weighted_pull_up`, and `set_support_work_alternative_families`.
- `npm run lint` passed with existing warnings only.
- Focused training-block tests passed.
- `git diff --check` passed.
- Copilot instruction mirrors are byte-for-byte identical.

## Current Risks And Notes

- The Support Work Library UX still needs an in-browser review before deeper product expansion.
- Support-work compatibility is intentionally metadata-light: strict equipment only for truly strict cases, and alternatives are ranked by `support_work_family`, movement pattern, and equipment profile.
- The recent production path issue was routing-related (rewrites), not data-model related; support-work data remains unchanged by the fix.
- Support-work templates should remain reusable support prescriptions. Do not add arbitrary erg workout building here.
- Next likely architecture decision: whether training-block support prescriptions should link to support-session templates directly, or whether the support library needs one more edit/review polish pass first.
- Historical working-memory and decision-log entries contain older multi-app names and paths. Treat those as historical until verified against the current filesystem and live service config.

## Next Small Step For Fresh Session

1. Confirm in-browser on both desktop and mobile that the library route is stable after the routing fix, then do a focused browser UX pass on the Support Work Library (empty state, list/detail scanning, create/edit flows, and deletion safety).
2. Make only small polish fixes from that UX pass unless a blocking data bug appears.
3. After UX polish, decide whether the next product slice should link training-block support prescriptions to support-session templates. Do not start that linking work before the UX pass.

## Ongoing Context Hygiene

- Keep future instruction additions short: routing rules and durable constraints only, not long background essays.
- Keep `activeContext.md` current-state only. Move history to `implementationLog.md` or `decisionLog.md`.
