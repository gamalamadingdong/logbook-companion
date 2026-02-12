# Active Context

> Last updated: 2026-02-12

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
- **Dashboard error handling (Sprint 3 complete)**: Refactored `useDashboardData` to track per-section errors independently. Created reusable `SectionError` component. Each dashboard section (meters, goals, history, workouts, C2 profile) now fails gracefully with inline error + retry, instead of one generic banner. `retry()` function exposed for "Retry All".
- **Weekly Focus card**: New `coaching_weekly_plans` table (migration in `db/migrations/`). `WeeklyFocusCard` on CoachDashboard — set/edit weekly theme, focus points (bullet list), and notes. Week navigation with prev/next. Integrated via `upsertWeeklyPlan()` (upsert on team_id + week_start). Migration needs manual execution in Supabase.
- **Icon overhaul (feature/rowing-icons branch)**: RowingShellIcon (top-down 8+), ErgIcon (C2 motif), CoxboxIcon (pulse waveform). Nav swapped to Lucide: Ergs=Trophy, Live=Activity, Library=Library. Dead code: ErgIcon/CoxboxIcon exports in RowingIcons.tsx no longer imported.
- **Light theme palette fix**: CSS overrides in `index.css` expanded from neutral-only to full accent coverage. Added overrides for emerald, indigo, blue, red, amber, yellow, green, rose, cyan, purple, orange, teal text colors (-200/-300→-800, -400→-700, -500→-600). Added accent bg overrides (-900/xx→-50/-100, -500/10/20→-50/-100). Added accent border overrides. Neutral text-400→text-500 (was text-600 — bumped for better muted readability). ~1,100+ accent color instances now properly theme-aware.

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

## ErgLink Integration (Future)
- Support `target_*_max` fields (ranges) in PM5 programming
- Enables: RWN → LC templates → ErgLink → PM5
