# Manual entry result grid implementation plan

**Goal:** Replace the interval cards with a compact result grid that works on desktop and phones, while preserving the existing LC save and explicit Concept2 publication paths.

**Architecture:** Keep `CompletedWorkoutEntry` as the owner of draft state. Use `SegmentGrid` to render each existing `SegmentForm` once in a responsive grid; retain the form model in `segmentForm.ts`. Reuse `scaffoldSegmentsFromRwn` for planned rows, and keep measured fields blank until entered. Use a small pure reconciliation helper for reapplying a plan without silently discarding matching measurements.

**Tech stack:** React, TypeScript, Tailwind, Vitest.

## Constraints

- Plan targets and measured values remain separate.
- No schema, Edge Function, Concept2 payload, or RWN grammar changes.
- The existing saved result format and publication validation remain compatible.
- Phone rows must not require horizontal scrolling; controls remain keyboard accessible.

## Task 1: Safe RWN row setup

- Add a pure helper beside the entry utilities that builds form rows from a parsed plan and preserves measured values only where the existing row still represents the same role and target.
- Test `8x500m/3:00r` expands to eight Work and seven Rest rows with empty actuals; test preservation for matching rows and explicit replacement detection for changed rows.
- Keep typed RWN separate from the applied plan, and connect the helper to the form's Set up intervals and template actions. If any entered actual would be replaced, show the affected-row count before applying the plan.

## Task 2: Responsive result grid

- Replace the repeated `Card` markup in `SegmentEditor` with `SegmentGrid`, one row per segment, and remove the unused card editor. At desktop width, show columns for row, segment, basis, plan, actual distance, actual time, and details. At phone width, stack actual fields under a compact row heading.
- Keep optional calories, watts, label, and row actions in an expandable details area. Keep Add Work and Add Rest below the grid.
- Render existing per-row errors adjacent to their fields. Preserve row order, copy, move, and remove behavior.

## Task 3: Totals and verification

- Show Work and Rest subtotals separately. For full detail, derive the displayed result totals from measured rows; for partial detail, retain editable session totals.
- Run focused utility tests, TypeScript/build, ESLint on touched files, and a responsive browser check if a usable local browser is available.
- Review the changed UX against the existing form design and the design document, then open a staging PR.
