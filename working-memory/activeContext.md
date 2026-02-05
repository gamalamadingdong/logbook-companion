
# Active Context

## Current Focus
**Template system enhancements complete - Ready for analytics improvements**

## Recent Changes (2026-02-04 Session 3)

### ✅ Fixed: Token Refresh Race Conditions & Scopes
1.  **Web Locks Implemented**:
    - Problem: Multiple tabs refreshing token simultaneously caused race conditions and 400 Bad Request errors.
    - Solution: Used `navigator.locks` to mutex-guard the network refresh.
    - Added optimistic check to reuse tokens refreshed by other tabs.
    - **File**: [`concept2.ts`](src/api/concept2.ts)

2.  **Scope Mismatch Fixed**:
    - Problem: Old tokens had `results:write` scope which is no longer valid/configured, causing `invalid_grant`.
    - Solution: Explicitly downscoped refresh request to `user:read,results:read`.

### ✅ Implemented: Work-Only Analysis & Template Trends
1.  **Work-Only Metrics**:
    - **Session Pace**: Cleanly separated from Work Pace/Distance.
    - **Logic**: `getMainBlockIndices()` filters out warmups/cooldowns.
    - **UI**: Added "Session Pace" card to `WorkoutDetail.tsx`.

2.  **Template Effectiveness Chart**:
    - Added **Performance Trend** chart to `TemplateDetail.tsx`.
    - Visualizes historical Watts for the specific template over time.

## Recent Changes (2026-02-04 Session 2)

### ✅ Fixed: Template Linking & Display Issues
1. **Power Distribution 406 Error Fixed**
   - Added graceful error handling in `getPowerBuckets()` function
   - Catches PGRST116 and 406 errors when RLS blocks access or data doesn't exist
   - Returns null instead of crashing when power distribution unavailable
   - **File**: [workoutService.ts](src/services/workoutService.ts)

2. **Template Linking Not Showing - FIXED**
   - Root cause: `getWorkoutDetail()` was only returning C2 API data (`raw_data`)
   - Database fields (`template_id`, `manual_rwn`, `is_benchmark`) were being stripped
   - **Solution**: Merge database fields into returned object
   - WorkoutDetail page now properly displays linked templates
   - **File**: [workoutService.ts](src/services/workoutService.ts)

### ✅ Menu & Terminology Updates
1. **"Templates" → "Library"**
   - Navigation menu item renamed for clarity
   - **File**: [Layout.tsx](src/components/Layout.tsx)

2. **"Analytics" → "Analysis"**
   - Tab renamed per user preference
   - **File**: [Layout.tsx](src/components/Layout.tsx)

### ✅ Template Library Enhancements

#### Global vs Personal Data Decision
**DECISION**: Templates are global/shared, but usage stats show personal data
- **Templates**: Shared across all users (good for teams/coaching)
- **Usage Count (on template detail)**: Shows global usage (all users)
- **"X workouts categorized" stat**: Shows YOUR workouts linked to templates
- **Rationale**: See popular templates globally, track personal progress individually

#### Usage Statistics Added
- Replaced "X templates linked" with "X workouts categorized"
- Counts personal workouts (`user_id` filtered) that have `template_id` not null
- Shows meaningful adoption metric: "347 workouts categorized"
- **File**: [TemplateLibrary.tsx](src/pages/TemplateLibrary.tsx)

#### Template Sorting by Popularity & Recency
1. **Added `last_used_at` field** to track most recent workout link
2. **Created migration**: [migration_add_last_used_at.sql](db/migrations/migration_add_last_used_at.sql)
   - Adds `last_used_at TIMESTAMP WITH TIME ZONE` column
   - Creates index for efficient sorting
   - Updates trigger to maintain `last_used_at` automatically
   - Backfills existing data from workout_logs
3. **Added sort dropdown** with two modes:
   - **Most Popular** (default): Sorts by `usage_count DESC`
   - **Recently Used**: Sorts by `last_used_at DESC`
4. **Files Changed**:
   - [templateService.ts](src/services/templateService.ts) — Added `sortBy` parameter
   - [TemplateLibrary.tsx](src/pages/TemplateLibrary.tsx) — Sort UI controls
   - [migration_add_last_used_at.sql](db/migrations/migration_add_last_used_at.sql) — Database migration

**Note**: Migration must be run manually in Supabase SQL Editor (MCP lacks DDL permissions)

### ✅ RWN Playground Enhancements

#### Categorized Examples with Multi-Modal Support
- **Reorganized examples** into 4 categories:
  - **Basic**: Intervals, steady state, time-based
  - **Pace**: Training zones, relative pace, rate/pace ranges
  - **Advanced**: Warmup/cooldown, rate pyramids, nested blocks
  - **Multi-Modal**: BikeErg, SkiErg, Circuit training, Team circuits
- **New multi-modal examples**:
  - `Bike: 15000m` — Single modality
  - `Ski: 8x500m/3:30r` — Ski intervals
  - `Row: 2000m + Bike: 5000m + Ski: 2000m` — Cross-training circuit
  - `3x(Row: 2000m/2:00r + Bike: 5000m/2:00r + Run: 800m/2:00r)` — Full team circuit
- **UI Improvements**:
  - Examples grouped by category with headers
  - Parsed structure now uses flex layout to match examples height
  - Better visual hierarchy
- **File**: [RWNPlayground.tsx](src/components/RWNPlayground.tsx)

### ✅ RWN Specification Updates

#### Documented Chained Guidance Parameters
- **Added Section 4.4**: Chaining Guidance Parameters
- **Syntax**: Multiple `@` symbols can be chained together
- **Examples**:
  - `30:00@UT2@r20` → 30 mins at UT2 pace, holding rate 20
  - `5000m@2k+5@r28` → 5k at 2k+5 pace, holding rate 28
  - `8x500m/1:00r@1:50@r32` → 500m intervals at 1:50 split and rate 32
  - `60:00@r18..22@UT2` → Hour piece at UT2, rate range 18-22
- **Parser behavior**: Order doesn't matter (`@UT2@r20` = `@r20@UT2`)
- **File**: [RWN_spec.md](rwn/RWN_spec.md)

## Architecture Decisions Made Today

### Template System Design
1. **Global Template Library**
   - All users see same templates (community/team resource)
   - Templates created by any user are visible to all
   - Good for coaching platforms and team coordination

2. **Personal Usage Tracking**
   - Each user's workout links are private
   - "Workouts categorized" stat shows personal progress
   - Template detail shows global `usage_count` (community popularity)

3. **Template Sorting**
   - Default: Most Popular (usage_count DESC)
   - Alternative: Recently Used (last_used_at DESC)
   - Helps discover both popular templates and recently active ones

### Data Quality & Error Handling
1. **Graceful Degradation**
   - Missing power distribution data doesn't crash UI
   - 406/RLS errors logged but don't block page rendering
   - Null-safe rendering for optional data

2. **Database Triggers for Data Integrity**
   - `usage_count` automatically maintained on workout_logs changes
   - `last_used_at` automatically updated when templates linked
   - No manual maintenance required

## Next Steps

### Ready for Implementation
1.  **Analytics/Analysis Improvements**
    - Training zone distribution
    - Volume trends by template type
    - Best Efforts per template

2.  **erg-link Integration**
    - Support `target_*_max` fields (ranges) in PM5 programming

### Completed / Verified
- **Backfill Remaining Workouts**: Script confirmed all workouts are already linked to templates upon inspection (2026-02-04).

### Blocked/Waiting
- **Migration Pending**: `last_used_at` field needs manual SQL execution
  - File ready: `db/migrations/migration_add_last_used_at.sql`
  - Run in Supabase SQL Editor
  - After running, "Recently Used" sort will work

## Recent Changes (2026-02-04 Session 1)

### ✅ Implemented: Block Tag Notation in RWN Spec & Parser
- **Grammar Addition**: `[w]`, `[c]`, `[t]` bracket prefixes for warmup/cooldown/test
- **Files Changed**:
  - [RWN_spec.md](rwn/RWN_spec.md) — Added Section 10.1 Block Tags
  - [workoutStructure.types.ts](src/types/workoutStructure.types.ts) — Added `BlockType` enum and `blockType` field
  - [rwnParser.ts](src/utils/rwnParser.ts) — Parses bracket tags and sets `blockType` on steps
  - [test_roundtrip.ts](scripts/test_roundtrip.ts) — Updated to output canonical bracket notation
- **Canonical Form**: `[w]10:00 + 5x500m/1:00r + [c]5:00` (bracket notation preferred)
- **Legacy Support**: `#warmup`, `#cooldown`, `#test` still parse correctly

### ✅ Design Decisions Finalized
1. **"Main" is implicit** — Untagged blocks default to `blockType: 'main'`
2. **Naming: `getMainBlock()`** — Not "getWorkIntervalsOnly" (work can be intervals OR fixed distance/time)
3. **Tags don't affect matching** — Canonical name strips tags; matching is by structure only
4. **Multiple template priority**: User's template first → Most popular community template

### ✅ Trinity Verification Updated
- **Round-trip Tests**: 7/10 passing (test file updated with bracket notation tests)
- **"Failures" are expected canonicalization**: Legacy `#warmup` → `[w]` output
- **Core semantic matching**: `blockType` preserved in all cases ✓

### ✅ Created: Workflow Requirements Document
- **File**: [workflow-requirements.md](workflow-requirements.md)
- **Purpose**: Define immutable constraints for data sync, matching, and analysis
- **Key Principles**:
  1. **Trinity**: RWN ↔ Structure ↔ Canonical Name (must be lossless round-trip)
  2. **Matching by String Equality**: canonical_name is the join key (no fuzzy matching for MVP)
  3. **Tags are Metadata**: `[w]`, `[c]` inform analysis but NOT matching
  4. **Guidance Stripped from Canonical**: `4x500m@2k/2:00r` → `4x500m/2:00r`

### ✅ Created: Pacing Calculator Library (2026-02-03)
- **File**: [paceCalculator.ts](src/utils/paceCalculator.ts)
- **Purpose**: Decoupled pacing calculations for personalized targets
- **Key Functions**: `calculateActualPace()`, `parsePaceToSeconds()`, `formatSplit()`
- **Bug Fixed**: `parsePaceToSeconds("2k+20")` was returning 2 (now returns null)

## Next Steps: Template Matching Implementation

### ✅ Phase 1: Database Schema (COMPLETED 2026-02-04)
1. ✅ Verified `template_id` column exists in `workout_logs` table
2. ✅ Added `canonical_name` column to `workout_templates` table
3. ✅ Created indexes for efficient lookups:
   - `idx_workout_templates_canonical_name` on workout_templates
   - `idx_workout_logs_template_id` on workout_logs
   - `idx_workout_logs_canonical_name` on workout_logs
4. ✅ Created migration script: [migration_add_canonical_name_to_templates.sql](db/migrations/migration_add_canonical_name_to_templates.sql)
5. ✅ Created backfill script: [backfill_canonical_names.ts](scripts/backfill_canonical_names.ts)
6. ✅ Applied migration via Supabase MCP
7. ✅ **Backfilled 89 templates successfully** - All templates now have canonical_name

**Files Changed**:
- [db_schema.sql](db/db_schema.sql) — Added `canonical_name` column to workout_templates
- [migration_add_canonical_name_to_templates.sql](db/migrations/migration_add_canonical_name_to_templates.sql) — Migration file
- [backfill_canonical_names.ts](scripts/backfill_canonical_names.ts) — Backfill script
- [structureToRWN.ts](src/utils/structureToRWN.ts) — NEW: Extracted trinity regeneration function
- [migrations/README.md](db/migrations/README.md) — Migration documentation

**Results**: 89/89 templates updated with canonical RWN notation ✨

### ✅ Phase 2: Auto-Matching in Sync (COMPLETED 2026-02-04)
**Goal**: Automatically match workouts to templates when syncing from Concept2

**Implementation**:
1. ✅ Created `templateMatching.ts` utility with priority matching logic
2. ✅ Integrated into `useConcept2Sync.ts` after workout upsert
3. ✅ Matching priority implemented:
   - User's own templates (created_by = user_id) FIRST
   - Then most popular community template (highest usage_count)
4. ✅ Edge cases handled:
   - No canonical_name → skip matching
   - No matching templates → template_id stays null
   - Silent failure on error (workout still synced)

**Files Changed**:
- [templateMatching.ts](src/utils/templateMatching.ts) — NEW: Template matching utility functions
- [useConcept2Sync.ts](src/hooks/useConcept2Sync.ts) — Added auto-matching after workout upsert

**How It Works**:
```typescript
// After creating workout in database
const upsertedWorkout = await upsertWorkout(record);

// Auto-match by canonical_name
if (upsertedWorkout && record.canonical_name) {
  const workoutId = upsertedWorkout[0].id;
  await matchWorkoutToTemplate(workoutId, userId, record.canonical_name);
}
```

**Priority Logic**:
1. Query all templates WHERE canonical_name = workout.canonical_name
2. If user has their own template → use it
3. Else → use most popular community template (ORDER BY usage_count DESC)
4. Update workout_logs.template_id

### Phase 3: Work-Only Analysis (Next)
**Goal**: Extract and analyze only the "work" portion of workouts (excluding warmup/cooldown)

**Implementation Plan**:
1. Create `getMainBlock()` utility function in `src/utils/workoutAnalysis.ts`
2. Filter steps by `blockType !== 'warmup' && blockType !== 'cooldown'`
3. Update stats calculations to use main block only:
   - `WorkoutComparison.tsx` — Compare work intervals only
   - `WorkoutDetail.tsx` — Show work vs warmup/cooldown separately
   - Stats calculations — Calculate averages on main block

**Design**:
```typescript
function getMainBlock(workout: WorkoutStructure): WorkoutStep[] {
  if (workout.type === 'variable') {
    return workout.steps.filter(step => 
      step.blockType !== 'warmup' && 
      step.blockType !== 'cooldown'
    );
  }
  // For steady_state/interval, check top-level blockType
  if (workout.blockType === 'warmup' || workout.blockType === 'cooldown') {
    return [];
  }
  return [workout]; // Return the whole workout as main block
}
```

**Use Cases**:
- Template matching: Match on full structure INCLUDING warmup/cooldown
- Stats analysis: Calculate on MAIN BLOCK ONLY (work intervals)
- Comparison: Compare main blocks between workouts

### Phase 2: Auto-Matching in Sync (Next)
**Goal**: When user syncs from Concept2, automatically match workouts to templates by canonical_name

**Implementation Plan**:
1. Update `useConcept2Sync.ts` to query templates after workout creation
2. Implement matching logic:
   ```typescript
   // After creating workout in database
   const canonicalName = structureToRWN(workoutStructure);
   
   // Query for matching template (user's first, then community)
   const matchedTemplate = await findBestMatchingTemplate(userId, canonicalName);
   
   if (matchedTemplate) {
     await supabase
       .from('workout_logs')
       .update({ template_id: matchedTemplate.id })
       .eq('id', workoutLog.id);
   }
   ```
3. Create `findBestMatchingTemplate()` utility with priority:
   - User's own templates (created_by = user_id) first
   - Then community templates sorted by usage_count DESC
4. Handle edge cases:
   - No matching templates → `template_id` stays null
   - Multiple matches → Pick highest priority (user's first, then most popular)

### Phase 2: Auto-Matching During Sync
1. In `useConcept2Sync.ts`, after calculating canonical_name:
   - Query templates for matching canonical_name
   - Priority: user's own → most popular
   - Set `template_id` on workout_log

### Phase 3: Work-Only Analysis
1. Create `getMainBlock(workout, template)` utility
2. Update stats calculations to filter by blockType

## Recent Changes (2026-02-03)

### ✅ Completed: Absolute Range Notation Support
- **Problem**: Coaches/athletes want to prescribe intensity bands (e.g., "hold 1:48-1:52")
- **Solution**: Extended RWN spec and parser to support absolute ranges
- **Notation Added**:
  - Pace range: `@1:48-1:52` (target 1:48-1:52 split)
  - Rate range: `@28-32spm` or `@r24-28` (target 24-28 spm)
  - Combined: `@1:48-1:52@28-32spm` (both ranges)
- **Files Changed**:
  - [RWN_spec.md](rwn/RWN_spec.md) — Documented new syntax in sections 4.1 and 4.2
  - [workoutStructure.types.ts](src/types/workoutStructure.types.ts) — Added `target_rate_max` and `target_pace_max` fields
  - [rwnParser.ts](src/utils/rwnParser.ts) — Updated guidance parsing to recognize ranges
  - [rwnParser.test.ts](src/utils/rwnParser.test.ts) — Added comprehensive test suite for ranges
- **Explicitly NOT Supported**: Relative ranges (`@2k+5-2k+10`) deferred to avoid parsing ambiguity

### ✅ Completed: Chained `@` Parameter Support
- **Problem**: Parser couldn't handle multiple guidance parameters (e.g., pace AND stroke rate in same segment)
- **Solution**: Modified [`rwnParser.ts`](file:///c:/Users/samgammon/apps/LogbookCompanion/src/utils/rwnParser.ts) to split guidance by `@` and parse each independently
- **Examples Now Working**:
  - `10 x 500m@2k@32spm/3:00r` → Parses both pace (`2k`) and rate (`32 spm`)
  - `5000m@2k+10@22spm` → Steady state with pace and rate guidance

### ✅ Completed: Training Zone Abbreviations
- **Problem**: Zone identifiers (UT2, UT1, AT, TR, AN) not recognized as valid pace guidance
- **Solution**: Added regex pattern to recognize training zones as `target_pace` values
- **Examples Now Working**:
  - `2 x (12:00@UT2 + 9:00@UT1 + 6:00@AT)/5:00r` → Each segment has proper zone guidance
  - `30:00@UT2` → Steady state with zone target

### ✅ Completed: Template Delete Functionality
- **Feature**: Added admin-only delete button to Template Library
- **Implementation**: [`TemplateLibrary.tsx`](file:///c:/Users/samgammon/apps/LogbookCompanion/src/pages/TemplateLibrary.tsx)
- **UX**: Trash icon with confirmation dialog, auto-refresh on success

## RWN as Community Standard
- **Vision**: RWN is the interchange format for the rowing community
- **Pipeline**: RWN → LogbookCompanion templates → erg-link → PM5
- **Guidance Philosophy**: Multiple valid ways to prescribe intensity:
  - Zones: `@UT2` (abstract, coach decides)
  - Relative: `@2k+10` (personalized to athlete)
  - Absolute: `@1:48` (exact target)
  - Ranges: `@1:48-1:52` (band of acceptable paces)

## Immediate Next Steps
1. **Canonical Naming Fix**: Update `workoutNaming.ts` to detect repeating patterns in unrolled variable structures
2. **UI Display**: Optionally update TemplateEditor/WorkoutDetail to display ranges nicely
3. **erg-link Integration**: Ensure erg-link can read `target_*_max` fields for PM5 programming

## Active Issues
- **Canonical Naming**: Currently generates verbose names (e.g. `v500m/250m...`) for unrolled loops instead of concise `3x...` names
- **Zone Calc Limitation**: `zone_distribution` uses current baseline, not historical fitness

## Architecture Notes
- **RWN Directory**: `rwn/` contains spec and may be extracted to standalone repo
- **Workout Structure Types**: `SteadyStateStructure`, `IntervalStructure`, `VariableStructure` in `workoutStructure.types.ts`
- **Adapter Pattern**: `structureToIntervals()` converts template JSON to C2Interval format for consistent naming
- **Canonical Naming**: Single source of truth via `calculateCanonicalName()` in `workoutNaming.ts`
- **Parser Enhancement**: Guidance now supports chained parameters via `@` splitting (2026-02-03)

## Test Files Created
- [`rwnParser.test.ts`](file:///c:/Users/samgammon/apps/LogbookCompanion/src/utils/rwnParser.test.ts) - Comprehensive test suite
- [`test-parser.ts`](file:///c:/Users/samgammon/apps/LogbookCompanion/test-parser.ts) - Manual verification script
- [`test-guidance.ts`](file:///c:/Users/samgammon/apps/LogbookCompanion/test-guidance.ts) - Training zone tests

## Documentation
- [`walkthrough.md`](file:///C:/Users/samgammon/.gemini/antigravity/brain/147ddb98-76ac-4909-99ac-e0ee19c92529/walkthrough.md) - Recent enhancements summary
- [`rwn-grouped-workouts-analysis.md`](file:///C:/Users/samgammon/.gemini/antigravity/brain/147ddb98-76ac-4909-99ac-e0ee19c92529/rwn-grouped-workouts-analysis.md) - Grouped workout notation guide
