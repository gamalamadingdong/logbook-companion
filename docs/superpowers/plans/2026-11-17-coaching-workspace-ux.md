# Coaching workspace UX implementation plan

> For agentic workers: use subagent-driven-development for isolated service/schedule tasks, integrate the dashboard and review the complete change. Track checkboxes and verification here.

**Goal:** Help staff understand the selected club/team, open today's training and record attendance/results without searching through several pages.

**Architecture:** Retain CoachingContext, existing permissions, Schedule session deep links and assignment results pages. Introduce a small read-only dashboard service with explicit accessible-team scope. Load dashboard sections independently; isolate asynchronous results by account/scope. Do not change shared legacy assignment semantics for unrelated consumers.

**Tech Stack:** React, TypeScript, existing shared UI components, Supabase client, Vitest.

## Product direction and boundaries

The approved direction is a Today-first dashboard, consistent club/team scope, direct task destinations, a compact club overview, less duplicated planning/navigation, role-relevant actions and mobile-friendly layouts. Account-free athletes and existing role/data protections stay intact. Implement phases separately; phase 1 is the executable change in this branch. Phases 2–4 are a sequenced roadmap, not a claim that they are implemented.

One team means that team's practices and assignments plus shared club workouts, with completion restricted to the selected accessible roster. All Teams means all accessible teams in the current club. Never derive action destinations from an arbitrary anchor team. RLS remains authoritative. Requests for another club cannot appear as if they concern the selected team. Archived season selection does not silently filter operational data.

### Phase 1: Today and scope consistency — execute now

- [ ] Task 1 — scoped dashboard service (`src/services/coaching/teamDashboardService.ts`, matching test): define `DashboardScope { teamIds: string[]; orgId: string | null; date: string }`; export `getDashboardWorkouts(scope)` and `getDashboardPractices(scope)`. Workouts return `{ assignment: GroupAssignment; total: number; completed: number }[]`. Practices return `CoachingSession[]`. Use effective-access IDs supplied by context, unique IDs, exact date and scope filters; include shared club assignments only for the current club. Completion rows must intersect scoped roster athlete IDs; do not reuse full-club totals. Query failures throw instead of becoming false empty states. Empty scopes perform no reads. Tests: two-team and selected-team visibility, shared deduplication, out-of-club/other-team exclusion, completion boundaries, empty scope and rejected reads. Write failing tests, run focused Vitest, implement and rerun.
- [ ] Task 2 — Schedule All Teams (`src/pages/coaching/CoachingSchedule.tsx`, focused scope test): aggregate sessions, athletes and crews across accessible teams when All Teams is selected. Filter org-returned assignments to those teams plus shared club assignments. Selected-team behavior remains exact. Preserve actual session team for editing, attendance and lineup destinations; require a team destination for creation in All Teams rather than silently using anchor. Isolate late loads after scope changes. Verify with selected-team/all-team, inaccessible-team and scope-switch regression tests; preserve existing SessionCard role tests. Avoid changes to database policies or global assignment helper semantics.
- [ ] Task 3 — Today-first dashboard (`src/pages/coaching/CoachDashboard.tsx`, test): header with date/scope; Today practice and workout sections first, compact roster link/count and weekly focus afterward. Each practice links to `/team-management/schedule?date=YYYY-MM-DD&sessionId=ID`; selecting a cross-team practice must set that team context before navigating. Each workout links to its exact `/team-management/assignments/ID/results` destination. Use truthful `Open practice` and `View results` labels unless destination actually opens the entry flow. Label shared club workouts and clarify completion is for the selected roster. Show incomplete-workout counts as `Not recorded complete`, never missed-training judgments. Keep weekly focus available for one selected team. Remove unbounded `Season Leaderboard` from dashboard; retain Analytics navigation. Remove account-wide coaching request panel from this team-scoped overview; review requests remains a subsequent explicitly scoped admin task. Independent loading, errors and retry for practices/workouts/roster; one failure must not hide other sections. Key sections by user/org/team/date to reject stale loads. No false all-complete state for zero recipients. Tests cover exact destinations, ordering, partial failure/retry, empty states, coxswain/read-only behavior, scope switching, no-team setup redirect, shared counts and no misleading season label.
- [ ] Task 4 — integration/review: inspect new query boundaries and team destinations against existing permission rules; review 320px markup, touch targets >=44px, shared theme tokens, empty/loading/error states. Run focused tests, all app tests, build, lint (exclude preserved worktrees/native/generated artifacts), diff check. Browser walkthrough if a connected browser is available; otherwise explicitly report that limit. Update working memory and this receipt. Commit feature for review; migrations/functions are not expected.

## Subsequent phases

### Phase 2: Club overview and scope visibility

Display an accessible-team row per club team with roster size, today's training and Open team. Show shared events/workouts once with clear club labels. Keep single-team clubs direct and quiet. Review every aggregate for deduplication and date semantics; do not sum percentages. Selected club/team label is displayed once in a consistent header. Show active roster season as context only, with an explicit route to roster history; do not imply all pages use that season.

### Phase 3: Daily navigation and planning ownership

Keep Overview, Roster, Schedule, Workouts and Analytics prominent. Keep Live reachable as a tool; Seasons and administration remain easy-to-find secondary destinations. First compare desktop/mobile navigation alternatives before implementing. Weekly focus has one editing destination and a short dashboard summary; Schedule reuses the same plan. Eliminate the second embedded schedule surface, while preserving useful weekly sharing/export and reflection workflows. Administration/request review gets explicit club/account labels and its own discoverable destination before restoring scoped badges.

### Phase 4: Role actions and mobile refinement

Coach actions emphasize planning, roster and performance. Coxswain actions emphasize practice, attendance, crews and results. Admin actions emphasize access, team/club settings and transitions. Reuse one workspace with capability-gated actions; do not add role dashboards or broaden RLS. On phones, use compact scope controls, stacked Today cards and a short primary navigation. Validate keyboard/focus, themes, long names, large rosters, virtual keyboard and 320px layout in a signed-in browser. Add attention items only when the existing data can determine their state reliably; distinguish incomplete recording from athlete nonparticipation.

## Acceptance and verification receipt

Pending phase-1 implementation. No production writes or migration are authorized by this read-only dashboard work. Prior PR #247 is merged at `088288c`; this branch starts there. Browser discovery in the preceding review found no connected browsers; check again for rendered verification if availability changes.
