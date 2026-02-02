# Active Context

## Current Focus
Open Source Preparation & RWN Standardization.

## Recent Changes
-   **Completed**: Implemented **Rowers Workout Notation (RWN)** parser and UI integration.
    - `rwnParser.ts` — Full parser supporting intervals, steady state, variable workouts.
    - `RWNPlayground.tsx` — Interactive validator embedded in documentation.
    - `TemplateEditor.tsx` — "Quick Create" feature for RWN input.
    - **New Syntax**: Relative pace (`@2k+10`), Modalities (`Bike:`, `Ski:`).
-   **Completed**: Moved RWN spec to dedicated `rwn/` directory for potential future extraction.
-   **Completed**: Applied **MIT License** and added copyright notice to UI.
-   **Completed**: Cleaned repo for public release (removed `.agent/`, timestamped schema snapshots).
-   **Completed**: Renamed GitHub repo from `better-training` to `logbook-companion`.
-   **Completed**: Fixed routing error for `/templates` and Concept2 token refresh infinite loop.

## Immediate Next Steps
1.  **Prepare erg-link for public release**: Apply MIT license, clean repo structure.
2.  **Community Outreach**: Post RWN spec to r/Rowing and Concept2 forums for feedback.
3.  **Goals UI**: Add goal setting UI (Weekly distance & Interval Targets).

## Active Issues
- **Zone Calc Limitation**: `zone_distribution` uses current baseline, not historical fitness.
- **Template Matching**: Need to test matching synced logs to standardized templates.

## Architecture Notes
- **RWN Directory**: `rwn/` contains spec and may be extracted to standalone repo.
- **Workout Structure Types**: `SteadyStateStructure`, `IntervalStructure`, `VariableStructure` in `workoutStructure.types.ts`.
- **Adapter Pattern**: `structureToIntervals()` converts template JSON to C2Interval format for consistent naming.
- **Canonical Naming**: Single source of truth via `calculateCanonicalName()` in `prCalculator.ts`.
