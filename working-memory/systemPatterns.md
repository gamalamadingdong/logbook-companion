# System Patterns

## Architecture
-   **Type**: SPA (Single Page Application)
-   **Framework**: React (Vite)
-   **Language**: TypeScript
-   **State Management**: React Context (for Auth/Global state) + Local Component State (for UI).
-   **Styling**: TailwindCSS.

## RWN Architecture ("RWN Trinity")
-   **Philosophy**: RWN (Rowing Workout Notation) is the "DNA" of a workout.
-   **The Trinity**:
    1.  **DNA (RWN)**: The source of truth string (e.g., `4x500m/1:00r`).
    2.  **Body (Structure)**: The JSON object for machine use (`WorkoutStructure`).
    3.  **Name (Canonical)**: The deterministic label derived from structure (`4x 500m`).
-   **Data Flow**:
    -   **Templates**: Defined by RWN -> Structure -> Name.
    -   **Logs**: Raw Data -> (Auto-Detect OR Manual Override RWN) -> Structure -> Name.
-   Concept2's continuous workout mode takes precedence over split/interval/stroke inference. `FixedDistanceSplits` and `FixedTimeSplits` are continuous pieces; `workout.splits` records measurement detail, not repeated efforts. Actual interval modes retain their interval structure even with zero rest.
-   Workout detail responses expose `db_id` for the LC `workout_logs` UUID while preserving Concept2 `id`. Link/unlink operations use `db_id`; routes may contain either identifier, resolved once by `getWorkoutDetail`.
-   `supabase/functions/_shared/concept2-workout-naming.ts` provides the continuous naming rule shared by client and sync worker. Manual RWN retains priority; name maintenance must update signatures consistently and preserve custom notes.

## Design Patterns
-   **External APIs**: Clients for external services (Concept2, Google Sheets) reside in `src/api/`.
-   **Internal Services**: Business logic and database interactions (Supabase, Workout management) reside in `src/services/`.
-   **Adapters**: Transform API responses into internal TypeScript interfaces immediately upon fetching.
-   **Auth Context**: Centralized provider for managing tokens and user session.

## Team Management (`/team-management/*`)

- **Routes and gate**: `/team-management/*` is the coaching workspace; `/coaching/*` is a legacy redirect. `CoachRoute` uses AuthContext `isCoach`, derived from direct coach/coxswain membership, organization membership, or an approved coaching request. It is not simply a profile role check. The frontend gate does not establish permission for every database operation.
- **Access versus roster**: `organization_members` and `team_members` link accounts to access roles. `athletes` contains coaching profiles with optional account links; `team_athletes` carries team-specific roster status, squad, and performance tier. Do not treat account membership and roster membership as interchangeable.
- **Scope**: `getTeamsForUser()` merges direct and organization-derived access. `CoachingContext` exposes active team, organization, grouped teams, and a separate team filter. User-specific local storage preserves selection. `useScopedTeamScope` resolves one-team or current-organization scope. The older `getTeamForUser()` helper is not the primary multi-team context path.
- **Scope contract**: Labeled Club/Team selects drive the shared context. Specific team selection synchronizes `teamId` and `filterTeamId`; `switchOrganization` opens All Teams only for clubs with multiple teams. Restore only same-club saved filters. The provider is keyed by account to isolate loads. Roster add/import requires a destination in All Teams, and team settings requires a selected team. Roster/settings content is keyed by scope while navigation remains mounted. Other coach pages retain their existing organization-wide queries; check their actual caller and RLS before assuming uniform All Teams behavior.
- **Services and types**: `src/services/coaching/coachingService.ts` and `types.ts` own coaching operations and contracts. Team-scoped, organization-scoped, and athlete/account-scoped queries coexist; not all queries use a single team filter. `src/hooks/useCoachingContext.ts` is a re-export shim for the shared provider.
- **Permissions**: Database policies are authoritative and operation-specific. Coach/coxswain/member UI descriptions are not a uniform CRUD matrix. Organization-derived coach access and direct membership can differ under existing policies. Verify the relevant policy/helper for the operation.
- **Lifecycle caveat**: Join/add account linking, roster transfer, account leave/removal, and global athlete deletion are distinct operations. Product direction is one active coached roster and coach-defined squads; enforcement and lifecycle details remain to be designed. Preserve historical records when designing lifecycle changes; see the baseline before implementation.
- **Squads**: Free-form team-specific text on `team_athletes`, distinct from performance tier and benchmark-derived erg tiers.
- **Annual roster seasons**: `team_seasons` and `team_season_athletes` hold team-owned annual contexts and roster snapshots; `/team-management/seasons` owns historical selection. Other coaching pages retain their actual existing filters. `teamSeasonService.ts` validates reads against generated DB contracts. Account links stay optional.
- **Season transitions**: Coach-only RPCs serialize on the team row. Draft preparation leaves the operational roster unchanged; explicit activation updates `team_athletes` and starts eligibility enforcement. Pending work blocks close/first adoption; harmless result corrections/completion remain permitted after archive. Operational roster and identity edits update active snapshots only. Archived snapshots protect destructive athlete/team deletion. Do not bypass these rules through direct seasonal writes or account reinvitation.
- **Schedule and lineups**: `CoachingSchedule` is the daily practice/report workflow. `CoachingBoatings` supplies reusable lineups, boat/history tools, and session references. Practice crew snapshots preserve historical names/seats.
- **Assignments and logs**: Group assignments fan out per-athlete daily rows. Coaching results, coaching erg scores, and personal workout logs are separate stores; automatic completion does not imply full result propagation. Team training-block URLs currently redirect; retained team-context block code is not a complete team-block assignment workflow.
- **Review baseline**: [Team management current state](../docs/team-management-current-state.md) records the November 13 code/docs and read-only policy review, concrete integration gaps, and verification limits. Follow the [coach scope receipt](../docs/superpowers/plans/2026-11-13-coach-scope.md) for subsequent UX changes; membership lifecycle details remain to be decided.

## Knowledge Base (`kb/`)
-   Sub-folders: `coaching-plans/`, `training-plans/`, `technique/`, `physiology/`, `injury-prevention/`, `scores/`
-   Coaching plans are athlete-group-specific (e.g., `novice-8th-boys-spring-2026.md`)
-   Assistant Coach Cue Sheets (`assistant-coach-cue-sheets.md`) — weekly briefings with daily focus tables, common faults, drill descriptions
-   `.optimized.md` variants exist for some files (condensed versions)

## Coding Standards
-   **Functional Components**: Use React Functional Components with Hooks.
-   **Strict Types**: No `any`. Define interfaces for all data structures (Workout, User, StrokeData).
-   **Environment Variables**: API Keys/Client IDs must be loaded from `import.meta.env`.

## Content Search
- `src/search/` owns typed result groups, literal/multi-term filtering, ranking, async cancellation, owner-bound queries, and active-team queries. The sidebar palette uses cmdk inside the shared Modal; a mobile header button opens the same dialog.
- Never reuse results across query/user/team keys. Group failures remain independent. Queries are bounded and return a refinement hint when truncated.
- Shared team workouts are distinct from personally owned daily assignments: coach fanout can leave `daily_workout_assignments.user_id` null. Search uses permitted shared group rows and labels them as team workouts, with owner-specific rows taking precedence.
- `/training-block?enrollment=...&date=...&session=...` validates ownership and selects a planned session without activation writes. `/library/strength-mobility?template=...` reveals the selected support template. Member `/team/search/:kind/:id` loaders repeat owner/team/org restrictions.

## Manual template history linking

- `workoutIdentity.ts` is the conservative full-structure equivalence used for optional historical linking. Canonical shorthand is not safe for this purpose: different pyramids can share a display name.
- `templateLinkingService.ts` previews owner-only unlinked rows with UUID cursor pagination and narrow structure JSON. Save the current workout first, then use owner/previous-link/updated-at compare-and-set guards for history. Preserve confirmed scope and report partial saves/skips; never silently replace existing historical links.
