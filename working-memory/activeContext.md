# Active Context

> Last updated: 2026-02-13

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

### Recent Changes
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

## Next Up: Workout Capture Implementation Plan

**Status**: Research complete, plan needed. Resume here.

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
