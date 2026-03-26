# Active Context

> Last updated: March 26, 2026

## Current Focus
- The workout library is now being repositioned as a **public community surface** rather than an authenticated-only internal tool.
- The template model now effectively supports three layers:
  - `status = draft` → personal draft
  - `status = published` + `validated = false` → community library
  - `status = published` + `validated = true` → curated standard library
- New work has opened a separate `workout_template_proposals` moderation queue so public/community submission can grow without mixing raw proposals directly into the canonical library table.
- The public workout detail page is now being reframed around **human-first understanding plus machine-ready structure**:
  - whiteboard view first
  - RWN second
  - structured JSON/DTO third
  - visualizer as a supporting explanation, not the primary public read
- The library is moving toward a normalized public template DTO so the app UI and future AI/planning consumers can share one stable contract derived from `workout_templates`.
- The coaching IA has moved to **Schedule as the parent surface** with internal `Schedule | Lineups` tabs.
- `CoachingSchedule.tsx` now owns day/week/month navigation, visible event/session CTAs, and the embedded org-wide Lineups surface.
- The old `/team-management/boatings` route is now just a redirect into `Schedule?tab=lineups`, and top-level coaching nav no longer treats Lineups as a separate peer page.

## Recently Completed

### ReadyAll admin notifications + proposal hardening rollout
- `db/migrations/20260326_add_admin_notification_fields_and_proposal_guards.sql`
  - applied live to the `ReadyAll` Supabase project (`vmlhcbkyonemmlawnqqr`)
  - added `workout_template_proposals.admin_notified_at`
  - added `user_profiles.admin_signup_notified_at`
  - added DB-level proposal guardrails for field lengths and `workout_structure` JSON shape
- `src/services/templateProposalService.ts`
  - now invokes the live proposal-notification edge function using the shorter verified slug `notify-template-proposal`
- `supabase/functions/notify-template-proposal/index.ts`
  - renamed from the longer local slug after Supabase returned a successful deploy response but would not resolve the function by slug
  - now deployed live with `verify_jwt: false` so anonymous public proposal submits can trigger admin email alerts
- `supabase/functions/notify-user-signup/index.ts`
  - deployed live with `verify_jwt: true` so authenticated first-signup/profile creation can trigger admin email alerts
- ReadyAll live verification now confirms:
  - migration `20260326130249_add_admin_notification_fields_and_proposal_guards` exists
  - both new notification columns exist
  - proposal hardening CHECK constraints exist
  - `notify-template-proposal` is retrievable and active
  - `notify-user-signup` is retrievable and active
  - older pending proposal rows that were created before the proposal function was fully reachable have now been backfilled through `notify-template-proposal`, and their `admin_notified_at` timestamps are set

### Public workout library + proposal foundation
- `src\App.tsx`
  - made `/library` and `/library/:templateId` publicly viewable with the shared app chrome instead of `ProtectedRoute`
  - added `/library/propose`
  - added protected reviewer route `/library/review`
  - added redirect compatibility from legacy `/templates/*` and `/workout-library`
- `src\pages\TemplateLibrary.tsx`
  - reframed the surface as a public workout library
  - added clear `Standard | Community | Draft` tier semantics in the UI
  - added proposal CTA and admin review CTA
  - limited edit affordances to admins and template owners
- `src\pages\TemplateDetail.tsx`
  - added template-tier badging and permission-aware edit affordance
  - added aggregate reference counts for assignments/plans to help users “see its uses”
- `src\pages\TemplateProposalPage.tsx`
  - added an RWN-first public proposal flow with validation, duplicate detection, and optional attribution/contact
- `src\pages\TemplateProposalReview.tsx`
  - added basic admin review tooling to mark submissions under review, reject them, or promote them into the community/standard library
- `src\services\templateProposalService.ts`
  - added proposal CRUD/review/promotion service functions
- `db\migrations\20260325_add_workout_template_proposals.sql`
  - added proposal queue table plus public insert and admin review RLS policies
- `src\services\templateService.ts`
  - expanded list queries to include ownership metadata
  - added aggregate reference stats lookup for template detail

### Public workout detail IA + DTO pass
- `src\pages\TemplateDetail.tsx`
  - now foregrounds coach-style whiteboard output and canonical RWN instead of hiding them beneath the visualizer
  - adds a structured-data card with machine-readable JSON copy affordance so the public library reads as both human- and AI-consumable
  - keeps usage/reference signals visible while intentionally deferring ratings from the public headline surface
  - now includes an admin-only `Make standard` action for promoting a community workout into the validated standard tier directly from the detail page
  - now computes whiteboard lines defensively from `workout_structure` (and falls back to RWN when needed) so the coach whiteboard no longer appears blank when derived lines are missing from the DTO
  - now uses shared UI components and token-based surfaces/text for far better light-mode readability
- `src\services\templateService.ts`
  - now exposes `fetchPublicTemplateDetail()` and a normalized library-tier helper so detail-page semantics are not rebuilt ad hoc in the component
  - now exposes `promoteTemplateToStandard()` for admin promotion of published community workouts
- `src\types\workoutStructure.types.ts`
  - now includes `PublicWorkoutTemplateDetail` for the normalized public template DTO shape
- `src\components\WorkoutVisualizer.tsx`
  - now uses token-based neutral surfaces/text so the visual breakdown no longer drags the detail page back into dark-only styling in light mode

### Public docs + anonymous proposal follow-up
- `src\pages\Documentation.tsx`
  - now tells public users where to browse the workout library and where to submit proposals
  - now documents the `Standard | Community | Proposal` flow and explicitly links to `/library` and `/library/propose`
- `src\pages\About.tsx`
  - now points public visitors directly to the workout library from the marketing/about surface
- `src\services\templateProposalService.ts`
  - proposal creation no longer chains `.select().single()` after insert, which was causing anonymous submissions to fail under RLS because anon can insert proposals but cannot read them back

### Validation
- `node .\node_modules\eslint\bin\eslint.js src\pages\TemplateLibrary.tsx src\pages\TemplateDetail.tsx src\pages\TemplateProposalPage.tsx src\pages\TemplateProposalReview.tsx src\services\templateService.ts src\services\templateProposalService.ts src\types\workoutStructure.types.ts` ✅
- `node .\node_modules\eslint\bin\eslint.js src\pages\TemplateDetail.tsx src\services\templateService.ts src\types\workoutStructure.types.ts` ✅
- `node .\node_modules\eslint\bin\eslint.js src\pages\Documentation.tsx src\pages\About.tsx` ✅
- `node .\node_modules\eslint\bin\eslint.js src\services\templateProposalService.ts src\pages\TemplateProposalPage.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` remains unreliable/noisy because of pre-existing repo issues and an existing `src\App.tsx` refs rule outside this feature slice
- `npm run lint` still fails repo-wide on unrelated pre-existing scripts/analytics files outside this workout-library slice
- post-rollout validation for admin notifications:
  - `node .\node_modules\eslint\bin\eslint.js src\services\templateProposalService.ts` ✅
  - `npm run build` ✅
- detail-page follow-up validation:
  - `node .\node_modules\eslint\bin\eslint.js src\pages\TemplateDetail.tsx src\components\WorkoutVisualizer.tsx src\services\templateService.ts src\utils\structureToWhiteboard.ts src\utils\structureToWhiteboard.test.ts` ✅
  - `npm run build` ✅
  - `npm run test:run -- src\utils\structureToWhiteboard.test.ts` ✅
  - `npm run test:run` ✅
  - `npm run lint` still fails repo-wide on unrelated pre-existing scripts/analytics debt; this detail-page slice did not introduce new lint errors

### RWN parser parity fix for PR #31 follow-up
- `src\utils\rwnParser.ts`
  - extracted the shared guidance parser into a reusable helper so work-token guidance and rest-token guidance now use the same parsing rules
  - this closes the parity gap found during PR #31 review, where rest-attached guidance could have drifted from work-attached guidance for valid forms like bare reference pace
- `src\utils\rwnParser.test.ts`
  - added parity tests for rest-token guidance covering:
    - `@2k`
    - `@2k@32spm`
    - `@UT2`
- validation:
  - `node .\node_modules\eslint\bin\eslint.js src\utils\rwnParser.ts src\utils\rwnParser.test.ts` ✅
  - `npm run test:run -- src\utils\rwnParser.test.ts` ✅
  - `npm run build` ✅
  - `npm run test:run` ✅
  - `npm run lint` still fails repo-wide on unrelated pre-existing files (`scripts/*`, analytics components, `src/api/*`, etc.); this parser slice did not add new repo-wide lint debt

## Next Steps
- Run a fresh true end-to-end smoke test for:
  - a brand-new anonymous workout proposal submitted after rollout → one admin email without manual replay
  - first signup/profile creation → one admin email
  - feature request submission → confirm the existing `notify-feedback` path still lands as expected
- Decide whether `ADMIN_NOTIFICATION_EMAIL` should remain on the current fallback or be added explicitly as a Supabase secret for ReadyAll

### Schedule header cleanup
- `src/pages/coaching/CoachingSchedule.tsx`
  - rebuilt the top header into clearer lanes for page identity, `Schedule | Lineups` surface tabs, primary creation actions, and calendar controls
  - replaced the header's raw action buttons with shared `Button`, `Card`, and `Badge` components so the top area now follows the coaching design system more closely
  - made the date range the main focal point, with `Today` and previous/next navigation grouped together and the `Day | Week | Month` switch moved into a separate control row
  - improved mobile stacking and touch target sizing so the top controls read as one organized control panel instead of several competing button strips
  - follow-up polish tightened the `Schedule | Lineups` switch into a centered full-width workspace toggle, folded navigation + creation controls into one shared control panel, and boosted `Add Event` contrast so it reads properly in light mode
  - latest refinement makes the calendar/navigation chrome render only for the `Schedule` tab; `Lineups` no longer shows irrelevant week/day/month controls, and the view switch now uses a softer tab-like treatment instead of another strong button group
  - structural rework anchored the `Schedule | Lineups` switcher in one stable left-side position across both tabs, while the right-side column now changes independently so switching to `Lineups` hides schedule-only controls without moving the workspace nav
  - full shell redesign now uses:
    - a compact top workspace switcher for `Schedule | Lineups`
    - a single contextual schedule toolbar for date navigation, `Day | Week | Month`, and session/event creation
    - a lighter embedded Lineups header so the Lineups tab feels like part of the same page rather than a second nested page

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
- The Schedule header cleanup passed:
  - `node .\node_modules\eslint\bin\eslint.js src\pages\coaching\CoachingSchedule.tsx`
  - `npm run build`
  - `npm run test:run`
- `npm run lint` still fails on unrelated pre-existing repo issues outside the touched schedule work (scripts + `src/App.tsx` refs rule).
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
- Retest the public anonymous proposal flow in the live app now that the insert no longer attempts a follow-up select blocked by RLS.
- Decide whether to expose the normalized public template DTO through a dedicated read-only endpoint / Edge Function for AI and external planning consumers, or keep it app-internal for one more slice.
- Layer the normalized DTO into future plan-builder work so curated library workouts become the default programming building blocks.
- Decide whether community-promoted templates should support ratings/comments/remixes later, with a real trust model, thresholds, and anti-gaming rules instead of headline metrics from day one.
- Add richer reviewer tooling if the proposal queue grows:
  - duplicate/merge into existing library template
  - moderation filters by status/date
  - side-by-side proposal vs published template comparison
- Decide whether authenticated users also need a dedicated “My drafts” surface instead of seeing drafts only incidentally through current template ownership flows.
- If the schedule surface still feels dense after this pass, consider giving the week/day list itself a second visual cleanup so the header and body share the same hierarchy.
- Decide whether the embedded Lineups tab should become date-aware (for example, filter/highlight lineups for the currently focused day/week/month range).
- Improve multi-team schedule scope if coaches should truly see or create sessions for `All teams` rather than a single active team filter.
- Add richer template workflows if needed:
  - explicit "save this session crew as template"
  - recent session crews as first-class template sources
  - boat/history filtering inside the embedded Lineups tab
- Tackle repo-wide lint debt separately from this feature if a clean `npm run lint` becomes mandatory.

## Blockers
- Public aggregate template reference counts may need follow-up if anon/public RLS on assignment/plan tables is stricter than expected; current UI safely falls back to zero with logging rather than breaking the page.
- The proposal queue’s SELECT policy remains intentionally restricted; anonymous submitters can insert successfully but cannot read proposal rows back directly, so future anon UX should continue avoiding insert-returning-row patterns.
- No technical blocker on the implemented session-first slice.
- Live data currently contains duplicate same-name team rows in the org, with saved boating history attached to only one set of team IDs; org-wide lineup reuse now intentionally surfaces those records with explicit team labels, but data cleanup may still be needed later.
- Live save failures when reusing a lineup template were caused by an incorrect unique constraint on `coaching_session_crews.source_boating_id`; that constraint has now been removed so the same lineup source can seed multiple session snapshots.
- The main remaining product work is feature depth rather than wording: the new merged surface still needs refinement around multi-team scheduling and date-aware lineup browsing if the coaching workflow expands further.
- Repo-wide lint remains noisy because of unrelated pre-existing issues.



