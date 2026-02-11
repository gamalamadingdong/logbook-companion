# Active Context

> Last updated: 2026-02-11

## Current Focus: Application Audit — Sprint 1 Bug Fixes ✅ COMPLETE

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

### Sprint 2: Error Handling & Missing Pages
- [ ] Create 404/NotFound page + catch-all route
- [ ] Add toast notification system (Sonner) — replace `alert()` calls
- [ ] Extract baseline watts utility (duplicated in Analytics + WorkoutDetail)
- [ ] Centralize `isAdmin` in AuthContext (replace hardcoded UUID checks)

### Sprint 3: Robustness & Data Quality
- [ ] Dashboard: handle service errors gracefully (show error states, not silent fail)
- [ ] C2 token refresh: proactive refresh before expiry, not just on 401
- [ ] Template matching: surface unmatched workouts to user
- [ ] Sync: add progress indicator (X of Y workouts)

### Sprint 4: UX Polish
- [ ] Loading skeletons for Dashboard, Analytics, WorkoutHistory
- [ ] Empty states for all list pages (no workouts, no templates, etc.)
- [ ] Remove `console.log` statements from production code
- [ ] Mobile nav: highlight active tab

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
