# Implementation Log: Feature Development History

**Purpose**: Track what's been built, what worked, what failed, and why certain approaches were abandoned.

---

## Phase 72: ReadyAll admin notifications + proposal hardening rollout (March 26, 2026)

**Timeline**: March 26, 2026  
**Status**: ✅ Complete

### What Was Built

- `db/migrations/20260326_add_admin_notification_fields_and_proposal_guards.sql`
  - applied live to ReadyAll
  - added notification idempotency columns:
    - `workout_template_proposals.admin_notified_at`
    - `user_profiles.admin_signup_notified_at`
  - added DB-level guardrails for public proposal inputs:
    - name length
    - description length
    - RWN length
    - notes length
    - attribution name/contact length
    - `workout_structure` must be a JSON object when present

- `supabase/functions/notify-user-signup/index.ts`
  - deployed live with `verify_jwt: true`
  - authenticates the caller, marks `admin_signup_notified_at`, and sends one admin email per profile

- `supabase/functions/notify-template-proposal/index.ts`
  - renamed locally from `notify-workout-template-proposal`
  - deployed live as `notify-template-proposal` with `verify_jwt: false`
  - accepts only `proposalId`, marks `admin_notified_at`, and sends one admin email per pending proposal

- `src/services/templateProposalService.ts`
  - updated to invoke the verified live slug `notify-template-proposal`

### Why This Shape Won

- public proposal submission needs anonymous reach, so the proposal function must intentionally disable JWT verification while still constraining its input to a UUID and doing all privileged work server-side
- first-signup notifications should stay tied to authenticated profile creation, so the signup function keeps `verify_jwt: true`
- idempotency belongs in the database fields (`admin_notified_at`, `admin_signup_notified_at`) so retries and repeated client invocations do not create duplicate emails
- DB-level constraints are the right backstop for a public form because client validation alone is not a security boundary
- the original long proposal-function slug returned a successful deploy response but was not actually addressable via Supabase MCP, so the shorter slug was adopted and verified directly

### Validation

- Supabase MCP:
  - migration `20260326130249_add_admin_notification_fields_and_proposal_guards` present ✅
  - `workout_template_proposals.admin_notified_at` present ✅
  - `user_profiles.admin_signup_notified_at` present ✅
  - proposal hardening CHECK constraints present ✅
  - `notify-template-proposal` active and retrievable ✅
  - `notify-user-signup` active and retrievable ✅
- `node .\node_modules\eslint\bin\eslint.js src\services\templateProposalService.ts` ✅
- `npm run build` ✅

### Outcome

ReadyAll now has the backend pieces for admin notification coverage across public workout proposals and first signups, plus stronger DB-level protection on the public proposal surface. The remaining follow-up is operational smoke testing of actual email delivery rather than schema or deployment work.

---

## Phase 70: Workout library detail IA + normalized public DTO (March 26, 2026)

**Timeline**: March 26, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/TemplateDetail.tsx`
  - reworked the public detail hierarchy so the workout is understood in this order:
    - coach whiteboard view
    - canonical RWN
    - machine-readable JSON/structured-data surface
    - visualizer as supporting context
  - added copy affordances for whiteboard, RWN, and JSON
  - kept usage/reference metrics prominent while deliberately not surfacing ratings as a headline signal yet

- `src/services/templateService.ts`
  - added `getWorkoutTemplateTier()` so tier semantics are derived consistently
  - added `fetchPublicTemplateDetail()` to return a normalized public template DTO including:
    - tier
    - whiteboard lines
    - aggregate reference stats

- `src/types/workoutStructure.types.ts`
  - added `PublicWorkoutTemplateDetail` so the public library read model has an explicit TypeScript contract

### Why This Shape Won

- public library pages need to answer “what is this workout?” faster than an internal template-management page does
- whiteboard text is the fastest human interpretation, while RWN remains the canonical portable notation and JSON remains the machine contract
- a normalized DTO is a better foundation for future AI/planning use than having each consumer infer tiering and derived fields from raw DB rows
- usage/reference counts provide immediate social proof with less trust risk than ratings

### Validation

- `node .\node_modules\eslint\bin\eslint.js src\pages\TemplateDetail.tsx src\services\templateService.ts src\types\workoutStructure.types.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ❌ — still fails on unrelated pre-existing scripts/analytics lint debt outside this library slice

### Outcome

The workout library detail page now reads like a real public knowledge artifact instead of an internal template record, and the app now has the beginnings of a stable, AI-friendly public template contract without creating a second source of truth outside `workout_templates`.

---

## Phase 71: Public library docs + anonymous proposal RLS fix (March 26, 2026)

**Timeline**: March 26, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/Documentation.tsx`
  - added public-facing guidance on where the workout library lives
  - documented the `Standard | Community | Proposal` flow
  - added direct links to `/library` and `/library/propose`

- `src/pages/About.tsx`
  - added a direct CTA to the workout library from the public/about surface
  - added the workout library as a first-class feature in the public product description

- `src/services/templateProposalService.ts`
  - fixed anonymous proposal submission by removing the post-insert `.select().single()` call
  - preserved the existing RLS model where anon users can insert proposals but not select proposal rows

### Why This Shape Won

- the public library needs discoverability from outside the authenticated app chrome, not just from users who already know where to click
- public docs should explain both how to use templates and how to contribute them
- the RLS failure was caused by client behavior, not by missing insert permission, so the correct fix was to stop requiring a read-after-write for anonymous users

### Validation

- `node .\node_modules\eslint\bin\eslint.js src\pages\Documentation.tsx src\pages\About.tsx` ✅
- `node .\node_modules\eslint\bin\eslint.js src\services\templateProposalService.ts src\pages\TemplateProposalPage.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Public users now have clearer guidance on where to browse and propose workouts, and anonymous proposal submission should work with the live RLS policy instead of failing on a blocked readback step.

---

## Phase 69: Public workout library + moderated proposal pipeline (March 25, 2026)

**Timeline**: March 25, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/App.tsx`
  - opened `/library` and `/library/:templateId` to public browsing using the shared `Layout`
  - added a public proposal route at `/library/propose`
  - added a protected admin review route at `/library/review`
  - added compatibility redirects from legacy `/templates/*` URLs and `/workout-library`

- `src/pages/TemplateLibrary.tsx`
  - reframed the page as a public workout library rather than an authenticated-only management page
  - introduced visible library tiers:
    - `Draft`
    - `Community`
    - `Standard`
  - added proposal and review CTAs
  - limited edit affordances to admins and template owners

- `src/pages/TemplateDetail.tsx`
  - added tier badging (`Community Library` vs `Standard Library`)
  - added assignment/plan reference counts so templates expose more of their downstream usage
  - kept personal history/PB as an authenticated enhancement

- `src/pages/TemplateProposalPage.tsx`
  - added a public RWN-first submission flow
  - validates RWN before submit
  - detects duplicate published templates before queueing a new proposal
  - captures optional attribution/contact metadata

- `src/pages/TemplateProposalReview.tsx`
  - added a basic admin moderation queue
  - reviewers can mark proposals under review, reject them, or promote them into:
    - the public community library
    - the validated standard library

- `src/services/templateProposalService.ts`
  - added proposal creation, review, and promotion helpers

- `db/migrations/20260325_add_workout_template_proposals.sql`
  - added `workout_template_proposals`
  - added public insert policy
  - added admin review/select/update policies

- `src/services/templateService.ts`
  - expanded template list metadata so ownership-aware UI decisions are possible
  - added aggregate reference-count queries for template detail

### Why This Shape Won

- it matches the user’s preferred model: **public library first, moderation instead of login as the main quality gate**
- it avoids polluting `workout_templates` with raw submissions by giving proposals their own queue table
- it reuses existing template fields cleanly:
  - `draft` for personal work
  - `published + validated=false` for community library
  - `published + validated=true` for curated standard library
- it preserves the RWN-centered architecture instead of inventing a second workout definition format

### Validation

- `node .\node_modules\eslint\bin\eslint.js src\pages\TemplateLibrary.tsx src\pages\TemplateDetail.tsx src\pages\TemplateProposalPage.tsx src\pages\TemplateProposalReview.tsx src\services\templateService.ts src\services\templateProposalService.ts src\types\workoutStructure.types.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` / linting around `src\App.tsx` remains noisy from unrelated pre-existing issues and was not solved in this slice

### Outcome

The workout library can now act like a real community surface: anyone can browse it, anyone can submit structured workouts into a moderation queue, and admins can promote strong submissions into either a community or curated standard tier without mixing unreviewed proposals directly into the canonical library.

---

## Phase 68: Schedule header UX cleanup (March 23, 2026)

**Timeline**: March 23, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingSchedule.tsx`
  - replaced the custom neutral-toned header wrapper with the shared `Card` surface
  - moved the top controls into clearer groups:
    - page title + coaching context badge
    - `Schedule | Lineups` surface tabs
    - `Add Session` / `Add Event` primary actions
    - range navigation + `Today`
    - `Day | Week | Month` view mode controls
  - swapped the header's raw action buttons for shared `Button` usage and added a `Badge` for stronger page-state signaling
  - increased mobile touch target sizing and reduced visual competition between the date picker row and the view toggle row
  - follow-up polish turned the workspace tabs into a centered full-width switcher and reduced the top-of-page control clutter by folding navigation and creation actions into the same control panel
  - strengthened the `Add Event` action styling with token-based elevated surface colors so it stays legible in light mode
  - final refinement split the top chrome by mode so `Lineups` no longer inherits schedule-only controls, and softened `Day | Week | Month` into a lighter tab treatment rather than a third heavy button group
  - structural follow-up anchored the workspace switcher in a consistent left-side position and reserved the right-side column for schedule-only controls, preventing the nav from jumping when switching to `Lineups`
  - from-scratch shell pass replaced the oversized workspace toggle with a compact top switcher, consolidated schedule actions into one contextual toolbar, and reduced the embedded Lineups header so switching between the two feels like one workflow
  - kept all routing/query-param behavior and schedule interactions intact while improving hierarchy only

### Why This Shape Won

- the previous header asked users to parse title, tabs, actions, view mode, and date navigation at the same visual weight
- making the current range the focal item gives the page a clearer "where am I?" anchor before the user chooses actions
- splitting surface selection from calendar mode selection reduces cognitive overlap between "which workspace am I in?" and "how am I viewing this workspace?"
- using the shared UI components makes the coaching schedule feel more like the rest of the app and less like a one-off admin surface

### Validation

- `node .\node_modules\eslint\bin\eslint.js src\pages\coaching\CoachingSchedule.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ❌ — still fails on unrelated pre-existing repo-wide issues in scripts and `src/App.tsx`

### Outcome

The top of the Schedule page now reads as a single organized control panel instead of a loose stack of mixed buttons. The page should feel cleaner on desktop and much less cramped on mobile without changing how coaches already use the Schedule/Lineups workflow.

---

## Phase 55: Persistent boats + session-linked boating logs (March 20, 2026)

**Timeline**: March 20, 2026  
**Status**: ✅ Complete

### What Was Built

- `db/migrations/20260320_add_persistent_coaching_boats.sql`
  - added persistent parent table `public.coaching_boats`
  - added nullable `boat_id` to `public.coaching_boatings`
  - backfilled existing boating rows onto parent boats by `(team_id, boat_name, boat_type)`
  - added team/view + coach/manage RLS policies mirroring existing coaching access rules

- `src/services/coaching/types.ts`
  - added `BoatType`
  - added `CoachingBoat`
  - added `boat_id` to `CoachingBoating`

- `src/services/coaching/coachingService.ts`
  - added `getBoats()`, `getOrgBoats()`, `createBoat()`, `getOrgSessions()`, and `getBoatingsByDateRange()`
  - updated `createBoating()` and `updateBoating()` to persist `boat_id` and `session_id`
  - preserved `boat_name` / `boat_type` snapshots on boating logs for historical stability

- `src/pages/coaching/CoachingBoatings.tsx`
  - boating logs can now select an existing persistent boat or create a new one implicitly from the log
  - boating logs can link directly to a session
  - session-linked Boatings opens with a contextual banner from the `sessionId` query param
  - expanded boating cards now act as the first detail surface and show rower-context notes:
    - historical coach notes per rower
    - linked-session notes per rower
    - inline add/edit/delete for session notes from the boating surface
  - copy was updated from pure “lineup” language toward “boating log” language

- `src/pages/coaching/CoachingSchedule.tsx`
  - schedule now loads boating logs in the visible date range
  - water sessions show boating-count badges
  - expanded water-session cards expose a boating-management CTA into the Boatings flow
  - non-water sessions remain session-only

### Why This Shape Won

- the user’s mental model is **persistent physical boats/shells with repeated outing logs**, not one-off unnamed snapshots
- live schema already had `coaching_boatings.session_id`, which strongly suggested that `coaching_boatings` should stay the outing-log table instead of becoming the persistent boat entity
- adding a parent `coaching_boats` table was safer than repurposing `coaching_boatings` and breaking history
- keeping the expanded boating card as the first “detail” surface delivered the new rower-note workflow without the extra routing/UI overhead of a brand-new detail page in the same pass

### Validation

- Supabase MCP migration applied: `add_persistent_coaching_boats` ✅
- Supabase MCP verification:
  - `coaching_boats` table present ✅
  - `coaching_boatings.boat_id` present ✅
  - `coaching_boats` RLS policies present ✅
- `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx src/services/coaching/coachingService.ts src/services/coaching/types.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ❌ — unrelated pre-existing repo-wide failures remain outside the touched coaching files

### Outcome

The app now has a real parent/child model for boats and outing logs, water sessions can visibly own boating work, and boating cards can serve as a practical crew-detail surface with rower notes even before a dedicated boating-detail route exists.

---

## Phase 60: Session-first coaching workflow reset plan (March 20, 2026)

**Timeline**: March 20, 2026  
**Status**: ✅ Complete

### What Was Built

- `C:\Users\samgammon\.copilot\session-state\eb170977-aaf2-4942-8d86-3506a4f44686\plan.md`
  - rewrote the coaching sessions/boatings plan from first principles instead of iterating further on the existing linked-record UX
  - reframed the primary artifact as the **session report**
  - proposed that daily crew/boat lineups be stored as **snapshots inside the session**
  - repositioned `CoachingBoatings.tsx` as a future **templates/history** surface rather than a co-equal daily workflow page

- `working-memory/activeContext.md`
  - updated the current focus to reflect the new approved direction
  - recorded that the implemented app still reflects the older session-child-boating model and will need a follow-up redesign pass

- SQL todo tracking
  - marked completed planning tasks:
    - `define-session-report-model`
    - `design-session-crew-ui`
    - `plan-session-centered-rollout`
  - left `decide-template-storage` pending because the storage boundary between current `coaching_boatings` and potential session-owned snapshot tables is still intentionally open

### Why This Approach Won

- repeated UX fixes made the current model more coherent, but the user feedback made clear that the deeper abstraction was still wrong
- the coach’s real job is to open a day, write what happened, and record which crews went out
- "link a boating to a session" is an internal data-model concern, not the right primary user workflow

### Outcome

The project now has an approved redesign direction: **session report first, crew snapshots inside the session, boatings/templates as secondary tooling**. No new code was implemented in this phase; the work product was a clean reset plan and durable session handoff documentation.

---

## Phase 61: Session-owned crew snapshots land in Schedule (March 21, 2026)

**Timeline**: March 21, 2026  
**Status**: ✅ Complete

### What Was Built

- `db/migrations/20260321_add_session_crew_snapshots.sql`
  - added `public.coaching_session_crews` as the canonical per-session crew snapshot table
  - added `public.coaching_session_crew_positions` for seat-by-seat athlete snapshots
  - added team-scoped SELECT/INSERT/UPDATE/DELETE RLS policies mirroring the existing coaching access model
  - backfilled existing `coaching_boatings.session_id` rows into the new session-crew snapshot tables

- `src/services/coaching/types.ts`
  - added `CoachingSessionCrew`
  - added `CoachingSessionCrewPosition`

- `src/services/coaching/coachingService.ts`
  - added `getSessionCrewsForSession()` and `getSessionCrewsForSessions()`
  - added `createSessionCrew()`, `updateSessionCrew()`, and `deleteSessionCrew()`
  - kept team-scoped queries explicit so the new tables follow the existing coaching service/RLS contract

- `src/pages/coaching/CoachingSchedule.tsx`
  - now loads session-owned crew snapshots for the visible range
  - water sessions now show crew snapshot counts as the primary daily-record indicator
  - session detail now supports add/edit/delete for crew snapshots directly inside the session report
  - the crew form can start from:
    - a persistent boat's latest saved lineup
    - any saved boating-history template
  - Boatings is now referenced as `Templates & history` from Schedule rather than the main daily logging path

### Why This Approach Won

- it resolves the still-open storage question from Phase 60 with the safest model: **new session-owned snapshot tables** instead of repurposing `coaching_boatings`
- it preserves the value of boating history/templates without making daily reports depend on a live linked record
- it allows historical session truth to remain stable even if boats, templates, or athlete membership change later
- the migration could safely backfill the existing linked-boating data so current history was not lost

### Validation

- Supabase MCP migration applied: `add_session_crew_snapshots` ✅
- Supabase MCP verification:
  - `coaching_session_crews` present ✅
  - `coaching_session_crew_positions` present ✅
  - RLS policies present on both new tables ✅
- `npx eslint src/pages/coaching/CoachingSchedule.tsx src/services/coaching/coachingService.ts src/services/coaching/types.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

The primary coaching workflow is now materially session-first: a coach can open a water session and save the actual crews that went out as part of the session report itself, while boating history remains useful as helper/template tooling rather than the canonical daily record.

---

## Phase 62: Boatings is reframed as Templates & History (March 23, 2026)

**Timeline**: March 23, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/components/coaching/CoachingNav.tsx`
  - renamed the boating tab to `Templates & History`
  - fixed touched-file hook lint violations while updating the navigation label

- `src/pages/coaching/CoachingBoatings.tsx`
  - updated the page header to explicitly frame the route as secondary tooling for reusable crew records, shell history, and session-linked references
  - added a clearer path back to `Schedule` from both the header and session-context workflow
  - updated session-context copy so coaches are reminded that the session report remains the primary daily record
  - renamed key UX surfaces away from "primary daily logging" language:
    - `New Boating Log` → `New Crew Record`
    - `Past Lineups` → `Crew history archive`
    - archive/reactivate/delete wording now consistently references crew records/history
    - form labels and helper text now explain that linking a session is optional and secondary to the session report
  - updated empty states and DnD helper copy so the page reads like templates/history tooling rather than the normal start point for logging a day

### Why This Approach Won

- the session-first schema/UI work in Phase 61 changed the data boundary, but the product language still made Boatings feel like a competing primary workflow
- coaches need wayfinding that reinforces: **Schedule = daily report**, **Boatings = reusable crew records and history**
- a copy/IA pass on the existing route was the safest way to align the UX without another risky data or routing change

### Validation

- `npx eslint src/pages/coaching/CoachingBoatings.tsx src/components/coaching/CoachingNav.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

The secondary boating surface now reads coherently as `Templates & History`, which better matches the implemented session-first workflow and reduces the chance that coaches treat it as the normal place to log the day.

---

## Phase 63: Lineups becomes team-scoped and drops session-linking UI (March 23, 2026)

**Timeline**: March 23, 2026  
**Status**: ✅ Complete

### What Was Built

- Live-data debugging via Supabase MCP
  - confirmed the apparent Schedule dropdown bug was actually a scoping mismatch
  - found duplicate same-name team rows in the org, with saved `coaching_boatings` attached to only one set of team IDs
  - verified that `CoachingSchedule` was correctly staying session-team-scoped while `CoachingBoatings` was still showing org-wide records

- `src/pages/coaching/CoachingBoatings.tsx`
  - removed the session-context banner, same-day link/unlink panels, and related `sessionId` query-param workflow
  - removed the form field for linking a crew record to a session from the Boatings page
  - changed page data loading from org-wide to selected-team-scoped so the page now matches Schedule's lineup source boundary
  - kept rower-note context functional for legacy linked boating rows by reading/writing session notes through `boating.session_id` when it already exists
  - retained the page as reusable lineup/history tooling instead of a daily session workflow

- `src/components/coaching/CoachingNav.tsx`
  - renamed the boating tab from `Templates & History` to `Lineups`

- `src/pages/coaching/CoachingSchedule.tsx`
  - renamed the secondary CTA/copy from `Templates & history` to `Lineups`

### Why This Approach Won

- the user report was correct about the confusion, but the root cause was not the Schedule modal itself — it was the secondary page advertising lineups that belonged to a different same-named team
- team-scoping the Lineups page is safer than widening Schedule across team boundaries, which would risk cross-team data leakage and break the intended coaching access model
- removing the in-between session-linking workflow keeps the product aligned with the session-first direction: **Schedule owns the day, Lineups stores reusable crew records/history**

### Validation

- Supabase MCP SQL verification of `teams` + `coaching_boatings` counts ✅
- `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx src/components/coaching/CoachingNav.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

The secondary boating surface is now `Lineups`, scoped to the selected team, and no longer pretends to be a session-linking workflow. Schedule and Lineups now agree on what counts as an available saved lineup, so coaches are no longer misled by org-wide records from the wrong team.

---

## Phase 64: Org-wide lineup reuse and reusable source fix (March 23, 2026)

**Timeline**: March 23, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingSchedule.tsx`
  - `Start from saved lineup` now loads org-wide lineup sources when the coach is operating inside an org
  - lineup options show explicit team labels when the source record belongs to another team
  - applying another team's lineup copies the saved boat name/type and seat assignments without attaching that other team's persistent `boat_id`

- `src/pages/coaching/CoachingBoatings.tsx`
  - Lineups page now loads org-wide lineup/boat/athlete data again so lineup reuse matches the user’s real seasonal workflow across teams
  - the earlier session-linking removal remains in place
  - copy now frames Lineups as an org-wide resource

- `db/migrations/20260323_allow_reusable_session_crew_sources.sql`
  - drops the accidental unique constraint on `public.coaching_session_crews.source_boating_id`
  - adds a non-unique partial index for lookup performance instead

- Live Supabase migration
  - applied `allow_reusable_session_crew_sources` directly to the ReadyAll project via MCP

### Why This Approach Won

- the product rule is now explicit: **lineups are org-wide reusable resources**, while **sessions remain team-scoped daily reports**
- the immediate save failure was not a frontend-only bug: the schema incorrectly enforced one-to-one usage of a lineup source via `UNIQUE (source_boating_id)`
- removing that uniqueness is the correct provenance model because the same saved lineup template should be reusable across many session snapshots over time

### Validation

- Live schema inspection:
  - verified `coaching_session_crews_source_boating_id_key` is gone ✅
  - verified `idx_coaching_session_crews_source_boating_id` exists ✅
- `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx src/components/coaching/CoachingNav.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ❌ — still fails only because of unrelated pre-existing repo-wide issues (`scripts/*`, `src/App.tsx`, `src/api/concept2.ts`, etc.)

### Outcome

Coaches can now reuse the same lineup source across multiple session snapshots without hitting a 409, and the Schedule picker can intentionally pull reusable org-wide lineups instead of pretending templates are locked to one team for the whole season.

---

## Phase 65: Schedule absorbs Lineups and adds Day view (March 23, 2026)

**Timeline**: March 23, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingSchedule.tsx`
  - added internal `Schedule | Lineups` tabs using URL query state so deep links can still open the Lineups surface
  - added a true `Day` view in addition to `Week` and `Month`
  - added persistent top-level `Add Session` and `Add Event` CTAs plus more visible event actions inside schedule views
  - session cards now open the embedded Lineups tab instead of routing to a separate top-level page
  - add-session flow now supports choosing the target team at creation time when org team context is available
  - event scope now reads more clearly with explicit team/all-team badges

- `src/pages/coaching/CoachingBoatings.tsx`
  - extracted the reusable `LineupsWorkspace` surface so Schedule can render it inline
  - lineup cards now show the owning team badge directly
  - `CoachingBoatings` is now just a redirect into `Schedule?tab=lineups&from=boatings`

- `src/components/coaching/CoachingNav.tsx`
  - removed the separate top-level Lineups tab, since Lineups now lives inside Schedule

- `src/pages/coaching/CoachDashboard.tsx`
  - updated the lineup summary card to deep-link into `Schedule?tab=lineups`

### Why This Approach Won

- the user’s core feedback was about workflow, not just labels: coaches think in **days and practices first**, then drill into saved lineups as secondary tooling
- embedding Lineups inside Schedule preserves deep linking while eliminating unnecessary route/context switching
- adding Day view and visible event/session CTAs makes Schedule feel like the true operational hub instead of just a weekly list

### Validation

- `npx eslint src/pages/coaching/CoachingSchedule.tsx src/pages/coaching/CoachingBoatings.tsx src/components/coaching/CoachingNav.tsx src/pages/coaching/CoachDashboard.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Coaching navigation is now closer to the approved product direction: Schedule is the single parent surface, Lineups is available as a fast in-context tab, and coaches can move between day/week/month planning without leaving the same page.

---

## Phase 56: Session-first boating handoff and linking workflow (March 20, 2026)

**Timeline**: March 20, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingSchedule.tsx`
  - expanded water-session cards now present clearer actions:
    - `Add boating log`
    - `Manage lineup & logs`
  - the empty-state copy now explains that coaches can either create a new boating log or link an existing same-day boating

- `src/pages/coaching/CoachingBoatings.tsx`
  - opening the page with a `sessionId` query param now creates a real session-context workflow instead of just a banner
  - session context now shows:
    - boating logs already linked to that session,
    - same-day unlinked boating logs available to link,
    - explicit `Link to session` and `Unlink` actions,
    - `Edit` access for each surfaced boating,
    - a clearer `Exit session view` action
  - `create=1` query-param support now opens the new boating form directly for schedule-driven creation

### Why This Approach Won

- the previous handoff was the core UX failure: "Manage boatings" sent coaches to another page that effectively only supported creating a new boating
- keeping `Schedule` as the primary daily surface while making `CoachingBoatings.tsx` a real secondary linking/editor workflow fixed the confusion without forcing a risky one-pass full-page merge
- separating "new boating log" from "link existing boating" better matches the coach’s mental model when collaborating with another coach across the same practice day

### Validation

- `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ❌ — still fails only because of unrelated pre-existing repo-wide issues such as `src/App.tsx`, `src/api/concept2.ts`, and multiple `scripts/*.ts` files

### Outcome

Coaches can now move from a water session into a boating workflow that actually supports the three real jobs: create a new boating log, link an existing same-day boating, and remove an incorrect link. The flow is still split across two pages, but it is now understandable instead of misleading.

---

## Phase 57: New boating logs inherit the selected boat's latest crew (March 20, 2026)

**Timeline**: March 20, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingBoatings.tsx`
  - selecting an existing persistent boat while creating a new boating log now seeds the form with that shell's most recent saved lineup
  - lineup templating uses recent boating history for the selected shell rather than forcing the coach to reseat the whole crew manually every time
  - the behavior is scoped to new boating creation so changing boats while editing does not unexpectedly overwrite an existing crew

### Why This Approach Won

- the user expectation is correct: picking an existing shell usually implies "start from who was in this boat last time"
- applying the behavior only in new-log mode preserves convenience without creating destructive surprises in edit mode
- sourcing the template from recent boating history keeps the persistent boat useful as a seasonal anchor rather than just a name/type container

### Validation

- `npx eslint src/pages/coaching/CoachingBoatings.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Creating a new boating log from an existing boat now starts from a realistic crew template, which better matches real coach workflow and reduces repetitive seat entry.

---

## Phase 58: Session-driven boating creation now returns to the main schedule workflow (March 20, 2026)

**Timeline**: March 20, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingBoatings.tsx`
  - creating a boating log from session context now uses the session's team as the save target instead of blindly relying on the boating page's current team
  - the add form now inherits the session date so a session-created boating starts on the actual practice day
  - after a session-driven boating create succeeds, the app routes back to `CoachingSchedule` with the target session in the URL

- `src/pages/coaching/CoachingSchedule.tsx`
  - schedule now initializes its selected day / expanded session from `sessionId` + `date` query params
  - this makes session-driven boating creation land back on the main rowing-day surface with the correct session already focused

### Why This Approach Won

- the user’s complaint was valid: the previous flow still treated Boatings as the primary destination after creation, which contradicted the product decision that Schedule is the main coach workflow
- using URL-driven session focus avoided the lint-unfriendly pattern of forcing multiple local state updates inside an effect
- tying creation to the session's own team/date context reduces the chance of a boating looking linked on one page but failing to appear as the expected child of that session

### Validation

- `npx eslint src/pages/coaching/CoachingBoatings.tsx src/pages/coaching/CoachingSchedule.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Adding a boating log from a session now behaves much more like "add a child record to this rowing day" and much less like "go work on a separate boating page and maybe come back later."

---

## Phase 59: Schedule now owns net-new boating creation (March 20, 2026)

**Timeline**: March 20, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingSchedule.tsx`
  - `Add boating log` on expanded water sessions now opens a real session-bound creation modal inside Schedule
  - the modal uses the session date automatically and saves the boating directly with `session_id = session.id`
  - the modal supports:
    - selecting an existing persistent boat,
    - inheriting that shell's latest crew,
    - creating a new boat record when needed,
    - writing the boat-level outing note,
    - assigning the lineup seat-by-seat
  - after save, Schedule refreshes and keeps the session as the primary surface instead of redirecting away

- `src/pages/coaching/CoachingBoatings.tsx`
  - remains the secondary page for deeper lineup/history work and explicit link/unlink management

### Why This Approach Won

- the user feedback was clear: a primary Schedule action should not immediately bounce the coach into a different page just to create a child record
- moving net-new creation into Schedule aligns the product with the intended mental model: the session is the rowing day, and the boating log is one child artifact of that day
- keeping Boatings as the advanced editor/history surface preserves the existing deeper tooling without making it the default path for ordinary session work

### Validation

- `npx eslint src/pages/coaching/CoachingSchedule.tsx src/pages/coaching/CoachingBoatings.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

The workflow is now much more coherent: coaches can create a boating log directly from the session they are reviewing, and only use the separate Boatings page when they actually want deeper lineup/history management.

---

## Phase 54: CoachingBoatings UX polish pass (March 19, 2026)

**Timeline**: March 19, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingBoatings.tsx`
  - added a desktop drag-and-drop help callout clarifying assign, swap, and unseat behavior
  - added a confirmation dialog for destructive lineup actions so archive/delete no longer happen on a single click
  - added success toasts for create, edit, duplicate, archive/reactivate, and delete actions
  - added `aria-label` coverage for icon-only boating controls and seat-swap actions

### UX Assessment

- **Reviewed flows**: active lineup management, archived lineup actions, drag-and-drop assignment, seat swap, roster-panel unseat flow
- **Assessment**: solid after polish
- **Moderate issues fixed**: destructive actions lacked confirmation; the drag workflow relied too much on implicit discovery; icon-only actions were under-labeled for accessibility

### Validation

- `npx eslint src/pages/coaching/CoachingBoatings.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

The page now gives clearer guidance, safer destructive actions, more explicit success feedback, and better accessibility without changing the core boating workflow.

---
## Phase 53: CoachingBoatings drag/drop audit and seat targeting fix (March 19, 2026)

**Timeline**: March 19, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachingBoatings.tsx`
  - audited every active drag/drop surface on the page: roster panel, compact seat badges, expanded seat rows, seated-athlete drags, and drag-to-roster unseating
  - changed collision resolution to prefer the seat directly under the pointer before falling back to broader proximity matching`r`n  - tagged compact vs expanded seat droppables separately so expanded seat rows are now prioritized over compact seat badges when both are candidates
  - added source boat/seat metadata to seated drags so same-boat and cross-boat moves resolve against the intended source row
  - fixed occupied-seat drops for seated athletes so they swap cleanly instead of silently dropping the displaced athlete
  - cleaned up nearby file-level lint issues by moving the expansion ref sync into `useEffect` and stabilizing `getAthleteName` with `useCallback`

### Why This Approach Won

- the original collision strategy was too broad for stacked boat cards, so nearby seats from boats above or below could win even when the pointer was over stroke
- the seated-drag payload did not include enough source context to make occupied-seat drops deterministic
- keeping the fix inside the existing DnD model preserved the intended roster-panel and compact-seat workflows without redesigning the page

### Validation

- `npx eslint src/pages/coaching/CoachingBoatings.tsx` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Boating drag/drop now matches the visible target more reliably, and seat-to-seat moves no longer risk sending athletes to the wrong boat or silently discarding the displaced seat occupant.

---
## Phase 52: Bulk coach invite polish and routing cleanup (March 18, 2026)

**Timeline**: March 18, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/components/coaching/BulkCoachInviteModal.tsx`
  - replaced the textarea-based bulk input with structured row-based fields for first name, last name, and email
  - made coach invites easier to review before submission and aligned the UI with the richer payload the backend now expects

- `supabase/functions/invite-coaches/index.ts`
  - updated the edge function to accept `entries[]` instead of a bare email list
  - looks up organization name and passes invite metadata (`first_name`, `last_name`, `org_name`) into the created user record
  - marks invited coaches as `onboarding_complete` so they land in the coaching product flow instead of generic onboarding

- `src/services/coaching/coachingService.ts`
  - updated the invite call shape to send structured invite entries to the edge function

- `src/pages/coaching/CoachingSettings.tsx`
  - passes organization context through to the invite modal so invites can be personalized correctly

- `src/pages/ResetPassword.tsx`
  - routes invited coaches to `/team-management` after password creation instead of dropping them at the generic app entry point

- `src/components/OnboardingWizard.tsx`
- `src/components/coaching/BulkRosterModal.tsx`
  - migrated remaining hardcoded neutral/emerald utility classes to design-token-based colors for better theme consistency

### Why This Approach Won

- the old textarea flow was too lossy once invites needed personalized metadata and predictable post-invite routing
- carrying names and org context all the way through the invite path improves the email, the created profile metadata, and the initial in-app experience in one pass
- redirecting invited coaches straight to team management matches the actual job-to-be-done after accepting the invite

### Validation

- end-to-end invite flow was tested in production during the March 18 session
- later March 18 validation passes also confirmed the repo still built and tests still passed after adjacent follow-up work: `npm run build` ✅, `npm run test:run` ✅

### Outcome

Coach invites now carry the right identity metadata, land users in the right post-password destination, and present a more reliable admin-facing bulk entry workflow.

---
## Phase 51: Team Info editor UI simplification (March 18, 2026)

**Timeline**: March 18, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/components/team/TeamInfoEditorList.tsx`
  - simplified the Team Info surface into a grouped table-style editor
  - each row now focuses on the only two editable fields that matter here: `name` and `description`
  - save actions are inline per team and grouped by organization / standalone teams

- `src/pages/coaching/CoachDashboard.tsx`
  - removed the visual "Active" state from org/team rows so the dashboard no longer suggests that team editing depends on a selected active team

### Why This Approach Won

- the previous card-per-team layout was too heavy for such a small data model
- the user’s workflow is list-oriented: scan teams, edit name/description, save, move on
- removing the visible "Active" badge keeps the hidden technical anchor from masquerading as a product-level concept

### Validation

- `npx eslint src/components/team/TeamInfoEditorList.tsx src/pages/team/MyTeamSettings.tsx src/pages/coaching/CoachingSettings.tsx src/pages/coaching/CoachDashboard.tsx src/services/coaching/coachingService.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Team Info editing now feels more like a simple admin table than a stack of mini forms, and the dashboard no longer reinforces the confusing idea that one team must be "active" before it can be edited.

---

## Phase 50: Team Info editor decoupled from active selector (March 18, 2026)

**Timeline**: March 18, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/components/team/TeamInfoEditorList.tsx`
  - new shared editor that loads full details for all accessible teams and renders per-team name/description forms
  - Team Info editing is now explicitly independent from the active team selector and filter pills
  - non-coach teams render read-only

- `src/services/coaching/coachingService.ts`
  - added `getTeamsByIds()` so the shared editor can hydrate full team records (including description) for many teams at once

- `src/pages/team/MyTeamSettings.tsx`
  - Team Info section now renders the shared all-teams editor
  - removed the previous scope-centric copy that implied editing followed the active/team filter state

- `src/pages/coaching/CoachingSettings.tsx`
  - replaced the single active-team Team Info form with the shared all-teams editor
  - left the rest of the page (invite code, members, org assignment) on the active-team model for now

### Why This Approach Won

- the user’s real complaint was workflow friction: editing team identity should not require preselecting one “active” team first
- making Team Info filter-independent fixes the UX without destabilizing the rest of the coaching module
- a shared component keeps the team and coaching settings pages aligned so the same bug does not reappear in two places

### Validation

- `npx eslint src/components/team/TeamInfoEditorList.tsx src/pages/team/MyTeamSettings.tsx src/pages/coaching/CoachingSettings.tsx src/services/coaching/coachingService.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

Team Info editing on both settings pages now shows all accessible teams directly and no longer depends on whichever team is currently marked active elsewhere in the app.

---

## Phase 49: Team self-service scope alignment audit (March 18, 2026)

**Timeline**: March 18, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/hooks/useScopedTeamScope.ts`
  - new shared hook that derives the visible scoped team set from `CoachingContext`
  - centralizes the rule: `filterTeamId` wins, otherwise org-wide means all teams in the active org, otherwise fall back to the anchor team

- `src/services/coaching/coachingService.ts`
  - updated `getMyErgScores`, `getMySessionNotes`, and `getMyCoachNotes` to accept one or many team IDs
  - these self-service reads now explicitly filter by `team_id`, which removes the old app-side cross-team ambiguity for coach notes

- `src/pages/team/MyTeamDashboard.tsx`
  - now reflects scoped team visibility instead of a first-membership lookup
  - routes membership management to `MyTeamSettings` instead of duplicating destructive logic

- `src/pages/team/MyScores.tsx`
  - now loads scores for the full current scoped team set
  - shows scope badges and team labels when multiple teams are in scope

- `src/pages/team/MyTeamNotes.tsx`
  - now loads coach notes and session notes for the full current scoped team set
  - displays team labels in multi-team views and uses explicit team scoping for coach notes

- `src/pages/team/MyTeamSettings.tsx`
  - now consumes the shared `useScopedTeamScope()` hook instead of carrying a duplicate scoped-team derivation

### Why This Approach Won

- the core problem was consistency, not just one broken page: coaching pages were multi-team aware, while athlete self-service pages still behaved like the app only supported one team
- extracting a shared scope hook is the lowest-risk way to keep the team side aligned with the coaching side going forward
- expanding self-service service helpers to accept multiple team IDs let us preserve the existing UI surfaces while fixing the underlying scope model

### Validation

- `npx eslint src/hooks/useScopedTeamScope.ts src/pages/team/MyTeamDashboard.tsx src/pages/team/MyScores.tsx src/pages/team/MyTeamNotes.tsx src/pages/team/MyTeamSettings.tsx src/services/coaching/coachingService.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅

### Outcome

The `/team/*` and `/team-management/*` sides now follow the same visible-scope model for single-team, multi-team, and All Teams workflows, and the previous athlete coach-note read path no longer risks cross-team leakage at the app-query layer.

---

## Phase 48: MyTeamSettings scope reset for All Teams / multi-team access (March 18, 2026)

**Timeline**: March 18, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/team/MyTeamSettings.tsx`
  - replaced the old single-membership load with `CoachingContext`-driven scope rendering
  - Team Info now reflects `filterTeamId` / `filterTeamName`, distinguishes org-wide `All Teams` scope from single-team scope, and lists the teams currently represented on the page
  - Danger Zone now operates on explicit direct memberships instead of whatever team happened to be returned first
- `src/services/coaching/coachingService.ts`
  - added `getMyDirectTeamMemberships(userId)` to fetch direct `team_members` rows with `memberId`, role, and joined team for leave actions

### Why This Approach Won

- the bug was not just UI copy — it was a data-model mismatch: the page mixed up **visibility scope** with **direct membership**
- `CoachingContext` is already the canonical source of filter state (`null = All Teams`), so the settings page needed to align with that instead of making its own single-team query
- leaving a team requires a precise `team_members.id`, so that action needed a separate direct-membership query even when the user can see teams through org-wide access

### Validation

- `npx eslint src/pages/team/MyTeamSettings.tsx src/services/coaching/coachingService.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ⚠️ still failing on unrelated pre-existing files across the repo

### Outcome

`MyTeamSettings` now correctly reflects the intended workflow for org-scoped coaches and multi-team users: All Teams shows org-wide scope, while destructive membership actions stay explicit and unambiguous.

---

## Phase 47: Boatings UX Overhaul — DnD, Compact View, Org-Wide, Persistent Sort (March 17, 2026)

**Timeline**: March 17, 2026  
**Status**: ✅ Complete

### What Was Built

**Org-Wide Boatings**
- `CoachingBoatings` now always fetches org-wide data (ignores `filterTeamId` from CoachingNav)
- Roster panel ("Boathouse") has its own independent team filter + unboated-only toggle
- Other 4 coaching pages (Dashboard, Roster, Assignments, Analytics) still respond to the team filter

**Active Lineup Model**
- Migration: `is_active BOOLEAN DEFAULT true` on `coaching_boatings` with partial index
- Service: `setBoatingActive()` for archive/reactivate
- UI: Active lineups at top, archived in collapsible history section

**Persistent Sort Order**
- Migration: `sort_order INTEGER DEFAULT 0` on `coaching_boatings` (backfilled from existing order)
- ↑/↓ reorder buttons with optimistic local swap + async batch persist via `updateBoatingSortOrders`
- `getBoatings` orders by `sort_order ASC, date DESC` with fallback if column doesn't exist

**Compact Seat Strip (Default View)**
- Default: horizontal strip with athlete initials (Cox → 8 → 7 → ... → 1)
- "Details" click expands to full seat view with draggable athletes
- Seat labels: just "Cox" and numbers (removed "Stroke"/"Bow")
- Condensed card headers: smaller badges, removed subtitle, shrunk action icons

**Drag-and-Drop**
- `DndContext` with custom `CollisionDetection` (rectIntersection for roster, closestCorners for seats)
- `DraggableAthleteCard` using `useDraggable` (NOT `useSortable` — key lesson)
- `DraggableSeatedAthlete` with `seated-` ID prefix to avoid collision with roster draggables
- `DroppableSeatRow` + `CompactSeatBadge` as drop targets
- Drag to roster panel = unseat athlete
- `DragOverlay` with athlete card preview

**Mobile Responsiveness (7 pages)**
- CoachingRoster, BulkRosterModal, CoachingAssignments, TeamAnalytics, CoachDashboard, AthleteEditorModal, CoachingBoatings

### Key Lessons

1. **`useSortable` vs `useDraggable`**: `useSortable` registers items as BOTH draggable AND droppable, which pollutes collision detection when you have separate droppable seat targets. Use `useDraggable` for roster cards.

2. **Custom collision detection**: When mixing a large droppable zone (roster panel) with small droppable zones (seat badges), you need a custom function that prioritizes the large zone via `rectIntersection` first, then falls back to `closestCorners` for precision seat matching.

3. **Vite HMR cache**: When file is valid but Vite serves stale module (export error), clear `node_modules/.vite` and hard refresh.

4. **PostgREST column ordering**: Ordering by a column that doesn't exist returns 400. Added try/catch fallback in `getBoatings`.

### Files Modified
- `src/pages/coaching/CoachingBoatings.tsx` (~1356 lines — major refactor)
- `src/services/coaching/coachingService.ts` (added org-wide + sort + active functions)
- `src/services/coaching/types.ts` (added `is_active`, `sort_order`)
- `db/migrations/20260317_boating_is_active.sql` (new)
- `db/migrations/20260317_boating_sort_order.sql` (new)
- 6 mobile-fixed pages (CoachingRoster, BulkRosterModal, CoachingAssignments, TeamAnalytics, CoachDashboard, AthleteEditorModal)

---

## Phase 46: Speed Index Equal-Weight Recalibration (March 16, 2026)

**Timeline**: March 16, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/services/coaching/coachingService.ts`
  - changed the canonical stored workout Speed Index formula from a 70/30 split to a 50/50 split between normalized split and normalized W/lb
  - exported the weighting constants so other reconstruction paths can reuse the same definition instead of drifting

- `src/services/coaching/analyticsView.ts`
  - removed the duplicated hard-coded 70/30 math from the public/share reconstruction path and sourced the shared constants from coachingService

- `src/pages/coaching/TeamAnalytics.tsx`
  - updated leaderboard helper copy and athlete expansion cards so the UI now explains the equal-weight model correctly

- `src/pages/PublicTeamLeaderboardShare.tsx`
  - updated the public share page copy to match the internal leaderboard surface and the canonical equal-weight model

- `src/pages/coaching/CoachingSettings.tsx`
  - rewrote the formula explanation to reflect the product rationale for equal weighting after z-score normalization
  - kept the historical recompute action aligned with the new equal-weight formula

- `src/pages/coaching/AssignmentResults.tsx`
  - updated inline metric help so assignment-level explanations no longer describe a speed-biased blend

- `readyall/src/app/docs/speed-index/page.tsx`
  - updated the public Speed Index docs to reflect equal z-score blending and removed the old “speed remains the anchor” / 70-30 framing

### Why This Approach Won

- the user’s objection was at the model level, not just at the copy level: `W/lb` already carries speed-derived information because watts comes from split
- leaving a fixed extra speed weight on top of that effectively double-counted speed more than intended
- exporting the weights from the canonical scorer removes a fresh source of future public/internal drift

### Validation

- pending current pass command validation after edits:
  - `get_errors`
  - `npm run build` in `LogbookCompanion`
  - `npm run test:run` in `LogbookCompanion`
  - forced historical recompute of stored Speed Index values
  - `npm run build` in `readyall`

### Outcome

Speed Index now uses an equal-weight z-score blend consistently across stored assignment scores, internal analytics, public shares, coaching copy, and public docs.

---

## Phase 45: Leaderboard Parity + Light-Mode Contrast (March 16, 2026)

**Timeline**: March 16, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/services/coaching/analyticsView.ts`
  - added shared analytics helpers for time-range presets, decimal rank formatting, and public-share leaderboard/chart reconstruction from shared assignment payloads
  - moved the public leaderboard off its stale standalone ranking math so it now follows the same derived model as Team Analytics

- `src/pages/coaching/TeamAnalytics.tsx`
  - aligned the charts with the selected leaderboard lens by filtering erg comparison data to the active time range and tests-only mode
  - updated share-link creation to preserve the active analytics lens with query params
  - changed leaderboard pagination to 20 rows and added a visual separator after every 8 visible athletes
  - fixed light-mode contrast for the leaderboard helper card, row states, expanded detail cards, recent-work table, and pagination buttons

- `src/pages/PublicTeamLeaderboardShare.tsx`
  - rebuilt the share page to mirror the internal leaderboard structure, copy, filters, rank display, expansion cards, pagination, and charts
  - added light-mode summary cards, filter chips, helper copy panels, row states, and expansion surfaces so the page remains readable on white/light backgrounds

- `src/components/coaching/ErgComparisonChart.tsx`
  - removed the dependency on a separate athlete list for weight lookups so the chart can be reused by both internal and public analytics views
  - added an option to suppress the internal-only results deep link on public share pages

- `src/services/coaching/coachingService.ts`
  - extended erg-comparison rows with weight/test metadata so chart behavior can stay aligned with leaderboard filters

### Why This Approach Won

- the public share page had already drifted from the internal analytics surface because it reimplemented ranking and filtering separately
- moving the shared view logic into a small analytics helper keeps parity maintainable without coupling the public page to internal page state
- handling light-mode contrast in the same pass avoided preserving a split experience where parity existed functionally but not visually

### Validation

- `get_errors` on:
  - `src/pages/coaching/TeamAnalytics.tsx`
  - `src/pages/PublicTeamLeaderboardShare.tsx`
  - `src/components/coaching/ErgComparisonChart.tsx`
  - `src/services/coaching/analyticsView.ts`
  - `src/services/coaching/coachingService.ts` ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ⚠️ unchanged pre-existing repo debt remains in unrelated files (`src/App.tsx`, `src/api/*`, older analytics components)

### Outcome

Internal and public leaderboard views now stay aligned on filters, charts, ranking behavior, pagination, and scanability, with light-mode contrast brought up to the same readable standard as the main leaderboard.

---

## Phase 44: Speed Index Terminology Rename (March 16, 2026)

**Timeline**: March 16, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/TeamAnalytics.tsx`
  - renamed the visible leaderboard metric from `Titan Index` to `Speed Index`
  - updated summary-card helper copy, the leaderboard column header, and the athlete expansion card label

- `src/pages/coaching/CoachingSettings.tsx`
  - renamed the coaching-settings explanation and recompute action to `Speed Index`

- `docs/demo-team-management-seed.md`
  - updated the runbook wording so the seeded demo data refers to `Speed Index` values

- `readyall/src/app/docs/page.tsx`
  - updated the Team Management docs card to point at `Speed Index`

- `readyall/src/app/docs/speed-index/page.tsx`
  - new public docs page for the renamed metric

- `readyall/src/app/docs/titan-index/page.tsx`
  - converted the legacy route into a redirect to preserve old links without keeping the old branded page live

### Why This Approach Won

- the user asked for a visible product/docs terminology change, not a risky schema rename
- keeping internal `titan_*` identifiers intact avoids unnecessary migrations, Supabase type churn, and downstream breakage
- adding a redirect preserves any existing shared docs links while moving public-facing navigation onto the new label

### Validation

- pending current pass command validation after edits:
  - `get_errors`
  - `npm run build` in `LogbookCompanion`
  - `npm run build` in `readyall`

### Outcome

The app and public docs now present the leaderboard metric as `Speed Index` while the implementation stays low-risk under the hood.

---

## Phase 43: Demo Team-Management Seed Path (March 16, 2026)

**Timeline**: March 16, 2026  
**Status**: ✅ Complete

### What Was Built

- `scripts/seed_demo_team_management.mjs`
  - adds a repeatable service-role seed path for a demo coaching environment
  - creates a demo organization with five teams mirroring the current program structure:
    - Varsity
    - Junior Varsity
    - Upper Novice
    - Novice
    - Freshmen
  - seeds a believable roster, org-wide assignments, completed assignment results, Titan values, erg scores, sessions, athlete notes, coach-note feed entries, and boatings
  - reuses existing workout template names already present in the target database instead of inventing fake workout structures
  - cleans up the prior seeded demo org before recreating it, making the script rerunnable for a demo project

- `package.json`
  - added `npm run seed:demo:team-management`

- `docs/demo-team-management-seed.md`
  - documents required env vars, assumptions, usage, and the remaining prerequisite that the demo coach auth user already exist

### Why This Approach Won

- the existing guest/demo fixture path only covers the athlete-facing analytics/dashboard experience, not coach-gated team-management routes
- seeding the real coaching tables keeps the demo experience aligned with production UI behavior and avoids creating a second fake coaching data layer in the frontend
- keeping the seed as a script rather than a migration makes it safe to target a separate demo project without polluting the main live environment

### Validation

- live schema inspection via MCP ✅
- `node --check scripts/seed_demo_team_management.mjs` ✅
- `get_errors` on the new script and package manifest ✅

### Outcome

The repo now has a concrete, repeatable path for populating a demo Supabase project with realistic team-management data so the demo site can show roster, dashboard, assignments, analytics, notes, and boatings as a coach would actually see them.

---

## Phase 42: Invite Flow Athlete Auto-Link + Coach Request Hardening (March 16, 2026)

**Timeline**: March 16, 2026  
**Status**: ✅ Complete

### What Was Built

- `db/migrations/20260316090000_secure_team_join_and_coach_request_review.sql`
  - added `ensure_team_member_athlete_link(team_id, user_id)` as a SECURITY DEFINER RPC that:
    - verifies the caller is either the joining user or staff who can manage team members
    - reuses an existing `athletes.user_id` row when one already exists
    - creates a fallback athlete row from `user_profiles` when none exists
    - ensures the `team_athletes` link exists for the target team
  - tightened coaching-request visibility from any coach/coxswain to org `owner/admin`
  - tightened `approve_coaching_request()` to the same org leadership boundary

- `src/services/coaching/coachingService.ts`
  - added a small service wrapper for the new athlete-link RPC
  - updated `joinTeamByInviteCode()` to call the RPC after membership creation and roll back the membership if linking fails
  - updated `addTeamMemberByEmail()` to do the same for coach-added members

- `src/components/coaching/PendingCoachingRequests.tsx`
  - now checks `organization_members` for `owner/admin` before loading or rendering the review queue
  - keeps the UI aligned with the DB policy/RPC boundary instead of showing a queue the caller cannot legally act on

### Why This Approach Won

- self-joiners were already allowed to create `team_members`, but RLS correctly blocked them from writing `team_athletes`
- moving only the athlete-link step behind a narrow SECURITY DEFINER RPC fixed the onboarding hole without widening general table policies
- review authority now follows the existing org role model instead of a looser “any coach can approve coaches” rule

### Validation

- `get_errors` on touched files ✅
- live Supabase migration applied + verified via MCP ✅
- `npm run build` ✅
- `npm run test:run` ✅
- `npm run lint` ⚠️ unchanged pre-existing repo debt remains outside this change set

### Outcome

Athletes who join a team through the main onboarding paths now become real coaching-athlete records instead of stopping at membership, and coach-request review is limited to org leadership rather than any existing coach.

---

## Phase 40: Team Analytics UX Refresh + Rowing Zone Alignment (March 15, 2026)

**Timeline**: March 15, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/TeamAnalytics.tsx`
  - added summary cards above the charts/table so coaches can immediately see:
    - visible athlete count in current scope
    - whether the page is reading all scored work or tests only
    - current Titan leader
    - quick group snapshot (average Titan plus fastest average split / highest workload)
  - rewrote leaderboard explanatory copy to make the two leaderboard modes more explicit and coaching-oriented.
  - converted the leaderboard into a cleaner default table focused on:
    - Titan Index
    - average split
    - best split
    - latest split
    - average W/lb
    - scored workout count
  - moved composite/speed/efficiency rank detail into the expanded athlete panel, reducing noise without removing useful data.
  - replaced the row-wide click behavior with an explicit athlete expansion button, improving affordance and accessibility.

- `src/utils/paceCalculator.ts`
  - replaced the flat equal-width zone bands with a shared `TRAINING_ZONE_CONFIG`.
  - updated the bands to broad rowing-aligned ranges anchored to 2k watts:
    - UT2 `55–70%`
    - UT1 `68–80%`
    - AT `78–88%`
    - TR `88–100%`
    - AN `100–115%`
  - kept the ranges intentionally broad so they match real coaching practice better than rigid single-value targets.

- `src/components/coaching/AthleteTrainingZones.tsx`
  - now consumes the shared zone config instead of duplicating watt percentages locally.
  - updated athlete-facing copy to explain that the ranges are broad guidance to be paired with feel and heart rate.
  - clarified the intent of each zone with better labels and usage descriptions.
  - fixed the inline-style issue on the intensity bar by switching to class-based widths.

### Domain Validation Applied

- checked intensity-label coherence against rowing physiology references and common coaching usage
- preserved broad practical ranges rather than overly narrow lab-style bands
- corrected the confusing AN positioning so true anaerobic/sprint work begins at current 2k pace and above

### Knowledge Base Sources Used

- `kb/physiology/zones-and-pacing.md`
- `kb/physiology/rowing-training-physiology.md`

### Validation

- pending current pass command validation after code edits:
  - `npm run lint`
  - `npm run build`
  - `npm run test:run`

### Outcome

Team Analytics now reads more like a coaching dashboard and less like a raw spreadsheet, while athlete training zones are better aligned with common rowing practice and no longer imply that anaerobic work should sit below 2k pace.

---

## Phase 41: Analytics Time-Range Filters + Contrast Fixes (March 16, 2026)

**Timeline**: March 16, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/TeamAnalytics.tsx`
  - replaced the misleading top-strip status pills with a real time-range control.
  - added presets for:
    - last week
    - last 4 weeks (default)
    - current season
    - all time
  - defined the analytics season on an August-to-August school-year cadence, using August 1 as the season start.
  - updated the summary cards and leaderboard helper copy so Titan reads as an average across the selected time window rather than a last-N-workouts calculation.
  - improved chip and segmented-control contrast for light mode while preserving dark-mode readability.

- `src/services/coaching/coachingService.ts`
  - updated `getSeasonMeasuredLeaderboard()` so Titan is averaged across the visible assignment set returned by the selected date range.
  - updated `rerankLeaderboard()` to do the same for filtered/test-only client-side reranking.

- `src/pages/coaching/CoachingSettings.tsx`
  - removed the stale Titan “window size” configuration UI.
  - replaced it with explanatory copy that points coaches to the page-level time filters in Team Analytics.

### Outcome

The analytics page now has real time filters instead of status pills that only looked interactive, and the Titan calculation matches the selected date range rather than a hidden workout-count window.

### Validation

- pending current pass command validation after edits:
  - `npm run build`
  - `npm run test:run`
  - `npm run lint`

---

## Phase 38: Titan Bias Save Propagation + Analytics Sort Typing (March 15, 2026)

**Timeline**: March 15, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/TeamAnalytics.tsx`
  - introduced a widened `LeaderboardSortField` union so the leaderboard can safely sort by:
    - `avg_split_seconds`
    - `best_split`
    - `latest_split_seconds`
    - `avg_wplb`
    - `assignment_count`
  - fixed the page-level TypeScript breakage caused by adding sortable leaderboard columns without expanding the sort state type.

- `src/pages/coaching/CoachingSettings.tsx`
  - Titan settings save flow now compares the previous and new `titan_power_weight`.
  - when the weight changes, save now immediately runs:
    - `backfillTitanIndexes(teamId, { orgId: updated.org_id ?? undefined, force: true })`
  - this ensures stored `daily_workout_assignments.titan_index` rows are recomputed at save time instead of requiring the user to separately click the manual recompute control.
  - updated helper copy to reflect the new automatic recompute behavior.

- `src/pages/team/MyTeamNotes.tsx`
  - updated athlete-facing notes to render the visible coach-note feed array instead of the old single-string coach-note model.

### Key Debugging Outcome

- The Titan weighting bug was not in `TeamAnalytics` display logic.
- Root cause: the settings page persisted `teams.titan_power_weight`, but leaderboard Titan values still came from precomputed `daily_workout_assignments.titan_index` values.
- Because those assignment-level Titan scores were only refreshed via the separate manual recompute action, changing the bias slider alone did not visibly affect analytics.
- Fixing the save path resolved the mismatch without changing the underlying Titan pipeline:
  - base per-workout scoring still comes from assignment rows,
  - leaderboard Titan still rolls up from those assignment-level Titan values.

### Validation

- editor diagnostics:
  - `TeamAnalytics.tsx` → ✅ no errors
  - `CoachingSettings.tsx` → ✅ no errors
- build:
  - `npm run build` → ✅ pass

### Outcome

Saving a changed Titan power bias now updates the historical assignment Titan data immediately, so Team Analytics reflects the new weighting as soon as the save completes.

---

## Phase 39: Coach Notes Feed Pivot Completion (March 15, 2026)

**Timeline**: March 15, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/team/MyTeamNotes.tsx`
  - athlete-facing notes now render the visible coach-note feed as a list of entries with author/date metadata instead of assuming a single coach note string.

- `src/pages/coaching/CoachingAthleteDetail.tsx`
  - coach-facing athlete detail now creates coach notes against the athlete's actual `team_id`, not the active context team.
  - this prevents wrong-team writes when coaches are operating in org-wide views.
  - squad updates on the detail page now use the same athlete-team scoping fix.

- `src/pages/coaching/CoachingRoster.tsx`
  - removed stale legacy single-note fields from new-athlete creation payloads.

- `src/services/coaching/coachingService.ts`
  - narrowed `createAthlete()` and `updateAthlete()` to core athlete profile fields only.
  - shared coach notes remain managed exclusively through `coaching_athlete_coach_notes` service methods:
    - `getCoachNotesForAthlete()`
    - `createCoachNote()`
    - `getMyCoachNotes()`

### Key Debugging Outcome

- The codebase had already pivoted to the shared `coaching_athlete_coach_notes` feed, but some write paths still referenced the old `athletes.coach_notes` model.
- There was also a multi-team scoping bug in athlete detail:
  - org-wide coaches could open an athlete from another team,
  - but note creation and squad updates still used the active context `teamId`.
- Fixing those paths brought the UI and service layer back into alignment with the feed-based model and existing team/org RLS expectations.

### Coaching RLS / Scope Validation

- Touched surfaces:
  - `coaching_athlete_coach_notes`
  - `CoachingAthleteDetail`
  - `CoachingRoster`
  - `coachingService.ts`
- Team/org scope:
  - coach-note writes are now team-scoped using `athlete.team_id` when available.
  - athlete-facing reads remain restricted to `visible_to_athlete = true` via `getMyCoachNotes()`.
- Role enforcement:
  - coach-facing add/read flow continues through coaching routes and the existing feed-table RLS.
- Result:
  - no new RLS mismatch found in the final query shapes used by the completed pivot.

### Validation

- editor diagnostics:
  - `CoachingAthleteDetail.tsx` → ✅ no errors
  - `CoachingRoster.tsx` → ✅ no errors
  - `coachingService.ts` → ✅ no errors
  - `MyTeamNotes.tsx` → ✅ no errors
- build:
  - `npm run build` → ✅ pass

### Outcome

The old single coach-note model is no longer used by the coaching UI, and the shared running coach-note feed now behaves consistently across coach-facing and athlete-facing surfaces.

---

## Phase 37: Coaching Org Visibility + Team Creation RLS Alignment (March 12, 2026)

**Timeline**: March 12, 2026  
**Status**: ✅ Complete

### What Was Built

- Live data repair:
  - inserted missing `organization_members` row for Haley as `coach` on `2026 Titan Boys Rowing`.

- `src/services/coaching/coachingService.ts`
  - `getTeamsForUser()` now merges:
    - direct `team_members`,
    - `organization_members`,
    - all teams in orgs the user belongs to.
  - prevents org coaches from only seeing directly assigned teams.

- `src/auth/AuthContext.tsx`
  - coach access now also recognizes `organization_members`, in addition to team coach/coxswain roles and approved coaching requests.

- `src/pages/coaching/CoachingSettings.tsx`
  - added a visible `Create Another Team` CTA linking to `/team-management/setup`.

- Migrations applied live via Supabase MCP:
  - `fix_org_coach_team_visibility_rls`
  - `optimize_org_coach_visibility_policies`
  - `split_coaching_manage_policies`
  - `merge_team_member_insert_policies`
  - `align_team_creation_policy_with_coach_access`
  - `fix_team_select_policy_for_insert_returning`
  - `fix_team_select_policy_aliases`

### Key Debugging Outcome

- The reported `POST /rest/v1/teams?select=*` 403 was not just an insert-policy problem.
- Root cause was stacked:
  - `teams` insert policy was too narrow for app-level coach access.
  - `teams` select policy was self-referential (`can_view_team(id, auth.uid())` querying `teams` again), which broke `INSERT ... RETURNING` under RLS.
- Replaced the `teams` SELECT policy with direct row-based visibility checks so PostgREST can return newly created rows immediately.

### Validation

- Live DB simulation under authenticated user `93c46300-57eb-48c8-b35c-cc49c76cfa66`:
  - `INSERT INTO teams ... RETURNING *` → ✅ pass
  - `INSERT INTO team_members ... RETURNING *` → ✅ pass
  - `UPDATE teams SET org_id = ... RETURNING *` → ✅ pass
- App validation:
  - `npx eslint src/auth/AuthContext.tsx src/pages/coaching/CoachingSettings.tsx` → ✅ pass
  - `npm run build` → ✅ pass
  - `npm run test:run` → ✅ pass (`225/225`)
  - `npm run lint` → ⚠️ fails on pre-existing unrelated issues (`reproduce_rwn.ts` first failure in latest run)

### Outcome

Org-level coaches now resolve org teams correctly, and the team creation flow no longer fails on the `teams` RLS `return=representation` path that previously produced the 403.

---

## Phase 36: CSV Single-Piece Assignment Import Alignment (March 12, 2026)

**Timeline**: March 12, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/components/coaching/ImportCsvModal.tsx`
  - import flow now derives assignment entry shape from `workout_structure` first, with canonical-name fallback to match results-entry behavior.
  - single-piece assignments now parse CSVs in single-result mode instead of assuming every non-name column is an interval rep.
  - review step now exposes CSV column selectors for athlete-name and result-time mapping when importing a single-piece effort.
  - single-piece saves now write top-level fields (`result_time_seconds`, `result_distance_meters`, `result_split_seconds`) and leave `result_intervals` null.

- `src/utils/csvScoreParser.ts`
  - added assignment-aware parse modes: `intervals` and `single_piece`.
  - added column metadata + heuristics so single-piece imports prefer overall time columns and avoid metadata columns like split/watts/weight/classification.
  - interval parsing now prefers rep-labeled/time-like columns instead of blindly consuming every non-empty header.

- `src/utils/workoutEntryClassifier.ts`
  - one-repeat interval shapes are now normalized to single-piece entry semantics (`fixed_distance` / `fixed_time`) for result capture.

- Tests:
  - added `src/utils/csvScoreParser.test.ts` for 2k single-piece CSV parsing and interval-column filtering.
  - extended `src/utils/workoutEntryClassifier.test.ts` with one-repeat interval regression coverage.

### Validation

- Targeted: `npm run test:run -- src/utils/workoutEntryClassifier.test.ts src/utils/csvScoreParser.test.ts` → ✅ pass
- Repo build: `npm run build` → ✅ pass
- Full tests: `npm run test:run` → ✅ pass (`225/225`)
- Repo lint: `npm run lint` → ⚠️ fails on pre-existing unrelated issues outside this change

### Outcome

2k-style benchmark CSVs now follow the assignment/RWN-derived workout shape, so a single continuous test imports as one piece instead of a fake multi-interval workout built from metadata columns.

---

## Phase 35: Rubric-Based Performance Tier Rendering (Squad + 2k) (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

- Added `src/utils/performanceTierRubric.ts`:
  - centralized squad-normalization + benchmark tier derivation,
  - labels for `Developmental`, `Competitive`, `Challenger`, `National Team`,
  - best-2k map builder from erg scores (`distance = 2000`),
  - `formatErgTime(...)` display helper.

- `src/pages/coaching/CoachingRoster.tsx`
  - now loads team erg scores and computes best 2k per athlete,
  - performance-tier display now shows rubric-derived benchmark tier (when available) plus best-2k reference.

- `src/pages/coaching/CoachDashboard.tsx`
  - org roster load now also fetches per-team erg scores and computes org-wide best 2k map,
  - org roster tier column now shows rubric-derived benchmark tier and best-2k reference.

### Rubric Notes

- Freshman thresholds use coach-provided example:
  - `>7:40 developmental`
  - `7:40–7:20 competitive`
  - `7:20–7:10 challenger`
  - `<=7:10 national team`
- Novice/JV/Varsity currently use centralized defaults in the same file for immediate rendering and can be tuned in one place once the full rubric matrix is provided.

### Validation

- `npm run build` → ✅ pass
- `npm run test:run` → ✅ pass (`209/209`)

### Outcome

Main org and team roster surfaces now support automatic benchmark-tier labeling from squad + 2k performance, with rubric logic centralized and editable.

---

## Phase 34: Assignment Results UI Simplification — Remove Sigma Labels (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/AssignmentResults.tsx`
  - Removed `σ Splits` header/cell from summary table.
  - Heatmap trailing metric now uses `Spread` label/value instead of sigma notation.
  - Removed consistency-sort branch from summary table sorting.

- `src/pages/PublicAssignmentResultsShare.tsx`
  - Same parity updates as private page:
    - removed `σ Splits` summary column,
    - heatmap trailing metric now `Spread`,
    - removed consistency-sort branch.

### Validation

- `npm run build` → ✅ pass
- `npm run test:run` → ✅ pass (`209/209`)

### Outcome

Assignment results now present one interval-variance concept (`Spread`) with simpler labels and less table noise.

---

## Phase 33: Live Supabase Migration Apply — `performance_tier` (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

- Applied migration to production Supabase via MCP:
  - migration name: `add_team_athlete_performance_tier`
  - project: `vmlhcbkyonemmlawnqqr`

### Verification

- Confirmed migration exists in live migration history.
- Confirmed schema objects exist:
  - column: `public.team_athletes.performance_tier` (`text`, nullable)
  - check constraint: `team_athletes_performance_tier_check`
  - index: `idx_team_athletes_team_performance_tier` (partial, `performance_tier IS NOT NULL`)

### Outcome

Performance-tier reads/writes now align with live schema, removing the migration gap for tier persistence and roster editing.

---

## Phase 32: Team Management Team-Route Navigation + Org Roster Edit Parity (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

- `src/pages/coaching/CoachDashboard.tsx`
  - Team rows in the org/team list now switch active team **and navigate to team roster route** (`/team-management/roster`) from the chevron row action.
  - Org-wide roster section (grouped by team) expanded from minimal columns to full editable roster fields:
    - first name, last name, squad, grade, side, experience level, performance tier, height, weight.
  - Added inline cell editing flows in org roster table using existing coaching services:
    - `updateAthlete(...)`
    - `updateAthleteSquad(...)`
    - `updateAthletePerformanceTier(...)`
  - Height/weight editing respects unit preference with imperial conversion support.

- `src/components/coaching/BulkRosterModal.tsx`
  - Added `performance_tier` as a bulk-entry column.
  - Bulk create now passes selected tier through `createAthlete(...)`.

### Validation

- `npm run build` → ✅ pass
- `npm run test:run` → ✅ pass (`209/209`)

### Outcome

Team-management navigation now supports direct drill-down to a selected team roster from the org/team hierarchy, and the org-wide grouped roster has near-parity editing coverage with the dedicated roster experience.

---

## Phase 31: Imperial Analytics Unit Fidelity + Performance Tier Schema Fallback (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Fix unit fidelity so imperial users see ratio analytics in W/lb (not W/kg), and prevent runtime 400 failures when `performance_tier` migration is not yet applied on live Supabase.

### Changes Implemented

#### 1. Unit-aware ratio analytics (private + public assignment results pages)
- `src/pages/coaching/AssignmentResults.tsx`
- `src/pages/PublicAssignmentResultsShare.tsx`
  - Heatmap ratio mode now computes/labels by selected unit:
    - metric users: W/kg
    - imperial users: W/lb
  - Power-vs-bodyweight percentile plot now uses unit-consistent ratio benchmarks and axis labels:
    - metric: bodyweight kg, benchmark lines in W/kg
    - imperial: bodyweight lb, benchmark lines in W/lb
  - Updated tooltip and benchmark label text to match selected ratio unit.
  - Public page power-to-weight bar chart now respects unit preference (W/lb vs W/kg).

#### 2. Live-schema-safe fallback for missing `performance_tier`
- `src/services/coaching/coachingService.ts`
  - Added missing-column detection and availability tracking for `team_athletes.performance_tier`.
  - `getAthletes`, `getOrgAthletes`, and `getAssignmentResultsWithAthletes` now retry without `performance_tier` when column is absent and hydrate `performance_tier: null`.
  - `createAthlete` now falls back to insert without `performance_tier` if migration is not applied.
  - `getTeamPerformanceTiers` returns empty when column unavailable.
  - `updateAthletePerformanceTier` now returns a clear migration-required error when column is missing.

### Verification

- `npm run build` → ✅ pass
- `npm run test:run` → ✅ pass (`209/209`)

### Outcome

Imperial users now get coherent ratio analytics in W/lb across heatmap and decomposition plot, and coaching pages no longer hard-fail in pre-migration environments where `performance_tier` hasn’t been applied yet.

---

## Phase 30: Coaching Performance Tier + Measured Leaderboard + Assignment Metrics Expansion (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Introduce a dedicated team-scoped competitive classification (`performance_tier`), ship season-to-date measured leaderboards, and expand assignment results with clearer aggregates and interval quality metrics.

### Changes Implemented

#### 1. Team-scoped Performance Tier model
- Added migration: `db/migrations/20260226_add_team_athlete_performance_tier.sql`
  - `team_athletes.performance_tier` (nullable text)
  - check constraint: `pool | developmental | challenger | champion`
  - index on `(team_id, performance_tier)` for filter/reporting performance
- Updated coaching types:
  - `PerformanceTier` union in `src/services/coaching/types.ts`
  - `performance_tier` added to `CoachingAthlete` and `TeamAthlete`
- Updated coaching service wiring (`src/services/coaching/coachingService.ts`):
  - team-athlete select joins now include `performance_tier`
  - added `getTeamPerformanceTiers(...)`
  - added `updateAthletePerformanceTier(...)`
  - `createAthlete(...)` and transfer logic now support/reset tier appropriately

#### 2. Measured-workout season leaderboard service
- Added `getSeasonMeasuredLeaderboard(teamId, { from, to, limit })` in `src/services/coaching/coachingService.ts`
  - source set: group assignments where template `is_test = true`
  - rank models:
    - raw rank by lower split (distance-weighted where interval distances available)
    - W/lb rank from split-derived watts and effective weight (`result_weight_kg` fallback to profile `weight_kg`)
  - returns per-athlete:
    - `avg_raw_rank`
    - `avg_wplb_rank`
    - `assignment_count`
    - `trend_raw_rank`
    - `squad` + `performance_tier`

#### 3. Top-level summary surfaces
- `src/pages/coaching/CoachDashboard.tsx`
  - added quick-view season measured leaderboard card (top 5) with link to Analytics
- `src/pages/coaching/TeamAnalytics.tsx`
  - added measured leaderboard table (top 10) on team analytics route
  - includes average rank, average W/lb rank, test count, and trend

#### 4. Assignment results metrics expansion (private + public)
- `src/pages/coaching/AssignmentResults.tsx`
- `src/pages/PublicAssignmentResultsShare.tsx`
  - enriched per-athlete interval stats:
    - `rep_best_split_seconds`
    - `rep_worst_split_seconds`
    - `rep_split_spread_seconds`
  - summary table now shows interval `Best · Worst` and `Spread` columns
  - added assignment-level aggregate cards:
    - avg finisher split
    - avg finisher watts
    - best/worst rep (overall)
    - rep spread (overall)

### Verification

- `npm run build` → ✅ pass
- `npm run test:run` → ✅ pass (`209/209`)
- `npm run lint` → ❌ fails on pre-existing repository-wide baseline lint debt (unrelated `scripts/*`, `src/App.tsx`, etc.)

### Outcome

The coaching stack now separates long-term rowing maturity (`experience_level`) from season-ready competitive classification (`performance_tier`), provides measurable season standings from benchmark workouts, and improves assignment-results interpretability with explicit best/worst interval and aggregate performance summaries.

---

## Phase 29: Magic Layer Confidence Matching (Read-Only Suggestion Mode) (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Add confidence-scored template matching for workout suggestions without introducing breaking schema changes or auto-link behavior changes.

### Changes Implemented

#### 1. Confidence-scored matching utility
- `src/utils/templateMatching.ts`
  - Added `MatchReason` (`exact_user_template`, `exact_community_template`, `no_match`)
  - Added `findTemplateMatchesWithConfidence(...)`
  - `MatchedTemplate` now includes:
    - `match_confidence`
    - `match_reason`
    - `canonical_signature`
  - `findBestMatchingTemplate(...)` now delegates to confidence matcher for deterministic behavior.

#### 2. Workout detail suggestion wiring
- `src/pages/WorkoutDetail.tsx`
  - Suggestion fetch path now uses `findTemplateMatchesWithConfidence(...)`.
  - Suggestion banner now shows confidence % and reason text (user template vs community exact match).
  - Existing link action remains explicit/manual (read-only suggestion mode preserved).

### Verification

- Targeted lint: `npx eslint src/utils/templateMatching.ts src/pages/WorkoutDetail.tsx` → ✅ pass
- Build: `npm run build` → ✅ pass
- Focused tests:
  - `src/utils/rwnParser.test.ts`
  - `src/utils/workoutEntryClassifier.test.ts`
  - `src/utils/workoutNaming.test.ts`
  - Result: ✅ `67/67` passing

### Outcome

Template suggestions now communicate confidence and match reason, making matching behavior more transparent for users while keeping the current non-breaking, user-confirmed linking workflow.

---

## Phase 28: Magic Layer Foundation (Canonical Derivation Unification) (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete (foundation slice)

### What Was Built

**Goal**: Start the magic-layer implementation by unifying canonical name derivation across templates, logs, and workout detail flows without breaking existing imports/behavior.

### Changes Implemented

#### 1. New shared canonical utility
- `src/utils/workoutCanonical.ts`
  - Added shared helpers:
    - `deriveCanonicalNameFromIntervals(...)`
    - `deriveCanonicalNameFromStructure(...)`
    - `deriveCanonicalNameFromRWN(...)`
    - `normalizeCanonicalName(...)`
    - `canonicalSignatureFromCanonicalName(...)`
  - Centralizes canonical normalization and filters invalid canonical values (`Unknown`, `Unstructured`, etc.).

#### 2. Template + log flow wiring
- `src/services/templateService.ts`
  - Template create/update now uses shared canonical derivation from structure.
- `src/services/workoutService.ts`
  - Manual RWN and raw interval canonical generation now use shared helpers for consistent output and backfill behavior.

#### 3. Workout detail consistency updates
- `src/pages/WorkoutDetail.tsx`
  - Canonical derivation for template suggestions, preview name, and displayed workout name now routes through shared helpers.

#### 4. Template estimate correctness fix
- `src/pages/TemplateDetail.tsx`
  - Fixed duration estimate input by passing `structureToRWN(template.workout_structure)` instead of `JSON.stringify(workout_structure)`.

### Verification

- `npm run build` → ✅ pass
- `npm run test:run` → ✅ pass (`11/11` files, `209/209` tests)
- `npm run lint` baseline remains failing on pre-existing repository-wide lint debt (unchanged by this slice).

### Outcome

Canonical naming behavior is now more deterministic across key user paths, reducing drift risk between template storage, log display, and manual-RWN workflows while remaining backward compatible.

---

## Phase 27: Copilot Skill Pack Expansion II (Coaching/RLS, Migrations, Analytics, Edge Ops) (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Add four additional repository skills for high-risk governance areas: coaching access control, migration safety, analytics correctness, and edge-function operability.

### Changes Implemented

#### 1. Coaching + RLS Guard
- `.github/skills/coaching-rls-guard/SKILL.md`
  - Enforces team/org scoping checks, role hierarchy alignment, multi-team safety, and RLS-compatible query behavior.

#### 2. Migration Safety Guard
- `.github/skills/migration-safety-guard/SKILL.md`
  - Enforces migration-first DDL, rollout sequencing, policy/RPC safety, and post-apply verification expectations.

#### 3. Analytics Integrity Guard
- `.github/skills/analytics-integrity-guard/SKILL.md`
  - Enforces formula/unit consistency, filtered-population statistical correctness, and visualization semantics alignment.

#### 4. Edge Function Operability Guard
- `.github/skills/edge-function-operability-guard/SKILL.md`
  - Enforces auth-mode intent, secret hygiene, retry/idempotency behavior, observability quality, and deployment completeness checks.

### Outcome

The project skill pack now covers both implementation quality and operational safety across UI, data, training domain logic, RWN, Concept2 integration, coaching access control, migrations, analytics, and edge runtimes.

---

## Phase 26: Copilot Skill Pack Expansion (UI/UX + Concept2) (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Extend the project skill pack with one UX-governance skill and one Concept2 reliability skill.

### Changes Implemented

#### 1. UI/UX Consistency Skill
- `.github/skills/ui-ux-consistency-guard/SKILL.md`
  - Adds checks for accessibility baseline, responsive behavior, interaction-state consistency, and cross-surface pattern alignment.
  - Includes discovery/search rule for shared UI pattern drift in `src/pages` and `src/components`.

#### 2. Concept2 Reliability Skill
- `.github/skills/concept2-reliability-guard/SKILL.md`
  - Adds checks for OAuth scopes, token lifecycle reliability, sync/publish idempotency, mapping consistency, and operational readiness.
  - Anchors validation to existing C2 surfaces (`concept2.ts`, `useConcept2Sync`, callback/sync pages, reconnect prompts, reconciliation, workout service).

### Outcome

The skill set now directly covers UX consistency governance and Concept2 integration reliability, reducing regressions in two high-change, high-impact areas.

---

## Phase 25: Copilot CLI Skill Pack (February 26, 2026)

**Timeline**: February 26, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Add repository-level Copilot skills to standardize Supabase schema validation, testing gates, rowing domain validation, and RWN integrity checks.

### Changes Implemented

#### 1. New project skills under `.github/skills/`
- `supabase-schema-guard/SKILL.md`
  - MCP-first schema inspection and drift checks against `src/lib/types/database.ts`.
- `preflight-test-gate/SKILL.md`
  - Standard pre/post-change validation sequence (`lint`, `build`, `test:run`) with clear failure reporting.
- `rowing-domain-validator/SKILL.md`
  - Rowing/training validation checklist grounded in KB sources across physiology, coaching plans, and injury prevention.
- `rwn-spec-guardian/SKILL.md`
  - RWN source-of-truth guard (`rwn/RWN_spec.md`), known touchpoint list, discovery rule, and round-trip/spec-doc alignment checks.

### Outcome

The repository now has reusable, explicit Copilot skill workflows for high-risk areas (DB/schema, validation rigor, rowing-domain correctness, and RWN consistency), improving repeatability and reducing prompt-by-prompt setup overhead.

---

## Phase 24: Team Invite Flow Reliability Fix (February 25, 2026)

**Timeline**: February 25, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Fix coach invite failures affecting both add-by-email and invite-code join paths for existing accounts.

### Root Cause

1. `team_members` RLS allowed only self-insert (`auth.uid() = user_id`), so coaches/coxswains could not add another existing user by email.
2. `teams` SELECT policy prevented non-members from reading private teams, so invite-code lookup could not resolve private team previews/joins.

### Changes Implemented

#### 1. Service Layer Hardening
- `src/services/coaching/coachingService.ts`
   - `getTeamByInviteCode()` now uses RPC `lookup_team_by_invite_code(p_code)` instead of direct `teams` query.
   - `addTeamMemberByEmail()` now performs case-insensitive email lookup with `.ilike('email', normalizedEmail)`.

#### 2. Database Migration
- `db/migrations/20260225_fix_team_invite_rls_and_lookup.sql`
   - Added policy: **"Coaches and coxswains can add team members"** on `public.team_members` (INSERT).
   - Added security-definer RPC: `public.lookup_team_by_invite_code(p_code text)` returning `SETOF public.teams`.
   - Granted execute on RPC to `authenticated` and revoked public execute.

#### 3. Live Environment Application
- Applied to Supabase project `vmlhcbkyonemmlawnqqr` via MCP migration:
   - `mcp_supabase_apply_migration` name: `fix_team_invite_rls_and_lookup`

### Verification

- `npm run build` (LogbookCompanion) → ✅ success (`tsc -b` + `vite build`)
- Type diagnostics on `coachingService.ts` → ✅ no errors

### Outcome

Inviting existing users now works across both entry points:
- Coaches/coxswains can add an existing account directly by email.
- Existing authenticated users can resolve private teams by invite code and join successfully.

---

## Phase 23: PM5 Adapter-Level Lowering Classification (February 25, 2026)

**Timeline**: February 25, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Add a concrete adapter-layer contract that lowers parsed `WorkoutStructure` into PM5-ready `ActiveWorkoutSpec` while explicitly classifying execution capability as `exact`, `prompt_only`, or `unsupported`.

### Changes Implemented

#### 1. New Lowering Utility
- `src/utils/rwnPm5Lowering.ts`
   - Added `Pm5LoweringMode` (`exact` | `prompt_only` | `unsupported`)
   - Added `Pm5LoweringResult` (`mode`, `activeWorkoutSpec`, `notes`)
   - Added `lowerWorkoutStructureToPm5(structure)`

#### 2. Lowering Rules (Current)
- **Exact**
   - steady-state meters → `fixed_distance`
   - steady-state seconds → `fixed_time`
   - fixed interval distance work → `interval_distance`
   - fixed interval time work → `interval_time`
   - variable distance/time/rest steps → `variable_interval`
- **Prompt-only**
   - any structure carrying `sessionExtension` (`partner`, `relay`, `rotate`, `circuit`) while preserving PM5-programmable core payload
- **Unsupported**
   - calorie-based steady-state, interval work, or variable steps (current adapter scope)

#### 3. Focused Tests
- `src/utils/rwnPm5Lowering.test.ts`
   - PM5-native fixed interval lowers as `exact`
   - `partner(...)` lowers as `prompt_only` with preserved core
   - `rotate(...)` lowers as `prompt_only` with parser-derived core
   - calorie step case lowers as `unsupported`

### Verification

- Focused test run: `npm run test:run -- src/utils/rwnPm5Lowering.test.ts` → ✅ `4/4` passing
- Full project build: `npm run build` → ✅ success

### Outcome

The project now has an explicit, test-backed PM5 lowering contract that separates parser expressiveness from PM5 execution capability and prepares the path for ErgLink adapter integration.

---

## Phase 22: RWN Session-Orchestration Parser Extensions (Additive) (February 25, 2026)

**Timeline**: February 25, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Implement parser-first support for coach-facing orchestration constructs (`partner`, `relay`, `rotate`, `circuit`) without breaking existing RWN grammar or downstream consumers.

### Changes Implemented

#### 1. Type System (Additive Metadata Only)
- `src/types/workoutStructure.types.ts`
   - Added `SessionExtension` interface for orchestration metadata (`kind`, `switch`, `on`, `off`, `leg`, `total`, `team_size`, `order`, `off_task`, `stations`, `rounds`, `plan`, `items`)
   - Added optional `sessionExtension?: SessionExtension` to:
      - `SteadyStateStructure`
      - `IntervalStructure`
      - `VariableStructure`

#### 2. Parser Extensions
- `src/utils/rwnParser.ts`
   - Added top-level orchestration parser path with helper utilities:
      - paren/bracket-aware token splitting
      - named-argument parsing
      - list parsing
      - distance parsing
      - recursive embedded-RWN parsing for `on`/`off`/plan items
   - Implemented `parseSessionExtensionSyntax(...)` support for:
      - `partner(on=..., off=..., switch=...)`
      - `relay(leg=..., total=...)` (with defaults: `switch=leg_complete`, `order=round_robin`, `off_task=wait`)
      - `rotate(stations=..., switch=..., rounds=..., plan=[...])`
      - `circuit(...)`
   - Hooked orchestration parsing early in `parseRWN(...)` flow while preserving legacy parsing behavior when orchestration syntax is not used.

#### 3. Regression + Feature Test Coverage
- `src/utils/rwnParser.test.ts`
   - Added suite: **RWN Parser - Session Orchestration Extensions (Additive)**
   - Coverage includes:
      - Partner parse + core-work preservation
      - Partner with active `off=circuit(...)`
      - Minimal relay defaults
      - Rotate with plan parsing
      - Standalone circuit parse
      - Explicit legacy interval regression guard

### Verification

- Focused parser test run: `src/utils/rwnParser.test.ts` → ✅ `50/50` passing
- Full project build: `npm run build` → ✅ success (`tsc -b` + `vite build`)

### Outcome

RWN now supports session-level orchestration syntax in an additive, backward-compatible way by attaching optional metadata rather than changing core workout structure contracts.

---

## Phase 21: User-Level Measurement Units Preference (February 25, 2026)

**Timeline**: February 25, 2026  
**Status**: ✅ Complete

### What Was Built

**Goal**: Make height/weight display and entry user-configurable (`imperial` vs `metric`) while keeping canonical storage metric (cm/kg), with no team-level defaults.

### Changes Implemented

#### 1. Units Model + Resolver
- `src/utils/unitConversion.ts`
   - Added `MeasurementUnits` type (`'imperial' | 'metric'`)
   - Added `isMeasurementUnits()` validator
   - Added `resolveMeasurementUnits()` preference resolver with fallback
   - Updated `formatHeight()` / `formatWeight()` to support unit-aware output

#### 2. Auth-Aware Units Hook
- `src/hooks/useMeasurementUnits.ts`
   - New hook reading `user_profiles.preferences.units`
   - Defaults to `imperial` when unset/invalid

#### 3. Preferences UI (User-Level Setting)
- `src/pages/Preferences.tsx`
   - Added **Units** section in General tab
   - Added measurement units selector:
      - `Imperial (lb, ft/in)`
      - `Metric (kg, cm)`
   - Added `updateMeasurementUnits()` with optimistic UI + DB persistence + rollback on failure

#### 4. Coaching Entry + Display Wiring
- `src/pages/coaching/CoachingAssignments.tsx`
   - Results-entry bodyweight input now follows user units label/placeholder (`lbs` or `kg`)
   - Input values convert back to kg before saving `result_weight_kg`
   - Prefill values convert from stored/profile kg into selected display units
- `src/components/coaching/AthleteEditorModal.tsx`
   - Added `units` prop
   - Height input now supports imperial (`ft/in`) or metric (`cm`)
   - Weight input now supports imperial (`lbs`) or metric (`kg`)
   - Persisted outputs remain `height_cm` and `weight_kg`
- `src/pages/coaching/CoachingRoster.tsx`
   - Inline height/weight display and editing now respect user units
   - Conversion logic updated to parse/store metric regardless of display units
   - Passes `units` prop to add-athlete modal
- `src/pages/coaching/CoachingAthleteDetail.tsx`
   - Height/weight display now unit-aware
   - Passes `units` prop to edit-athlete modal

### Verification

- `npm run build` (LogbookCompanion) → ✅ success (`tsc -b` + `vite build`)

### Outcome

Users can now choose their own measurement system globally, with coaching/profile workflows honoring that preference while data storage remains consistently metric.

---

## Phase 20: Assignment-Level Weight Capture + Dual-Unit Power-to-Weight (February 25, 2026)

**Timeline**: February 25, 2026  
**Status**: ✅ Complete

### What Was Built

**Problem**: Assignment result analytics used only athlete profile `weight_kg`, which can be stale relative to race/test day. Coaches needed to capture weight per assignment result and view power-to-weight in both metric and imperial forms.

### Changes Implemented

#### 1. Service Layer (`src/services/coaching/coachingService.ts`)
- Added `result_weight_kg?: number | null` to assignment/result row interfaces (`AthleteAssignmentRow`, `AssignmentResultRow`)
- Included `result_weight_kg` in select projections for:
   - `getAthleteAssignmentRows()`
   - `getAssignmentResultsWithAthletes()`
   - `addAthleteToAssignment()` return shape
- Updated `saveAssignmentResults()` payload typing and persistence to write `result_weight_kg` when provided

#### 2. Results Entry Modal (`src/pages/coaching/CoachingAssignments.tsx`)
- Extended `AthleteResultEntry` with `weightKg: string`
- Prefills weight from saved `result_weight_kg` or falls back to athlete profile `weight_kg`
- Added per-athlete `Wt kg` input column/field in results table
- Persisted parsed `result_weight_kg` in all save paths (completed, partial DNF, full DNF)

#### 3. Assignment Results View (`src/pages/coaching/AssignmentResults.tsx`)
- Effective weight logic now prefers `result_weight_kg`, fallback to profile `weight_kg`
- Computes both `W/kg` and `W/lb` on enriched rows
- Updated ratio rendering to display both values (`W/kg · W/lb`) in the table
- Updated W/kg chart tooltip text to include both units

#### 4. Database Migration
- Added `db/migrations/migration_add_result_weight_kg.sql`:
   - `ALTER TABLE public.daily_workout_assignments ADD COLUMN IF NOT EXISTS result_weight_kg NUMERIC;`

### Verification

- `npm run build` (LogbookCompanion) → ✅ success (`tsc -b` + `vite build`)

### Outcome

Power-to-weight analytics now reflect assignment/test-day athlete body weight when entered, with profile weight as safe fallback, and present both metric and imperial ratio units for coach usability.

---

## Phase 19: Coaching Module Deep Audit — 27 Issues Fixed (February 24, 2026)

**Timeline**: February 24, 2026  
**Status**: ✅ Complete

### What Was Built

**Problem**: After implementing org-wide assignments and boating snapshots, a comprehensive 4-subagent audit (security, robustness, type-safety, UX) uncovered 27 issues across coaching module files (8 Critical, 6 High, 7 Medium, 6 Low).

### All 27 Issues Fixed Across 12 Files

#### 1. Context Layer (`coachingContextDef.ts`, `CoachingContext.tsx`)
- Added `orgId: string | null` and `activeTeam: UserTeamInfo | null` to `CoachingContextType`
- Changed `teamRole: string | null` → `TeamRole | null` (proper union type)
- User-scoped localStorage key: `lc_selected_team_${userId}` (prevents cross-user collision)
- Exposed `orgId` and `activeTeam` in provider value memo

#### 2. Cross-Org Data Leakage Fix (`coachingService.ts`)
- `getComplianceData()`: Replaced dangerous `team_id.is.null` filter with proper two-step approach — queries `group_assignments` WHERE `org_id = orgId` to get org assignment IDs, then filters `daily_workout_assignments` with `team_id.in.(teamIds) OR group_assignment_id.in.(orgAssignmentIds)`
- Added empty `teamIds`/`orgAssignmentIds` guard (returns `[]` if both empty)

#### 3. Org Athlete Resolution (`coachingService.ts`)
- `getAssignmentResultsWithAthletes()`: Added optional `orgId` parameter, uses `getOrgAthletes(orgId)` for cross-team visibility when org assignments present

#### 4. Mutual Exclusivity Validation (`coachingService.ts`)
- `createGroupAssignment()`: Throws error if both `org_id` and `team_id` are set

#### 5. Type Safety (`types.ts`)
- `BoatPosition.athlete_name`: Changed from `string` to `string?` (optional)

#### 6. orgId Passthrough (6 UI Components)
- `CoachingRoster.tsx`: passes `orgId` to `getAssignmentCompletions`
- `CoachingSchedule.tsx`: passes `orgId` to `getGroupAssignments`
- `CoachDashboard.tsx`: passes `orgId` to `getAssignmentsForDate` and `getAssignmentCompletions`
- `CoachingAssignments.tsx`: uses context `orgId` instead of local derivation
- `AssignmentResults.tsx`: passes `orgId` to `getAssignmentResultsWithAthletes`
- `ResultsEntryModal` in `CoachingAssignments.tsx`: loads org athletes for org-wide assignments

#### 7. Boatings Hardening (`CoachingBoatings.tsx`)
- Fixed `handleInlinePositionUpdate`: passes only `{ positions: newPositions }` (not full spread with `id`, `created_at`)
- Changed all `'Unknown'` fallbacks to `''` (prevents permanent "Unknown" snapshots)
- Added try/catch + toast.error to 5 handlers
- Added teamId guards to `handleSave`, `handleDuplicate`, `handleCopyPreviousDay`

#### 8. Robustness Across 4 Components
- `CoachingRoster.tsx`: teamId guard + try/catch on handleSave/handleDelete
- `CoachingSchedule.tsx`: teamId guards + try/catch on 5 handlers, added toast import
- `CoachingErgScores.tsx`: teamId guard + try/catch on handleAddScore/handleDeleteScore, added toast import
- `CoachingAthleteDetail.tsx`: teamId guard + try/catch on handleSave/handleDelete

### Build Verification
- `npx tsc --noEmit` → Clean (zero errors)
- `npx vite build` → ✓ 2855 modules transformed, built in 8.58s, no errors

### What Worked
- Audit-first approach caught real security issues (cross-org data leakage via `team_id.is.null`)
- Systematic fix ordering (context → service → types → UI) minimized cascading changes
- All fixes passed build verification without introducing regressions

---

## Phase 18: Org-Wide Assignments & Boating Snapshots (February 23, 2026)

**Timeline**: February 23, 2026  
**Status**: ✅ Complete

### What Was Built

**Problem**: When athletes transfer between teams within an org, their workout assignments break because `group_assignments` was strictly team-scoped via `team_id`. Also, boating lineups show "Unknown" for transferred athletes because seat positions only store `athlete_id` and look up names from the current team roster.

### Changes Implemented

#### 1. Database Migration (applied to live Supabase)
- `db/migrations/20260223_add_org_assignments_and_boating_snapshots.sql`
- Added `org_id` FK on `group_assignments` referencing `organizations(id)`
- Made `team_id` nullable on `group_assignments`
- Added CHECK constraint: exactly one of `team_id` or `org_id` must be set
- Updated RLS policies to allow org-level queries via org membership
- Added index on `group_assignments(org_id)`

#### 2. TypeScript Types
- `BoatPosition`: Added optional `athlete_name?: string` for snapshot
- `GroupAssignment`: Added `org_id?: string | null`, made `team_id` optional/nullable
- `GroupAssignmentInput`: Added `org_id?: string | null`, made `team_id` optional/nullable

#### 3. Service Layer (`coachingService.ts`)
- **New**: `getTeamsForOrg(orgId)` — queries `teams` table by org_id
- **New**: `getOrgAthletes(orgId)` — fetches all athletes across all org teams, de-duplicated by athlete ID
- **Modified**: `getGroupAssignments()` — accepts optional `orgId`, uses `.or()` for org-wide + team-scoped
- **Modified**: `createGroupAssignment()` — auto-fans-out to all org athletes when `org_id` set and `team_id` null
- **Modified**: `syncAssignmentAthletes()` — handles nullable `team_id`
- **Modified**: `getComplianceData()` — queries across all org teams when `orgId` provided
- **Modified**: `getAssignmentCompletions()` — passes through `orgId`
- **Modified**: `getAssignmentsForDate()` — passes through `orgId`

#### 4. Boating UI Snapshots (`CoachingBoatings.tsx`)
- `setPosition()`: resolves + stores `athlete_name` when assigning seat
- `getAthleteNameForSeat()`: prefers snapshot name, falls back to live roster
- `handleSeatChange()`: includes `athlete_name` for inline edits
- Swap logic: preserves snapshot names during seat swaps

#### 5. Assignment UI (`CoachingAssignments.tsx`)
- Derived `orgId` from `useCoachingContext().teams`
- `loadData()`: passes `orgId` to service queries
- `CreateAssignmentForm`: new `orgId` prop, "All Teams (Org)" radio button, lazy-loaded org athletes
- `assignTo` expanded to `'all' | 'squad' | 'org'`
- `handleSubmit`: sets `org_id`/`team_id` correctly for scope
- `AssignmentCard`: "ORG" badge for org-level assignments

### Verification

- `npx tsc --noEmit` — clean (zero errors)
- `npx vite build` — clean (2855 modules, 13.68s, ~2MB bundle)

### Design Decisions

- **Fan-out at creation time**: Org-level assignments create `daily_workout_assignments` per athlete using `athlete_id` FK (not `team_id`). This makes results transfer-stable — when an athlete moves teams, their completed results stay.
- **Snapshot over live lookup**: Boating `athlete_name` snapshots prevent historical lineups from breaking when athletes transfer. Display prefers snapshot, falls back to live roster.
- **Lazy loading org athletes**: Only fetched when coach selects "All Teams" radio, avoiding unnecessary queries for team-scoped assignments.

**Result**: Coaches can now assign workouts to all athletes across an organization, and those assignments + boating records remain accurate even after athlete transfers.

---

## Phase 17: Coaching Results Modal Ladder Recognition Fix (February 18, 2026)

**Timeline**: February 18, 2026  
**Status**: ✅ Complete

### What Was Fixed

**Problem**: Team Management → Assignments `Enter Results` modal sometimes failed to recognize variable ladders (notably `1:00/5:00r + 3:00/5:00r + 7:00/5:00r`) and fell back to single-piece/freeform inputs.

**Root Cause**: Entry shape classification relied on `canonical_name` text parsing. Some templates surfaced stylized/non-parseable canonical display text (for example `v1:00...7:00 Ladder`) even though `workout_structure` JSON was correct.

### Changes Implemented

- Added `parseWorkoutStructureForEntry()` in `src/utils/workoutEntryClassifier.ts`.
- Updated `GroupAssignment` to include optional `workout_structure` in `src/services/coaching/types.ts`.
- Updated `getGroupAssignments()` to select and map `workout_templates.workout_structure` in `src/services/coaching/coachingService.ts`.
- Updated `ResultsEntryModal` in `src/pages/coaching/CoachingAssignments.tsx` to classify from `workout_structure` first, then fallback to `canonical_name` parsing only (friendly `template_name`/`title` are labels, not parse inputs).
- Updated interval rep input semantics in `ResultsEntryModal` so timed work reps request **distance** input and distance work reps request **time** input (applies to fixed interval and variable ladder reps).
- Fixed Enter Results input reset loop by memoizing computed workout shape and removing unstable array-reference effect dependency that caused repeated `getAthleteAssignmentRows()` fetches and state re-seeding.
- Added regression test in `src/utils/workoutEntryClassifier.test.ts` using the exact variable ladder JSON shape (`60s`, `180s`, `420s` work with `300s` rests).

### Verification

- Ran focused suite: `npm run test:run -- src/utils/workoutEntryClassifier.test.ts`
- Result: ✅ 4/4 tests passing.

**Result**: Results modal now recognizes ladder workouts reliably from authoritative template structure, independent of canonical label formatting.


## Phase 16: OCR Asset Extraction + Integration Deep Dive (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning + Preservation Complete

### What Was Added

#### 1. OCR source preservation inside LC
Copied Train Better OCR artifacts into `working-memory/extracted-ocr/`:

#### 2. Integration deep-dive brief
Created `working-memory/train-better-ocr-deep-dive.md` documenting:

**Result**: ✅ OCR intellectual property and implementation details are preserved in-repo and translated into an actionable LC roadmap artifact.



## Phase 16: OCR Salvage Deep Dive + Integration Brief (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

Created `working-memory/ocr-salvage-and-integration-brief.md` to convert extracted Train Better OCR code into an implementation-ready migration plan for Logbook Companion.

#### Audit inputs reviewed
- `working-memory/extracted-ocr/OcrService.train-better.ts`
- `working-memory/extracted-ocr/ErgWorkoutParser.train-better.ts`
- `working-memory/extracted-ocr/image_processor.train-better.py`
- `working-memory/extracted-ocr/workout_parser.train-better.py`
- `train-better/functions/src/processErgImages.ts`

#### Included in the brief
- Keep/adapt/drop matrix for salvage candidates
- Minimum normalized OCR response contract
- LC target architecture (server OCR module + web adapter + Bronze ingestion bridge)
- Phase-aligned execution sequence tied to workout-capture Phase 1
- Risk register (interval misclassification, stitching artifacts, schema drift, config mismatch)

**Result**: ✅ OCR is now scoped as a low-risk migration stream with explicit implementation order and integration boundaries.

===
## Phase 15: Phase A Kickoff Pack (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

Created `working-memory/train-better-phase-a-kickoff-pack.md` to convert the roadmap into immediate execution assets.

#### Included in the kickoff pack
- Recommended label taxonomy for phases, workstreams, risk, and status
- Board setup blueprint (columns + custom fields)
- Phase A definition of done checklist
- Copy/paste issue templates for Epics 1-5
- Reusable Phase A task template
- Suggested initial setup task list and 30-minute kickoff agenda

**Result**: ✅ Program setup can now be executed in one pass with standardized issue structure and explicit phase gating.

===

## Phase 14: Train Better Program Roadmap + Execution Spec (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

Created `working-memory/train-better-change-roadmap-spec.md` to operationalize the strategy docs into a single execution artifact.

#### Included in the spec
- Phase-gated roadmap (A-F) with objectives, deliverables, entry/exit criteria
- Workstream specs (Brand/UX, Platform/Domains, Auth/Integrations, Analytics, Change Ops)
- Dependencies, risks, mitigations, and governance cadence
- Issue-ready backlog epics and program completion definition
- Conditional execution tracks for coaching split and product rename

**Result**: ✅ You now have architecture + runbook + worksheet + execution roadmap artifacts needed to begin implementation planning and commit with a complete paper trail.

===

## Phase 13: Split + Naming Decision Worksheet (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

Added Section 10 to `working-memory/train-better-site-architecture.md` with a one-session decision framework:
- App split readiness scorecard (0-5 criteria)
- Explicit split thresholds (go/no-go)
- Naming scorecard across multiple candidates
- Naming decision threshold (when rename is justified)
- Required evidence checklist before decision
- Fill-in decision templates and immediate kickoff checklist

**Result**: ✅ Repeatable, evidence-based process to decide both app split timing and product naming without ad hoc debate.

===

## Phase 12: Coaching Split Strategy + Naming Exploration (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

#### 1. Split Strategy Section in Architecture Doc
Expanded `working-memory/train-better-site-architecture.md` with:
- Keep-unified-now recommendation for in-season execution
- Split-readiness trigger checklist (2+ trigger gate)
- Target post-split domain map including `coach.train-better.app`
- Four-phase migration roadmap (boundary hardening → shell split → optimization → packaging)
- Risk/mitigation notes for auth, UI drift, and user navigation confusion

#### 2. Product Naming Exploration
Added structured evaluation for whether to keep "Logbook Companion":
- Naming decision criteria (clarity, scope fit, brand coherence, distinctiveness, migration cost)
- Option analysis (keep, soft transition, full rename)
- Recommended path: keep current name now, strengthen subtitle, revisit with post-season evidence

**Result**: ✅ Decision-quality planning artifact for both app-boundary and naming strategy without forcing immediate architectural churn.

===

## Phase 11: Train Better Hub IA + Wireframes (February 13, 2026)

**Timeline**: February 13, 2026  
**Status**: ✅ Planning Complete

### What Was Built

#### 1. Umbrella Site Architecture Document
**Problem**: Domain rollout plan existed, but there was no dedicated product/UX architecture doc for how `train-better.app` should communicate and route users across Logbook Companion and ErgLink.

**Solution**:
- Added `working-memory/train-better-site-architecture.md` as a companion to `working-memory/domain-rollout-plan.md`.
- Defined brand model, messaging hierarchy, IA/site map, and cross-site communication strategy.

#### 2. Wireframe Set (ASCII)
**What was documented**:
- Home page wireframes (desktop + mobile)
- Product detail page wireframe
- Coaches journey page wireframe

#### 3. MVP Sequencing
**Implementation order**:
1. Ship hub homepage + product pages
2. Add docs/community/support pages
3. Add analytics events and funnel tracking
4. Iterate copy and routing based on spring season usage feedback

**Result**: ✅ Clear blueprint for building `train-better.app` as umbrella site while keeping app deployments independent (`log.*`, `erg.*`).

===

## Phase 6: Workout Capture Engine (Backend) (February 6, 2026)

**Timeline**: February 6, 2026
**Status**: ✅ Complete (Backend)

### What Was Built

#### 1. Reconciliation Engine
**Problem**: Duplicate data entering system from Manual + C2 sources.
**Solution**: "Swiss Cheese" layering with source priority (Gold/Silver/Bronze).
**Logic**:
- Check for existing workout within +/- 10 mins.
- If existing, check if new source > existing source (e.g. C2 > Manual).
- If update: Update in place. If new: Insert.

#### 2. RWN Canonical Naming Updates
**Problem**: Complex nested blocks (e.g., `2 x (4 x 500m)`) not naming correctly.
**Solution**:
- Recursive block structure detection.
- Updated `workoutNaming.ts` to generate `Nx(MxDIST)` strings.
- Saved canonical name to `notes` field for visibility.

#### 3. Power Distribution & Zone Analytics
**Problem**: Power distribution data was missing or incorrectly bucketed, leading to inaccurate "Time in Zone" charts.
**Solution**:
- Integrated `getPowerDistribution` from C2 API to fetch raw stroke buckets.
- Fixed bucketing logic to align with training zones.
- Upserted to `workout_power_distribution` table for fast analytics.
- Added graceful error handling (skips if RLS/Schema fails).

===

## Phase 5: Template System Enhancement (February 4, 2026)

**Timeline**: February 4, 2026  
**Status**: ✅ Complete (pending manual migration)

### What Was Built

#### 1. Template Linking & Display Fixes
**Problem**: Template links weren't displaying on WorkoutDetail page despite being set in database

**Root Cause**: `getWorkoutDetail()` returned only C2 API data (`raw_data`), stripping database metadata

**Solution**:
```typescript
// workoutService.ts - Merge database fields into returned object
return {
    ...data.raw_data,
    workout_name: canonicalName,
    template_id: data.template_id,      // ✅ Now included
    manual_rwn: data.manual_rwn,        // ✅ Now included
    is_benchmark: data.is_benchmark     // ✅ Now included
} as C2ResultDetail;
```

**Files Changed**:
- `src/services/workoutService.ts`

**Result**: ✅ Linked templates now display correctly on WorkoutDetail page

---

#### 2. Power Distribution Error Handling
**Problem**: 406 errors when accessing `workout_power_distribution` table blocked page rendering

**Root Cause**: RLS policy requires user owns workout; when data missing or access denied → 406

**Solution**:
```typescript
// Wrap query in try-catch, handle specific error codes
try {
    const { data, error } = await supabase
        .from('workout_power_distribution')
        .select('buckets')
        .eq('workout_id', workoutId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('406')) {
            console.log('Power distribution not available');
            return null; // Graceful degradation
        }
    }
} catch (err) {
    return null;
}
```

**Files Changed**:
- `src/services/workoutService.ts` - `getPowerBuckets()` function

**Result**: ✅ Pages no longer crash when power distribution unavailable

---

#### 3. Global Template Library with Personal Stats
**Design Decision**: Templates shared globally, but usage tracking is personal

**Implementation**:
```typescript
// Templates: No user filter (global library)
const templates = await fetchTemplates({ workoutType: 'erg' });

// Personal stat: User-filtered workout count
const { count } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('template_id', 'is', null);

// Display: "347 workouts categorized" (personal)
// vs template.usage_count (global community popularity)
```

**Files Changed**:
- `src/pages/TemplateLibrary.tsx` - Personal workout count query
- `src/services/templateService.ts` - No user filtering on templates

**Result**: ✅ Community template discovery + personal progress tracking

**See Also**: ADR-013 for decision rationale

---

#### 4. Template Sorting (Popularity vs Recency)
**Feature**: Sort templates by "Most Popular" or "Recently Used"

**Database Changes**:
```sql
-- Add last_used_at column
ALTER TABLE workout_templates 
ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast sorting
CREATE INDEX idx_workout_templates_last_used_at 
ON workout_templates(last_used_at DESC);

-- Update trigger to maintain both usage_count and last_used_at
CREATE OR REPLACE FUNCTION update_template_usage_count() ...
```

**UI Implementation**:
```typescript
// Sort options dropdown
<select value={sortOrder} onChange={...}>
    <option value="popular">Most Popular</option>
    <option value="recent">Recently Used</option>
</select>

// Query logic
if (sortBy === 'recent') {
    query.order('last_used_at', { ascending: false, nullsFirst: false });
} else {
    query.order('usage_count', { ascending: false });
}
```

**Files Changed**:
- `db/migrations/migration_add_last_used_at.sql` - Database migration (NOT YET APPLIED)
- `src/services/templateService.ts` - Added `sortBy` parameter
- `src/pages/TemplateLibrary.tsx` - Sort UI controls

**Result**: ✅ Code ready, ⏳ Pending manual SQL execution in Supabase

**See Also**: ADR-014 for decision rationale

---

#### 5. RWN Playground Enhancements
**Feature**: Better visualization and multi-modal workout examples

**Changes**:
1. **Categorized Examples**: Basic → Pace → Advanced → Multi-Modal
2. **Multi-Modal Examples Added**:
   - BikeErg: `Bike: 15000m`
   - SkiErg: `Ski: 8x500m/3:30r`
   - Circuit: `Row: 2000m + Bike: 5000m + Ski: 2000m`
   - Team Circuit: `3x(Row: 2000m/2:00r + Bike: 5000m/2:00r + Run: 800m/2:00r)`
3. **Layout Improvements**: Parsed structure now flex-grows to match examples height

**Files Changed**:
- `src/components/RWNPlayground.tsx` - Reorganized examples, flex layout

**Result**: ✅ Users can experiment with multi-step, multi-modal workouts

---

#### 6. RWN Specification Updates
**Feature**: Document chained guidance parameters

**Added Section 4.4**:
```markdown
### 4.4 Chaining Guidance Parameters
Multiple guidance parameters can be chained using multiple `@` symbols.

Examples:
- 30:00@UT2@r20 → 30 mins at UT2 pace, holding rate 20
- 5000m@2k+5@r28 → 5k at 2k+5 pace, holding rate 28
- 8x500m/1:00r@1:50@r32 → 500m intervals at 1:50 split and rate 32
```

**Files Changed**:
- `rwn/RWN_spec.md` - Added Section 4.4

**Result**: ✅ Specification now documents chaining syntax like `@UT2@r20`

---

#### 7. Menu & Terminology Updates
**Changes**:
- "Templates" → "Library" (clearer for community templates)
- "Analytics" → "Analysis" (user preference)

**Files Changed**:
- `src/components/Layout.tsx` - Navigation menu updates

**Result**: ✅ Improved terminology consistency

---

### What Worked
- ✅ **Graceful error handling**: Null checks prevent cascading failures
- ✅ **Database triggers**: Automatic maintenance of usage_count and last_used_at
- ✅ **Global templates**: Good for team/coaching platforms
- ✅ **Personal stats**: Users still see their own progress
- ✅ **RWN playground**: Interactive learning for complex workouts

### What Failed / Lessons Learned
- ❌ **MCP Server DDL limitations**: Can't apply migrations via MCP (permission denied)
- 📝 **Lesson**: Some operations require manual SQL execution in Supabase UI
- ❌ **Original stats confusion**: "Templates linked" was ambiguous (now "workouts categorized")
- 📝 **Lesson**: Metrics should be user-centric, not system-centric

### Pending Work
- ⏳ **Migration**: `migration_add_last_used_at.sql` needs manual execution
- ⏳ **Template effectiveness tracking**: Compare progress on same template over time
- ⏳ **Backfill script**: Auto-link entire workout history to templates
- ⏳ **Analytics improvements**: Training zone distribution, volume trends

---

## Phase 1: Foundation & Architecture (Completed)

**Timeline**: Initial development → December 2025  
**Status**: ✅ Complete

### What Was Built
1. **Monorepo Structure**
   - `packages/` organized by concern (auth, functions, ui, shared)
   - `infra/` for database schema and infrastructure
   - `scripts/` for build automation
   - Clear separation of concerns

2. **Database Schema (Multi-Tenant)**
   - Core entities: businesses, profiles, user_business_roles
   - Service business entities: service_items, clients, workers, service_instances
   - Row Level Security (RLS) policies for all tables
   - Audit trail pattern established

3. **Workspace Configuration**
   - TypeScript configured with strict mode
   - pnpm workspace setup
   - Shared tsconfig for consistency

### What Worked
- ✅ Monorepo structure keeps things organized
- ✅ Multi-tenant schema proven in ScheduleBoard v2
- ✅ RLS policies enforce security at database level
- ✅ TypeScript strict mode catches bugs early

### What Failed / Lessons Learned
- ❌ Initial plan for complex generator was over-engineered
- 📝 Lesson: Simpler instruction-driven approach is more maintainable

---

## Phase 2: Authentication System (Completed)

**Timeline**: Early development  
**Status**: ✅ Complete

### What Was Built
1. **Invite-Based Onboarding**
   - `create-invite` edge function: Creates invite records
   - `send-invite-email` edge function: Sends email via Resend
   - `process-invite` edge function: Creates account from invite
   - `get-invite` edge function: Retrieves invite details
   - `delete-user-account` edge function: Account deletion

2. **Email Integration (Resend)**
   - HTML email templates
   - Invite email with direct signup link
   - Verified domain: scheduleboard.co

3. **Role-Based Access**
   - 7-tier role system (USER → OWNER)
   - Enforced via RLS policies
   - Role assignment during invite acceptance

### What Worked
- ✅ Invite flow eliminates manual password setup
- ✅ Resend integration simple and reliable
- ✅ Role-based access clear and enforceable
- ✅ Edge Functions handle business logic securely

### What Failed / Lessons Learned
- ⚠️ Email template styling needs mobile testing
- 📝 Lesson: Always test emails on actual mobile devices
- 📝 Lesson: Edge Functions cold start can be slow (~2s)

---

## Phase 3: Notification System (Completed)

**Timeline**: Mid development  
**Status**: ✅ Complete

### What Was Built
1. **Orchestrator Pattern**
   - `notifications/orchestrator` routes notification requests
   - Determines channel (email, SMS, push) based on preferences
   - Handles retry logic and failure tracking

2. **Email Delivery**
   - `notifications/send-email` handles actual sending
   - Template selection based on notification type
   - HTML + text fallback

3. **Cleanup Job**
   - `notifications/cleanup` removes old notification records
   - Prevents database bloat
   - Runs on scheduled cron

### What Worked
- ✅ Orchestrator pattern allows future SMS/push addition
- ✅ Separation of routing from delivery is clean
- ✅ Cleanup job prevents database bloat

### What Failed / Lessons Learned
- 📝 Lesson: Need better monitoring for failed notifications
- 📝 Lesson: Retry logic should be exponential backoff

---

## Phase 4: Subscription & Payments (Completed)

**Timeline**: Mid development  
**Status**: ✅ Complete

### What Was Built
1. **Stripe Integration**
   - `subscriptions/create-intent` starts checkout
   - `subscriptions/verify-session` confirms payment
   - `subscriptions/stripe-webhooks` handles events
   - `subscriptions/check-status` validates active subscription
   - `subscriptions/manage-tier` updates plan

2. **Tiered Plans**
   - Free tier with limitations
   - Paid tiers with feature unlocks
   - Database fields track subscription status

3. **Webhook Handling**
   - Processes: payment_succeeded, subscription_updated, subscription_cancelled
   - Updates database on subscription changes
   - Idempotent webhook processing

### What Worked
- ✅ Stripe Checkout simplifies payment UI
- ✅ Webhooks keep database in sync
- ✅ Tiered access clear and enforceable
- ✅ Test mode makes development easy

### What Failed / Lessons Learned
- ⚠️ Webhook signature verification critical (security)
- 📝 Lesson: Always verify webhook signatures
- 📝 Lesson: Need clear upgrade prompts in UI

---

## Phase 5: Refactoring to Instruction-Driven (In Progress)

**Timeline**: December 15, 2025  
**Status**: 🚧 In Progress

### What's Being Built
1. **Working Memory Pattern**
   - `working-memoryory/` directory structure
   - Persistent context files (projectBrief, activeContext, etc.)
   - Integration into copilot-instructions.md

2. **Instruction Architecture**
   - Plan to create `.github/instructions/setup/`
   - Pattern documentation in `.github/instructions/patterns/`
   - Workflow templates in `.github/instructions/workflows/`
   - Business type examples

3. **Generator Deprecation**
   - Decision to move away from CLI generator
   - Keep `generator/` as reference for now
   - Focus on instruction-driven workflow

### What's Working
- ✅ Working Memory pattern solves stateless LLM problem
- ✅ Copilot-instructions.md updated with workflow
- ✅ Clear plan for instruction structure

### Current Challenges
- 🤔 Decide fate of `generator/` directory
- 🤔 How tightly to couple with ScheduleBoard v2
- 🤔 Business config: YAML vs markdown instructions

### Next Steps
1. Create `.github/instructions/setup/` structure
2. Write first setup guide (00-project-init.md)
3. Document database patterns
4. Create business type decision tree
5. Fill out remaining Working Memory files

---

## Phase 6: Component Extraction (Not Started)

**Timeline**: TBD  
**Status**: ❌ Not Started

### Planned Work
1. **Extract Core Components from ScheduleBoard v2**
   - Authentication UI components
   - Service item management components
   - Client/worker management components
   - Mobile-optimized input components

2. **Generalize Components**
   - Add BusinessConfig props
   - Make terminology configurable
   - Add feature toggle support

3. **Document Extraction**
   - Map source → template for each component
   - Document generalization decisions
   - Provide usage examples

### Dependencies
- Need Working Memory and instruction architecture complete first
- ScheduleBoard v2 production release should be stable

---

## Phase 7: Example Applications (Not Started)

**Timeline**: TBD  
**Status**: ❌ Not Started

### Planned Work
1. **HVAC Business Example**
   - Full implementation using template
   - Job tracking, technician scheduling
   - Equipment tracking

2. **Cleaning Business Example**
   - Recurring appointments
   - Team management
   - Route optimization

3. **Personal Care Example**
   - Appointment booking
   - Stylist schedules
   - Package/membership management

---

## Abandoned Approaches

### Generator CLI (Abandoned December 2025)
**Why Built**: Thought code generation would be faster  
**Why Abandoned**: Too complex to maintain, instruction-driven is better  
**What We Learned**: Copilot + instructions > custom CLI  
**Code Location**: `generator/` (kept as reference)

---

## Key Metrics & Learnings

### Development Velocity
- **Auth System**: ~3 days including edge functions
- **Notification System**: ~2 days with orchestrator pattern
- **Subscription System**: ~4 days including Stripe integration
- **Working Memory Setup**: ~1 day to establish pattern

### What Accelerates Development
1. ✅ Clear database schema defined upfront (data-first design)
2. ✅ Edge Functions for business logic (keeps frontend simple)
3. ✅ TypeScript strict mode (catches bugs early)
4. ✅ Supabase RLS (security built-in)
5. ✅ Working Memory (persistent context across sessions)

### What Slows Development
1. ⚠️ Over-engineering abstractions before needed (YAGNI violation)
2. ⚠️ Mobile testing on actual devices (necessary but time-consuming)
3. ⚠️ Webhook testing (need to use Stripe CLI or ngrok)
4. ⚠️ Cold start times on Edge Functions (2-3s on first request)

---

## Template for Future Entries

```markdown
## Phase X: [Feature Name] ([Status])

**Timeline**: [Start] → [End]  
**Status**: [Not Started | In Progress | Complete | Abandoned]

### What Was Built
1. **[Component/Feature 1]**
   - [Detail]
   - [Detail]

### What Worked
- ✅ [Success]
- ✅ [Success]

### What Failed / Lessons Learned
- ❌ [Failure]
- 📝 Lesson: [Learning]

### Metrics
- **Time Spent**: [X days/hours]
- **Lines of Code**: [Estimate]
- **Files Changed**: [Count]
```

---

# 🚀 LogbookAnalyzer Project Progress

*Separate from template history above.*

## Phase 1: Core Logic & Analytics (In Progress)

**Status**: 🚧 In Progress

### What Was Built
1.  **Workout Naming Engine**
    -   Canonical naming logic (`750/500/250...`)
    -   **Polish**: Added Fuzzy matching (avg distance), Ladder detection (`v100...1000m`), and Pyramid detection.
    -   **Refinement**: Prioritized Standard Time naming (e.g. `1x30:00`) over distance for single intervals.
    -   Handling of variable intervals and repeating patterns.
    -   Fixes for "Unstructured" misclassification.

2.  **Analytics Foundation**
    -   "Time in Zone" chart using aggregated power buckets (percentages).
    -   `PRList` component for displaying Personal Records.
    -   Raw data parsing for PR detection.

3.  **Sync Reliability**
    -   Retry logic and error handling for 500/CORS errors.
    -   Date handling fixes.

4.  **Guest Mode / Public Demo**
    -   Frontend-only implementation using curated mock data (`demoData.ts`).
    -   Bypassed Supabase calls for `isGuest` users to ensure security and prevent errors.
    -   Implemented in AuthContext, Analytics, Dashboard, and WorkoutDetail.

### Key Learnings
-   **Date Parsing**: Concept2 dates can be tricky; standardized on specific parsing logic.
-   **Interval Detection**: `rest_time` vs `rest_distance` requires careful handling for variable identifiers.





