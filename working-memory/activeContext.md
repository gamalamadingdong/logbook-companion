# Active Context

> Last updated: March 23, 2026

## Current Focus
- The coaching IA has moved to **Schedule as the parent surface** with internal `Schedule | Lineups` tabs.
- `CoachingSchedule.tsx` now owns day/week/month navigation, visible event/session CTAs, and the embedded org-wide Lineups surface.
- The old `/team-management/boatings` route is now just a redirect into `Schedule?tab=lineups`, and top-level coaching nav no longer treats Lineups as a separate peer page.

## Recently Completed

### Schedule + Lineups merge pass
- `src/pages/coaching/CoachingSchedule.tsx`
  - added a real `Day` view alongside `Week` and `Month`
  - added internal `Schedule | Lineups` tabs driven by query params
  - added top-level `Add Session` and `Add Event` CTAs plus more visible event creation affordances inside schedule views
  - session cards now open the embedded `Lineups` tab instead of routing out to a separate page
  - add-session modal now supports an explicit team selector on create when org teams are available
  - event banners now surface team scope more clearly, including an explicit `All teams` state
- `src/pages/coaching/CoachingBoatings.tsx`
  - extracted the reusable `LineupsWorkspace` surface so Schedule can render it inline
  - lineup cards now show team labels
  - old standalone route now redirects into `Schedule?tab=lineups&from=boatings`
- `src/components/coaching/CoachingNav.tsx`
  - removed the separate top-level `Lineups` tab now that it lives inside Schedule
- `src/pages/coaching/CoachDashboard.tsx`
  - lineup summary card now deep-links into `Schedule?tab=lineups`

### Persistent boats + boating logs foundation
- Added live Supabase migration `add_persistent_coaching_boats` and local file `db/migrations/20260320_add_persistent_coaching_boats.sql`.
- New `public.coaching_boats` table now stores persistent boats/shells with team-scoped RLS mirroring existing coaching tables.
- `public.coaching_boatings` now has nullable `boat_id`; existing boating rows were backfilled to parent boats.
- Verified live schema via Supabase MCP: `coaching_boats` exists, `coaching_boatings.boat_id` exists, and new boat-table policies are present.

### Coaching service/model updates
- `src/services/coaching/types.ts` now includes `BoatType`, `CoachingBoat`, and `boat_id` on `CoachingBoating`.
- `src/services/coaching/coachingService.ts` now exposes `getBoats()`, `getOrgBoats()`, `createBoat()`, `getOrgSessions()`, and `getBoatingsByDateRange()`.
- `createBoating()` / `updateBoating()` now persist `boat_id` and `session_id`, matching the live schema instead of lagging behind it.

### Boatings ↔ Schedule UX coupling
- `src/pages/coaching/CoachingBoatings.tsx`
  - boating creation/edit now supports selecting a persistent boat or creating one from the log
  - when creating a new boating log from an existing persistent boat, the form now preloads the most recent saved crew for that shell as the starting lineup
  - boating logs can link to a session directly in the form
  - creating a boating log from a session now uses that session's team/date context rather than relying on the current boating-page defaults
  - session context on Boatings now shows:
    - boating logs already linked to the session,
    - same-day unlinked boating logs that can be linked,
    - explicit link/unlink actions,
    - a clearer "Exit session view" action instead of the ambiguous old session-link banner
  - expanded boating cards now act as the first detail surface and show crew-context rower notes
- `src/pages/coaching/CoachingSchedule.tsx`
  - water sessions now compute/show linked boating counts for the visible range
  - expanded water sessions now show linked boating logs inline with shell name, lineup by seat, and boat notes
  - water sessions now expose clearer actions:
    - `Add boating log`
    - `Manage lineup & logs`
  - `Add boating log` is now a true session-bound modal inside Schedule instead of a redirect into the Boatings page
  - session-bound boating creation uses the session date and creates the boating directly as a child of that rowing day
  - the secondary Boatings route is now a real linking/editing workflow instead of just a net-new creation detour
  - non-water sessions remain session-only

### Session-owned crew snapshots
- Added live Supabase migration `add_session_crew_snapshots` and local file `db/migrations/20260321_add_session_crew_snapshots.sql`.
- New `public.coaching_session_crews` table stores per-session crew snapshots with boat metadata, ordering, and optional provenance to a source boating template/history row.
- New `public.coaching_session_crew_positions` table stores per-seat athlete snapshots with preserved `athlete_name` so historical reports survive athlete deletion.
- Existing `coaching_boatings.session_id` data was backfilled into the new session-crew tables so current linked water-session history now appears in the new session-first model.

### Coaching service/model updates
- `src/services/coaching/types.ts` now includes `CoachingSessionCrew` and `CoachingSessionCrewPosition`.
- `src/services/coaching/coachingService.ts` now exposes `getSessionCrewsForSession()`, `getSessionCrewsForSessions()`, `createSessionCrew()`, `updateSessionCrew()`, and `deleteSessionCrew()`.

### Schedule UX reset
 - `src/pages/coaching/CoachingSchedule.tsx`
   - now loads session-owned crew snapshots for the visible range
   - water sessions now show **crew snapshot counts** instead of linked-boating counts as the primary daily indicator
   - water-session detail now supports:
     - add crew snapshot
    - edit crew snapshot
    - delete crew snapshot
    - start from a persistent boat or saved boating template/history row
   - the saved-lineup picker now only offers boating templates that actually have seated positions, and saved snapshot names stay visible even if a rower is no longer in the current roster list
   - the crew snapshot modal stays session-team-scoped, and the secondary Lineups page now matches that selected-team scope so saved-lineup availability is no longer confused by org-wide same-name teams
   - schedule copy now frames Boatings as `Lineups` instead of the main daily workflow

### Templates/history UX pass
- `src/components/coaching/CoachingNav.tsx`
  - boating tab label now reads `Templates & History`
  - fixed touched-file hook lint issues while updating the nav label
- `src/pages/coaching/CoachingBoatings.tsx`
  - page header now explains that Schedule is the primary daily-report surface and this page is for reusable crew records, shell history, and session-linked references
  - session-context banner now emphasizes returning to the session report and browsing templates separately
  - empty states, section headers, CTA labels, destructive-confirmation copy, and form labels now consistently use **crew record / templates / history** language instead of framing the page as the normal daily logging workflow
  - history/archive wording now uses `Crew history archive` / `Move to history` / `Restore from history`
  - now operates in the selected-team scope instead of loading org-wide records, so it no longer shows misleading same-name-team lineups that Schedule cannot legally reuse
  - session-linking UI/flows have been removed from this page; it is now lineup/history tooling only
  - rower note context still reads/writes session notes for legacy linked crew records via `boating.session_id`, but no longer tells users to link sessions here
- `src/components/coaching/CoachingNav.tsx`
  - boating tab label now reads `Lineups`
- `src/pages/coaching/CoachingSchedule.tsx`
  - schedule CTA copy now uses `Lineups` instead of `Templates & history`
  - saved-lineup picker now supports org-wide lineup reuse with explicit team labels when other teams in the org own the source lineup
  - when copying a lineup from another team, the snapshot copies boat name/type + seats without silently attaching that other team's persistent `boat_id`

## Validation Status
- Supabase MCP verification:
  - `coaching_session_crews` exists ✅
  - `coaching_session_crew_positions` exists ✅
  - SELECT/INSERT/UPDATE/DELETE RLS policies exist for both new tables ✅
- Targeted ESLint on touched coaching files passed:
  - `src/pages/coaching/CoachingSchedule.tsx`
  - `src/services/coaching/coachingService.ts`
  - `src/services/coaching/types.ts`
  - `src/pages/coaching/CoachingBoatings.tsx`
  - `src/components/coaching/CoachingNav.tsx`
 - The follow-up Schedule saved-lineup fix also passed:
   - `npx eslint src/pages/coaching/CoachingSchedule.tsx`
   - `npm run build`
   - `npm run test:run`
- The schedule lineup-source scope fix passed:
  - `npx eslint src/pages/coaching/CoachingSchedule.tsx`
  - `npm run build`
  - `npm run test:run`
- The lineups/team-scope cleanup passed:
  - `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx src/components/coaching/CoachingNav.tsx`
  - `npm run build`
  - `npm run test:run`
- The reusable lineup-source migration passed:
  - live Supabase migration `allow_reusable_session_crew_sources` ✅
  - verified `coaching_session_crews.source_boating_id` is no longer unique ✅
  - verified replacement index `idx_coaching_session_crews_source_boating_id` exists ✅
  - `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx src/components/coaching/CoachingNav.tsx`
  - `npm run build`
  - `npm run test:run`
- The Schedule + Lineups merge pass passed:
  - `npx eslint src/pages/coaching/CoachingSchedule.tsx src/pages/coaching/CoachingBoatings.tsx src/components/coaching/CoachingNav.tsx src/pages/coaching/CoachDashboard.tsx`
  - `npm run build`
  - `npm run test:run`
- `npm run lint` still fails on unrelated pre-existing repo issues outside the touched coaching files.

## Important Files
- `db/migrations/20260321_add_session_crew_snapshots.sql`
- `db/migrations/20260320_add_persistent_coaching_boats.sql`
- `src/services/coaching/types.ts`
- `src/services/coaching/coachingService.ts`
- `src/pages/coaching/CoachingSchedule.tsx`
- `src/pages/coaching/CoachingBoatings.tsx`
- `src/components/coaching/CoachingNav.tsx`
- `working-memory/decisionLog.md`

## Next Likely Steps
- Decide whether the embedded Lineups tab should become date-aware (for example, filter/highlight lineups for the currently focused day/week/month range).
- Improve multi-team schedule scope if coaches should truly see or create sessions for `All teams` rather than a single active team filter.
- Add richer template workflows if needed:
  - explicit "save this session crew as template"
  - recent session crews as first-class template sources
  - boat/history filtering inside the embedded Lineups tab
- Tackle repo-wide lint debt separately from this feature if a clean `npm run lint` becomes mandatory.

## Blockers
- No technical blocker on the implemented session-first slice.
- Live data currently contains duplicate same-name team rows in the org, with saved boating history attached to only one set of team IDs; org-wide lineup reuse now intentionally surfaces those records with explicit team labels, but data cleanup may still be needed later.
- Live save failures when reusing a lineup template were caused by an incorrect unique constraint on `coaching_session_crews.source_boating_id`; that constraint has now been removed so the same lineup source can seed multiple session snapshots.
- The main remaining product work is feature depth rather than wording: the new merged surface still needs refinement around multi-team scheduling and date-aware lineup browsing if the coaching workflow expands further.
- Repo-wide lint remains noisy because of unrelated pre-existing issues.



