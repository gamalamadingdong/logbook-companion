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

## Coding Standards
-   **Functional Components**: Use React Functional Components with Hooks.
-   **Strict Types**: No `any`. Define interfaces for all data structures (Workout, User, StrokeData).
-   **Environment Variables**: API Keys/Client IDs must be loaded from `import.meta.env`.
