# Active Context

## Current Focus
General Maintenance, Logic Hardening, and Documentation Updates.

## Recent Changes
-   **Completed**: Renamed "Coach Sessions" to **"Live Sessions"** and removed Admin restrictions.
-   **Completed**: Updated "Set Workout" Modal to support **Intervals** (Dist/Time/Rest) and Start Type (Self-Paced/Synchronized).
-   **Completed**: Implemented **Race Control UI** (Set, Go, False Start, Terminate) for synchronized starts.
-   **Completed**: Fixed Canonical Workout Naming logic (repeating patterns, variable intervals).
-   **Completed**: Refactored "Time in Zone" Analytics Chart (buckets & percentages).
-   **Completed**: Implemented `PRList` component and refactored PR detection logic.
-   **Completed**: Updated `README.md` and `START_HERE.md` for AI Agent template documentation.
-   **Completed**: Implemented **Guest Mode / Public Demo** with mock data and Supabase bypass for safe exploring.
-   **Fixed**: Addressed sync retry logic and date handling.

## Immediate Next Steps
1.  **Verify End-to-End Race**: Test full flow with `erg-link` clients (Set -> Go -> Finish -> Upload).
2.  **Goals UI**: Add goal setting UI (Weekly distance & Interval Targets).

## Active Issues
- **Zone Calc Limitation**: Currently `zone_distribution` is calculated during sync using the *current* user baseline. It does not look up historical fitness.
- **Offline Sync**: Verified but needs robust handling for edge cases.

## Architecture Notes
- **Concept2 API**: We sync workouts from the Concept2 Logbook API. Schema definitions in `working-memory/concept2_schema.md`.
- **Analytics**: Moving towards aggregated buckets for more accurate "Time in Zone" analysis.

