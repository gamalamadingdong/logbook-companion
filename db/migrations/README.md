# Template Matching Database Migration

## Phase 1: Schema Changes (2026-02-04)

### Overview
This migration adds support for automatic template matching by canonical workout structure names.

### What Changed

#### 1. New Column: `workout_templates.canonical_name`
- **Type**: `text`
- **Purpose**: Stores the canonical RWN representation for efficient template matching
- **Nullable**: Yes (will be populated by backfill script)
- **Generated from**: Either `rwn` field or `workout_structure` JSON

#### 2. New Indexes
- **`idx_workout_templates_canonical_name`**: Fast lookups when matching workouts to templates
- **`idx_workout_logs_template_id`**: Efficient reverse lookups (find all workouts using a template)
- **`idx_workout_logs_canonical_name`**: Match workouts by structure

#### 3. Existing Columns (Already Present)
- ✅ `workout_logs.template_id` — Already exists
- ✅ `workout_logs.canonical_name` — Already exists

### How to Apply

#### Step 1: Run Migration (Supabase)
```bash
# Apply the migration to your Supabase database
# Copy the contents of migration_add_canonical_name_to_templates.sql
# and run it in the Supabase SQL editor
```

Or via CLI:
```bash
supabase migration new add_canonical_name_to_templates
# Copy contents from migration_add_canonical_name_to_templates.sql
supabase db push
```

#### Step 2: Backfill Existing Templates
```bash
# Set environment variables
export VITE_SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run backfill script
npx tsx scripts/backfill_canonical_names.ts
```

### What It Enables

1. **Automatic Template Matching**: When users sync workouts from Concept2, we can automatically match them to existing templates
2. **Priority Matching**: User's own templates matched first, then most popular community templates
3. **Efficient Queries**: Indexed lookups on canonical_name for O(1) matching

### Next Steps

After applying this migration:
- **Phase 2**: Update `useConcept2Sync.ts` to auto-match workouts to templates
- **Phase 3**: Implement work-only analysis using `getMainBlock()` utility

### Files

- **Migration**: [migration_add_canonical_name_to_templates.sql](./migration_add_canonical_name_to_templates.sql)
- **Backfill Script**: [../scripts/backfill_canonical_names.ts](../scripts/backfill_canonical_names.ts)
- **Updated Schema**: [db_schema.sql](./db_schema.sql)

### Verification

After running the migration, verify with:

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'workout_templates'
  AND column_name = 'canonical_name';

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('workout_templates', 'workout_logs')
  AND indexname LIKE 'idx_%canonical%';

-- Check backfill progress
SELECT 
  COUNT(*) as total_templates,
  COUNT(canonical_name) as with_canonical,
  COUNT(*) - COUNT(canonical_name) as missing_canonical
FROM workout_templates;
```

### Rollback (if needed)

```sql
DROP INDEX IF EXISTS idx_workout_templates_canonical_name;
DROP INDEX IF EXISTS idx_workout_logs_template_id;
DROP INDEX IF EXISTS idx_workout_logs_canonical_name;
ALTER TABLE workout_templates DROP COLUMN IF EXISTS canonical_name;
```
