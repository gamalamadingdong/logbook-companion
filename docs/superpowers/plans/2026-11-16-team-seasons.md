# Team seasons implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist annual team rosters and their history, provide explicit season preparation/activation/archive, and expose an honest coaching context without requiring athlete accounts.

**Architecture:** Add team-owned seasons and roster snapshots alongside persistent teams/athletes. Existing `team_athletes` remains the operational roster; only explicit season activation changes it. Keep legacy records untouched until coaches explicitly adopt a roster into a season. Read historical roster snapshots instead of current athlete fields. Reuse existing scope context and UI primitives.

**Tech Stack:** PostgreSQL/Supabase RLS/RPC, React/TypeScript, Vitest, isolated Docker PostgreSQL regression tests.

## Global constraints

- `athletes.user_id` stays nullable; no seasonal operation requires/creates accounts or changes membership invitations.
- No automatic Titan/legacy backfill, inferred historical squads, deletion of results, or silent next-season assignment generation.
- Existing team permissions remain authoritative; season mutations require coach capability, never client-only gating. Historical roster snapshots are staff-only; do not expose private profile notes or broaden member access.
- Future draft seasons do not change operational roster or assignment eligibility. Activating a season is transactional, serialized per team, and updates operational participation; team account access persists.
- Archived roster names/grade/squads stay snapshots. Legacy history remains explicitly unclassified until reviewed.
- Do not show a season filter on an existing page unless that page actually follows it. Persistent team settings are not season-filtered.
- Existing source permissions/access helpers verified read-only via MCP on project `vmlhcbkyonemmlawnqqr`. Apply migrations only after local review/testing; no data adoption without coach confirmation.

## Task 1: Seasonal storage and transactional transitions

Files: `supabase/migrations/20261116215714_team_seasons_and_rosters.sql`, `scripts/tests/team_seasons.sql`, isolated SQL test runner.

Contract: `team_seasons(id,team_id,name,starts_on,ends_on,status,created_at)` where status draft/active/archived; `team_season_athletes(season_id,athlete_id,first_name,last_name,grade,squad,performance_tier,status)` immutable snapshots except explicit draft/current placement edits. `create_team_season(p_team_id,p_name,p_starts_on,p_ends_on,p_source_season_id,p_athlete_ids,p_copy_squads)` returns season UUID; null source copies explicitly selected legacy active participants, source UUID copies only selected source participants. Always creates draft. `activate_team_season(p_season_id)` archives previous active, atomically updates operational roster, no account changes. `archive_team_season(p_season_id)` stops current-season operational eligibility while retaining team access/history. Pending incomplete assignments in the outgoing season must block close/activation with actionable error rather than deletion. `set_team_season_squad(p_season_id,p_athlete_id,p_squad)` handles placements. Synchronize existing operational add/squad/grade/name/status writes into active snapshots, never draft/archived.

- [x] Write SQL regression assertions first: account-null participant rollover, excluded participants stay out, draft isolation, archive snapshot stability, permissions/cross-team denial, duplicate/retry safeguards, invalid dates/IDs, pending-work protection.
- [x] Implement schema, indexed keys, RLS, restricted grants, locked transitions, triggers; run SQL assertions in a fresh local PostgreSQL instance.
- [x] Review migration against live helpers and service expectations; fix integrity/security defects before apply.

## Task 2: Typed service boundary

Files: `src/services/coaching/teamSeasonService.ts`, `teamSeasonService.test.ts`, generated `src/types/database.types.ts` after migration.

Interfaces: export `TeamSeason`, `SeasonRosterAthlete`, `CreateTeamSeasonInput`; `listTeamSeasons(teamId): Promise<TeamSeason[]>`, `getSeasonRoster(seasonId): Promise<SeasonRosterAthlete[]>`, `createTeamSeason(input): Promise<string>`, `activateTeamSeason(id): Promise<void>`, `archiveTeamSeason(id): Promise<void>`, `setTeamSeasonSquad(id,athleteId,squad): Promise<void>`. Service validates input and projects only approved fields; server validates again.

- [x] Write failing Vitest tests for explicit IDs/empty selection/date validation and null-account round trip.
- [x] Implement service and domain helpers; check the runtime schemas against generated DB definitions, without `any`. The existing shared client remains untyped; converting it globally is outside this change.
- [x] Verify calls handle database errors and never create accounts or invitations.

## Task 3: Season preparation/history interface

Files: `src/pages/coaching/CoachingSeasons.tsx`, focused component tests, `src/components/coaching/CoachingNav.tsx`, `src/App.tsx`.

- [x] Add reachable Seasons workspace for selected team, prompt for explicit team in club overview.
- [x] Render historical/current/draft season roster snapshots with optional squad filter; show no-account/linked status without requiring account actions. Historical profile links must not substitute mutable current identity for snapshot presentation.
- [x] Preparation form defaults label `YYYY/YYYY+1` and editable dates, requires reviewed source and selected returning athletes; copying placements is opt-in. Preview shows names/count and confirms no account invitations or copied assignments. First adoption explicitly says current roster is a present-day snapshot, not reconstructed historical participation.
- [x] Activation/archive confirmation names team, season, eligibility consequences, retained access/history. On failure retain dialog and actionable error. Retry must not duplicate season creation.
- [x] Test explicit team, no-account selection, draft isolation, failed save retention, historical read-only state, context switches, and squad filtering.

## Task 4: Context clarity and integration

- [x] Make single-option Club/Team read as compact context and retain switching for multiple choices. Label club-wide scope explicitly; add season navigation without implying existing pages are season-filtered.
- [x] Add active-season context to operational roster and visible link to history; season management owns explicit historical selection initially. Existing settings remain persistent team settings.
- [x] Audit active-roster recipient queries for reliance on `team_athletes.status`; fix directly affected fanout to exclude inactive participants. Do not silently assign next-season drafts.
- [x] Ensure no-account add/bulk-add still synchronize current snapshots through database triggers and old code still works without any seasons.

## Task 5: Verification and rollout receipt

- [x] Run isolated PostgreSQL authorization/transaction/history assertions, focused UI/service suites, full app tests, production build, lint, and diff checks.
- [x] Run task/spec and final code reviews; fix load-bearing findings.
- [x] Apply additive migration via Supabase MCP, inspect columns/functions/policies and regenerate types. No real season creation/rollover on user's data.
- [x] Record exact implemented scope, live/local boundary, browser verification gaps, and follow-ups. Existing analytics/date presets and legacy results must not be described as migrated seasonal history.

## Follow-on boundary

Cross-page historical assignment/results/lineup editors, club-wide coordinated season calendars, account claiming, departure synchronization, one-active-team enforcement, and historical corrections are separate bounded follow-ons. This delivery preserves existing results and adds seasonal roster history/operational rollover; it does not infer historical membership or replace Concept2 seasons. Broader season selectors remain disabled until each consuming page supports them honestly.

## Verification and rollout receipt — November 16, 2026

Implemented on `feature/roster-lifecycle`, based on main `e19397c`. New workspace: `/team-management/seasons`. Coach mutations and staff snapshot reads follow the existing team/org helpers. Coxswains have read-only UI. Club/team choices collapse to text when there is only one option; mobile navigation retains visible labels.

The workspace supports reviewed source selection, explicit returning participants, optional copied squad placements, draft/current placement editing, and activation/archive confirmation. An empty source can bootstrap an empty roster; accounts remain optional. Names, grades, squads, tiers, participation status and account-link presence are snapshots. Operational roster changes synchronize only into the active season. Account access and invitations are not changed by transitions.

Draft preparation leaves existing operational behavior unchanged. Eligibility enforcement starts only after explicit activation. Closing a season blocks unresolved work; first adoption conservatively blocks any pending legacy team assignment. Assignment completion and result corrections remain possible after archive; reopening work must meet active-season eligibility. Archived snapshots restrict destructive athlete/team deletion to preserve history. Existing delete flows cannot erase these protected records; richer departure and correction UX remains follow-up work.

Assignment creation now reports saved-but-undelivered work instead of silently showing success. Club-wide recipients come exclusively from active roster junctions. The UI reloads the saved group for recovery when delivery or recipient lookup fails. Atomic group creation/delivery and broader assignment editing remain follow-ups.

### Verified

- `npm run test:run`: **543 tests, 56 files passed**.
- `npm run build`: passed; existing Vite large-chunk advisory remains.
- `npm run lint -- --ignore-pattern '.worktrees/**' --ignore-pattern 'android/**' --ignore-pattern 'ios/**' --ignore-pattern 'updates/**'`: **0 errors, 115 existing warnings**. Excludes unrelated retained worktrees/native output.
- `bash scripts/tests/run-team-seasons.sh`: passed against a fresh disposable PostgreSQL 16 container, cleaned up afterward. Covers nullable accounts, explicit selection, legacy/draft isolation, active synchronization, frozen history, invalid input, role and cross-team authorization, direct-write denial, pending work, idempotent retries and two-connection archive/reopening serialization.
- Independent security/spec review found and verified fixes for roster-update serialization, pending first-adoption assignments, completion-only reopening, coxswain UI gating, and org recipient/error handling. No remaining blocker in those reviewed changes.
- `git diff --check`: passed.

### Live boundary

Applied `team_seasons_and_rosters` through Supabase MCP on project `vmlhcbkyonemmlawnqqr`; migration history reports **20261116215714**, matching the local filename. Confirmed both tables have RLS; authenticated users cannot directly insert seasons/update snapshots; anonymous users cannot execute the new functions; trigger helpers are not directly callable; mutation functions enforce coach permission internally with an empty search path. Verified `athletes.user_id` is still nullable and its account FK remains `ON DELETE SET NULL`.

Regenerated `src/types/database.types.ts` from the live project. This also reflects preexisting live-schema drift (including development Concept2 tables and nullable athlete creator); it does not apply additional schema changes. No actual seasons, snapshots, roster rollovers or invitations were created: both new tables remain empty. No staging branch sync, UI deployment, push or PR was performed.

Security advisors add four expected warnings for authenticated execution of the coach-authorized SECURITY DEFINER RPCs. This access is intentional and independently checked inside each function; anonymous execution and direct table writes are denied. See [Supabase function-execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Other advisor findings predate this migration.

### Limits and next checks

No connected browser was available after bootstrap/discovery, so authenticated visual/mobile walkthrough remains unverified. Component tests cover context changes, StrictMode, failed save/activation/squad retention, account-optional selection and read-only history/coxswain controls. The SQL fixture mirrors live helper behavior but does not reproduce every existing operational-table RLS policy; live inspection verified the relevant helpers, grants and policy definitions without writing user data.

Results remain in their existing stores/views. This delivery does not backfill old results or membership, attach every result to a season, or make other coaching pages historical-season-aware. The approved broader strategy remains in the design document; club-coordinated calendars, season-aware results/assignments/lineups, claiming/departure, single-active-team enforcement, and historical corrections are follow-ups.
