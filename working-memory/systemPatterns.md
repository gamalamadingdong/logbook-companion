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

## Design Patterns
-   **External APIs**: Clients for external services (Concept2, Google Sheets) reside in `src/api/`.
-   **Internal Services**: Business logic and database interactions (Supabase, Workout management) reside in `src/services/`.
-   **Adapters**: Transform API responses into internal TypeScript interfaces immediately upon fetching.
-   **Auth Context**: Centralized provider for managing tokens and user session.

## Coaching Module (`/coaching/*`)
-   **Route gating**: `CoachRoute` component checks `isCoach` from AuthContext (derived from `user_profiles.roles` containing `'coach'`).
-   **Service layer**: `src/services/coaching/coachingService.ts` — full CRUD for 5 Supabase tables (`coaching_athletes`, `coaching_sessions`, `coaching_athlete_notes`, `coaching_erg_scores`, `coaching_boatings`). All with RLS.
-   **Types**: `src/services/coaching/types.ts` — interfaces matching Supabase columns (snake_case, UUID strings, ISO date strings).
-   **Pages**: `src/pages/coaching/` — CoachDashboard, CoachingRoster, CoachingSchedule, CoachingLog, CoachingErgScores, CoachingBoatings.
-   **Pattern**: Initial data fetched via `.then()` in `useEffect`; event handlers use standalone `async` refresh functions (avoids `react-hooks/set-state-in-effect`).

## Knowledge Base (`kb/`)
-   Sub-folders: `coaching-plans/`, `training-plans/`, `technique/`, `physiology/`, `injury-prevention/`, `scores/`
-   Coaching plans are athlete-group-specific (e.g., `novice-8th-boys-spring-2026.md`)
-   Assistant Coach Cue Sheets (`assistant-coach-cue-sheets.md`) — weekly briefings with daily focus tables, common faults, drill descriptions
-   `.optimized.md` variants exist for some files (condensed versions)

## Coding Standards
-   **Functional Components**: Use React Functional Components with Hooks.
-   **Strict Types**: No `any`. Define interfaces for all data structures (Workout, User, StrokeData).
-   **Environment Variables**: API Keys/Client IDs must be loaded from `import.meta.env`.
