# Club management and focused dashboard implementation plan

> **For agentic workers:** Use executing-plans to implement the following bounded tasks in order.

**Goal:** Make club creation/editing visible independently of team selection, and remove redundant dashboard management surfaces.

**Architecture:** Reuse existing organizations and membership permissions, services and shared form components. A dedicated Clubs panel lives in coaching settings in every scope. Team affiliation and benchmark configuration stay with selected-team settings. Dashboard reads follow one explicit team or club scope, cancel stale loads, and link to dedicated management pages.

**Constraints:** No schema changes, real club creation or roster mutations during verification. Club edits require existing owner/admin membership. Creating a club does not move a team. Club-wide data must never show an arbitrary anchor team's weekly plan or combine unrelated team ranks into a leaderboard.

## Tasks

- [x] Add membership-aware Clubs panel with visible Add club/Edit club, name/description forms, failure retention, saved-write/refresh distinction, and tests for independent creation, permission gating and account isolation.
- [x] Integrate panel above team settings in all scopes; remove duplicate hidden club creation/rename forms. Preserve team affiliation and rubric controls, with refreshed selectors after club changes.
- [x] Consolidate dashboard to one overview, stats, today's workouts, team-specific weekly focus/performance, and admin requests. Remove duplicated roster editor, directory and org-summary queries. Test team/club scope, late response isolation, and unavailable data handling.
- [x] Run focused/full tests, lint, production build and diff review; update current context with exact scope and remaining visual-verification gap. Keep changes on current feature branch without live data mutations.

## Implementation receipt

Implemented on `feature/club-team-management-entry`, following local commit `30f9d65`.

- Settings now has a Clubs panel in team and All Teams scopes, including clubs with no teams. Add club creates independently; owner/admin Edit club updates name/description. Team affiliation remains explicit. Removed the hidden duplicate create/rename forms.
- Membership reads are account-filtered; load errors are surfaced. Form failures retain drafts. Pending reads block creation, repeated saves are locked, account changes discard late responses. Successful writes and selector refresh failures have separate recovery paths. Context refresh has an opt-in rejection contract without changing existing callers.
- Dashboard has one scope heading, statistics row and today's workouts; weekly focus and measured performance are selected-team-only. Removed duplicate organization summaries, editable roster and hierarchy directory, with their fetches. Club totals deduplicate athlete IDs and shared assignment summaries; no averaging team completion percentages or merging team ranks.
- Independent task/final reviews completed. Fixed both club review findings: pending snapshot overwrite and swallowed selector refresh errors.

Verification: focused 26 tests passed; complete suite **559 tests / 59 files** passed. `npm run build` passed. Lint passed with **0 errors / 115 existing warnings**, excluding retained native artifacts, updates and nested worktrees. `git diff --check` passed. No schema changes or live club/roster writes; signed-in visual/mobile walkthrough pending.

Existing service boundaries remain: organization creation and owner-membership insertion use separate writes, so partial creation failure still requires recovery; org-aware assignment queries retain their existing broad club semantics even for selected-team dashboard workouts; weekly completion stats suppress some underlying query failures. These are follow-ups rather than changes to permission/schema or assignment semantics in this UX slice.
