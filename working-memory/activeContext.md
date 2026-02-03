
# Active Context

## Current Focus
RWN Parser Enhancements & Community Standard Development

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
