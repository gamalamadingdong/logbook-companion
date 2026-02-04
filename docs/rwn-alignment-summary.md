# RWN Component Alignment Summary

**Date:** 2026-02-04  
**Status:** ✅ All components aligned

## Components

### 1. RWN Specification (`rwn/RWN_spec.md`)
- **Purpose:** Authoritative documentation for Rowing Workout Notation
- **Recent Updates:**
  - ✅ Added documentation for single intervals without "1x" prefix (Section 2.1)
  - ✅ Clarified steady state examples with training zones
  - **Coverage:** Intervals, steady state, guidance (@pace/@rate), tags, modalities, grouping

### 2. RWN Parser (`src/utils/rwnParser.ts`)
- **Purpose:** Parse RWN strings into WorkoutStructure objects
- **Recent Updates:**
  - ✅ Added support for single intervals with rest (e.g., "15:00@UT1/2:00r")
  - ✅ Parses as interval with `repeats: 1` rather than failing
- **Test Coverage:** All Playground examples parse correctly

### 3. RWN Playground (`src/components/RWNPlayground.tsx`)
- **Purpose:** Interactive RWN validator UI
- **Recent Updates:**
  - ✅ Expanded examples to cover:
    - Distance intervals: `4x500m/1:00r`
    - Time intervals: `8x1:00/1:00r`
    - **Single interval with rest:** `500m@2k/1:00r` (NEW!)
    - Training zones: `20:00@UT1`
    - Rate ranges: `30:00@18..22spm`
    - Pace ranges: `60:00@2:05..2:10`
    - Variable workouts: `2000m+1000m+500m`
    - Grouped repeats: `3x(750m/3:00r + 500m/3:00r)`
- **Integration:** Uses `parseRWN()` and displays canonical names via `calculateCanonicalName()`

### 4. Template Editor (`src/components/TemplateEditor.tsx`)
- **Purpose:** Create/edit workout templates with RWN Quick Create
- **Features:**
  - ✅ RWN Quick Create: Paste RWN string, auto-populate structure
  - ✅ Handles all structure types: steady_state, interval, variable
  - ✅ Extracts guidance: target_rate, target_pace, ranges
  - ✅ Parses tags (#test, #warmup, etc.)
  - ✅ Shows canonical name preview
- **Integration:** Uses `parseRWN()` → populates builder state → generates canonical name

## Full Pipeline Test Results

```
✓ 4x500m/1:00r                        → 4x500m/1:00r
✓ 8x1:00/1:00r                        → 8x1:00/1:00r
✓ 500m@2k/1:00r                       → 500m (single interval)
✓ 15:00@UT1/2:00r                     → 15:00 (single interval)
✓ 10000m                              → 10000m
✓ 30:00                               → 30:00
✓ 20:00@UT1                           → 20:00
✓ 5000m@2k+10                         → 5000m
✓ 30:00@18..22spm                     → 30:00
✓ 60:00@2:05..2:10                    → 60:00
✓ Bike: 15000m                        → 15000m
✓ 2000m+1000m+500m                    → v2000/1000/500m
✓ 3x(750m/3:00r + 500m/3:00r)         → 3x 750m/500m/3:00r
✓ 4x(5x500m/1:30r)/6:00r              → 4x5x500m (block detection working!)
```

## Key Features Supported

### Parsing
- ✅ Distance, time, calories
- ✅ Intervals with rest (Nx Work/Rest)
- ✅ **Single intervals with rest** (Work/Rest) → treated as 1x
- ✅ Steady state (no rest)
- ✅ Variable/pyramid workouts (A+B+C)
- ✅ Grouped repeats (Nx(A+B))
- ✅ Modality prefixes (Bike:, Ski:, etc.)

### Guidance
- ✅ Training zones (@UT1, @UT2, @AT, @TR, @AN)
- ✅ Absolute pace (@1:45, @2:00)
- ✅ Relative pace (@2k, @2k+10, @6k-5)
- ✅ Pace ranges (@1:48..1:52, @2k-1..2k-5)
- ✅ Rate targets (@r24, @28spm)
- ✅ Rate ranges (@18..22spm, @r24..28)

### Tags
- ✅ #test, #warmup, #cooldown, #benchmark

### Canonical Names
- ✅ Simple intervals: `4x500m/1:00r`
- ✅ Variable: `v2000/1000/500m`
- ✅ Chunked: `3x 750m/500m/3:00r`
- ✅ **Block structure:** `4x5x500m` (preserves block grouping!)

## User Flow

1. **User enters RWN in Template Editor Quick Create:** `15:00@UT1/2:00r`
2. **Parser validates and structures:**
   ```json
   {
     "type": "interval",
     "repeats": 1,
     "work": { "type": "time", "value": 900, "target_pace": "UT1" },
     "rest": { "type": "time", "value": 120 }
   }
   ```
3. **Template Editor populates UI fields:**
   - Structure Type: Interval
   - Repeats: 1
   - Work Type: Time
   - Work Value: 900s (15:00)
   - Target Pace: UT1
   - Rest Value: 120s (2:00)
4. **Canonical name generated:** `15:00`
5. **Saved to database** with full structure for PM5 execution

## Validation

All components are tested and aligned:
- ✅ Parser handles all Playground examples
- ✅ Playground displays all spec features
- ✅ Template Editor correctly populates from RWN
- ✅ Canonical naming works for all workout types
- ✅ Block detection preserves structure (4x5x500m)

## Notes

- **Single interval canonical names:** When `repeats: 1`, canonical name shows work only (e.g., "500m" not "1x500m/1:00r"). This is intentional for simplicity.
- **Block detection:** Critical for Pete Plan and other block-based training programs. Detects repeating rest patterns and generates compact names like "4x5x500m" instead of "20x500m/1:30r".
