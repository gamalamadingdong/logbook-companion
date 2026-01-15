# Active Context

## Current Focus
Smart PR & Interval Detection.

## Recent Changes
-   **Completed**: Better Filtering (Date Pickers) in `Analytics.tsx`.
-   **Recovered**: Context on Training Plan Intelligence, Reports, and Goals.
-   **Plan**: Restored full analytics roadmap.

## Immediate Next Steps
1.  **PR Detection**: Implement `raw_data` parsing in `prDetection.ts`.
2.  **Visuals**: Build `ShareableReport.tsx`.
3.  **Goals**: Add goal setting UI.

## Active Issues

## Architecture Notes
- **Concept2 API**: We sync workouts from the Concept2 Logbook API. Schema definitions in `working-memory/concept2_schema.md`.
- **Zone Calc Limitation**: Currently `zone_distribution` is calculated during sync using the *current* user baseline. It does not look up historical fitness. This means syncing old workouts uses today's fitness, which may be inaccurate. (See Task #25).
