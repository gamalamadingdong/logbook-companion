# Active Context

> Last updated: 2026-02-19

## Current Focus: Sprint 3 Wrap-up & Pre-Season Prep

### Sprint 1: Critical Bug Fixes (2026-02-11) ✅ COMPLETE

Full application audit identified 6 bugs + 1 bonus fix. All fixed and build verified (zero errors).

| Bug | File | Fix |
|---|---|---|
| B1 | `WorkoutComparison.tsx` | Dynamic Tailwind `text-${color}-500` replaced with static class map |
| B2 | `templateService.ts` + `TemplateDetail.tsx` | Wrong column names (`workout_date`→`completed_at`, `distance`→`distance_meters`, `time`→`duration_seconds`, `stroke_rate`→`average_stroke_rate`) |
| B3 | `App.tsx` + new `ResetPassword.tsx` | Missing `/reset-password` route — created page + added route |
| B4 | `Layout.tsx` | Brand name "Analyzer" → "Companion" |
| B5 | `Feedback.tsx` | No admin guard — added UUID check + `<Navigate>` redirect |
| B6 | `useConcept2Sync.ts` | Duplicate `findMatchingWorkout` block removed (~20 lines) |
| Bonus | `Login.tsx` | Copyright "2025" → "2026" |

### Build Fix Follow-ups (2026-02-11) ✅ COMPLETE
- Added `notes` + `training_zone` to `WorkoutLog` type to match DB usage
- Fixed `useConcept2Sync` interval typing for power buckets
- Typed `Promise.all` results in `CoachingAthleteDetail`
- Updated `Feedback` to use shared `useAuth` hook
- Allowed `TemplateDetail` tooltip formatter to accept `undefined`

### Team Management UX (2026-02-11) ✅ COMPLETE
- Created `TeamSetup.tsx` (onboarding for first-time coaches)
- Created `CoachingSettings.tsx` (team name, invite code, member management)
- Added routes `/coaching/setup` and `/coaching/settings`
- Dashboard redirects to setup when no team exists

### Unified Athletes Data Model (2026-02-11) ✅ COMPLETE
Retired `coaching_athletes` → unified `athletes` + `team_athletes` model. All coaching queries team-scoped.

---

## Next Work Plan

### Sprint 2: Error Handling & Missing Pages ✅ COMPLETE
- [x] Create 404/NotFound page + catch-all route
- [x] Add toast notification system (Sonner) — replace `alert()` calls
- [x] Extract baseline watts utility (duplicated in Analytics + WorkoutDetail)
- [x] Centralize `isAdmin` in AuthContext (replace hardcoded UUID checks)

### Sprint 3: Robustness & Data Quality ✅ COMPLETE
- [x] Dashboard: handle service errors gracefully (show error states, not silent fail)
- [x] C2 token refresh: proactive refresh before expiry, not just on 401 (see `src/api/concept2.ts`)
- [x] Template matching: surface unmatched workouts to user (WorkoutDetail suggestion banners)
- [x] Sync: add progress indicator (X of Y workouts)

### Sprint 4: UX Polish
- [x] Loading skeletons for Dashboard, Analytics, WorkoutHistory
- [x] Empty states for all list pages (no workouts, no templates, etc.)
- [x] Remove `console.log` statements from production code
- [x] Mobile nav: highlight active tab

### Sprints 5/6/7: Coaching Module Polish (2026-02-17) ✅ COMPLETE

13-item sprint across coaching module improvements. All items completed except Item 12 (deferred).

| # | Item | Status |
|---|---|---|
| 1 | Delete orphaned CoachingLog.tsx | ✅ Done |
| 2 | Athlete detail assignment history | ✅ Done |
| 3 | Athlete detail erg score sparkline chart | ✅ Done |
| 4 | Bulk completion entry on assignments | ✅ Done |
| 5 | Fix workout_type/name bugs (verified already fixed) | ✅ Done |
| 6 | Assignment editing modal | ✅ Done |
| 7 | Session-assignment linkage (SessionForm dropdown + SessionCard badge) | ✅ Done |
| 8 | Team stats dashboard card (athletes, squads, sessions, completion %) | ✅ Done |
| 9 | Height/weight in athlete detail (display + edit) | ✅ Done |
| 10 | CSV export for roster + erg scores | ✅ Done |
| 11 | Recurring assignments (daily/weekdays/weekly + repeat-until) | ✅ Done |
| 12 | Align CoachSessions to service layer | ⏭️ Deferred — CoachSessions.tsx operates on `erg_sessions` (ErgLink domain), not `coaching_sessions` |
| 13 | Activate self-service pages (MyTeamDashboard, MyScores routes) | ✅ Done |

**New files**: `src/utils/csvExport.ts` (reusable CSV download utility)
**Migration pending**: `db/migrations/20260217_add_assignment_to_sessions.sql` (adds `group_assignment_id` to `coaching_sessions`)
**CoachSessions finding**: Uses `erg_sessions`/`erg_session_participants` tables (11 raw supabase calls, user-level scoped). Would need new `ergSessionService.ts` + schema changes. Deferred to future sprint.
**Self-service routes**: `/team` → MyTeamDashboard, `/team/scores` → MyScores. `/team/notes` and `/team/settings` pages not yet created (links exist in MyTeamDashboard but will 404).

### Recent Changes
- **Multi-team support + team name display + Settings visibility (2026-02-20)**: Added `getTeamsForUser()` service function (returns all teams with name + role). Updated `useCoachingContext` hook from single-team to multi-team: exposes `teams[]`, `teamName`, `teamRole`, `switchTeam()`, persists selected team in localStorage. Updated `CoachingNav` to show team name badge (or dropdown switcher when multiple teams). Updated `CoachDashboard` to show team name as page title, team switcher dropdown, "+ New Team" button, and Settings in section nav pills. Updated `TeamSetup` to support creating additional teams (back link, contextual copy). Added `UserTeamInfo` type to coaching types. No DB migration required.
- **Roster row numbers + column sorting (2026-02-20)**: Added `#` column to CoachingRoster desktop table and mobile cards showing row index. Added click-to-sort on all desktop column headers (First, Last, Squad, Grade, Side, Experience, Height, Weight) with ascending/descending toggle and sort direction indicators (ArrowUpDown / ChevronUp / ChevronDown icons). Sorting uses `useMemo` for performance; experience level sorts by progression order (beginner→advanced). Mobile cards reflect sort order and show number prefix.
- **Documentation updated with Coaching & Teams tab (2026-02-19)**: Added new "Coaching & Teams" tab to `src/pages/Documentation.tsx` with comprehensive documentation covering: Getting Started (team setup flow), Roles & Permissions (coach/coxswain/member), Roster Management (profiles, squads, bulk import, CSV export, inline editing), Workout Assignments (calendar view, compliance matrix, recurring, smart results entry, quick score), Erg Score Tracking (standard distances, trend arrows, athlete progression charts), Schedule & Sessions (practice types, athlete notes, weekly focus plans), Boatings & Lineups (all boat classes, duplicate/copy), Team Analytics (zone distribution, squad power, W/kg), and Athlete Self-Service (my team, my scores, join/leave). Updated `src/pages/About.tsx`: added Team Management showcase section with Roster, Assignments, and Boatings cards + link to coaching docs; replaced outdated "No Coaching Plans" limitation with "Not a Training Prescription Service" wording; added `Users` icon import.
- **Invite email sending wired via Supabase Edge Function (2026-02-19)**: Added `supabase/functions/send-team-invite/index.ts` (Resend-backed) with auth token validation, team-role authorization (coach/coxswain), invite-code/link payload handling, and HTML invite template delivery. Added `sendTeamInviteEmail()` in `src/services/coaching/coachingService.ts` using `supabase.functions.invoke('send-team-invite')`. Updated `src/pages/coaching/CoachingSettings.tsx` with new **Email Invite** action in Add Member section including loading/success/error states. Added deployment/setup notes in `supabase/functions/README.md` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, deploy/serve commands).
- **Assignments results modal input-reset/infinite-fetch fix (2026-02-18)**: Fixed repeated `getAthleteAssignmentRows()` fetch loop that was resetting typed values in Enter Results. Root cause was unstable workout-shape references in modal effect dependencies (`shape.variableReps` object identity churn). `ResultsEntryModal` now memoizes computed shape with `useMemo`, loads rows with cancellation-safe effect logic, and depends on stable shape object rather than unstable nested array references.
- **Assignments results modal rep-input semantics fix (2026-02-18)**: Updated Team Management → Assignments `Enter Results` interval columns/inputs to follow prescribed work type per rep: fixed/timed work now prompts for **distance** (`m`), fixed/distance work prompts for **time** (`m:ss.s`). Applied to `distance_interval`, `time_interval`, and `variable_interval` ladders so mixed/time-based ladders no longer show time-entry fields for timed reps.
- **Results modal structure-first classification + name-text protection (2026-02-18)**: Fixed Team Management → Assignments `Enter Results` misclassification for ladder workouts when `canonical_name` is non-parseable/stylized (e.g., `v1:00...7:00 Ladder`). `getGroupAssignments()` now loads template `workout_structure`, `GroupAssignment` carries `workout_structure`, and `ResultsEntryModal` now classifies entry shape from `workout_structure` first; if absent, it parses only `canonical_name` (no `template_name`/`title` parsing). Friendly/display names remain labels only. Added regression in `src/utils/workoutEntryClassifier.test.ts` using the exact variable ladder JSON (`1:00 + 3:00 + 7:00` with `5:00r`). Focused classifier tests pass (`4/4`).
- **Variable-list interval parsing support (2026-02-17)**: Added native `parseRWN()` support for variable-list interval syntax used by templates: `v500m/1000m/1500m`, `500m/1000m/1500m`, and `v1:00/3:00/7:00`. Added rest-token detection so two-part work/rest shorthand (e.g., `15:00/2:00r`) continues to parse as single interval instead of variable list. This improves workout template assignment parsing/detection for new interval-style workouts and feeds smart results entry classification (`variable_interval`) correctly.
- **Regression coverage expanded (2026-02-17)**: Added parser tests for variable-list notation in `src/utils/rwnParser.test.ts` and classifier test coverage for `v`-prefixed variable lists in `src/utils/workoutEntryClassifier.test.ts`. Focused suites pass (`43/43`).
- **Variable ladder results-entry fix (2026-02-17)**: Hardened smart results classification for assignment entry when canonical parsing is weak or missing. `parseCanonicalForEntry()` now normalizes notation (including full-width plus `＋`) and includes a fallback parser for ladder segments like `1:00/5:00r + 3:00/5:00r + 7:00/5:00r`, ensuring they classify as `variable_interval` with per-rep fields. `ResultsEntryModal` now falls back to `template_name`/`title` when `canonical_name` is null. Added regression tests in `src/utils/workoutEntryClassifier.test.ts` for both standard and full-width-plus ladder notation.
- **Team management navigation refresh (2026-02-17)**: Updated `src/pages/coaching/CoachDashboard.tsx` to move section navigation from the bottom card grid to the top of the page. Replaced card-style section links with a compact horizontal pill navigation bar for faster section switching (Roster, Schedule, Assignments, Boatings, Analytics, Live Sessions).
- **Hub → LC SSO consumer bootstrap (2026-02-17)**: Added `src/pages/AuthBootstrap.tsx` and route `/auth/bootstrap` in `src/App.tsx`. Flow reads `ssoToken` query + session tokens from URL hash, establishes LC session via `supabase.auth.setSession`, consumes one-time handoff via `consume_sso_handoff(..., p_expected_target='lc')`, and redirects to consumed internal `requested_return_to` (or sanitized fallback `returnTo`).
- **LC → Hub SSO handoff issuer (2026-02-17)**: Updated `src/pages/Login.tsx` cross-origin redirect behavior for Hub targets (`readyall.org` / `train-better.app`) to issue one-time handoff tokens via `create_sso_handoff('lc','hub',...)` and redirect to Hub `/auth/bootstrap` with short-lived session hash payload. Preserved existing local-path redirects and non-Hub absolute redirects.
- **Unified auth hardening + telemetry (2026-02-15)**: Added loop protection and redirect safety checks to login `returnTo` handling (blocks `/login`/`/auth` loops, origin allowlist enforcement, hop threshold). Added auth redirect telemetry events (`auth_redirect_start`, `auth_redirect_success`, `auth_redirect_error`) via new `src/utils/authTelemetry.ts` with support for `gtag`/`plausible` and custom browser event dispatch.
- **Unified auth readyall domain hardening (2026-02-16)**: Added explicit `https://readyall.org` and `https://www.readyall.org` to LC login `returnTo` allowlist in `src/pages/Login.tsx` so Hub redirects remain valid even if `VITE_HUB_URL` is not set. Added `VITE_HUB_URL=https://readyall.org` to `.env.example` for explicit environment configuration.
- **Theme sync hardening (2026-02-16)**: Updated `src/hooks/useTheme.tsx` to default LC to light mode and to prefer `user_profiles.preferences.theme` over stale local storage when resolving theme on load, ensuring cross-app (ReadyAll ↔ LC) preference changes are respected.
- **Documentation deep-link support (2026-02-16)**: Updated `src/pages/Documentation.tsx` to support query-param tab navigation (`tab` + `rwnSubTab`) so external surfaces (ReadyAll) can link directly to the LC RWN interactive playground tab.
- **Hub auth handoff marker (2026-02-16)**: Superseded by one-time SSO handoff issuance in `src/pages/Login.tsx` (2026-02-17).
- **Unified auth Phase 1 foundation (2026-02-15)**: Added `returnTo` auth redirect contract in LC. `ProtectedRoute`/`CoachRoute` now redirect to `/login?returnTo=...` preserving destination path. `Login.tsx` now validates and honors `returnTo` for both local paths and allowlisted absolute URLs, including transition compatibility for `https://logbook-companion.vercel.app` and new domains (`train-better.app`, `logbook.train-better.app`).
- **Hub scaffold complete (2026-02-15)**: Scaffolded `train-better-hub` with Next.js 16 (App Router), TypeScript strict, TailwindCSS. 10 routes (Home, Products, Athletes, Coaches, Community, Docs, Roadmap, Feedback, Support, 404). Shared type convention at `src/lib/types/` (database, shared, supabase, barrel). Supabase client wired. Build verified clean. Pushed to GitHub.
- **Workspace ecosystem docs aligned (2026-02-15)**: Updated `copilot-instructions.md` in all 3 repos (LC, EL, Hub) with identical Workspace Directory Map table documenting all directories, shorthand names, repos, tech stacks, deployment targets, and roles. Created `train-better-hub/.github/instructions/copilot-instructions.md` and `train-better-hub/working-memory/` docs (activeContext, projectBrief, systemPatterns, techContext). EL instructions got new "App Ecosystem" section. LC instructions updated from stale CL reference to current 3-repo map.
- **OCR code preservation + deep-dive completed (2026-02-15)**: Extracted the Train Better OCR pipeline into `working-memory/extracted-ocr/` (TypeScript client/parser + Python Azure Function pipeline + requirements) and added `working-memory/train-better-ocr-deep-dive.md` with reusable concepts, migration boundaries, phased LC integration strategy, risk controls, and immediate issue-ready next task.
- **Phase A kickoff pack created (2026-02-15)**: Added `working-memory/train-better-phase-a-kickoff-pack.md` with copy/paste-ready GitHub issue templates for Epics 1-5, recommended labels, board column/field setup, Phase A DoD, reusable Phase A task template, and suggested initial setup task list to execute the Train Better change roadmap.
- **Train Better phased roadmap + execution spec (2026-02-15)**: Added `working-memory/train-better-change-roadmap-spec.md` as the implementation-facing artifact tying architecture and domain plans into a phase-gated program (Phase A-F), with entry/exit criteria, workstream specs, dependencies, risk controls, analytics requirements, and issue-ready epics.
- **Decision worksheet added (2026-02-15)**: Extended `working-memory/train-better-site-architecture.md` with Section 10 "Decision Worksheet (Split + Naming)" including weighted scorecards, explicit go/no-go thresholds, required evidence checklist, decision templates, and immediate kickoff checklist for split execution.
- **Coaching app split + naming planning (2026-02-15)**: Expanded `working-memory/train-better-site-architecture.md` with a formal app-boundary strategy: keep unified app during season, define split-readiness triggers, and document phased migration to `coach.train-better.app` while retaining shared Supabase/auth. Added naming exploration for whether to keep "Logbook Companion" (recommended short-term) vs soft/hard rename paths, with decision criteria and post-season validation gate.
- **Train Better hub architecture + wireframes (2026-02-13)**: Added `working-memory/train-better-site-architecture.md` with umbrella brand model, IA/site map, page-level layout blueprint, cross-site communication model, MVP implementation sequencing, and ASCII wireframes for desktop/mobile home, product detail, and coach journey pages. This is a companion planning doc to `working-memory/domain-rollout-plan.md` (same folder, separate purpose).
- **Domain migration runbook expanded (2026-02-13)**: Upgraded `working-memory/domain-rollout-plan.md` from high-level phases to a one-pass operational checklist covering DreamHost DNS, Vercel domain mapping/certs/redirects, Supabase auth URL updates, Concept2 callback allowlist updates (`/callback`), Resend domain verification/sender updates, GitHub public link updates, env var audit, cutover validation order, and rollback steps.
- **Domain + community rollout planning docs (2026-02-13)**: Added `working-memory/domain-rollout-plan.md` with phased domain strategy centered on `train-better.app` umbrella + `log.train-better.app` for Logbook Companion and `erg.train-better.app` for ErgLink. Added `working-memory/practice-test-scripts.md` with 6 manual test scripts (quick score, completion-only, squad assign, invite/join, boatings ops, support flow), pass criteria, feedback prompts, and weekly cadence.
- **Quick score entry completed (2026-02-13)**: Wired `QuickScoreModal` into `CoachingRoster.tsx` so clicking a red "Missing" badge opens inline quick entry for that athlete. Added roster refresh path that reloads both athletes and same-day assignment completions after save. Modal writes score via `quickScoreAndComplete()` (erg score + assignment completion linkage) or supports mark-complete-only mode. Also fixed modal assignment `<select>` accessibility naming (`htmlFor`/`id` + `aria-label`).
- **Coaching accessibility + lint cleanup (2026-02-13)**: Fixed assignment form accessibility warnings by adding explicit label associations (`htmlFor`/`id`) and accessible names for selects in `CoachingAssignments.tsx` (template select and squad select, plus date input association). Removed dead/unused roster completion scaffolding (`completedAthleteIds`, `allAssigned`, `assignedAthleteIds`) from `CoachingRoster.tsx` to resolve TS6133 noise and keep roster logic focused on missing-athlete status.
- **Community support messaging (2026-02-13)**: Added a new "Community Supported" section to public About page with GitHub Sponsors CTA (`VITE_GITHUB_SPONSORS_URL`, defaulting to `https://github.com/sponsors/gamalamadingdong`) and public roadmap CTA (`VITE_PUBLIC_ROADMAP_URL`, defaulting to `https://github.com/gamalamadingdong/LogbookCompanion/issues`). Also typed `FeatureCard` props in `About.tsx` (removed `any`).
- **Squad tagging (2026-02-12)**: Added free-form `squad` TEXT column to `team_athletes` junction table (not `athletes`, because squad is team-specific). Migration: `db/migrations/20260212_add_squad_to_team_athletes.sql` — needs manual execution in Supabase. Service layer: `getAthletes()` returns squad from join, `createAthlete()` accepts optional squad, new `getTeamSquads(teamId)` returns distinct names, new `updateAthleteSquad(teamId, athleteId, squad)` updates junction row. UI: all 4 coaching pages updated — CoachingRoster (filter + badge + form field), CoachingAthleteDetail (badge + edit form field), CoachingErgScores (squad filter dropdown), CoachingBoatings (squad filter + form athletes filtered). Squad autocomplete via `<datalist>` from existing squad names. Architectural note: no new single-team assumptions introduced — future multi-team refactor still concentrated in `coachingService.ts` (LIMIT 1) and `useCoachingContext.ts` (single teamId).
- **Dashboard error handling (Sprint 3 complete)**: Refactored `useDashboardData` to track per-section errors independently. Created reusable `SectionError` component. Each dashboard section (meters, goals, history, workouts, C2 profile) now fails gracefully with inline error + retry, instead of one generic banner. `retry()` function exposed for "Retry All".
- **Weekly Focus card**: New `coaching_weekly_plans` table (migration in `db/migrations/`). `WeeklyFocusCard` on CoachDashboard — set/edit weekly theme, focus points (bullet list), and notes. Week navigation with prev/next. Integrated via `upsertWeeklyPlan()` (upsert on team_id + week_start). Migration needs manual execution in Supabase.
- **Icon overhaul (feature/rowing-icons branch)**: RowingShellIcon (top-down 8+), ErgIcon (C2 motif), CoxboxIcon (pulse waveform). Nav swapped to Lucide: Ergs=Trophy, Live=Activity, Library=Library. Dead code: ErgIcon/CoxboxIcon exports in RowingIcons.tsx no longer imported.
- **Light theme palette fix**: CSS overrides in `index.css` expanded from neutral-only to full accent coverage. Added overrides for emerald, indigo, blue, red, amber, yellow, green, rose, cyan, purple, orange, teal text colors (-200/-300→-800, -400→-700, -500→-600). Added accent bg overrides (-900/xx→-50/-100, -500/10/20→-50/-100). Added accent border overrides. Neutral text-400→text-500 (was text-600 — bumped for better muted readability). ~1,100+ accent color instances now properly theme-aware.
- **Power Profile feature plan**: Full implementation plan written to `working-memory/implementation_plan.md`. Three-phase plan: Phase 1 (MVP) builds `powerProfile.ts` engine, `PowerProfileChart.tsx`, `PowerProfileAnalysis.tsx`, and integrates into Analytics page. Phase 2 adds date filtering, test vs training toggle, sliding window analysis. Phase 3 adds coaching integration, historical animation, materialized DB table. KB research documented in `kb/physiology/power-duration-curve.md`.
- **Stale session recovery (2026-02-12)**: Fixed app hang when Supabase refresh token expires. Added 8s safety timeout in `AuthContext`, `clearStaleSession()` escape hatch, and `AuthLoadingScreen` component with "Trouble signing in?" link after 3s. Handles both local dev and production.
- **Power Profile interval fix (2026-02-12)**: Critical data quality bug — interval workouts (2x1000m, 3x10:00, VariableInterval) were being treated as continuous efforts at the total distance. A 2x1000m with `distance_meters=2000` was incorrectly matching the 2k anchor. Fix: `isIntervalWorkout()` helper checks `canonical_name` (primary, via regex patterns for multi-rep, variable, and block structures) then falls back to `workout_name` (C2 `workout_type` column swap) for "Interval" keyword. Interval workouts skip whole-workout anchor matching (steps A/B/C); only individual interval splits from `raw_data.workout.intervals` are used (step D). Added `workout_name` and `canonical_name` to Supabase select in `PowerProfileTab.tsx`. 10 new tests covering: 2x1000m, 3x10:00, 5x1500m, VariableInterval, continuous regression, standalone vs interval preference, plus 4 canonical_name-specific tests (canonical overrides workout_name, variable "v" prefix, block parens, continuous canonical). All 34 tests pass, tsc clean, vite build clean.
- **Athlete self-service pages (2026-02-12, PARKED)**: Created `JoinTeam.tsx`, `MyTeamDashboard.tsx`, `MyScores.tsx` + service functions (`joinTeamByInviteCode`, `getMyTeamMembership`, `leaveTeam`, `getMyErgScores`, `getMySessionNotes`). Not routed — dormant for now. Decision: athletes with accounts DO get value (full LC analysis + future team features), but not gating on this for launch.
- **Known secondary bugs found during audit**: (1) `recommendationEngine.ts` hard session detection checks `workout_type` which is "rower" — always returns 0 hard sessions. (2) `workoutService.ts` canonical name fallback compares `workout_type` against "FixedDistanceSplits" etc. — dead code for same reason. Both caused by the `workout_type`/`workout_name` column swap.
- **Experience level values (2026-02-13)**: Changed from novice/freshman/jv/varsity to beginner/intermediate/experienced/advanced. Updated types, UI (CoachingRoster, CoachingAthleteDetail badge colors + form options), and DB constraint (migration `20260213_update_experience_level_values.sql`, executed).
- **C2 token refresh fix (2026-02-13)**: Expanded fatal refresh detection to include "refresh token is invalid" and "token has been revoked" messages, not just `invalid_grant` error code. Proactive interceptor only rejects on truly fatal errors.
- **Quick squad assign (2026-02-13)**: Toggle button on CoachingRoster for inline squad editing. `QuickSquadInput` component with `<datalist>` autocomplete, blur/Enter to commit, optimistic save.
- **Invite flow (2026-02-13)**: (1) `addTeamMemberByEmail()` service function — looks up `user_profiles` by email, checks existing membership, inserts `team_members`. (2) CoachingSettings UI: "Copy Invite Link" button + "Add Member" section with email input, role dropdown, success/error feedback. (3) `/join` route wired up — JoinTeam.tsx switched from `useParams` to `useSearchParams` to match `?code=XXX` link format. Wrapped in `ProtectedRoute`.
- **isCoach derived from team_members (2026-02-13)**: Replaced `user_profiles.roles.includes('coach')` check with `team_members` query (`role='coach'` in any team). Promoting someone in Settings now automatically grants coaching route access on next login/refresh. `user_profiles.roles` no longer used for coach gating.
- **Boatings UX overhaul (2026-02-13)**: (1) **Inline seat editing**: Click any seat in expanded `BoatDiagram` to get dropdown, select athlete, auto-saves via `handleInlinePositionUpdate()` with optimistic update. (2) **Side-sorted dropdowns**: In both form and inline edit, sweep boat seats show athletes with preferred side first (even=port, odd=starboard). Side indicator shown: P/S/B. (3) **Copy Previous Day**: Button copies all lineups from most recent prior day. (4) **Quick seat swap**: Click swap icon on a seat, then click target seat to swap athletes. Visual feedback with amber ring highlighting.

---

## App Status

### CL → LC Merge: ✅ COMPLETE
All 5 phases done. CL repo archived. Coaching module lives at `/coaching/*` with role-based gating.

### Service Layer: `src/services/coaching/coachingService.ts`
Full CRUD for athletes, sessions, notes, erg scores, boatings — all team-scoped via `team_id`. Uses `throwOnError<T>()`.

### Key Hook: `src/hooks/useCoachingContext.ts`
Resolves `userId` and `teamId` from `team_members`. All coaching pages consume this.

---

## Coaching Season Context
- **Season**: Feb 17 – May 2, 2026 (11 weeks to Virginia State Championships)
- **Athletes**: 13–14 year old novice boys, none have raced
- **Fleet**: 2 × 8+ (both boats race at States)
- **Staff**: Head coach + 2–3 assistants
- **Plans**: `kb/coaching-plans/novice-8th-boys-spring-2026.md`

---

## Key Architecture (Quick Reference)
- **Unified Athletes**: `athletes` table + `team_athletes` junction. `CoachingAthlete` includes computed `name` field.
- **Team Scoping**: All coaching data accessed via `team_id`, not `coach_user_id`.
- **RWN**: Rowing Workout Notation — interchange format. Spec in `rwn/RWN_spec.md`
- **Data Fetch Pattern**: `isLoading` initialized `true`, `.then()` in `useEffect`, `.finally(() => setIsLoading(false))`
- **ESLint**: Strict — `no-explicit-any`, `set-state-in-effect`, `no-unused-vars`
- **Sam's user ID**: `93c46300-57eb-48c8-b35c-cc49c76cfa66`, roles: `['athlete', 'coach']`

---

## Next Up: Smart Results Entry Modal ✅ COMPLETE

**Completed 2026-02-17**: Upgraded Results Entry Modal from manual-entry-of-all-fields to smart workout-type-aware entry.

### Architecture Decision
Coach quick-capture results stay on `daily_workout_assignments` (lightweight), not `workout_logs` (athlete-owned). The `completed_log_id` FK exists for future upgrade when athletes have accounts. Canonical name is accessible via `group_assignments → workout_templates` join for full workout reconstruction.

### Smart Entry System
Parses canonical name (RWN) to classify workout type and show only the dependent variable:
- **fixed_distance** (e.g. 10000m): enter time + spm → split auto-computed
- **fixed_time** (e.g. 30:00): enter distance + spm → split auto-computed
- **distance_interval** (e.g. 4x500m/1:00r): per-rep time + spm
- **time_interval** (e.g. 3x10:00/2:00r): per-rep distance + spm
- **variable_interval**: mixed per-rep details based on each rep's fixedType
- **freeform** (unknown): time + distance + spm fallback

### Files Created/Modified
- **NEW**: `src/utils/workoutEntryClassifier.ts` — `parseCanonicalForEntry()`, `computeSplit()`, `fmtTime()`, `parseTimeInput()`, `EntryShape` type
- **NEW**: `db/migrations/20260217_add_result_stroke_rate.sql` — adds `result_stroke_rate integer` to `daily_workout_assignments`
- **MODIFIED**: `src/services/coaching/coachingService.ts` — `IntervalResult` + `AthleteAssignmentRow` + query/save updated with `stroke_rate`/`result_stroke_rate`
- **MODIFIED**: `src/pages/coaching/CoachingAssignments.tsx` — ResultsEntryModal fully rewritten to use smart fields, imports from workoutEntryClassifier, removed inline fmtTime/parseTime helpers, removed manual interval +/− controls (reps come from canonical)

### UI Labels
- Uses "SPM" (strokes per minute) not "SR" per user preference
- Split shown as read-only auto-computed field
- Interval rep headers show rep labels from canonical (e.g. "R1", "R2") with variable rep labels when applicable
- Shape label shown in modal subtitle for context

### Previous Results Entry & Compliance Grid (2026-02-17)
- Compliance Grid (athletes × assignments matrix) — unchanged
- DB columns: `result_time_seconds`, `result_distance_meters`, `result_split_seconds`, `result_stroke_rate`, `result_intervals` (jsonb)
- RLS: 4 team-scoped policies on `daily_workout_assignments`

## Program Execution Next Step (Train Better)

Immediate execution artifact is now ready in `working-memory/train-better-phase-a-kickoff-pack.md`.

Use it to:
1. Create the Train Better project board with recommended columns/fields/labels.
2. Open Epic 1-5 issues using the provided copy/paste templates.
3. Complete Phase A by sizing, assigning owners, and prioritizing all Phase B tasks.

OCR integration prep is now complete at planning level. Next implementation candidate is to open an issue for `[OCR][Phase 1] Add web OCR ingestion path for missing/manual workouts` using the module boundaries and deliverables in `working-memory/train-better-ocr-deep-dive.md`.

### Context Gathered
Read all spec files and ran a full audit of both repos. Here's what exists vs. what's needed:

| Spec Element | Status |
|---|---|
| C2 OAuth + Sync | **DONE** — full production sync with reconciliation |
| Reconciliation engine | **DONE** — source priority Gold/Silver/Bronze in `reconciliation.ts` |
| Template matching | **DONE** — auto-match by canonical name in `templateMatching.ts` |
| Assignment DB schema | **DONE** — `group_assignments` + `daily_workout_assignments` tables |
| Assignment linking (C2 sync) | **PARTIAL** — C2 sync auto-links, but no UI to create/manage assignments |
| Roster "Missing" filter | **NOT BUILT** — roster filters by squad only |
| Smart Form (template-aware entry) | **NOT BUILT** — no pre-filled interval grid |
| OCR / Image capture | **NOT BUILT** — no `ErgImageProcessor` |
| ErgLink BLE data reading | **DONE** — Web + Native |
| ErgLink workout programming | **PARTIAL** — Web BLE full, Native stubbed |
| ErgLink session join flow | **PARTIAL** — service exists, no dedicated PIN screen |
| ErgLink → C2 upload | **NOT BUILT** — uploads to Supabase only |
| ErgLink stroke buffering | **DONE** — IndexedDB `StrokeBuffer` |
| ErgLink session real-time | **DONE** — Supabase Realtime + polling |
| Coach quick-capture | **NOT BUILT** |
| Athlete self-service entry | **NOT BUILT** — pages created but parked |

### Key Spec Files (already read)
- `working-memory/feature-specs/workout-capture-system.md` — master spec (Swiss Cheese strategy)
- `working-memory/workflow-requirements.md` — RWN Trinity, sync workflows, canonical rules
- `erg-link/working-memory/analysis/ux_journeys.md` — 5 UX scenarios
- `erg-link/working-memory/systemPatterns.md` — Relay Pattern architecture

### What to Do When Resuming
1. **Develop phased implementation plan** — prioritize by season urgency (season starts Feb 17)
2. Phase 1 candidates (immediate value, LC-only): Assignment UI, Smart Form, Roster missing filter
3. Phase 2 candidates (ErgLink integration): Session PIN screen, Native workout programming, C2 upload
4. Phase 3 candidates (polish): OCR, Coach quick-capture, Athlete self-service

### ErgLink Integration (Future)
- Support `target_*_max` fields (ranges) in PM5 programming
- Enables: RWN → LC templates → ErgLink → PM5
