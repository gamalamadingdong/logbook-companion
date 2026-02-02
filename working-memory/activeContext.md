# Active Context

## Current Focus
Workout Template Editor and Standardized Naming (RWN).

## Recent Changes
-   **Completed**: Implemented **Workout Template Editor** (`/templates` route, Workouts nav item).
    - `TemplateLibrary.tsx` — Filterable list of templates with Standardized/Needs Structure indicators.
    - `TemplateEditor.tsx` — Modal with structure builder for Steady State, Fixed Interval, Variable workouts.
    - Types include calories, time-only rest (PM5 compliant), optional `target_rate` and `target_pace` guidance.
-   **Completed**: Created `structureAdapter.ts` to convert `workout_structure` JSON → `C2Interval[]` for canonical naming.
-   **Completed**: Editor now uses real `calculateCanonicalName()` for preview consistency.
-   **Completed**: Renamed "Coach Sessions" to **"Live Sessions"** and removed Admin restrictions.
-   **Completed**: Implemented Race Control UI and Set Workout Modal with interval support.
-   **Completed**: Fixed Canonical Workout Naming logic (repeating patterns, variable intervals).
-   **Completed**: Implemented Guest Mode with mock data for safe exploring.

## Immediate Next Steps
1.  **Test Template Editor**: Create/edit templates, verify canonical name generation matches synced logs.
2.  **RWN Spec**: Draft Rowing Workout Notation spec (grammar for `5x500m/1:00r` etc.).
3.  **Goals UI**: Add goal setting UI (Weekly distance & Interval Targets).

## Active Issues
- **Zone Calc Limitation**: `zone_distribution` uses current baseline, not historical fitness.
- **Template Matching**: Need to test matching synced logs to standardized templates.

## Architecture Notes
- **Workout Structure Types**: `SteadyStateStructure`, `IntervalStructure`, `VariableStructure` in `workoutStructure.types.ts`.
- **Adapter Pattern**: `structureToIntervals()` converts template JSON to C2Interval format for consistent naming.
- **Canonical Naming**: Single source of truth via `calculateCanonicalName()` in `prCalculator.ts`.
