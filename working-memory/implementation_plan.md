# Implementation Plan: Analytics Enhancements & PR Detection

## Goal Description
Resume work on the "Personal Analytics Enhancements" roadmap. The immediate focus is **Smart PR Detection** and **User Preferences/Tracking**.
The user wants to "Track" specific workouts (e.g., "Speed Pyramid", "4x1000m") and view achievements in their preferred units (Split, Time, Distance).

## User Review Required
> [!NOTE]
> Added **"Tracked Workouts"** feature. This requires schema changes (`user_preferences` or similar) to store the list of patterns a user wants to follow.

## Proposed Changes

### 1. Smart PR & Interval Detection (In Progress)
**Goal**: Automatically surface Personal Bests for standard distances AND benchmark intervals (e.g., 8x500m) by parsing granular `raw_data`.

#### [MODIFY] [prCalculator.ts](file:///c:/Users/samgammon/apps/LogbookAnalyzer/src/utils/prCalculator.ts)
- **Status**: Logic partially implemented (`calculatePRs`).
- **Update**: Ensure `PRRecord` returns data in *all* units if possible (seconds, meters, watts) so UI can toggle display.
- **Refinement**: Improve detection of "Speed Pyramid" or named workouts.

#### [NEW] [PRList.tsx / PRCard.tsx](file:///c:/Users/samgammon/apps/LogbookAnalyzer/src/components/analytics/PRList.tsx)
- Separate "Standard Distances" (2k, 5k, etc.) from "Interval Benchmarks".
- **Tracking UI**: Separate section for "Tracked Workouts" (User's Favorites).
- **Unit Toggle**: Allow viewing as Split (500m), Time, or Watts.

### 2. User Preferences & Tracking (New)
**Goal**: Allow users to "Pin" specific workout types and define their preferred benchmarks.

#### [NEW] [schema] (user_preferences)
- Create `user_preferences` table (or add JSONB to users/profiles):
  - `tracked_patterns`: Array of strings (e.g., `["4x1000m", "Speed Pyramid", "10k"]`).
  - `preferred_units`: `split` | `watts` | `time`.
  - `benchmark_2k`: existing (consolidate here if possible).

#### [MODIFY] [Analytics.tsx](file:///c:/Users/samgammon/apps/LogbookAnalyzer/src/pages/Analytics.tsx)
- Add "Preferences" modal or section.
- Allow toggling "Is Tracked" on a workout detail view? (Maybe v2).
- For now, simple "Manage Tracked Workouts" lists in Settings.

### 3. Shareable Reports (Weekly Postcard) - *Deferred*
### 4. Goal Tracker - *Deferred*

## Verification Plan

### Automated Tests
- Run `scripts/verify_pr_logic.ts` to ensure "Speed Pyramid" and "4x1000m" are correctly identified.

### Manual Verification
1.  **PRs**: Open Analytics. Verify "Distance PRs" are correct.
2.  **Tracking**: Select "4x500m" as a tracked workout. Verify it appears in a special "Tracked Benchmarks" section.
3.  **Units**: Toggle between "Split" and "Watts". Verify display updates.
