# System Patterns

## Architecture
-   **Type**: SPA (Single Page Application)
-   **Framework**: React (Vite)
-   **Language**: TypeScript
-   **State Management**: React Context (for Auth/Global state) + Local Component State (for UI).
-   **Styling**: TailwindCSS.

## Design Patterns
-   **Service Layer**: All API calls (Concept2, Google Sheets) interacting with external services reside in `src/api/`.
-   **Adapters**: Transform API responses into internal TypeScript interfaces immediately upon fetching.
-   **Auth Context**: Centralized provider for managing tokens and user session.

## Coding Standards
-   **Functional Components**: Use React Functional Components with Hooks.
-   **Strict Types**: No `any`. Define interfaces for all data structures (Workout, User, StrokeData).
-   **Environment Variables**: API Keys/Client IDs must be loaded from `import.meta.env`.
