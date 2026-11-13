# Content Search Implementation Plan

**Goal:** Find training records from sidebar search and open the matching record.

**Architecture:** Typed search rows and ranking helpers; independent personal/template/block/team query groups; cmdk in the existing Modal; validated URL selection at destinations.

**Tech Stack:** React, TypeScript, Supabase JS, cmdk, Vitest.

## Global constraints

Keep staging unchanged. Use authenticated reads with explicit owner/team boundaries. No schema changes or live writes. Member destinations cannot require a coach role. Never display stale results after query/user/team changes.

## Tasks

- [x] Implement search contracts, normalization/ranking and personal/template/block queries. Tests cover exact/prefix/broad matching, notation, filter escaping and partial errors. Run focused Vitest before and after implementation.
- [x] Implement active-team search with explicit membership/role checks, owner-specific athlete assignments, team sessions and coach-only athletes. Query seam tests verify team and athlete boundaries and role-appropriate links.
- [x] Add validated URL selection for enrollment/date/session and support templates; add an athlete assignment detail destination if the existing member pages lack one. Tests verify selected record and malformed/unavailable links.
- [x] Replace palette with grouped async content results, independent error/loading states, bounded result hints and secondary shortcuts. Add mobile entry point and cancellation tests.
- [x] Run focused tests, lint, build and full Vitest; inspect final diff and independently review access/routing. Update current working context with concise pointers.

Execute inline and delegate independent team/deep-link tasks under the subagent-driven-development skill. Commit only explicit feature paths after verification; no push/merge/deployment.

## Verification notes

Baseline: 412 tests passed before implementation. Focused feature checks: 45 tests passed, including query/access seams, link validation, asynchronous cancellation, real dialog interactions and focus restoration. Independent final review approved the team scope and dialog fixes. Final repo-wide verification: 457 tests passed in 40 files; npm run build passed; npm run lint passed with zero errors and 115 existing warnings; git diff --check passed. No connected browser was available, so signed-in visual/device proof remains outstanding.
