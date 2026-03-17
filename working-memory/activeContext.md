# Active Context

> Last updated: March 17, 2026

## Session Summary (2026-03-17) — Bulk Coach Invite Flow

### Completed This Session (Latest)

#### Bulk Coach Invite System
- [x] **Edge Function** — `supabase/functions/invite-coaches/index.ts`: Accepts `{ teamId, emails[], role, orgId? }`. For each email: calls `auth.admin.inviteUserByEmail()` (creates account + sends magic link), creates `user_profiles` row, inserts `team_members` with coach/coxswain role, optionally adds to org. Returns per-email results.
- [x] **Service function** — `inviteCoaches()` in `coachingService.ts`: Typed wrapper calling the edge function.
- [x] **BulkCoachInviteModal** — `src/components/coaching/BulkCoachInviteModal.tsx`: Paste emails (comma/newline/semicolon separated), live validation preview, role selector (coach/coxswain), sends invites, shows per-email results (✅ invited, ⚠️ already existed, ❌ error).
- [x] **CoachingSettings wired** — "Invite Coaches" button in Team Members section opens the modal. Refreshes member list on close.
- [x] **ResetPassword page updated** — `src/pages/ResetPassword.tsx`: Detects new users (invite flow) vs password reset. Shows "Set Your Password" title + welcome message for invited users. Waits for Supabase auth session from magic link URL hash before showing form. Loading spinner while verifying link.
- [ ] **Supabase email template** — Manual step: customize invite email template in Supabase Dashboard > Auth > Email Templates > "Invite user" to mention ReadyAll.
- [ ] **Deploy edge function** — `supabase functions deploy invite-coaches` (requires CLI)

### Validation
- `npm run build` ✅ (clean)
- `npm run test:run` ✅ (225/225 pass)

### Key Architecture Notes
- **`inviteUserByEmail`** is a Supabase admin API requiring the service role key — hence the edge function pattern (same as existing `send-team-invite`).
- **Flow**: Coach enters emails in modal → edge function creates accounts + sends Supabase invite emails → invited user clicks magic link → lands on `/reset-password` → sets password → redirected to dashboard as authenticated coach.
- **Existing users** are handled gracefully: if email already has an account, they're just added to the team directly (no invite email needed).
- **Organization membership**: If the team belongs to an org, invited coaches are also added as org members.

## Session Summary (2026-03-17) — Boatings UX Overhaul + Mobile Responsiveness

### Completed This Session

#### Boatings Org-Wide Fix
- [x] `CoachingBoatings` always org-wide — ignores `filterTeamId` entirely
- [x] New `getOrgBoatings(orgId)` service function
- [x] Roster panel ("Boathouse") has its own team filter dropdown + unboated-only toggle

#### Active Lineup Model
- [x] **Migration** — `db/migrations/20260317_boating_is_active.sql`: `is_active BOOLEAN DEFAULT true` + partial index
- [x] **Type/Service** — `is_active` on `CoachingBoating`, `setBoatingActive()` function
- [x] **UI** — Current lineups at top, archived in collapsible history; archive/reactivate; `BoatingCard` component

#### Persistent Sort Order
- [x] **Migration** — `db/migrations/20260317_boating_sort_order.sql`: `sort_order INTEGER DEFAULT 0` + backfill
- [x] **Service** — `updateBoatingSortOrders()` batch persist, `getBoatings` orders by `sort_order ASC, date DESC` with fallback
- [x] **UI** — ↑/↓ reorder buttons on each boat card, optimistic local swap + async persist

#### Compact Seat Strip + DnD
- [x] Default view: compact horizontal seat strip with athlete initials (Cox → 8 → 7 → ... → 1)
- [x] Click "Details" to expand full seat view with draggable athletes
- [x] Seat labels: just "Cox" and numbers (no "Stroke"/"Bow")
- [x] `DraggableAthleteCard` with `useDraggable` (not useSortable — avoids collision pollution)
- [x] `DraggableSeatedAthlete` with `seated-` ID prefix
- [x] `DroppableSeatRow` + `CompactSeatBadge` as drop targets
- [x] Custom `CollisionDetection`: `rectIntersection` for roster-panel, `closestCorners` for seats
- [x] `DragOverlay` with athlete card preview
- [x] Cross-boat removal on drop to roster panel; mobile dropdown fallback preserved

#### Condensed Boat Card Headers
- [x] Smaller badges, removed "X seats · since date" subtitle
- [x] Shrunk action icons (edit, copy, archive, delete) to 3.5px

#### Mobile Responsiveness (7 pages)
- [x] **CoachingRoster** — Mobile card view with expand/collapse, side badges; `w-14` inputs
- [x] **BulkRosterModal** — Mobile guard ("use desktop" message)
- [x] **CoachingAssignments** — `overflow-x-auto`, bumped text sizes
- [x] **TeamAnalytics** — Hidden secondary columns on mobile, overflow wrapper
- [x] **CoachDashboard** — `overflow-x-auto` on inline edit table
- [x] **AthleteEditorModal** — `grid-cols-1 sm:grid-cols-2`
- [x] **CoachingBoatings** — Mobile modal height constraints

#### Team Filter Context Audit
- [x] Verified: CoachDashboard, CoachingRoster, CoachingAssignments, TeamAnalytics all still respond to `filterTeamId`
- [x] CoachingBoatings is the only page ignoring `filterTeamId` (intentional)
- [x] MyTeamDashboard doesn't use coaching context at all (uses `useAuth()`)
- [x] Team selector in CoachingNav is NOT orphaned — works as expected

### Migrations Applied to Supabase
- `is_active BOOLEAN DEFAULT true` on coaching_boatings ✅
- `sort_order INTEGER DEFAULT 0` on coaching_boatings (backfilled) ✅
- Partial index on (team_id) WHERE is_active = true ✅

### Validation
- `npm run build` ✅ (clean)
- `npm run test:run` ✅ (225/225 pass)

### Remaining / Future
- [ ] **B5 Cross-boat drag** — Drag between expanded boats (stretch goal)
- [ ] **boating-session-ui** — Show linked lineups nested in SessionCard (DB prep done)

### Key Architecture Notes
- **CoachingBoatings** (~1356 lines) is the central file for all boatings work
- **Two-level team context**: `teamId` (auth anchor, always set) vs `filterTeamId` (visual filter, null = "All Teams")
- **DnD collision**: Custom detection needed because `useSortable` registers items as BOTH draggable AND droppable, polluting collision detection. Solution: use `useDraggable` only for roster cards.
- **sort_order fallback**: `getBoatings` tries `sort_order ASC, date DESC` first, catches 400 from PostgREST if column missing, retries with date-only

## Session Summary (2026-03-16) — Coaching UX restructuring & compliance scoping

### Completed This Session
- [x] **TeamAnalytics filter bar consolidation** — moved all filters (duration, workout type, squad, tier) onto one row; removed redundant info pills
- [x] **TeamAnalytics dead code cleanup** — removed TrendBadge, currentModeLabel; simplified header; moved Training Zone Donut to charts section; collapsed leaderboard explanation to `<details>`
- [x] **PublicTeamLeaderboardShare parity** — matched filter bar, explanation collapse, and unused var removal to private page
- [x] **Disabled button tooltips** on CoachingErgScores, CoachingBoatings, CoachingAssignments
- [x] **Schedule/Assignments week nav indicators** — adjacent-period dot indicators on CoachingSchedule + CoachingAssignments
- [x] **CoachingAssignments restructured** — week nav moved under calendar tab only; compliance tab given independent time range selector (Last Week / 4 Weeks / Season / All Time)
- [x] **Compliance tab scope alignment fixed**
  - compliance now uses `visibleComplianceAssignments` (filtered by `filterTeamId`) instead of raw `complianceAssignments`
  - compliance athletes use org-wide athletes (`ergOrgAthletes`) when org coach has no team filter, otherwise team athletes
  - mutation handlers (`handleCreate`, `handleEdit`, `handleDelete`) now refresh compliance data when on compliance tab

### Validation
- `tsc --noEmit` after compliance scope fix ✅
- All changes compile cleanly

### Remaining
- [ ] Decide whether internal `titan_*` schema and code identifiers should stay as-is long term or get a separate migration/rename pass later
- [ ] Decide whether `CoachDashboard` should adopt the same explicit edit-mode pattern as `CoachingRoster` for consistency

## Session Summary (2026-03-16) — Demo team-management seed path

### Completed This Session
- [x] **Demo coaching seed strategy established**
  - confirmed the existing `src/data/demoData.ts` path only covers athlete/dashboard demo mode, not coaching/team-management routes
  - confirmed coaching pages are live-data and coach-gated, so demo team-management needs a seeded Supabase dataset rather than more frontend fixtures
- [x] **Repeatable demo seed script added**
  - added `scripts/seed_demo_team_management.mjs`
  - script creates a demo org, five teams, seeded coach memberships, mock athletes, org-wide assignments, assignment results, erg scores, sessions, session notes, coach-note feed entries, and boatings
  - seed reuses existing workout template names already present in the target DB (`2k Test`, `6x1000m`, `2x2000m`, `4x4:00@26/5:00r`, `Ladder Fitness Test`)
  - seed computes Titan values so leaderboard and dashboard views populate meaningfully
- [x] **Runbook and entry point added**
  - added npm command `seed:demo:team-management`
  - documented usage and prerequisites in `docs/demo-team-management-seed.md`

### Validation
- live schema inspection via MCP ✅
- `node --check scripts/seed_demo_team_management.mjs` ✅
- `get_errors` on new script and `package.json` ✅
- seed script follow-up fix: `user_profiles.skill_level` updated from invalid `advanced` to valid `competitive` after live constraint failure ✅

### Remaining
- [ ] Create or choose the auth user that will act as the demo coach in the target demo Supabase project
- [ ] Run the seed against the demo project with `DEMO_COACH_USER_ID`
- [ ] Manual walkthrough of dashboard, roster, analytics, notes, and boatings under the demo coach login

## Session Summary (2026-03-16) — Coach request hardening + athlete auto-link

### Completed This Session
- [x] **Invite/join flow now auto-links athletes**
  - added live Supabase RPC `ensure_team_member_athlete_link(team_id, user_id)` as a SECURITY DEFINER bridge for the athlete-link step that RLS blocks for self-joiners
  - `joinTeamByInviteCode()` now creates membership, calls the RPC, and rolls back the membership if athlete linking fails
  - `addTeamMemberByEmail()` now does the same for invited members added by coaches
- [x] **Coach request review narrowed to org leadership**
  - replaced broad coach/coxswain review access with org `owner/admin` review access in both the live policy and `approve_coaching_request()` RPC
  - `PendingCoachingRequests` now hides itself unless the current user has an `organization_members` role of `owner` or `admin`
- [x] **Audit findings closed**
  - athlete self-service data still resolves through `athletes.user_id`, but the main team onboarding paths now ensure that link exists
  - request review remains SECURITY DEFINER-backed, now with a smaller reviewer set aligned to org leadership

### Validation
- `get_errors` on touched files ✅
- live Supabase migration applied via MCP ✅
- live RPC/policy verification via MCP ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ⚠️ still failing on pre-existing unrelated files (`src/App.tsx`, `src/api/*`, older analytics components)

### Remaining
- [ ] Manual happy-path check of self-join and coach add-by-email against live data
- [ ] Decide whether standalone non-org teams should ever regain a coaching-request review path
- [ ] Decide whether to add a merge/claim flow for pre-existing manual athlete rows with `user_id = null` so account-linked joins can reconcile to older roster entries instead of creating a second athlete row

## Session Summary (2026-03-15) — Titan bias propagation fix

### Completed This Session
- [x] **TeamAnalytics compile fix**
  - widened leaderboard sort field typing to include split-based and workload sort columns (`avg_split_seconds`, `best_split`, `latest_split_seconds`, `avg_wplb`, `assignment_count`)
  - resolved page-level TypeScript errors after the leaderboard column expansion
- [x] **Titan settings now propagate to analytics immediately**
  - `CoachingSettings` save path now detects changes to `titan_power_weight`
  - when power bias changes, it automatically runs `backfillTitanIndexes(..., { force: true })`
  - this refreshes stored `daily_workout_assignments.titan_index` values so `TeamAnalytics` reflects the new weighting without requiring a separate manual recompute click
- [x] **Coach notes athlete page alignment**
  - `MyTeamNotes` now renders a list of visible coach-note feed entries instead of assuming a single coach note string
- [x] **Coach notes feed pivot completed across coaching UI**
  - removed stale legacy `coach_notes` / `coach_notes_visible_to_athlete` write paths from roster athlete creation and generic athlete update flows
  - `CoachingAthleteDetail` now writes coach notes using the athlete's actual `team_id`, avoiding wrong-team writes in org-wide views
  - athlete detail squad updates now also use the athlete's actual team scope in org-wide mode
- [x] **Titan model simplified**
  - removed the coach-facing Titan power-bias slider from `CoachingSettings`
  - Titan weighting was simplified from the old per-team slider to a fixed formula, and has since been recalibrated again to the current equal-weight 50/50 z-score blend
  - fixed the rolling Titan window bug so the leaderboard uses the most recent workouts, not the oldest loaded ones
  - filtered/test-only leaderboard reranking now respects the configured Titan window instead of a hard-coded 5-workout average
- [x] **Team Analytics UX pass**
  - added high-level summary cards so coaches can read scope, leader, and group state before dropping into the table
  - rewrote leaderboard guidance copy to clarify the difference between season view and tests-only view
  - reduced leaderboard visual density by centering the default table on Titan, splits, efficiency, and workload
  - moved composite/speed/efficiency rank detail into the athlete expansion panel where it is useful but less noisy
- [x] **Training zone alignment with rowing conventions**
  - centralized zone definitions in `paceCalculator.ts` via shared `TRAINING_ZONE_CONFIG`
  - shifted bands to broader rowing-aligned ranges anchored to 2k watts:
    - UT2 `55–70%`
    - UT1 `68–80%`
    - AT `78–88%`
    - TR `88–100%`
    - AN `100–115%`
  - updated athlete-facing copy to explain that the ranges are intentionally broad and should be read with RPE and HR, not as exact single-target prescriptions
  - moved AN to start at current 2k pace and above, which better matches common rowing usage for sprint / anaerobic work
- [x] **Analytics time-range filters + contrast cleanup**
  - replaced the misleading Titan window / status pills on `TeamAnalytics` with real time-range controls: last week, last 4 weeks, season, all time
  - default analytics range is now last 4 weeks
  - season range is defined academically from August 1 through the current date
  - Titan is now averaged across the selected time range instead of the last N workouts
  - cleaned up light-mode and dark-mode contrast for informational chips and segmented controls
  - removed outdated Titan window configuration copy from `CoachingSettings`

### Validation
- `get_errors` on `TeamAnalytics.tsx` and `CoachingSettings.tsx` ✅
- `npm run build` ✅
- `get_errors` on `CoachingAthleteDetail.tsx`, `CoachingRoster.tsx`, `coachingService.ts`, `MyTeamNotes.tsx` ✅
- `npm run build` after coach-notes cleanup ✅
- `get_errors` on `TeamAnalytics.tsx`, `CoachingSettings.tsx`, `coachingService.ts` after Titan simplification ✅
- `npm run build` after Titan simplification ✅
- pending current pass validation: `get_errors`, `npm run lint`, `npm run build`, `npm run test:run`
- pending current pass validation: `get_errors`, `npm run build`, `npm run test:run`, `npm run lint` (expected unrelated repo debt)

### Remaining
- [ ] Manual UX verification of coach-note feed in team and org-wide coaching flows
- [ ] Manual review of Team Analytics summary-card usefulness with live roster data
- [ ] Manual sanity check on athlete training-zone ranges against a few known 2k baselines in UI
- [ ] Manual review of last-week / 4-week / season / all-time analytics ranges with live assignment data

## Session Summary (2026-03-13) — Race finish chart + coach nav UX

### Completed This Session
- [x] **Race finish chart** — New `RaceFinishChart` component on AssignmentResults
  - Horizontal bar chart showing athletes as race lanes, sorted by finish time
  - Bar length proportional to time; gold/silver/bronze colors for top 3
  - Shows for non-interval workouts with ≥2 finishers
  - Tooltip with time, split, and gap from leader
  - Full-width above the existing bar charts grid
- [x] **Filter pills label** — Added "Filter:" label before team pills in CoachingNav to clarify they're data filters, not context switches
- [x] **Team hierarchy collapsible** — Org/Team hierarchy section at bottom of CoachDashboard now collapsible (default collapsed), reducing visual noise since org overview cards are already prominent at top
- [x] **Titan Index on assignment results** (prior in session)
- [x] **Expandable leaderboard rows** with workout history (prior in session)
- [x] **Public team leaderboard share** (prior in session)
- [x] **"Assignments" → "Team Workouts"** rename (prior in session)
- [x] **Leaderboard rank-only columns + composite rank** (prior in session)

### Validation
- `npm run build` ✅

### Remaining
- [ ] **Public team analytics share page** — create share token mechanism, DB migration, new public page

## Session Summary (2026-03-13) — Public share, expandable rows, Assignments → Team Workouts

### Completed This Session
- [x] **Expandable leaderboard rows** — Click athlete name to expand/collapse showing last 5 workouts (newest first) with workout name, date, split, time, efficiency, and link to assignment results
- [x] **Added `label` to score_history** — Each history entry now includes the assignment title/template name
- [x] **Public team leaderboard share** — Full stack:
  - DB: `team_leaderboard_shares` table + `create_team_leaderboard_share` / `resolve_team_leaderboard_share` SECURITY DEFINER RPCs
  - Service: `createTeamLeaderboardShare`, `resolveTeamLeaderboardShare`, `buildTeamLeaderboardShareUrl`
  - UI: Share button in TeamAnalytics leaderboard header (generates link, copies to clipboard)
  - Public page: `/share/team-leaderboard/:shareToken` — full leaderboard with Titan Index, expandable rows, squad filter
- [x] **Renamed "Assignments" → "Team Workouts"** across nav, page headings, breadcrumbs, dashboard cards, empty states
- [x] **Titan Index on assignment results** (prior in session)
- [x] **Titan Index sorting fix** (prior in session)
- [x] **IIFE cleanup in TeamAnalytics** — removed dead `computeTitanIndex` function and unused `LbEntry` type

### Validation
- `npm run build` ✅
- [x] **Rank Over Time line chart**
  - New `RankOverTimeChart` component using Recharts `LineChart`
  - Shows composite rank per assignment date for top N athletes (configurable: 5/10/15/20)
  - Y-axis reversed (rank 1 at top), connects nulls, color-coded per athlete
  - Uses existing `rank_history` data from `SeasonLeaderboardEntry`
  - Added to TeamAnalytics below the erg chart + leaderboard grid
  - Filtered by squad/tier via `filteredLeaderboard`
- [x] **Assignments list view** (prior in session)
- [x] **Coxswain exclusion from compliance** (prior in session)
- [x] **Trend badge redesign** (prior in session)
- [x] **W/kg → W/lb "Efficiency"** (prior in session)
- [x] **Chart selector dropdown with assignment names** (prior in session)

### Remaining
- [ ] **Public team analytics share page** — create share token mechanism, DB migration, new public page

### Validation
- `npm run build` ✅

## Session Summary (2026-03-13) — Analytics filtering fixes, erg chart data gap

### Completed This Session
- [x] **Fix erg chart "No data" for teams with assignment results but no erg scores**
  - Root cause: `getTeamErgComparison` only queried `coaching_erg_scores` table; teams like Upper Novice with completed assignments but no manually entered erg scores showed empty
  - Fix: merged `daily_workout_assignments` results (by athlete ID) into erg comparison, picking best time per athlete×distance from either source
  - Queried by `athlete_id` (not `team_id`) because transferred athletes keep old team_id on their assignments
- [x] **Fix `hasErgData` using unfiltered data**
  - Changed from `ergComparison.length > 0` to `filteredErgData.length > 0`
- [x] **Leaderboard now filtered by squad & tier**
  - Added `filteredLeaderboard` memo applying `squadFilter` + `tierFilter` (was only team-filtered)
- [x] **Consolidated leaderboard-only fallback**
  - Removed ~60 lines of duplicated leaderboard table; side-by-side grid now shows when either erg data OR leaderboard exists

### Validation
- `npm run build` ✅
- Not yet tested with live data (needs manual verification)

## Session Summary (2026-03-13) — Roster tier filter, analytics org-awareness, leaderboard fix

### Completed This Session
- [x] **Performance tier filter on CoachingRoster**
  - Added `selectedTier` filter state alongside existing `selectedSquad`
  - Computes effective tier per athlete: computed benchmark tier (from 2k scores + rubric) takes priority, falls back to manual `performance_tier`
  - Tier dropdown only shows when 2+ distinct tiers exist in roster
  - Subtitle reflects active tier filter alongside squad filter
- [x] **Performance tier filter on TeamAnalytics**
  - Added `tierFilter` state + UI dropdown alongside squad filter
  - Loads org rubric and 2k benchmarks to compute effective tiers
  - Filters erg comparison data and athlete lists by tier
  - Auto-resets filters when team/org context changes
- [x] **Fixed stale `performanceTierOrder` in CoachingRoster**
  - Old: `{ pool: 0, developmental: 1, challenger: 2, champion: 3 }` — missing `competitor` and `nationals`
  - New: uses shared `TIER_SORT_ORDER` from `performanceTierRubric.ts` covering all 6 tier values
- [x] **Exported shared tier constants from `performanceTierRubric.ts`**
  - `BENCHMARK_TIERS`: ordered array of all 5 benchmark tiers
  - `TIER_SORT_ORDER`: unified sort order covering both `BenchmarkTier` and legacy `PerformanceTier` values
- [x] **BUGFIX: Leaderboard empty — org-level assignments invisible**
  - Root cause: `getSeasonMeasuredLeaderboard(teamId)` called `getGroupAssignments(teamId)` without `orgId`, so it used `.eq('team_id', teamId)` — missing org-scoped assignments where `team_id = null`
  - Fix: Added `orgId` param to `getSeasonMeasuredLeaderboard`, passes through to `getGroupAssignments`
  - Also made daily_workout_assignments query drop the `team_id` filter when org-level assignments exist
  - Also loads org-wide athletes when `orgId` provided (instead of single-team)
- [x] **BUGFIX: TeamAnalytics didn't reload on team filter change**
  - `loadData()` deps were `[teamId, orgId, isOrg]` — missing `filterTeamId`
  - Adopted `effectiveTeamId` pattern from CoachingRoster: `filterTeamId ?? teamId`
  - Now properly reloads data when switching teams in CoachingNav
  - Leaderboard now shown in org-wide mode too (was previously hidden with `!isOrg`)
- [x] **BUGFIX: CoachDashboard leaderboard missing orgId**
  - `getSeasonMeasuredLeaderboard(teamId, { limit: 5 })` → now passes `orgId`
  - Added `orgId` to useEffect deps (was only `[teamId]`)

### Validation
- `npm run build` ✅
- `npm run test:run` ✅ (225/225)

## Session Summary (2026-03-12) — Multi-coach fixes, assignment results

### Completed This Session
- [x] **Coach/org visibility + team creation RLS fixes**
  - Added missing `organization_members` coach row for Haley.
  - `getTeamsForUser()` now merges direct team memberships with org-derived teams.
  - Applied live MCP migrations for org-coach/team visibility helpers.
  - Fixed `teams` create flow RLS (insert policy + select policy for RETURNING).
  - Added `Create Another Team` CTA in `CoachingSettings`.
- [x] **Assignment page org-wide filter fix**
  - `getGroupAssignments()` now fetches all org team IDs and includes all team-scoped assignments.
- [x] **Assignment results — time display tenths**
  - `fmtTime()` in `AssignmentResults.tsx` now uses `.toFixed(1)` for tenths of a second.
- [x] **Assignment results — uncomplete athletes**
  - Removed `disabled={entry.wasCompleted}` from checkbox in `CoachingAssignments.tsx`.
  - Changed save payload from `completed: e.completed || e.wasCompleted` to `completed: e.completed`.
  - `saveAssignmentResults()` now clears `completed_at = null` when uncompleting.
- [x] **Assignment results — current team affiliation**
  - `getAssignmentResultsWithAthletes()` now uses `getOrgAthletesWithTeam()` for org path, storing each athlete's CURRENT `team_id`/`team_name` from `team_athletes` instead of the snapshot in `daily_workout_assignments.team_id`.
  - Team filter in results page automatically reflects current teams.
- [x] **RLS org-coach access — remaining tables**
  - Applied migration `fix_org_coach_access_remaining_tables` via MCP:
    - `teams` UPDATE/DELETE: now uses `can_coach_team()` instead of `coach_id = auth.uid()`
    - `group_assignments` UPDATE/DELETE: any team/org coach, not just creator
    - `coaching_weekly_plans`: uses `can_coach_team()` (was inline `team_members` only)
    - `daily_workout_assignments` INSERT/UPDATE/DELETE/SELECT: uses `can_coach_team()` for team path

- [x] **Athlete transfer not persisting (PATCH returns `[]`)**
  - Root cause: `CoachingRoster.tsx` passed `teamId` (context team) as `fromTeamId`, but in org-wide or filtered views the athlete's actual team differs from the context team. The `.eq('team_id', fromTeamId)` filter matched 0 rows.
  - Fixed `handleTransfer` to use `athlete.team_id ?? teamId` as `fromTeamId`.
  - Same bug existed for `updateAthleteSquad` and `updateAthletePerformanceTier` — fixed both.
  - `transferAthlete()` in `coachingService.ts` now throws if no rows updated (was silently succeeding).

### Validation
- `npm run build` ✅
- `npm run test:run` ✅ (225/225)
- `npm run lint` still fails on pre-existing unrelated issues

## Session Summary (2026-03-12)

### Completed This Session
- [x] **CSV single-piece assignment import fix**
  - `ImportCsvModal` now derives workout shape from assignment structure/canonical name before parsing CSV rows.
  - Single-piece assignments (including one-repeat interval-shaped work like `1x2000m`) now parse as a single result column instead of treating every later CSV column as a rep.
  - Review step now exposes CSV column mapping for athlete name + single-result time when the assignment is a single-piece effort.
  - Single-piece imports now save into top-level assignment result fields (`result_time_seconds`, `result_distance_meters`, `result_split_seconds`) instead of interval-style `result_intervals`.
  - Added parser + classifier regression coverage for 2k CSV imports and one-repeat interval normalization.

### Current Notes
- `npm run build` ✅
- `npm run test:run` ✅ (`225/225`)
- `npm run lint` still fails on pre-existing unrelated repo issues (scripts, analytics files, and existing `src/App.tsx` hook/ref lint violations).

## Session Summary (2026-03-07)

### Completed This Session
- [x] **Team Management Navigation & UX Overhaul**
  - Added Dashboard tab to CoachingNav (first tab, exact-match routing)
  - Added CoachingNav to CoachDashboard (was missing — only sub-pages had it)
  - Removed duplicate section nav bar from dashboard (inconsistent anchor vs navigate behavior)
  - Restructured dashboard layout: team content (weekly focus, stats, leaderboard, today's workouts) now appears FIRST, org content (roster table, hierarchy cards) moved below
  - Added empty states for Today's Workouts and Season Leaderboard (previously silently hidden)
  - Added loading context text to org summary spinners ("Loading schedule…", etc.)
  - Added ARIA attributes to nav tabs (role=tablist/tab, aria-selected, aria-current=page, focus-visible ring)
  - Cleaned up unused imports and dead code from dashboard

### Remaining from UX Audit (not yet implemented)
- [ ] Improve coaching access request flow (redirect feedback, realtime approval, sidebar pending badge)
- [ ] Add section navigation to CoachingSettings (930+ line page with no anchors)
- [ ] Improve performance tier rubric UX (help text, examples, mobile-responsive)
- [ ] Add accessibility to Settings dialogs (role=dialog, Escape key, aria-live)

## Previous Session Summary (2026-03-06)

### Completed This Session
- [x] CSV Score Import/Export for coaching assignments (full pipeline)
- [x] Import bug fixes: split_seconds, missing rows, weight auto-population
- [x] Best/Worst split into two separate sortable columns
- [x] Best Interval Efficiency (W/lb) column added to AssignmentResults + PublicAssignmentResultsShare tables
- [x] **UX Quick Wins (Proposal C)**: C1-C6 all shipped
- [x] **UX Proposal A: Org-First Navigation — COMPLETE**
  - `filterTeamId` / `setFilterTeamId` in CoachingContext (null = "All Teams")
  - CoachingNav: segmented team filter pills `[All | Team1 | Team2 ...]`
  - CoachingRoster: org-wide fetch + "Team" column in org-wide mode
  - CoachingAssignments: filters by `filterTeamId`, scope label updates
  - CoachingSchedule: wired to `filterTeamId` for session/assignment queries
  - CoachingErgScores: org-wide fetch across all teams + team name in cards
  - TeamAnalytics: synced to nav filter pills (removed duplicate team dropdown)
  - Assignment creation: defaults to org-level when coach is in an org
  - Dashboard: replaced verbose org sections with compact summary cards (3-col grid)

### Next Session Priorities
- [ ] C2 write permissions — register via C2 dev logbook for `results:write` scope
- [ ] In-app notification system (real-time via Supabase)
- [ ] DataTable shared component
- [ ] Onboarding wizard
- [ ] PWA manifest + service worker
- [ ] Erg Link progress (live erg workouts, local + remote)

### Known Issues
- working-memory docs and .github/copilot-instructions.md still reference train-better.app (planning docs only, not runtime)
- Version labeling alignment between LC and ReadyAll RWN specs

## Current Focus: Bug Fixes + Coaching Access Request Flow

### Analytics Chart Fixes (2026-03-05) ✅ COMPLETE
- [x] Fixed ZonePaceTrendChart: `<div role="img">` wrapper missing `h-full` → ResponsiveContainer rendered at 0px height
- [x] Fixed Weekly Volume chart in Analytics.tsx: same role="img" height issue + parent needed `flex flex-col`
- [x] Fixed SplitVarianceChart: Analytics query missing `raw_data` field → intervals never extracted. Added raw_data to select + interval extraction with split_seconds calculation from C2 decisecond format

### Coaching Access Request Flow (2026-03-05) ✅ COMPLETE
Built request/approval pipeline so users can request coaching access without self-selecting:
- [x] Migration: `coaching_access_requests` table with RLS + `approve_coaching_request` RPC (SECURITY DEFINER, coach-only)
- [x] Edge function: `request-coaching-access` — validates auth, inserts/updates request, emails admin via Resend
- [x] AuthContext: coach check now also looks for approved requests in `coaching_access_requests`
- [x] UI: `RequestCoachingAccess.tsx` page (form with name + message, handles pending/approved/rejected states)
- [x] UI: `PendingCoachingRequests.tsx` widget on CoachDashboard (approve/reject buttons, show all toggle)
- [x] Routing: `/team-management/request-access` route (ProtectedRoute, not CoachRoute); CoachRoute redirects non-coaches there instead of `/`

## Current Focus: UI/UX Audit Improvements + RWN Cross-Repo Sync

### UI/UX Audit Sprint (2026-03-05) ✅ PHASE 1 COMPLETE
Full-app audit produced 20 prioritized recommendations across 6 areas (design system, UX polish, features, analytics, coaching, accessibility). Phase 1 quick wins + next-sprint items completed:

**Done:**
- [x] Fixed 17+ hardcoded color violations across 8 files (bg-white/text-black/gray-*/slate-* → design tokens)
- [x] Added EmptyState to 10 pages (TemplateLibrary, WorkoutHistory, CoachingRoster, CoachingAssignments, CoachingSchedule, CoachingErgScores, CoachingBoatings, TeamAnalytics, AssignmentResults, WorkoutComparison)
- [x] Built `useDebouncedSave` hook + `SaveIndicator` component; wired auto-save to TemplateEditor
- [x] Built shared `Modal` + `ConfirmDialog` components in `src/components/ui/`
- [x] Built shared `StatCard` component; migrated Dashboard lifetime meters card
- [x] Fixed accessibility: aria-busy on skeletons, aria-labels on 20+ chart containers, skip-to-content link, aria-labels on ~25 icon-only buttons
- [x] Added `TrainingStreakWidget` + `WeeklyVolumeSparkline` to Dashboard
- [x] Cleaned up inline styles → Tailwind (WeeklyReport, ZonePaceTrendChart)
- [x] Imported ui-design-reviewer + ux-flow-reviewer skills to `.github/skills/`

**Remaining (pending):**
- [ ] Build shared `DataTable` component
- [ ] Implement onboarding wizard
- [x] Add global search / Cmd+K command palette
- [ ] Build in-app notification system
- [ ] Add split variance + W/kg progress analytics charts
- [x] Add PDF + Excel export for coaching reports
- [ ] Add PWA manifest + service worker

### RWN Cross-Repo Sync (2026-03-05) ✅ COMPLETE
Synced ReadyAll (`readyall/`) RWN reference with LC canonical spec:
- [x] Added 11 missing examples to ReadyAll playground (27 total, 5 categories including Orchestration)
- [x] Added 3 new spec sections to ReadyAll: Advanced Guidance (@open, chained, sub-interval +, input tolerance), Undefined Rest, Session Orchestration (Draft)
- [ ] Version labeling alignment (ReadyAll says v0.1.0-draft; LC spec has no version — minor)

## Current Focus: ErgLink → C2 Publishing Pipeline (blocked on C2 approval)

### ErgLink → Concept2 Logbook Publishing (Option B) ⏸️ BLOCKED
Publish ErgLink uploads to C2 Logbook using the athlete's stored C2 tokens.
- [x] Migration: added `c2_published_at` timestamptz column to `workout_logs`
- [x] Edge Function `publish-to-c2` deployed — reads unpublished EL uploads, POSTs to C2 API, stamps `external_id` + `c2_published_at`
- [x] OAuth scope updated from `results:read` → `results:write` in 5 LC files (Layout, Dashboard, Sync, Callback, concept2.ts)
- [ ] **BLOCKED**: Contact C2 (`ranking@concept2.com`) for live write API approval (dev-server testing first on `log-dev.concept2.com`)
- [ ] Set Edge Function secrets: `CONCEPT2_CLIENT_ID`, `CONCEPT2_CLIENT_SECRET` (via Supabase Dashboard → Edge Functions → Secrets)
- [ ] Wire EL to call `publish-to-c2` after uploading to `workout_logs`
- [ ] Existing users must re-link C2 to get `results:write` scope (refresh can't upgrade scopes)

### RWN Playground & Spec Updates 🔧 IN PROGRESS
- [x] `structureToRWN.ts` — orchestration serialization (partner/relay/rotate/circuit round-trip)
- [x] `RWNPlayground.tsx` — orchestration examples, PM5 badge, session extension panel, Rate Ladder example
- [x] `structureToWhiteboard.ts` — coach whiteboard renderer (tabular ladders, W/U/C/D, orchestration headers)
- [x] `structureToWhiteboard.test.ts` — 11 tests passing
- [x] `rwn/RWN_spec.md` — §4.4 `@open` guidance, §5.3 sub-interval guidance via `+`, §11.2 `'`/`"` shorthand
- [x] `rwnParser.ts` — `'`/`"` normalization + `@open` guidance parsing (67 tests passing)
- [x] `docs/RWN_WorkoutWhiteboardExample.md` — annotated whiteboard → RWN mapping
- [ ] `rwn/RWN_spec.md` — needs Section 13: Session Orchestration Extensions
- [ ] `src/pages/Documentation.tsx` — needs orchestration section in spec tab
- [ ] Verify `rwnParser.ts` + `rwnParser.test.ts` gap analysis (parser looks complete, tests at 50/50)

### Magic Layer (Template ↔ Log ↔ Canonical ↔ RWN) 🔧 IN PROGRESS (2026-02-26)
- [x] Added shared canonical utility: `src/utils/workoutCanonical.ts`
  - `deriveCanonicalNameFromIntervals(...)`
  - `deriveCanonicalNameFromStructure(...)`
  - `deriveCanonicalNameFromRWN(...)`
  - canonical normalization/signature helper
- [x] Wired canonical derivation to core flows:
  - `src/services/templateService.ts` (create/update canonical_name from shared utility)
  - `src/services/workoutService.ts` (manual RWN + raw interval canonical derivation/backfill)
  - `src/pages/WorkoutDetail.tsx` (matching + preview + display canonical derivation)
- [x] Fixed template duration estimation path in `src/pages/TemplateDetail.tsx` to use `structureToRWN(...)` rather than JSON stringifying structure.
- [x] Added confidence-scored suggestion matching (read-only first):
  - `src/utils/templateMatching.ts` now returns `match_confidence` + `match_reason`
  - `src/pages/WorkoutDetail.tsx` suggestion banner now displays confidence and reason text
- [ ] Next: canonical signature persistence strategy + optional DB fields for match metadata (`match_reason`, `match_confidence`) on logs.

### Coaching Analytics + Performance Tier (2026-02-26) ✅ COMPLETE
- [x] Added team-scoped `performance_tier` model (`pool`, `developmental`, `challenger`, `champion`) with additive migration:
  - `db/migrations/20260226_add_team_athlete_performance_tier.sql`
- [x] Updated coaching service + types + roster editing for performance tier (`team_athletes`-scoped, separate from `experience_level`)
- [x] Added season measured-workout leaderboard service:
  - `getSeasonMeasuredLeaderboard(teamId, { limit })`
  - tracks average raw rank + average W/lb rank + simple trend
- [x] Wired top-level summary surfaces:
  - `src/pages/coaching/CoachDashboard.tsx` (quick-view top 5 leaderboard card)
  - `src/pages/coaching/TeamAnalytics.tsx` (analytics route leaderboard table)
- [x] Enhanced assignment results private/public pages:
  - added aggregate cards (avg finisher split/watts, best/worst rep, spread)
  - added per-athlete `Best · Worst` and `Spread` columns for interval summary tables

### Copilot CLI Skill Pack ✅ COMPLETE (2026-02-26)
- [x] Added project skills under `.github/skills/`:
  - `supabase-schema-guard` (MCP-first schema/type drift validation)
  - `preflight-test-gate` (lint/build/test gate workflow)
  - `rowing-domain-validator` (rowing/training checks using `kb/` physiology/coaching/injury docs)
  - `rwn-spec-guardian` (RWN spec + surface-map guard with discovery rule)
- [x] Skills are repository-scoped and available via `/skills` in Copilot CLI.

### Copilot CLI Skill Pack Expansion ✅ COMPLETE (2026-02-26)
- [x] Added `ui-ux-consistency-guard` (a11y/responsive/interaction consistency checks across `src/pages` + `src/components`)
- [x] Added `concept2-reliability-guard` (Concept2 scope/token/sync/publish/reconciliation reliability checks)

### Copilot CLI Skill Pack Expansion II ✅ COMPLETE (2026-02-26)
- [x] Added `coaching-rls-guard` (team/org scoping, role hierarchy, RLS safety checks)
- [x] Added `migration-safety-guard` (DDL rollout/backfill/policy/RPC safety checks)
- [x] Added `analytics-integrity-guard` (metric/unit/statistical/visualization integrity checks)
- [x] Added `edge-function-operability-guard` (auth/secrets/idempotency/observability/deploy checks)

### ErgLink ↔ LC Integration Contract (ADR-017) ✅ COMPLETE
Defined shared TypeScript types in `src/types/ergSession.types.ts` (canonical — mirrored in ErgLink) covering:
- **`ActiveWorkoutSpec`** — typed shape for `erg_sessions.active_workout` JSONB. Replaces local `WorkoutConfig` in `CoachSessions.tsx`.
- **`ErgLinkUploadMeta`** — typed shape for `workout_logs.raw_data` when `source = 'erg_link_live'`.
- **`SOURCE_PRIORITY`** + **`ReconciliationMatch`** — codifies ADR-015 reconciliation rules.

#### LC-side wiring TODO:
1. [x] Refactor `CoachSessions.tsx` to use `ActiveWorkoutSpec` instead of local `WorkoutConfig` (type-safe bridge step completed, build verified)
2. [x] Add coaching view queries for `source = 'erg_link_live'` workout logs (implemented in `workoutService` source-filtered views via `.in('source', ['concept2', 'erg_link_live'])`, build verified)
3. [x] Auto-complete `daily_workout_assignments.completed_log_id` when EL upload has `group_assignment_id` (guarded/idempotent path added: only updates rows where `completed_log_id IS NULL`, build verified)
4. [ ] Wire reconciliation to merge EL uploads with C2 syncs using `ReconciliationMatch` tolerances

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
**Self-service routes**: `/team` → MyTeamDashboard, `/team/scores` → MyScores, `/team/notes` → MyTeamNotes ✅, `/team/settings` → MyTeamSettings ✅.

### UX & Architecture Improvements ✅ COMPLETE
1. **Shared UI Component Library** — `src/components/ui/` with Card, CardHeader, Button, Badge, Input, Select, Breadcrumb, EmptyState (all theme-token-aware)
2. **Breadcrumb Navigation** — Added to WorkoutDetail, TemplateDetail, CoachingAthleteDetail, AssignmentResults
3. **ErgLink Phase 2 Decomposition** — App.tsx from 454-line monolith → ~115-line router orchestrator with OnboardingScreen, DashboardScreen, ErrorBoundary, SessionSubscriber, extracted RaceOverlay + LiveDataGrid
4. **Magic Layer DB Persistence** — Added `canonical_signature`, `match_confidence`, `match_reason` columns to `workout_logs` (live migration applied). Service wiring in `workoutService.ts` for signature + match metadata persistence.
5. **Self-Service Pages** — Created MyTeamNotes + MyTeamSettings pages, wired routes `/team/notes` and `/team/settings`
6. **Light Theme Token System** — CSS custom properties in `:root`/`html.light` for semantic colors (surface, text, border, accent). Tailwind extended with token-based utilities (`bg-surface-card`, `text-content-primary`, etc.). All shared UI components migrated to tokens. Legacy html.light overrides preserved for backward compat.

### Shared Copilot Skills ✅ COMPLETE
- Universal skills in `C:/Users/samgammon/apps/shared-skills/`: devops-commit-guard, iterative-dev-loop, structured-dev-workflow, ui-ux-consistency-guard
- VS Code `chat.agentSkillsLocations` configured globally to scan `.github/skills` + shared-skills
- Context7 MCP added to global VS Code settings

### Recent Changes
- **Org-level configurable performance tier rubric (2026-02-26)**: Added organization-scoped rubric overrides so benchmark tier mapping (squad + best 2k) is configurable per org in `src/pages/coaching/CoachingSettings.tsx` under Organization settings. Added migration `db/migrations/20260226201930_add_org_performance_tier_rubric.sql` and applied live via Supabase MCP (`add_org_performance_tier_rubric`), introducing `public.organizations.performance_tier_rubric` (jsonb). Updated `src/utils/performanceTierRubric.ts` to support override configs and wired roster/dashboard tier derivation in `src/pages/coaching/CoachingRoster.tsx` and `src/pages/coaching/CoachDashboard.tsx` to use org rubric values when present. Validation pass: `npm run build`, `npm run test:run` (lint still has pre-existing repo-wide issues).
- **Blank benchmark tier badge text fix (2026-02-26)**: Fixed fallback rendering in `src/pages/coaching/CoachingRoster.tsx` and `src/pages/coaching/CoachDashboard.tsx` so tier display never renders an empty badge/text when an athlete has a best 2k but no derivable rubric tier (e.g., unmapped squad). Fallback now shows `Needs squad mapping` instead of blank. Validation pass: `npm run build`, `npm run test:run`.
- **Quick Score visibility + standalone score entry fix (2026-02-26)**: Updated `src/pages/coaching/CoachingRoster.tsx` to expose an always-visible `Add score` action per athlete (mobile + desktop), not only the assignment-missing path. Updated `src/components/coaching/QuickScoreModal.tsx` so when no missing assignment exists it saves a standalone erg score via `createErgScore(...)` instead of requiring assignment linkage; assignment-linked behavior remains unchanged. Validation pass: `npm run build`, `npm run test:run`.
- **Benchmark-based tier rendering (squad + 2k) (2026-02-26)**: Added `src/utils/performanceTierRubric.ts` with rubric-driven benchmark tier derivation from squad + best 2k time (`developmental`, `competitive`, `challenger`, `national team`) and helper map builders/time formatting. Wired `src/pages/coaching/CoachDashboard.tsx` org roster and `src/pages/coaching/CoachingRoster.tsx` team roster to load best-2k-per-athlete from `coaching_erg_scores` and render derived tier labels plus best 2k reference. Current rubric includes coach-provided freshman example with defaults for novice/JV/varsity and is centralized for easy tuning. Validation: `npm run build`, `npm run test:run`.
- **Assignment-results consistency label simplification (2026-02-26)**: Updated `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` to remove the confusing `σ Splits` presentation from heatmap/summary surfaces and use `Spread` only. Heatmap final column now shows split spread (best↔worst delta), and summary tables now keep `Best · Worst` + `Spread` without extra sigma column. Validation pass: `npm run build`, `npm run test:run`.
- **Applied `performance_tier` migration to live Supabase (2026-02-26)**: Ran `add_team_athlete_performance_tier` via Supabase MCP on project `vmlhcbkyonemmlawnqqr`. Verified live schema now includes `public.team_athletes.performance_tier` (nullable text), constraint `team_athletes_performance_tier_check`, and partial index `idx_team_athletes_team_performance_tier`.
- **Team-management navigation + org roster inline editing pass (2026-02-26)**: Updated `src/pages/coaching/CoachDashboard.tsx` so team rows/chevrons in the org/team hierarchy now switch active team and route directly to `/team-management/roster`. Expanded org-wide grouped roster table to show full roster fields (first/last, squad, grade, side, experience, performance tier, height, weight) with inline edit behavior aligned to roster patterns, including unit-aware height/weight entry/display for imperial vs metric. Updated `src/components/coaching/BulkRosterModal.tsx` to include `performance_tier` in bulk add rows and pass it to `createAthlete(...)`. Validation pass: `npm run build` and `npm run test:run` both green.
- **Imperial analytics + schema-fallback hotfix (2026-02-26)**: Updated `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` so heatmap ratio mode and Power-vs-Bodyweight percentile plot now honor user measurement units (`W/lb` when imperial, `W/kg` when metric), including labels/tooltips/benchmark lines and ratio math. Added schema-safe fallback in `src/services/coaching/coachingService.ts` for environments where `team_athletes.performance_tier` is not yet migrated: athlete queries now retry without the column and hydrate `performance_tier: null` instead of hard-failing with 400. Build + tests verified (`npm run build`, `npm run test:run`).
- **Team member add 500 fix (policy recursion) (2026-02-25)**: Root-caused `POST /rest/v1/team_members` 500 on add-by-email to recursive policy evaluation. The prior INSERT policy (`Coaches and coxswains can add team members`) referenced `public.team_members` directly inside `team_members` policy logic, which can trigger internal recursion/errors. Added migration `db/migrations/20260225_fix_team_members_insert_policy_recursion.sql` introducing security-definer helper `can_manage_team_members(team_id, user_id)` and rewired policy `WITH CHECK` to call helper instead of inline subquery. Applied live via Supabase MCP migration `fix_team_members_insert_policy_recursion` on project `vmlhcbkyonemmlawnqqr`; policy verification confirms `with_check = can_manage_team_members(team_id, auth.uid())`.
- **Join flow already-member feedback polish (2026-02-25)**: Updated `src/pages/JoinTeam.tsx` so invite-code attempts by users already on a team now show a clearer message (`You are already on this team`) with a direct `Go to My Team` action. Error styling now uses an amber informational variant for already-member state in both enter and preview steps. Build verified clean (`npm run build`).
- **Coach invite flows fixed for existing accounts (2026-02-25)**: Root-caused invite failures to RLS + lookup mismatch. `team_members` insert policy only allowed self-joins (`auth.uid() = user_id`), blocking coach/coxswain email-adds of other users; and `teams` select policy blocked non-members from reading private teams by invite code, breaking `/join` preview/join flow. **Service fix** (`src/services/coaching/coachingService.ts`): `getTeamByInviteCode()` now calls new RPC `lookup_team_by_invite_code(p_code)` (SECURITY DEFINER) and `addTeamMemberByEmail()` now performs case-insensitive email matching via `.ilike(...)`. **DB migration**: `db/migrations/20260225_fix_team_invite_rls_and_lookup.sql` adds `team_members` INSERT policy for coach/coxswain staff and creates/grants `lookup_team_by_invite_code` RPC to authenticated users. Applied live via Supabase MCP migration `fix_team_invite_rls_and_lookup` on project `vmlhcbkyonemmlawnqqr`. Build verified clean (`npm run build`).
- **Org dashboard assignment rows now link to results (2026-02-25)**: In `src/pages/coaching/CoachDashboard.tsx`, org-level grouped assignment list items now include direct links to assignment results (`/team-management/assignments/:assignmentId/results`) via clickable title and explicit `Results →` action. Build verified clean (`npm run build`).
- **Organization name editing in Team Settings (2026-02-25)**: Added editable organization name controls in `src/pages/coaching/CoachingSettings.tsx` for teams assigned to an organization. Added new service method `updateOrganization(...)` in `src/services/coaching/coachingService.ts`, wired save flow with success/error state, and refreshed coaching context after save so updated org name propagates to dashboard labels/navigation. Build verified clean (`npm run build`).
- **Org-first Team Management dashboard flow (2026-02-25)**: Updated `src/pages/coaching/CoachDashboard.tsx` so organization-level UX now leads the page: top section nav supports org-wide anchors for `Roster`, `Schedule & Log`, `Assignments`, and `Boatings`; organization roster panel was moved above the team hierarchy; and added simple org-wide grouped list sections for schedule/log, assignments, and boatings (grouped by team, plus organization-wide assignment grouping). This keeps org context primary and avoids jumping directly into selected-team pages when org-level navigation is intended. Build verified clean (`npm run build`).
- **Team Management top-nav count switched to org totals (2026-02-25)**: Updated `src/pages/coaching/CoachDashboard.tsx` top section-navigation badge (`Roster`) to show organization-wide athlete total when an org is active (sum across all org team athlete counts) instead of the selected team-only count. Quick-view stats remain team-scoped below.
- **Team Management root nav placement UX fix (2026-02-25)**: Updated `src/pages/coaching/CoachDashboard.tsx` so section navigation links (`Roster`, `Schedule & Log`, `Assignments`, `Boatings`, `Analytics`, `Live Sessions`, `Settings`) now render directly beneath the `Organizations & Teams` block instead of inside the lower quick-view section. This keeps primary navigation at the top context where team selection occurs and removes the awkward feel of needing to scroll into quick view before jumping to section pages. Quick view content remains below unchanged. Build verified clean (`npm run build`).
- **PM5 adapter-level lowering utility + classification tests (2026-02-25)**: Added `src/utils/rwnPm5Lowering.ts` with `lowerWorkoutStructureToPm5(...)` to map `WorkoutStructure` to `ActiveWorkoutSpec` and classify PM5 capability as `exact`, `prompt_only`, or `unsupported`. Lowering now marks any session-orchestration extension (`partner`/`relay`/`rotate`/`circuit`) as `prompt_only` while preserving the PM5-programmable core payload, and returns `unsupported` for unsupported calorie-based cases. Added focused tests in `src/utils/rwnPm5Lowering.test.ts` validating: native fixed interval (`exact`), partner orchestration (`prompt_only`), rotate orchestration (`prompt_only` with parser-derived core), and calorie step rejection (`unsupported`). Validation: focused test suite pass (`4/4`) and full build pass (`npm run build`).
- **RWN parser/session-extension additive implementation + regression validation (2026-02-25)**: Implemented parser-first support for coach-facing orchestration syntax in `src/utils/rwnParser.ts` with additive metadata attachment only (no breaking shape changes): `partner(...)`, `relay(...)`, `rotate(...)`, and `circuit(...)`. Added orchestration metadata model `SessionExtension` + optional `sessionExtension` to all workout structure variants in `src/types/workoutStructure.types.ts`. Added dedicated additive test suite in `src/utils/rwnParser.test.ts` covering partner core preservation, active off-task circuit, relay defaults, rotate plan parsing, standalone circuit parse, and explicit legacy interval regression guard. Validation: focused parser tests passing (`50/50`) and full app build passing (`npm run build`).
- **RWN note finalized with decision contract (2026-02-25)**: Expanded `working-memory/rwn-core-vs-session-extension-notes.md` with a formal Decision Contract section covering agreed coach-facing terminology (`On/Off`, `Switch`, `Stations`), default behaviors for partner/relay (`relay(leg=500m,total=6000m)` minimal form), allowed content model for `on/off/station` (any valid RWN block, with initial no-nested-orchestration guardrail), PM5 execution boundary (`exact` vs `prompt_only` vs `unsupported`), and runtime requirement for participant/team-size determinism.
- **RWN orchestration naming + circuit extension notes updated (2026-02-25)**: Updated `working-memory/rwn-core-vs-session-extension-notes.md` to reflect coach-facing terminology decisions (`On/Off`, `Switch`, `Stations`) and simplified relay defaults (`relay(leg=500m,total=6000m)`). Added explicit partner active off-task example and new `circuit(...)` extension section with examples (`20 burpees, 20 pushups, 20 situps`) for off-task/station orchestration. Documented default behaviors and PM5 mapping boundary (circuit is orchestration metadata/prompt layer, not PM5-native programming).
- **Diagonal ratio-zone shading added (2026-02-25)**: Enhanced `Power vs Body Weight` scatter in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` with subtle diagonal background zone shading between W/kg percentile benchmark lines (`P25`, `P50`, `P75`) so ratio bands are visible at a glance. Implemented with chart-coordinate polygon overlays (`recharts` `Customized`) so shading aligns to axes and benchmark geometry. Team-colored points and team/benchmark legends remain. Diagnostics + build verified clean (`npm run build`).
- **Team-colored decomposition chart + W/kg benchmark lines (2026-02-25)**: Updated `Power vs Body Weight` scatter in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` to color points by team (with team legend chips) and replaced median crosshair guides with diagonal W/kg percentile benchmark lines (`P25`, `P50`, `P75`) derived from the current filtered dataset. Tooltips now include team name. This improves cohort comparison (varsity/novice clustering) while preserving ratio interpretability. Build verified clean (`npm run build`).
- **Decomposition chart de-colored for clarity (2026-02-25)**: Removed quadrant/group color encoding from the `Power vs Body Weight` scatter in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx`. Points now render in a single color, and tooltip group labels were removed to reduce interpretive bias while chart semantics are being refined. Median reference lines (weight/power) remain color-distinct. Build verified clean (`npm run build`).
- **Weight-axis direction aligned to ratio intuition (2026-02-25)**: Updated decomposition scatter X-axis in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` to `reversed` so lighter bodyweight trends in the same visual direction as higher power (supports ratio-style interpretation). Axis label updated to `Body Weight (kg, lighter →)`. Diagnostics verified clean (no file errors).
- **Median line color differentiation (2026-02-25)**: Updated decomposition scatter median guides in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` so weight and power medians are visually distinct. Weight median line/label now uses blue (`#60a5fa`), power median line/label uses amber (`#f59e0b`). Diagnostics verified clean (no file errors).
- **Percentile chart semantics refactor (2026-02-25)**: Replaced the previous percentile-vs-percentile scatter in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` with a decomposition scatter: **X = body weight (kg), Y = power (watts)**. Added median reference lines for weight/power, updated quadrant-style grouping labels to non-overlapping coaching interpretations (high power/lower mass, high power/higher mass, lower power/lower mass, lower power/higher mass), and retained split + power-to-weight context in tooltips. This removes the prior self-referential percentile coupling (split signal reused in both axes). Build verified clean (`npm run build`).
- **Heatmap row numbering added (2026-02-25)**: Added visible row indices to athlete rows in both private and public rep heatmaps so ranking order is easier to scan at a glance. Implemented in `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx` by prefixing each athlete row label with its current sorted position. Diagnostics verified clean (no file errors).
- **Results chart order + summary collapse controls (2026-02-25)**: Updated both private and public results pages to match requested chart sequencing and add table-level collapse. In `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx`, interval chart order is now **Rep Heatmap → Speed/Power Percentiles → Rep Progression**. Percentile chart is no longer duplicated in the generic chart grid for interval mode (`!isInterval` guard). Added collapsible summary-table controls in both `SummaryTable` and `PublicSummaryTable` headers (`Collapse`/`Expand`) so users can hide/show the entire summary table section. Build verified clean (`npm run build`).
- **Percentile chart upgraded in both private + public results pages (2026-02-25)**: Replaced linear percentile dot plot with grouped 2D scatter in both `src/pages/coaching/AssignmentResults.tsx` and `src/pages/PublicAssignmentResultsShare.tsx`. New chart maps **speed percentile (X)** vs **W/kg percentile (Y)**, adds median reference lines (P50/P50), and color-groups athletes into quadrant-style cohorts (balanced/speed/power/develop). Tooltip now includes split, power-to-weight, and both percentile values. Athletes missing weight are excluded from this chart with an explicit count note. Build verified clean (`npm run build`).
- **Public share page global team filtering + heatmap metric parity (2026-02-25)**: Extended `src/pages/PublicAssignmentResultsShare.tsx` so team filter now scopes the **entire page** (summary counts, summary table, rep progression chart, rep heatmap, and all comparison charts). Added page-level team selector when multi-team data exists. Upgraded public `RepHeatmap` to private-style split/W·kg mode toggle (`Split` vs `W/kg`) with per-rep W/kg derivation from split + effective weight, metric-aware medians/coloring/cell text, and sortable headers. Build verified clean (`npm run build`).
- **Public share page summary-table parity pass (2026-02-25)**: Updated `src/pages/PublicAssignmentResultsShare.tsx` to mirror private `AssignmentResults` summary-table UX while staying read-only. Added private-style table formatting + behavior: sortable columns with `ArrowUpDown`, status bands/dividers (Partial, Completed-no-data, DNF), collapsible **Not completed** section with show/hide toggle, and private-style row status visuals (icons/badges + opacity tiers). Added working search/status filters and team filter (when multi-team data exists). Preserved public constraints: no back/navigation controls and no edit actions. Charts remain visible on the public page and render from the full read-only dataset. Build verified clean (`npm run build`).
- **Public share page TypeScript narrowing fix (2026-02-25)**: Fixed compile errors in `src/pages/PublicAssignmentResultsShare.tsx` caused by interval type predicates that omitted required `IntervalResult.rep`. Updated split-averaging narrowing to use `IntervalResult & { split_seconds: number; distance_meters: number }` and replaced nullable split extraction with `flatMap` to build a strict `number[]`. Resolved related nullability errors in weighted/mean split reductions. Build verified clean (`npm run build`).
- **Share RPC random/hash function resolution fix (2026-02-25)**: Root-caused share-link failure to function lookup inside `SECURITY DEFINER ... SET search_path = public` routines. `gen_random_bytes`/`digest` were unresolved from `public` path. Updated migration and live functions to schema-qualify extension calls: `extensions.gen_random_bytes(...)` and `extensions.digest(...)` in both `create_assignment_results_share` and `resolve_assignment_results_share`. Applied via Supabase MCP migration (`fix_assignment_share_extension_function_schema`) and reloaded PostgREST schema. Verified extension calls execute successfully in DB.
- **RWN strategy note captured + share-link RPC 404 mitigation (2026-02-25)**: Saved RWN architecture/spec-extension concepts to `working-memory/rwn-core-vs-session-extension-notes.md` (core parser vs session orchestration extensions; package strategy across LC/EL/ReadyAll; partner/relay/rotation examples). For share-link `404` on `/rpc/create_assignment_results_share`, verified both functions exist in `public` (`create_assignment_results_share(uuid, integer)`, `resolve_assignment_results_share(text)`), issued `NOTIFY pgrst, 'reload schema'` to refresh PostgREST cache, and re-granted execute to `anon, authenticated` for both RPCs. User should hard-refresh app and retry share link action.
- **Applied share-link migration to live Supabase via MCP (2026-02-25)**: Executed `20260225_add_assignment_result_shares.sql` against project `vmlhcbkyonemmlawnqqr` using `mcp_supabase_apply_migration`. Verified RPCs now exist with `mcp_supabase_execute_sql`: `create_assignment_results_share` and `resolve_assignment_results_share` present in `pg_proc`. This resolves prior `404` on `/rest/v1/rpc/create_assignment_results_share`.
- **Public assignment-results share links + memoization fix (2026-02-25)**: Implemented one-click external sharing for assignment results. **DB migration**: `db/migrations/20260225_add_assignment_result_shares.sql` adds `assignment_result_shares` table and secure RPCs `create_assignment_results_share(...)` (authenticated coach/org-role gated) and `resolve_assignment_results_share(...)` (token-based public resolver returning read-only assignment + result rows). **Service layer** (`src/services/coaching/coachingService.ts`): added `createAssignmentResultsShare()`, `resolveAssignmentResultsShare()`, and `buildAssignmentResultsShareUrl()`, plus `AssignmentResultsShareData` type. **UI** (`src/pages/coaching/AssignmentResults.tsx`): added `Copy Share Link` action in header that creates a 7-day link and copies it to clipboard with expiry toast. **Public route/page**: added `/share/assignment-results/:shareToken` in `src/App.tsx` and new `src/pages/PublicAssignmentResultsShare.tsx` read-only preview page with summary table and sign-up CTA. Also fixed React Compiler memoization warning in `AssignmentResults.tsx` by removing closure dependency (`matchesStatus`) from memoized filter logic. Build verified clean (`npm run build`).
- **AssignmentResults UX polish pass (2026-02-25)**: Updated `src/pages/coaching/AssignmentResults.tsx` per review pass. **Summary table** now has cleaner controls (athlete search + status filter), and the **Not completed** section is collapsible with a visible count and quick expand action. Sorting behavior remains intact while applying to the filtered subset, and empty-filter state now renders a clear message. **Chart priority** updated so interval-specific analytics render first when applicable (`RepProgressionChart`, `RepHeatmap`), followed by general comparison charts. **Rep heatmap** now supports metric toggle between `Split` and `W/kg`; W/kg mode derives per-rep ratio from split + effective weight and updates median/cell coloring + labels accordingly. Build verified clean (`npm run build`).
- **Result weight persistence visibility + query hardening (2026-02-25)**: Clarified and hardened behavior when `daily_workout_assignments.result_weight_kg` is missing in an environment. In `src/services/coaching/coachingService.ts`, assignment row fetches now track runtime availability of `result_weight_kg`, skip repeated failing selects once missing is detected, and continue fallback reads/writes without the column (hydrating `result_weight_kg: null`). In `src/pages/coaching/CoachingAssignments.tsx` (`ResultsEntryModal`), added an explicit amber warning banner when the weight column is unavailable so coaches know entered weights cannot persist yet. Build verified clean (`npm run build`).
- **Assignment results 400 retry hardening (2026-02-25)**: Further hardened `daily_workout_assignments` result fetches in `src/services/coaching/coachingService.ts` for pre-migration environments. `getAssignmentResultsWithAthletes()` and `getAthleteAssignmentRows()` now perform a fallback retry **without** `result_weight_kg` on any primary select error (not just specific error-message matches), and hydrate `result_weight_kg: null` when fallback succeeds. This addresses lingering 400s where Supabase error variants did not match prior detector logic. Build verified clean (`npm run build`).
- **AssignmentResults ratio-coverage second pass (2026-02-25)**: Expanded power-to-weight visibility across Assignment Results charts/tables in `src/pages/coaching/AssignmentResults.tsx`. Existing summary table ratio column retained (`W/kg · W/lb`), and now chart/tooltips also surface ratio context: **Split bar tooltip** now shows split + power-to-weight, **Watts bar tooltip** now shows watts + power-to-weight, **Percentile dot tooltip** now includes power-to-weight, **Rep progression tooltip legend text** now includes per-athlete power-to-weight, and **Rep heatmap athlete column** now shows a power-to-weight subline per row. Also corrected chart weight-presence gating to use computed `wpkg` availability (handles `result_weight_kg` fallback correctly). Build verified clean (`npm run build`).
- **User-level measurement units preference (2026-02-25)**: Added a user-scoped units setting (`preferences.units`) with no team-level defaults. **New hook**: `src/hooks/useMeasurementUnits.ts` resolves units from `user_profiles.preferences.units` with fallback to `imperial`. **Utilities**: `src/utils/unitConversion.ts` now exports `MeasurementUnits`, `isMeasurementUnits`, and `resolveMeasurementUnits`, and `formatHeight`/`formatWeight` are unit-aware. **Preferences UI**: `src/pages/Preferences.tsx` now includes a Units control in General tab (`Imperial` / `Metric`) with auto-save to `user_profiles.preferences`. **Coaching entry/display rollout**: `ResultsEntryModal` in `src/pages/coaching/CoachingAssignments.tsx` now uses user units for weight input labels/placeholders and converts to kg before persistence; `AthleteEditorModal` now accepts `units` prop and supports imperial or metric entry for height/weight while storing metric; `CoachingRoster.tsx` inline height/weight editing + display now follow user units; `CoachingAthleteDetail.tsx` height/weight display now uses unit-aware formatters and passes units into `AthleteEditorModal`. Build verified clean (`npm run build`).
- **Assignment results weight entry switched to lbs input (2026-02-25)**: Updated `ResultsEntryModal` in `src/pages/coaching/CoachingAssignments.tsx` so coaches enter bodyweight in pounds (`Wt lbs`) while persistence remains metric (`result_weight_kg`). Added lbs↔kg helpers in modal scope (`formatLbsFromKg`, `parseLbsToKg`), prefill now converts saved/profile kg values to lbs for display, and save path converts entered lbs back to kg before calling `saveAssignmentResults()`. This keeps DB canonical metric storage while matching current imperial coaching workflow. Build verified clean (`npm run build`).
- **Assignment fetch 400 compatibility fix for `result_weight_kg` (2026-02-25)**: Addressed production 400 errors on `daily_workout_assignments` selects when environments lag the new `result_weight_kg` column migration. **Service hardening** (`src/services/coaching/coachingService.ts`): added schema-drift detection helper for missing `result_weight_kg` and fallback query paths in `getAthleteAssignmentRows()` and `getAssignmentResultsWithAthletes()` that retry without the new column and hydrate `result_weight_kg: null` in-memory. Added save fallback in `saveAssignmentResults()` to retry update without `result_weight_kg` when column is unavailable, preventing result-entry breakage pre-migration. `addAthleteToAssignment()` insert-return select made schema-safe (does not depend on `result_weight_kg` in returning projection; returns `result_weight_kg: null`). Build verified clean (`npm run build`).
- **Concept2 token restore/persist hardening (2026-02-25)**: Investigated `FATAL_REFRESH_ERROR` + DB rows showing `concept2_* = null` despite expected valid tokens. Determined primary risk is persistence timing/visibility (OAuth callback can run before Supabase user hydration, and refresh-path DB writes previously ran fire-and-forget without error logging), not a TS schema/type mismatch. **Fixes**: (1) `src/pages/Callback.tsx` now waits/retries briefly for authenticated Supabase user before upserting C2 tokens to `user_integrations`, with explicit warning if still unavailable; (2) `src/api/concept2.ts` refresh path now performs explicit token upsert with error logging (no silent failure) via helper persistence function; (3) `src/auth/AuthContext.tsx` DB/local self-heal backfill now triggers when any of token/refresh/expiry fields are missing (not just access token). Build verified clean (`npm run build`).
- **Per-assignment result weight + dual-unit power-to-weight display (2026-02-25)**: Added assignment/test-level weight capture and usage so power-to-weight reflects the athlete's weight at time of result, not only profile default. **Service layer** (`src/services/coaching/coachingService.ts`): added `result_weight_kg` to assignment row/result row types, select projections (`getAthleteAssignmentRows`, `getAssignmentResultsWithAthletes`, `addAthleteToAssignment`), and save payload handling in `saveAssignmentResults()`. **Results entry UI** (`src/pages/coaching/CoachingAssignments.tsx`): `ResultsEntryModal` now includes per-athlete `Wt kg` input, prefilled from saved `result_weight_kg` or fallback athlete profile `weight_kg`; save path persists `result_weight_kg` for complete, partial, and DNF result submissions. **Assignment results UI** (`src/pages/coaching/AssignmentResults.tsx`): effective weight now resolves as `result_weight_kg` first, then profile `weight_kg`; displays both `W/kg` and `W/lb` in the table and W/kg chart tooltip text now includes both units, with final label pass updated to explicit `W/kg · W/lb` wording for consistency. **DB migration**: added `db/migrations/migration_add_result_weight_kg.sql` (`ALTER TABLE public.daily_workout_assignments ADD COLUMN IF NOT EXISTS result_weight_kg NUMERIC;`). Build verified clean (`npm run build`, tsc + vite).
- **Coxswain athletes excluded from all erg-related coaching pages (2026-02-24)**: Athletes with `side === 'coxswain'` are now filtered out across all coaching pages where erg performance is tracked or expected. Uses the athlete `side` field (not team roles, which aren't wired to invites yet). **CoachingAssignments.tsx**: `ergAthletes`/`ergOrgAthletes` memoized lists exclude coxswains from `ComplianceGrid`, `CreateAssignmentForm`, `ResultsEntryModal`, `EditAssignmentModal`, and the form's internal `getOrgAthletes()` call. **CoachingErgScores.tsx**: Added `ergAthletes` memo; used for score filtering (coxswain scores excluded from display), squad filter derivation, athlete name resolution, CSV export, and `AddScoreForm` dropdown. **TeamAnalytics.tsx**: Filters coxswains from loaded athletes in both org-level (`getOrgAthletesWithTeam`) and single-team (`getAthletes`) paths before setting state — keeps coxswains out of W/kg charts, squad power comparison, and filter dropdowns. **AssignmentResults.tsx**: `ResultsModalLoader` filters coxswains from loaded athletes before passing to `ResultsEntryModal`; "Not yet completed" note renamed to "Absent or not completed" and excludes coxswains (by `is_coxswain` flag combining `side` and team_members role). `PercentileDotPlot` excludes DNF/partialDnf athletes. **Service layer**: `AssignmentResultRow` now includes `side` and `is_coxswain` (true if `side='coxswain'` OR team_members `role='coxswain'`); `getAssignmentResultsWithAthletes` fetches `side`/`user_id` and queries team_members for coxswain roles. **Not filtered** (intentionally): CoachingRoster (canonical member list), CoachingBoatings (coxswain seat needed), CoachingSchedule (session notes apply to all), CoachingAthleteDetail (individual view), CoachDashboard (athlete counts include all members). Build verified clean (zero errors).
- **Late athlete addition to assignments (2026-02-24)**: Added ability to retroactively add athletes to existing assignments from the ResultsEntryModal. **Service**: New `addAthleteToAssignment(groupAssignmentId, athleteId, assignment)` in `coachingService.ts` — inserts a `daily_workout_assignments` row with proper team_id resolution for org assignments, returns `AthleteAssignmentRow`. **UI**: `ResultsEntryModal` now has an "Add athlete" button (UserPlus icon) next to "Mark all complete". Clicking shows a dropdown of roster athletes not yet assigned (excluding coxswains). Selecting one creates the DB row and appends a blank entry to the form. Dropdown shows athlete name + squad badge. Toast confirms addition. Feature works in both standalone and `AssignmentResults.tsx`-hosted modal (shared component). Build verified clean.
- **Team-based analytics and assignment filtering (2026-02-24)**: Replaced squad-only grouping with team-based separation across analytics and assignment results pages. **Service layer** (`coachingService.ts`): Added `team_id`/`team_name` optional fields to `TeamErgComparison` and `AssignmentResultRow`. Created 3 new org-level functions: `getOrgErgComparison(orgId)` (parallel per-team erg fetch, tagged with team info), `getOrgTrainingZoneDistribution(orgId)` (zone data aggregated across teams), `getOrgAthletesWithTeam(orgId)` (athletes tagged with team_id/team_name). Updated `getAssignmentResultsWithAthletes()` to include `team_id` from `daily_workout_assignments` rows and `team_name` from team lookup. **Types** (`types.ts`): Added optional `team_id`/`team_name` to `CoachingAthlete`. **TeamAnalytics.tsx**: Now detects org context — when orgId exists, loads org-wide data via new service functions. Two-tier filtering: team dropdown (primary) + squad dropdown (secondary). Header changes to "Organization Analytics" when in org mode. Auto-resets filters on org change. **AssignmentResults.tsx**: Added team filter pills for org assignments (shown when `assignment.org_id` exists and multiple teams present). Team filter applied before squad filter. Athlete name sub-line now shows "Team · Squad" when both available. **Chart tooltips**: `SquadPowerComparisonChart` and `WattsPerKgChart` tooltips now show team_name when present (indigo accent). Build verified clean (tsc, zero errors).
- **Org-level assignment athlete resolution fix (2026-02-24)**: Fixed org-scoped assignments showing "no athletes assigned" in Enter Results and only showing current-team athletes in Edit. Root cause: UI components were passing team-scoped `getAthletes(teamId)` results to modals instead of org-wide athlete lists. **CoachingAssignments.tsx**: Added `orgAthletes` state populated via `getOrgAthletes(orgId)` in `loadData`. `ResultsEntryModal` invocation now receives `orgAthletes` when the assignment has `org_id`. `EditAssignmentModal` refactored: accepts `orgAthletes`/`orgId` props, computes `effectiveAthletes` (org-wide for org assignments, team-scoped otherwise), `assignTo` state expanded to `'all' | 'org' | 'squad' | 'custom'`, mode detection compares against `effectiveAthletes`, radio buttons include "All Teams (Org)" option when applicable, custom athlete list uses `effectiveAthletes`. **AssignmentResults.tsx**: `ResultsModalLoader` now conditionally calls `getOrgAthletes(orgId)` instead of `getAthletes(teamId)` when `assignment.org_id` is set. Added `getOrgAthletes` import. Added `orgId` to `load` callback dependency array. Build verified clean (tsc, zero errors).
- **Org-level assignment athlete resolution fix (2026-02-24)**: Fixed org-scoped assignments showing "no athletes assigned" in Enter Results and only showing current-team athletes in Edit. Root cause: UI components were passing team-scoped `getAthletes(teamId)` results to modals instead of org-wide athlete lists. **CoachingAssignments.tsx**: Added `orgAthletes` state populated via `getOrgAthletes(orgId)` in `loadData`. `ResultsEntryModal` invocation now receives `orgAthletes` when the assignment has `org_id`. `EditAssignmentModal` refactored: accepts `orgAthletes`/`orgId` props, computes `effectiveAthletes` (org-wide for org assignments, team-scoped otherwise), `assignTo` state expanded to `'all' | 'org' | 'squad' | 'custom'`, mode detection compares against `effectiveAthletes`, radio buttons include "All Teams (Org)" option when applicable, custom athlete list uses `effectiveAthletes`. **AssignmentResults.tsx**: `ResultsModalLoader` now conditionally calls `getOrgAthletes(orgId)` instead of `getAthletes(teamId)` when `assignment.org_id` is set. Added `getOrgAthletes` import. Added `orgId` to `load` callback dependency array. Build verified clean (tsc, zero errors).
- **Org assignment 400/403 errors fixed (2026-02-24)**: Fixed two Supabase errors when creating/viewing org-level assignments. **(1) 400 on group_assignments query**: `getComplianceData()` was filtering `group_assignments` by `workout_date` column — which doesn't exist; correct column is `scheduled_date`. Fixed in `coachingService.ts`. **(2) 403 on daily_workout_assignments INSERT**: Two root causes — (a) `createGroupAssignment()` fan-out set `team_id: null` on daily rows for org assignments, but RLS INSERT policy required `team_members.team_id = daily_workout_assignments.team_id` which fails for NULL. Fixed by resolving each athlete's actual `team_id` from `team_athletes` junction before inserting. Same fix applied to `syncAssignmentAthletes()` (now accepts `org_id` param, resolves athlete→team mapping for new rows). (b) RLS policies on `daily_workout_assignments` only checked `team_members` — updated all 4 policies (INSERT/SELECT/UPDATE/DELETE) to also allow access via org membership through `group_assignments` → `organization_members` join. Migration: `db/migrations/20260223_fix_org_assignment_rls_and_column.sql`. Applied to live Supabase. Build verified clean.
- **Org/Team hierarchy dashboard (2026-02-24)**: Redesigned `/team-management` CoachDashboard from single-team view to org→team hierarchy. Page header now says "Team Management" (not team-specific). New `OrgCard` component renders collapsible organization cards with Building2 icon, org name, team/athlete summary counts. Each team row shows name, role badge (Coach/Coxswain/Member), athlete count, and indigo "Active" highlight for selected team. Click any team to switch context. Named orgs sort first, standalone teams grouped last. Active team quick-view (section nav, weekly focus, stats, today's workouts) renders below the hierarchy. Added `getTeamAthleteCounts(teamIds)` batch service function (single query on `team_athletes` returning `Record<string, number>`) to avoid N+1 queries. Old `<select>` dropdown switcher replaced by visual hierarchy cards. Build verified clean (tsc, zero errors).
- **Concept2 mobile sync network hardening (2026-02-23)**: Improved resilience for real-device mobile sync failures reporting generic "Network Error". **API client** (`src/api/concept2.ts`): added request timeouts (`20s`) and made refresh dedupe mobile-safe by wrapping Web Locks usage with a fallback when `navigator.locks` is unavailable (common on some mobile browsers). **Sync hook** (`src/hooks/useConcept2Sync.ts`): added transient-network retry wrapper for profile/page/detail/stroke fetch operations, plus clearer mobile-oriented error message when failures match transient network signatures (timeouts/ERR_NETWORK/failed-to-fetch/5xx/429).
- **Scroll hint auto-hide at end (2026-02-24)**: Tab-strip chevrons now show only when there is right-side overflow and hide once scrolled to the end. Implemented scroll-width/scroll-position detection with refs + scroll/resize listeners in `CoachingNav.tsx`, `CoachDashboard.tsx`, and `WeeklyFocusCard.tsx`.
- **Scroll hint de-buttoned (2026-02-24)**: Updated mobile tab-strip indicators to avoid button affordance confusion. Replaced chevron-in-circle pills with plain decorative `ChevronsRight` icons (`aria-hidden`, pointer-events-none) in `CoachingNav.tsx`, `CoachDashboard.tsx`, and `WeeklyFocusCard.tsx`.
- **Chevron affordance rendering fix (2026-02-24)**: Replaced right-edge gradient overlays (which rendered as harsh dark blocks in some theme combinations) with compact chevron-pill indicators in `CoachingNav.tsx`, `CoachDashboard.tsx`, and `WeeklyFocusCard.tsx`. Keeps mobile scroll hint while avoiding theme-specific artifacts.
- **Mobile scroll affordance for tab strips (2026-02-24)**: Added visible cues that tab rows are horizontally scrollable on mobile. Updated `CoachingNav.tsx`, `CoachDashboard.tsx`, and `WeeklyFocusCard.tsx` tab strips with right-edge gradient fade + chevron hint (`ChevronsRight`) while preserving hidden-scrollbar horizontal scroll behavior.
- **Weekly Focus mobile tab-strip fix (2026-02-24)**: Updated `src/components/coaching/WeeklyFocusCard.tsx` tab rows (both edit and display modes) to use the same mobile-safe pattern as coaching navs: horizontal scrolling (`overflow-x-auto`), hidden scrollbars, and non-shrinking tab pills (`shrink-0 whitespace-nowrap`) to prevent cramped/overflowed tabs on narrow screens.
- **Coaching mobile content gutter polish (2026-02-24)**: Added a small, consistent horizontal buffer on mobile to prevent edge bleed across team-management pages. Updated wrapper padding to `px-4 sm:px-6` (with existing vertical spacing preserved) in `CoachingAssignments.tsx`, `CoachingRoster.tsx`, `CoachingBoatings.tsx`, `CoachingErgScores.tsx`, `CoachingSettings.tsx`, `CoachingAthleteDetail.tsx`, and `TeamAnalytics.tsx`.
- **Coaching tab UX mobile polish + roster badges (2026-02-24)**: Added roster-count badge to roster tabs and improved mobile tab behavior. `src/components/coaching/CoachingNav.tsx`: now fetches `getTeamStats(teamId)` and renders athlete-count pill on the Roster tab; tab bar uses explicit horizontal scrolling with hidden scrollbar styles and `shrink-0` tab pills for stable small-screen behavior. `src/pages/coaching/CoachDashboard.tsx`: section navigation tab strip now uses the same mobile horizontal-scroll treatment and shows athlete-count badge on Roster tab using existing `teamStats.athleteCount`.
- **Sync lint cleanup (2026-02-24)**: Replaced inline-style progress bar width in `src/pages/Sync.tsx` with native `<progress>` element + Tailwind pseudo-element classes to satisfy no-inline-style lint rule while preserving visual behavior.
- **Concept2 connection false-disconnected fix (2026-02-24)**: Fixed C2 status getting stuck as "Disconnected" despite valid local tokens. Root causes: (1) `restoreC2Tokens()` could receive `user_integrations` rows with `concept2_* = null` and had no self-heal path, (2) Sync page only listened to a non-emitted event (`concept2-auth-error`) and did not react when tokens were restored in the same tab. **Auth fix** (`src/auth/AuthContext.tsx`): switched restore query to `.maybeSingle()`, added DB/local reconciliation (backfill DB from local token values when DB token is null), and emits `concept2-token-updated` plus reconnect event when no token remains. **UI fix** (`src/pages/Sync.tsx`): connection indicator now re-checks on `tokensReady`, `concept2-token-updated`, `concept2-reconnect-required`, `storage`, and window `focus`. **OAuth callback hardening** (`src/pages/Callback.tsx`): added explicit `upsert` error logging and emits token-updated event after token storage. **Refresh path sync event** (`src/api/concept2.ts`): emits token-updated when tokens are refreshed or cleared.
- **Assignments page UX redesign (2026-02-24)**: Replaced cramped 7-cell week grid + duplicate detail panel with a horizontal date strip + full-width assignment cards. Key changes: (1) **Compact header row**: title, week navigator, view toggle, and "Assign Workout" button all in one responsive row (stacks on mobile). (2) **Horizontal date strip**: 7 day buttons showing day name, date number, and dot indicators for assignment count. Selected day highlighted with indigo ring. (3) **Full-width detail cards**: `AssignmentDetailCard` replaces old `AssignmentCard` — shows title, ORG/zone/TEST badges, canonical name, instructions (2-line clamp), and action buttons (Enter Results, View Results, Edit, Delete). Cards display in a 2-column grid on desktop (`lg:grid-cols-2`). Mobile edit/delete actions show inline; desktop uses hover-reveal icons. (4) **Wider container**: `max-w-7xl` (from `max-w-5xl`) matching Roster/Analytics. (5) **Empty state**: dashed border placeholder with calendar icon and quick-assign link. Build verified clean (tsc + vite, 2855 modules).
- **Coaching module deep audit — 27 issues fixed (2026-02-24)**: Ran 4-subagent audit (security, robustness, type-safety, UX) across all coaching files. Found 27 issues (8 Critical, 6 High, 7 Medium, 6 Low). All fixed in a single session across 12 files. Key fixes: (1) **Context**: exposed `orgId`, `activeTeam` on `CoachingContextType`, changed `teamRole` from `string` to `TeamRole`, user-scoped localStorage key. (2) **Cross-org data leakage**: `getComplianceData()` replaced dangerous `team_id.is.null` filter with proper org-scoped `group_assignment_id` lookup. (3) **Org athlete resolution**: `getAssignmentResultsWithAthletes()` accepts optional `orgId`, uses `getOrgAthletes()` for cross-team visibility. (4) **Mutual exclusivity**: `createGroupAssignment()` throws if both `org_id` and `team_id` set. (5) **Type safety**: `BoatPosition.athlete_name` made optional. (6) **orgId passthrough**: 6 UI components updated to destructure `orgId` from context and pass to service calls. (7) **Boatings hardening**: fixed spread operator sending extra fields, changed `'Unknown'` fallbacks to `''`, added try/catch to 5 handlers. (8) **Robustness**: Added `teamId` guards + try/catch + toast.error to ~15 handlers across Roster, Schedule, ErgScores, AthleteDetail. Build verified clean (tsc + vite).
- **Cascade delete migration applied (2026-02-23)**: `db/migrations/20260223_add_cascade_delete_teams.sql` applied to live Supabase. 7 FK constraints updated with ON DELETE CASCADE.
- **Orphaned Freshmen team data cleaned up (2026-02-23)**: Deleted 55 assignments, 2 sessions, 1 boating from the old "Freshmen" team via Supabase MCP SQL.
- **Org-wide workout assignments — full stack (2026-02-23)**: Implemented org-level assignment support so workouts survive athlete transfers between teams. **Migration** (`db/migrations/20260223_add_org_assignments_and_boating_snapshots.sql`): Added `org_id` FK to `group_assignments`, made `team_id` nullable, added CHECK constraint (`team_id OR org_id, not both`), updated RLS policies to allow org-level queries, added index on `org_id`. Applied to live Supabase. **Service layer** (`coachingService.ts`): Added `getTeamsForOrg(orgId)` (queries teams by org) and `getOrgAthletes(orgId)` (fetches all athletes across all org teams, de-duplicated). Updated `getGroupAssignments()` to accept optional `orgId` and use `.or()` filter for org-wide + team-scoped assignments. Updated `createGroupAssignment()` to auto-fan-out to all org athletes when `org_id` is set and `team_id` is null. Updated `syncAssignmentAthletes()` for nullable `team_id`. Updated `getComplianceData()` and `getAssignmentCompletions()` to query across all org teams. **UI** (`CoachingAssignments.tsx`): Added "All Teams (Org)" radio button in `CreateAssignmentForm` with lazy-loaded org athlete state. `assignTo` union type expanded to `'all' | 'squad' | 'org'`. `handleSubmit` sets `org_id`/`team_id` correctly for org-level assignments. `AssignmentCard` shows "ORG" badge when `assignment.org_id` is set. Derived `orgId` from `useCoachingContext().teams`. Build verified clean (tsc + vite).
- **Boating athlete_name snapshots for historical accuracy (2026-02-23)**: Added `athlete_name` field to `BoatPosition` type. Updated `CoachingBoatings.tsx` in 4 places: `setPosition()` resolves and stores athlete name when assigning a seat; `getAthleteNameForSeat()` prefers snapshot name over live roster lookup; `handleSeatChange()` includes snapshot name for inline edits; swap logic preserves snapshot names during seat swaps. Prevents "Unknown" display when athletes transfer to different teams. Types updated in `src/services/coaching/types.ts`.
- **CoachingContext refactor — shared state via React Context (2026-02-23)**: Converted `useCoachingContext` from a standalone custom hook (each consumer got independent state) to a proper React Context (`CoachingProvider` + `useCoachingContext` consumer hook) in `src/contexts/CoachingContext.tsx`. Root cause: team switching in `CoachingNav` only updated Nav's local state + localStorage; page components (Roster, Settings, etc.) kept stale `teamId` until remount. Fix: single `CoachingProvider` wraps all routes in `App.tsx`, so all consumers share one state instance. `switchTeam()` now immediately updates all components. Old `src/hooks/useCoachingContext.ts` is now a re-export shim for backward compatibility. Build verified (tsc + vite, zero errors).
- **Athlete team transfer within org (2026-02-23)**: Added ability to move athletes between teams within the same organization from the roster page. Service: `transferAthlete(athleteId, fromTeamId, toTeamId)` in `coachingService.ts` — updates `team_athletes` junction row's `team_id` and clears squad (since squads are team-specific). UI: Transfer icon (ArrowRightLeft) in roster actions column (both mobile and desktop), only visible when current team belongs to an org with other teams. Click opens a modal listing sibling teams; selecting one moves the athlete and shows a toast confirmation. Athlete immediately disappears from the current roster view. Uses `teams` + org info from `useCoachingContext()` to compute sibling teams. Build verified (tsc + vite, zero errors).
- **Coxswain team management access (2026-02-23)**: Updated `isCoach` check in `AuthContext.tsx` from `.eq('role', 'coach')` to `.in('role', ['coach', 'coxswain'])`. Coxswains can now access all `/team-management/*` routes (roster, assignments, boatings, schedule, settings, analytics). Previously only coaches could.
- **Delete team feature (2026-02-23)**: Added full team deletion with safety checks. Migration: `db/migrations/20260223_add_cascade_delete_teams.sql` — alters 7 FK constraints on `coaching_athlete_notes`, `coaching_boatings`, `coaching_erg_scores`, `coaching_sessions`, `group_assignments`, `team_athletes`, `team_members` to add `ON DELETE CASCADE`. **Migration needs manual execution in Supabase.** Service: `deleteTeam(teamId)` + `getTeamDataCounts(teamId)` (returns counts of athletes, sessions, assignments, boatings, erg scores). UI: Danger Zone card at bottom of CoachingSettings with red-bordered "Delete Team" button. Confirmation dialog shows itemized data counts warning, requires typing the team name to confirm, then deletes and redirects to dashboard (if other teams exist) or setup page (if last team).
- **Organizations layer UI wiring (2026-02-22)**: Full implementation of the Organization > Team hierarchy UI. **Phase 1 — Service Layer**: Added `createOrganization()`, `getOrganizationsForUser()`, `getOrgByInviteCode()`, `joinOrgByInviteCode()`, `regenerateOrgInviteCode()`, `assignTeamToOrg()`, `removeTeamFromOrg()` to `coachingService.ts`. Updated `UserTeamInfo` type to include `org_id` and `org_name`. Updated `getTeamsForUser()` to join through `teams.org_id → organizations.name`. Added `Organization`, `OrgRole`, `OrganizationMember` to re-exports. **Phase 2 — Context Hook**: Updated `useCoachingContext` to compute `teamsByOrg` (via `useMemo`) grouping teams into `OrgTeamGroup[]` — named orgs first, standalone last. Exported `OrgTeamGroup` interface. **Phase 3 — Dashboard Switcher**: Updated `CoachDashboard.tsx` team switcher from flat `<select>` to grouped `<optgroup>` by org. Falls back to flat list when all teams are standalone. **Phase 4 — TeamSetup**: Added org selection to team creation flow — dropdown with existing orgs, "No organization" default, or "Create new organization" inline fields. When creating a new org, creates org first then assigns team. **Phase 5 — CoachingSettings**: Added Organization card to team settings page. Shows org dropdown (including "No organization") with instant save on change. Loads user's orgs on mount. Uses `assignTeamToOrg()`/`removeTeamFromOrg()` service functions. Build verified clean (tsc + vite build, zero errors).
- **Organizations migration + types (2026-02-22)**: Created `db/migrations/20260222_add_organizations.sql` migration, applied to Supabase. Creates `organizations` table (with invite_code, RLS), `organization_members` table (with role enum, RLS), `teams.org_id` nullable FK, indexes, `updated_at` trigger. Added `Organization`, `OrgRole`, `OrganizationMember` interfaces + `org_id` to `Team` in `types.ts`. ADR-016 logged.
- **Weekly focus Monday-alignment fix (2026-02-22)**: Fixed all 6 instances of `weekStartsOn: 0` → `weekStartsOn: 1` in `CoachingSchedule.tsx` so schedule/calendar aligns with Monday-based `coaching_weekly_plans.week_start`. Fixed month view calendar headers (Sun-first → Mon-first) and grid padding offset to `(getDay() + 6) % 7`.
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

### Key Hook: `src/contexts/CoachingContext.tsx`
Provides shared coaching state (teams, active team, org grouping, switchTeam) via React Context. `CoachingProvider` wraps all routes in `App.tsx`. Old `src/hooks/useCoachingContext.ts` is now a re-export shim. All consumers share a single state instance — switching teams in any component (CoachingNav, Dashboard, Settings) immediately updates all other consumers.

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
