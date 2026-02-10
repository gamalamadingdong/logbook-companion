# Implementation Plan: Analytics Enhancements & PR Detection

## Goal Description
Resume work on the "Personal Analytics Enhancements" roadmap. The immediate focus is **Smart PR Detection** and **User Preferences/Tracking**.
The user wants to "Track" specific workouts (e.g., "Speed Pyramid", "4x1000m") and view achievements in their preferred units (Split, Time, Distance).

## User Review Required
> [!NOTE]
> Added **"Tracked Workouts"** feature. This requires schema changes (`user_preferences` or similar) to store the list of patterns a user wants to follow.

## Pass Status

### Pass 1 — Coaching Merge + PR Detection ✅ Complete
**Goal**: Complete CoachingLog merge and surface PRs for standard distances and interval benchmarks with a unit toggle.

#### [DONE] Coaching routes
- `/coaching/*` routing complete (log and live sessions under `/coaching/log` and `/coaching/live`).

#### [DONE] prCalculator.ts
- PR detection for standard distances + interval patterns using `raw_data`.
- Watt/pace/time formatting helpers available for UI toggles.

#### [DONE] PRList.tsx
- Standard distances vs interval benchmarks split.
- Unit toggle (pace/time/watts) and PR cards in the same file.

### Pass 2 — Tracking + Preferences (Next)
**Goal**: Allow users to pin tracked workouts and persist preferred units.

#### [NEW] [schema] (user_preferences)
- Create `user_preferences` table (or add JSONB to users/profiles):
  - `tracked_patterns`: Array of strings (e.g., `["4x1000m", "Speed Pyramid", "10k"]`).
  - `preferred_units`: `split` | `watts` | `time`.
  - `benchmark_2k`: existing (consolidate here if possible).

#### [MODIFY] Analytics settings
- Add a "Tracked Workouts" section and a lightweight preferences editor.

### 3. Shareable Reports (Weekly Postcard) - *Deferred*
### 4. Goal Tracker - *Deferred*

## Verification Plan

### Automated Tests
- Run `scripts/verify_pr_logic.ts` to ensure tracked patterns (e.g., "Speed Pyramid", "4x1000m") are correctly identified.

### Manual Verification
1.  **PRs**: Open Analytics. Verify "Distance PRs" are correct.
2.  **Tracking**: Select "4x500m" as a tracked workout. Verify it appears in a special "Tracked Benchmarks" section.
3.  **Units**: Toggle between "Split" and "Watts". Verify display updates.
