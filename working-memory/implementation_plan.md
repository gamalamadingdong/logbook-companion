# Implementation Plan: Power Profile Feature

> Last updated: 2026-02-12
> KB reference: `kb/physiology/power-duration-curve.md`

## Goal Description

Build a **Power Profile** — a coaching-quality analytics feature that plots an athlete's best sustainable power across standard rowing distances, classifies their physiological profile, identifies training gaps, and prescribes corrective work.

This goes beyond "show a graph." The feature answers: **What should I train next, and why?**

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│  Power Profile Page (new tab in Analytics)            │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Layer 1: Power-Duration Chart                  │  │
│  │  (Recharts AreaChart — watts vs distance)       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Layer 2: Analysis Cards                        │  │
│  │  • 2k-relative ratios table                     │  │
│  │  • Gap detection ("You need a 5k test")         │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Layer 3: Profile Classification                │  │
│  │  • Badge: Sprinter / Diesel / Threshold Gap /   │  │
│  │    Balanced                                     │  │
│  │  • Plain-English explanation + what it means    │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Layer 4: Prescriptions                         │  │
│  │  • Zone to target + suggested workouts          │  │
│  │  • Link to template library if applicable       │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### Data Flow

```
Synced Workouts (workout_logs)
    ↓
extractBestEfforts()  ← scans whole workouts, interval splits, session averages
    ↓
PowerCurvePoint[]  (distance, watts, pace, date, workoutId, source)
    ↓
computePowerProfile()  ← matches to 11 anchor points, computes ratios
    ↓
PowerProfile  { points[], ratios[], profileType, gaps[], prescriptions[] }
    ↓
UI Components  (chart, analysis cards, badge, prescriptions)
```

---

## Phase 1: MVP — Core Feature (Target: Sprint 5)

### 1.1 Shared Utility Consolidation

**Problem**: `paceToWatts()` is duplicated in 5 files with subtly different signatures (see Regression Risk 1-2).

**Step A — Baseline tests FIRST** (before changing anything):

#### [NEW] `tests/utils/paceCalculator.test.ts`
- Lock current behavior: `calculateWattsFromSplit(120)` → expected watts
- Lock: `calculateSplitFromWatts(200)` → expected split

#### [NEW] `tests/utils/powerBucketing.test.ts`
- Lock: `paceToWatts(1200)` → expected watts (decisecond input!)
- Lock: `calculatePowerBuckets()` with mock strokes → expected buckets

#### [NEW] `tests/utils/prCalculator.test.ts`
- Lock: `calculateWatts(120)` → expected integer watts
- Lock: PR detection on known mock workouts

**Step B — Consolidate:**

#### [MODIFY] `src/utils/paceCalculator.ts`
- This is the single canonical home for `paceToWatts()` and `wattsToPace()`.
- Export `calculateWattsFromSplit(splitSeconds: number): number` (raw float, no rounding).
- Export `calculateSplitFromWatts(watts: number): number` (inverse).

#### [MODIFY] `src/utils/powerBucketing.ts`
- Remove local `paceToWatts()`.
- Import `calculateWattsFromSplit` from `paceCalculator.ts`.
- **CRITICAL**: Call site changes to `calculateWattsFromSplit(stroke.p / 10)` — the `/10` compensates for decisecond input format. This is where the C2 API quirk is handled.

#### [MODIFY] `src/utils/prCalculator.ts`
- Remove local watts formula.
- Import `calculateWattsFromSplit` from `paceCalculator.ts`.
- **Keep `calculateWatts()` as a rounding wrapper**: `export const calculateWatts = (pace: number) => Math.round(calculateWattsFromSplit(pace))`. Preserves integer display for all 6 downstream consumers (PRList, GoalProgressWidget, GoalsManager, WorkoutDetail, prDetection, formatWatts).

#### [MODIFY] `src/utils/zones.ts`
- Remove local `splitToWatts()`. Import from `paceCalculator.ts`.

#### [OPTIONAL] `src/pages/Analytics.tsx` + 3 other files
- Replace inline `2.8 / Math.pow(...)` with `calculateWattsFromSplit()` import (4 instances in Analytics, 2 in WeekAtAGlance, 2 in ZonePaceTrend). Low risk, high maintainability.

**Step C — Verify**: Run baseline tests again. Must all pass. Run `tsc --noEmit` + `vite build`.

### 1.2 Extend PR/Anchor Points

#### [MODIFY] `src/utils/prCalculator.ts`

**`PR_DISTANCES` stays unchanged** — 8 distance-based entries. This avoids breaking `calculatePRs()` distance-matching logic and `Preferences.tsx` which hardcodes `type: 'Distance'` on all entries (see Regression Risk 3).

Add a **separate** array for time-based tests:

```typescript
// Existing — NO CHANGES
export const PR_DISTANCES = [
    { meters: 500, label: '500m', shortLabel: '500' },
    { meters: 1000, label: '1k', shortLabel: '1k' },
    { meters: 2000, label: '2k', shortLabel: '2k' },
    { meters: 5000, label: '5k', shortLabel: '5k' },
    { meters: 6000, label: '6k', shortLabel: '6k' },
    { meters: 10000, label: '10k', shortLabel: '10k' },
    { meters: 21097, label: 'Half Marathon', shortLabel: 'HM' },
    { meters: 42195, label: 'Marathon', shortLabel: 'FM' },
];

// NEW — time-based standard tests (distance varies per athlete)
export const TIME_BASED_TESTS = [
    { seconds: 60, label: '1:00 Test', shortLabel: '1:00' },
    { seconds: 1800, label: '30:00 Test', shortLabel: '30:00' },
];
```

**`calculatePRs()` is NOT modified** — it continues to handle distance-based PRs only. Time-based test detection lives in the new `powerProfile.ts` module where it belongs.

Add `watts` field to `PRRecord` (additive, non-breaking — see Regression Risk 4):
```typescript
export interface PRRecord {
    // ...existing fields
    watts: number;        // NEW — computed from pace
    isTimeBased?: boolean; // NEW — true for 1:00, 30:00 tests
}
```

### 1.3 Power Profile Engine

#### [NEW] `src/utils/powerProfile.ts`

Core computation module. No UI dependencies.

```typescript
export interface PowerCurvePoint {
    distance: number;         // meters actually covered
    watts: number;
    pace: number;             // seconds per 500m
    date: string;
    workoutId: string;
    source: 'whole_workout' | 'interval_split' | 'interval_session' | 'time_test' | 'manual';
    label: string;            // e.g. "2k", "1:00 Test", "Max Watts"
    anchorKey?: string;       // maps to standard anchor (e.g. "2k", "HM"), null if non-standard
}

export interface PowerRatio {
    anchorKey: string;        // e.g. "500m", "5k"
    label: string;
    actualWatts: number;
    actualPercent: number;    // % of 2k watts
    expectedLow: number;     // expected range low %
    expectedHigh: number;    // expected range high %
    status: 'above' | 'within' | 'below';
}

export type ProfileType = 'sprinter' | 'diesel' | 'threshold_gap' | 'balanced' | 'insufficient_data';

export interface ProfileGap {
    anchorKey: string;
    label: string;
    message: string;          // "Row a standalone 5k to complete your threshold profile"
}

export interface TrainingPrescription {
    zone: string;
    rationale: string;
    suggestedWorkouts: string[];
}

export interface PowerProfile {
    points: PowerCurvePoint[];         // all data points (standard + non-standard)
    anchor2kWatts: number | null;      // the 2k anchor value
    ratios: PowerRatio[];              // 2k-relative analysis for each anchor
    profileType: ProfileType;
    profileDescription: string;        // plain-English explanation
    gaps: ProfileGap[];                // missing test data
    prescriptions: TrainingPrescription[];
    maxWatts: number | null;           // manual entry or suggested
    dataCompleteness: number;          // 0-1 score (how many of 11 anchors have data)
}
```

**Key functions:**

```typescript
/**
 * Extract the best-effort data point for every standard distance + time test
 * from the user's synced workouts. Also includes ALL non-standard distances.
 */
export function extractBestEfforts(
    workouts: C2ResultDetail[],
    manualMaxWatts?: number
): PowerCurvePoint[]

/**
 * Compute the full power profile from best efforts.
 * Requires a 2k data point to function (returns profileType='insufficient_data' without one).
 */
export function computePowerProfile(
    points: PowerCurvePoint[],
    anchor2kWatts?: number  // fallback: pull from user_baseline_metrics or profile
): PowerProfile

/**
 * Classify profile type from ratios.
 */
function classifyProfile(ratios: PowerRatio[]): {
    type: ProfileType;
    description: string;
}

/**
 * Generate training prescriptions based on profile type and gaps.
 */
function generatePrescriptions(
    profileType: ProfileType,
    ratios: PowerRatio[],
    gaps: ProfileGap[]
): TrainingPrescription[]
```

**Expected 2k-relative ratios** (from KB):

```typescript
const EXPECTED_RATIOS: Record<string, { low: number; high: number }> = {
    'max_watts': { low: 2.00, high: 2.50 },
    '1:00':      { low: 1.45, high: 1.60 },
    '500m':      { low: 1.30, high: 1.40 },
    '1k':        { low: 1.15, high: 1.20 },
    '2k':        { low: 1.00, high: 1.00 },
    '5k':        { low: 0.80, high: 0.85 },
    '6k':        { low: 0.75, high: 0.80 },
    '30:00':     { low: 0.72, high: 0.78 },
    '10k':       { low: 0.70, high: 0.75 },
    'HM':        { low: 0.65, high: 0.70 },
    'FM':        { low: 0.60, high: 0.65 },
};
```

**Profile classification logic:**

```typescript
function classifyProfile(ratios: PowerRatio[]): { type: ProfileType; description: string } {
    const shortAnchors = ['max_watts', '1:00', '500m', '1k'];
    const longAnchors = ['5k', '6k', '30:00', '10k', 'HM', 'FM'];
    const midAnchors = ['5k', '6k'];

    const shortAbove = ratios.filter(r => shortAnchors.includes(r.anchorKey) && r.status === 'above').length;
    const shortBelow = ratios.filter(r => shortAnchors.includes(r.anchorKey) && r.status === 'below').length;
    const longAbove = ratios.filter(r => longAnchors.includes(r.anchorKey) && r.status === 'above').length;
    const longBelow = ratios.filter(r => longAnchors.includes(r.anchorKey) && r.status === 'below').length;
    const midBelow = ratios.filter(r => midAnchors.includes(r.anchorKey) && r.status === 'below').length;

    if (shortAbove >= 2 && longBelow >= 2) {
        return { type: 'sprinter', description: '...' };
    }
    if (longAbove >= 2 && shortBelow >= 2) {
        return { type: 'diesel', description: '...' };
    }
    if (midBelow >= 2 && shortAbove >= 1 && longAbove >= 1) {
        return { type: 'threshold_gap', description: '...' };
    }
    return { type: 'balanced', description: '...' };
}
```

### 1.4 Max Watts Handling

#### [MODIFY] `src/services/profileService.ts` (or equivalent)

Add `max_watts` field to user profile storage. Two sources:

1. **Manual entry**: User inputs their known max watts via a settings field.
2. **Auto-suggestion**: Scan all stroke data, find the single highest `p` value (converted to watts). Surface as suggestion: *"We found 487W in your 2k on Jan 15 — is this close to your max?"*

#### Schema consideration
- Add `max_watts` column to `user_profiles` table (integer, nullable).
- Migration: `ALTER TABLE user_profiles ADD COLUMN max_watts integer;`

### 1.5 Chart Component

#### [NEW] `src/components/analytics/PowerProfileChart.tsx`

Recharts `AreaChart` (or `ComposedChart`) with:

- **X-axis**: Hybrid distance axis (log scale or custom ticks)
  - Standard distances as labeled gridlines/reference lines: 500m, 1k, 2k, 5k, 6k, 10k, HM, FM
  - All actual data points plotted at their true distance (including non-standard)
  - Time-based tests (1:00, 30:00) plotted at the distance actually covered
- **Y-axis (left)**: Watts
- **Y-axis (right)**: Pace (500m split) — derived, not separate data
- **Area fill**: Gradient under the curve (emerald/green tone to match app theme)
- **Data points**: Dots at each anchor, larger for standard distances, smaller for non-standard
- **Tooltips**: Show watts, pace, date achieved, workout link
- **Expected range band**: Light shaded region showing the expected ratio range (requires 2k anchor)

**Not in Phase 1**: Date filtering, overlay comparison, animation.

### 1.6 Analysis Panel

#### [NEW] `src/components/analytics/PowerProfileAnalysis.tsx`

Below the chart. Contains:

1. **Ratios Table**: For each anchor point with data:
   | Distance | Watts | % of 2k | Expected | Status |
   Shows green/yellow/red status indicator.

2. **Profile Badge**: Large card showing:
   - Profile type icon + label (e.g. 🏎️ Sprinter)
   - 2–3 sentence description of what it means
   - "What this means for your 2k" callout

3. **Gap Detection**: Cards for missing anchor points:
   - "You haven't done a standalone 5k yet. Row one to understand your threshold."
   - "Missing sprint data — try 8x500m or a standalone 500m test."

4. **Prescriptions**: Training recommendations:
   - Target zone + rationale
   - 2–3 suggested workouts per zone
   - Link to template library if matching templates exist

### 1.7 Integration

#### [MODIFY] `src/pages/Analytics.tsx`

Add a "Power Profile" tab alongside existing analytics views.

- Tab triggers data computation (`extractBestEfforts` + `computePowerProfile`)
- If no 2k data exists, show onboarding: "Row a 2k test to unlock your Power Profile"
- If data exists, render chart + analysis panel

---

## Phase 2: Refinements (Sprint 6)

### 2.1 Date Range Filtering
- **Filter bar**: All Time | Last 90 Days | Last 30 Days | Custom Range
- **Overlay mode**: Show "All Time best" as faded line behind filtered view
- Useful for tracking progress: "My 90-day curve vs all-time"

### 2.2 Test vs Training Filter
- Toggle: "All Efforts" vs "Tests Only"
- "Tests Only" filters to: standalone standard distance pieces, known benchmark patterns, AT+ zone workouts
- The gap between the two curves is itself informative (training vs capacity)

### 2.3 Sliding Window Analysis (Advanced)
- Use per-stroke data to find best-effort power at arbitrary durations:
  - Sliding window over cumulative time/distance in stroke data
  - E.g., find the best 5-minute power buried inside a 30-minute piece
- This fills in non-standard distances and makes the curve truly continuous
- Computationally intensive — run in a web worker or pre-compute server-side

### 2.4 Template Library Integration
- Prescriptions link directly to matching templates in the user's library
- E.g., "Sprinter profile → UT2 volume → [60:00 Steady State Template]"
- "Create Template" shortcut if no match exists

### 2.5 Gap Detection → Quick Actions
- Gap cards include "Log This Test" button → deep link to C2 logbook with pre-filled workout type
- Or "Add to Training Plan" if coaching module is active

---

## Phase 3: Coaching & Social (Sprint 7+)

### 3.1 Coaching Integration
- Coach view: compare athlete profiles side by side
- Overlay 2–3 athletes' curves on the same chart
- Identify which athletes need different training emphasis
- Link prescriptions to team training plans

### 3.2 Historical Animation
- "Play" button slides through time: watch the curve rise/shift over months
- Shows training impact over time — very motivating

### 3.3 PR Alerts
- When a synced workout creates a new point on the power curve: toast notification
- "New 5k best! 185W (was 178W) — profile updated"

### 3.4 Materialized Data Table
- Create `power_curve_points` table in Supabase for pre-computed curve data
- Avoids re-scanning all workouts on every page load
- Refresh on sync + manual recalculate button
- Schema:
  ```sql
  CREATE TABLE power_curve_points (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES auth.users(id),
      anchor_key text,          -- '2k', 'HM', null for non-standard
      distance_meters integer,
      watts numeric,
      pace_500m numeric,
      achieved_at timestamptz,
      workout_id text,
      source text,              -- 'whole_workout', 'interval_split', etc.
      created_at timestamptz DEFAULT now(),
      UNIQUE(user_id, anchor_key)
  );
  ```

---

## File Manifest

| Phase | Action | File | Description |
|---|---|---|---|
| 1.1A | NEW | `tests/utils/paceCalculator.test.ts` | Baseline tests — lock current watts/split behavior |
| 1.1A | NEW | `tests/utils/powerBucketing.test.ts` | Baseline tests — lock decisecond input + bucket output |
| 1.1A | NEW | `tests/utils/prCalculator.test.ts` | Baseline tests — lock PR detection + `calculateWatts` rounding |
| 1.1B | MODIFY | `src/utils/paceCalculator.ts` | Canonical `calculateWattsFromSplit()` / `calculateSplitFromWatts()` |
| 1.1B | MODIFY | `src/utils/powerBucketing.ts` | Remove duplicate, import from paceCalculator, add `/10` at call site |
| 1.1B | MODIFY | `src/utils/prCalculator.ts` | Remove duplicate, keep `calculateWatts()` as rounding wrapper |
| 1.1B | MODIFY | `src/utils/zones.ts` | Remove `splitToWatts()`, import from paceCalculator |
| 1.2 | MODIFY | `src/utils/prCalculator.ts` | Add `TIME_BASED_TESTS` (separate array), add `watts` to `PRRecord` |
| 1.3 | NEW | `src/utils/powerProfile.ts` | Core engine: `extractBestEfforts()`, `computePowerProfile()`, classification, prescriptions |
| 1.3 | NEW | `tests/utils/powerProfile.test.ts` | Full test suite for profile engine |
| 1.4 | MODIFY | Profile service / DB | Add `max_watts` to user profile |
| 1.5 | NEW | `src/components/analytics/PowerProfileChart.tsx` | Recharts power-duration curve chart |
| 1.6 | NEW | `src/components/analytics/PowerProfileAnalysis.tsx` | Ratios table, profile badge, gaps, prescriptions |
| 1.7 | MODIFY | `src/pages/Analytics.tsx` | Add "Power Profile" tab (minimal — delegates to PowerProfile components) |
| 2.1 | MODIFY | `PowerProfileChart.tsx` | Date range filter bar + overlay |
| 2.2 | MODIFY | `powerProfile.ts` | Test vs training effort classification |
| 2.3 | NEW | `src/utils/slidingWindowPower.ts` | Stroke-level best-effort extraction |
| 2.4 | MODIFY | `PowerProfileAnalysis.tsx` | Template library links in prescriptions |
| 3.1 | NEW | `src/components/coaching/AthleteProfileComparison.tsx` | Multi-athlete overlay chart |
| 3.4 | NEW | DB migration | `power_curve_points` table |

---

## Verification Plan

### Phase 1 Verification

**Unit Tests** (`tests/utils/powerProfile.test.ts`):
- `extractBestEfforts()` with mock workouts at standard distances → returns correct best watts
- `extractBestEfforts()` with interval workouts → picks best split, not session average
- `computePowerProfile()` with known 2k anchor → ratios match expected ranges
- `classifyProfile()` returns `'sprinter'` when short distances are above expected + long below
- `classifyProfile()` returns `'diesel'` for inverse pattern
- `classifyProfile()` returns `'threshold_gap'` when mid-range dips
- `classifyProfile()` returns `'balanced'` when all within range
- `classifyProfile()` returns `'insufficient_data'` with < 3 anchor points
- Gap detection identifies missing anchor points correctly

**Manual Verification**:
1. Open Analytics → Power Profile tab
2. Verify chart renders with correct data points at standard distances
3. Verify non-standard distance workouts appear on the curve (not just gridline distances)
4. Verify 2k-relative ratios table shows correct percentages
5. Verify profile badge classification makes sense for known test data
6. Verify gap cards appear for distances without data
7. Verify prescriptions align with profile type
8. Test with no 2k data → should show onboarding message
9. Test with only 1–2 data points → should show `insufficient_data` with encouragement

### Phase 2 Verification
- Date filter: verify curve changes when toggling between 30/90/All
- Test vs Training: verify a deliberate UT2 30-minute piece is excluded from "Tests Only"
- Overlay: verify all-time faded line appears behind filtered curve

---

## Regression Risk Assessment

### Risk 1: `paceToWatts` Input Format Mismatch — **CRITICAL**

**The problem**: There are 5 separate watts↔pace implementations across the codebase. They take **different input formats**:

| File | Function | Input | Rounding |
|---|---|---|---|
| `paceCalculator.ts` | `calculateWattsFromSplit(splitSeconds)` | seconds/500m (e.g. `117.9`) | No rounding (raw float) |
| `powerBucketing.ts` | `paceToWatts(paceVal)` | **deciseconds/500m** (e.g. `1179`) | `Math.round()` |
| `prCalculator.ts` | `calculateWatts(paceSeconds)` | seconds/500m | `Math.round()` |
| `zones.ts` | `splitToWatts(splitSeconds)` | seconds/500m | No rounding |
| `Analytics.tsx` + 3 others | Inline `2.8 / Math.pow(...)` | seconds/500m | Varies |

`powerBucketing.ts::paceToWatts()` does `paceVal / 10` internally because stroke data `stroke.p` is in **deciseconds** (C2 API quirk: values >300 are deciseconds). If we replace it with `calculateWattsFromSplit()` from paceCalculator (which expects seconds), **every power bucket calculation silently produces wrong values** — affecting C2 sync and power distribution charts.

**Mitigation**:
1. The consolidated function in `paceCalculator.ts` accepts **seconds** (the sane unit).
2. In `powerBucketing.ts`, the call site changes from `paceToWatts(stroke.p)` → `calculateWattsFromSplit(stroke.p / 10)`. The `/10` conversion stays at the call site where the data format is understood.
3. Add a **unit test** specifically for this: `paceToWatts(1179 deciseconds) === calculateWattsFromSplit(117.9 seconds)`. If these don't match, the consolidation is wrong.
4. Also consolidate `zones.ts::splitToWatts()` at the same time (identical formula, one less duplicate to maintain).

**Verification**: After consolidation, run a C2 sync on a known workout and compare the power distribution buckets before vs after. They must be identical.

### Risk 2: `calculateWatts()` Rounding Behavior — **MEDIUM**

**The problem**: `prCalculator.ts::calculateWatts()` rounds to integer. `paceCalculator.ts::calculateWattsFromSplit()` does not. Six consumers display watts to users via `calculateWatts()`:
- `PRList.tsx` (PR display)
- `GoalProgressWidget.tsx` (goal tracking)
- `GoalsManager.tsx` (goal creation)
- `WorkoutDetail.tsx` (workout page)
- `prDetection.ts` (re-export layer)
- `formatWatts()` in prCalculator.ts

If the consolidated function stops rounding, users will see `"183.47W"` instead of `"183W"` everywhere.

**Mitigation**:
1. Keep `calculateWatts()` as a **display-oriented wrapper** that calls the canonical function + rounds: `export const calculateWatts = (pace: number) => Math.round(calculateWattsFromSplit(pace))`.
2. New power profile code uses the raw (unrounded) canonical function internally, only rounding at display boundaries.
3. Existing consumers continue to import `calculateWatts` unchanged — zero breakage.

### Risk 3: `PR_DISTANCES` Extension Breaks Distance-Matching Logic — **HIGH**

**The problem**: `calculatePRs()` matches workouts to standard distances using `Math.abs(totalDistance - stdDist.meters) / stdDist.meters < 0.01` (1% tolerance on distance). Time-based tests (1:00, 30:00) have no fixed distance — a 30-minute test could cover 7,500–8,500m depending on the athlete.

**Consumers affected**:
- `Preferences.tsx` maps `PR_DISTANCES` with hardcoded `type: 'Distance'`. Time-based tests would be mislabeled.
- `calculatePRs()` internal iteration would try to distance-match time-based tests and fail.

**Mitigation**:
1. **Do NOT add time-based tests to `PR_DISTANCES`**. Keep them in a separate `TIME_BASED_TESTS` array (as proposed in plan).
2. `extractBestEfforts()` (new power profile code) handles time-based matching with its own duration-based logic: `Math.abs(totalDuration - test.seconds) / test.seconds < 0.03` (3% tolerance).
3. `Preferences.tsx` remains untouched — it only sees `PR_DISTANCES` (distance-based).
4. The existing `calculatePRs()` loop is unchanged — no regression there.

### Risk 4: `prDetection.ts` Re-Export Layer — **MEDIUM**

**The problem**: `prDetection.ts` is a facade that re-exports `{ calculatePRs, PR_DISTANCES, BENCHMARK_PATTERNS, formatTime, formatPace, calculateWatts, formatWatts, type PRRecord }` from `prCalculator.ts`. Five components import via this layer. If `prCalculator.ts` renames or changes signatures, the re-exports silently break consumers.

**Consumers**:
- `PRList.tsx` → `calculateWatts`, `formatTime`, `formatPace`, `formatWatts`, `PRRecord`
- `GoalProgressWidget.tsx` → `fetchUserPRs`, `PRRecord`
- `Preferences.tsx` → `fetchUserPRs`
- `WorkoutComparison.tsx` → `formatPace`
- `useConcept2Sync.ts` → `saveFilteredPRs`

**Mitigation**:
1. Adding `watts` to `PRRecord` is additive — no existing field changes, no re-export breaks.
2. `calculateWatts` keeps its name and signature (see Risk 2 mitigation) — no rename.
3. After any `prCalculator.ts` change, verify `prDetection.ts` re-exports compile with `tsc --noEmit`.

### Risk 5: `Analytics.tsx` Complexity — **LOW**

**The problem**: Analytics.tsx is already 790 lines with 3 tabs. Adding a 4th tab with Power Profile content risks bloating it further and creating merge conflicts.

**Mitigation**:
1. The Power Profile content is implemented as standalone components (`PowerProfileChart.tsx`, `PowerProfileAnalysis.tsx`).
2. Analytics.tsx changes are minimal: extend the tab union type, add one `<button>`, add one conditional render block that renders `<PowerProfile workouts={workouts} />`.
3. Consider extracting a `<PowerProfileTab>` wrapper component that handles its own data fetching so Analytics.tsx is just a thin router.

### Risk 6: Inline Watts Formulas Inconsistency — **LOW**

**The problem**: `Analytics.tsx` has 4 inline `2.8 / Math.pow(...)` calculations (lines ~157, 163, 267, 274). `WeekAtAGlanceWidget.tsx`, `ZonePaceTrendChart.tsx`, and `WorkoutComparison.tsx` have 2+ more. If Power Profile uses the consolidated utility while the rest of the same file uses raw formulas, there's a maintenance smell.

**Mitigation**:
1. Replace inline formulas in Analytics.tsx with `calculateWattsFromSplit()` imports **in the same PR** as the Power Profile tab addition. Small, safe change with high maintainability payoff.
2. Other files (`WeekAtAGlance`, `ZonePaceTrend`, `WorkoutComparison`) can be cleaned up separately — lower priority but file them as tech debt.

### Risk 7: No Existing Tests on Modified Files — **MEDIUM**

**The problem**: Zero test coverage exists for `paceCalculator.ts`, `powerBucketing.ts`, or `prCalculator.ts`. There are no tests to catch regressions from the consolidation.

**Mitigation**:
1. **Before** modifying these files, add baseline tests that lock current behavior:
   - `paceCalculator.test.ts`: `calculateWattsFromSplit(120)` → expected watts, `calculateSplitFromWatts(200)` → expected split
   - `powerBucketing.test.ts`: `paceToWatts(1200)` → expected watts (using deciseconds input), `calculatePowerBuckets()` with known stroke data → expected bucket distribution
   - `prCalculator.test.ts`: `calculateWatts(120)` → expected integer watts, `calculatePRs()` with known workout data → expected PRs
2. Run these tests **before and after** the consolidation. They must all pass.
3. This "test-before-refactor" approach catches silent numeric drift.

---

## Regression Testing Checklist (Pre-Deploy)

Run after Phase 1 implementation, before merging:

```
□ tsc --noEmit (zero errors)
□ vite build (clean build)
□ Existing unit tests pass (npm test)
□ New baseline tests pass (paceCalculator, powerBucketing, prCalculator)
□ New powerProfile tests pass

Manual smoke tests:
□ C2 sync: sync a workout → power distribution chart unchanged
□ Analytics → Records tab: PR values unchanged (same watts, same splits)
□ WorkoutDetail page: watts display unchanged
□ GoalsManager: create a watts-based goal → values reasonable
□ Preferences page: benchmark selector shows same 8 distances (not 10)
□ Power Profile tab: renders chart, shows profile type, prescriptions
□ Power Profile with no 2k data: shows onboarding message
```

---

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Not enough data for classification (new users) | Graceful degradation: show chart with whatever exists, skip classification if < 3 anchors, show gap cards to guide testing |
| 2k anchor missing | Fall back to `getUserBaseline2kWatts()` from paceCalculator.ts (profile → legacy table → 202W default). Show warning that auto-detected 2k is better |
| Stroke data not available for all workouts | Fall back to aggregate workout watts. Note lower confidence. Stroke data optional, not required |
| Max watts unreliable from stroke data | Manual entry as primary. Auto-suggest only as a hint. Clear "this is approximate" language |
| Expected ratio ranges may not fit all populations (juniors, masters, heavyweights) | Start with published ranges, add population-specific adjustments in Phase 3. Ranges are already wide enough to accommodate most variance |
| Performance: re-scanning all workouts on every page load | Phase 1: acceptable for modest workout counts (<500). Phase 3.4: materialize to DB table for scale |

---

## Previous Plan (Archived): Analytics Enhancements & PR Detection

The prior plan for Smart PR Detection and User Preferences/Tracking is superseded by this plan. The relevant pieces (PR detection, interval benchmarks, unit toggles) remain in scope and are incorporated into the broader Power Profile feature. Specifically:
- PR detection at standard distances → feeds `extractBestEfforts()`
- Benchmark pattern matching → identifies test workouts for "Tests Only" filter
- Unit toggles (Split/Watts/Time) → integrated into chart tooltip and ratios table
