# Active Context

## Current Focus
General Maintenance, Logic Hardening, and Documentation Updates.

## Recent Changes
-   **Completed**: Fixed Canonical Workout Naming logic (repeating patterns, variable intervals).
-   **Completed**: Refactored "Time in Zone" Analytics Chart (buckets & percentages).
-   **Completed**: Implemented `PRList` component and refactored PR detection logic.
-   **Completed**: Updated `README.md` and `START_HERE.md` for AI Agent template documentation.
-   **Fixed**: Addressed sync retry logic and date handling.

## Immediate Next Steps
1.  **Public Demo / Guest Mode**: distinct from "ShareableReport", this allows non-users to try the app.
2.  **Visuals**: Build `ShareableReport.tsx`.
3.  **Goals**: Add goal setting UI.

## Active Issues
- **Zone Calc Limitation**: Currently `zone_distribution` is calculated during sync using the *current* user baseline. It does not look up historical fitness.
- **Offline Sync**: Verified but needs robust handling for edge cases.

## Architecture Notes
- **Concept2 API**: We sync workouts from the Concept2 Logbook API. Schema definitions in `working-memory/concept2_schema.md`.
- **Analytics**: Moving towards aggregated buckets for more accurate "Time in Zone" analysis.

