
# Active Context

## Current Focus
RWN Parser Enhancements & Range Notation Planning

## Recent Changes (2026-02-03)

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

### 📋 Planned: Range Notation Support
- **Proposal**: Extend RWN spec to support pace/rate ranges (e.g., `10 x 500m@1:48-1:52@28-32spm/3:00r`)
- **Status**: Implementation plan created, awaiting user decision on notation style
- **Options**: Dash (`-`), Tilde (`~`), or Plus/Minus (`±`)
- **See**: [`implementation_plan.md`](file:///C:/Users/samgammon/.gemini/antigravity/brain/147ddb98-76ac-4909-99ac-e0ee19c92529/implementation_plan.md)

## Previous Work (Pre-2026-02-03)
- **Completed**: Fixed RWN Parser recursion bug for nested intervals (e.g., `3x(750/3r + 500/3r)`)
  - Implemented `splitRefined` for parenthesis-aware splitting
  - Implemented `parseRepeatedGroup` for unrolling complex sets
- **Completed**: Created `scripts/rwn_regression_suite.ts` with 15 test cases

## Immediate Next Steps
1. **User Decision**: Choose range notation style (dash/tilde/plus-minus)
2. **If Approved**: Implement range notation support
   - Update RWN spec (section 4.4)
   - Modify type definitions for range types
   - Update parser to recognize range patterns
   - Update UI components to display ranges
3. **Canonical Naming**: Update `workoutNaming.ts` to detect repeating patterns in unrolled variable structures

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
