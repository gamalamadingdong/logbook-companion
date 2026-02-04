# Workout Template Backfill via Supabase MCP

## Problem
The TypeScript backfill script uses the Supabase client which requires RLS permissions. When using the anon key, it can't see workouts from other users.

## Solution
Use Supabase MCP's `execute_sql` tool to run SQL directly with proper permissions.

## Status Check

```sql
SELECT 
  (SELECT COUNT(*) FROM workout_logs WHERE template_id IS NOT NULL) as linked_count,
  (SELECT COUNT(*) FROM workout_logs WHERE canonical_name IS NOT NULL AND template_id IS NULL) as unlinked_count,
  (SELECT COUNT(*) FROM workout_templates) as total_templates;
```

## Backfill Strategy

### Step 1: Match exact canonical names

```sql
-- Link workouts to templates with exact canonical_name matches
UPDATE workout_logs wl
SET template_id = wt.id
FROM workout_templates wt
WHERE wl.canonical_name = wt.canonical_name
  AND wl.template_id IS NULL
  AND wt.canonical_name IS NOT NULL;
```

### Step 2: Check results

```sql
-- See what's still unlinked
SELECT 
  canonical_name,
  COUNT(*) as count
FROM workout_logs
WHERE canonical_name IS NOT NULL
  AND template_id IS NULL
GROUP BY canonical_name
ORDER BY count DESC
LIMIT 20;
```

### Step 3: Create missing templates

For common workouts that don't have templates, create them:

```sql
-- Example: Create 15000m template
INSERT INTO workout_templates (name, canonical_name, description, workout_type, distance, is_steady_state)
VALUES ('15,000m Steady State', '15000m', 'Long steady state piece', 'steady_state', 15000, true);
```

## Already Completed

✅ Linked 70x 10000m workouts  
✅ Linked 41x 5000m workouts

## Next Steps

Run the Step 1 SQL above to do bulk matching, then assess what templates need to be created.
