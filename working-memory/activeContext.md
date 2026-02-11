# Active Context

> Last updated: 2026-02-11

## Current Focus: Unified Athletes Data Model — COMPLETE

### Data Model Unification (2026-02-11) ✅ COMPLETE
Retired the siloed `coaching_athletes` table in favor of a unified model:

**New DB Schema:**
- `athletes` table — single source of truth for all people. Has `first_name`, `last_name`, optional `user_id` FK to `auth.users`, `created_by` FK to track who added them.
- `team_athletes` junction table — links athletes to teams with `status` (active/inactive/graduated).
- All coaching tables (`coaching_sessions`, `coaching_athlete_notes`, `coaching_erg_scores`, `coaching_boatings`) now have `team_id` column for team-scoped access.
- `team_members` role constraint updated: `coach`, `coxswain`, `member` (removed `captain`).

**Migration:** `db/migrations/20260211_unified_athletes.sql` — applied to production via Supabase MCP (5 phases).

**TypeScript Changes:**
- `types.ts` — New `Athlete`, `CoachingAthlete` (extends Athlete with computed `name`), `TeamAthlete` interfaces. All coaching interfaces got `team_id` field.
- `coachingService.ts` — All queries now team-scoped (`.eq('team_id', teamId)` instead of `.eq('coach_user_id', coachUserId)`). Athletes queried via inner join on `team_athletes`. New `getTeamForUser()` helper. `createAthlete()` inserts into both `athletes` + `team_athletes`. `createNote/Session/ErgScore/Boating` all accept `(teamId, coachUserId, ...)`.
- `useCoachingContext.ts` — New hook resolving `userId` + `teamId` for coaching pages.
- All 6 coaching page components updated to use `useCoachingContext()` instead of `useAuth()` + `coachId`.
- Roster + AthleteDetail forms updated for `first_name`/`last_name` fields (was single `name`).

**Build:** `tsc --noEmit` — zero errors.

**Role hierarchy:** coach (full CRUD) > coxswain (view + add/edit scores) > member (view only).

### Prior Work (same session)
- Weekly Schedule View, Athlete Detail Page, Vertical Roster List — all implemented earlier.

---

## Immediate Next Steps
- [ ] Smoke test the coaching UI end-to-end (create athlete, session, score, boating)
- [ ] Verify RLS policies work correctly for team-scoped access
- [ ] Consider adding `coaching_athletes` table cleanup (currently still exists but FKs repointed)
- [ ] Pass 3 enhancements: Dynamic dashboard, form validation, duplicate-athlete check

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
