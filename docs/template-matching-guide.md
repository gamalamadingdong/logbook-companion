# Template Matching - Quick Reference

## How It Works

### 🔄 Automatic Matching (New Workouts)
When you sync workouts from Concept2, the system automatically:
1. Generates a canonical RWN form from the workout structure
2. Searches for matching templates (your templates first, then community)
3. Links the workout to the best matching template

This happens in `useConcept2Sync.ts` after every workout upsert.

---

## 🔧 Backfilling Existing Workouts

There are two different backfill jobs. Use the right one for the data you are fixing.

### 1. Populate missing `canonical_name` values

Use the local script that exists in this repo:

```bash
npx tsx scripts/backfill_canonical.ts
```

This script reads `workout_logs.raw_data`, derives a canonical workout name, and updates `workout_logs.canonical_name`. It requires Supabase credentials in `.env` and should use `SUPABASE_SERVICE_ROLE_KEY` when run against production data so RLS does not hide rows.

### 2. Link workouts to templates

There is currently no checked-in `scripts/backfill_workout_templates.ts` script. For bulk template-linking, use the SQL workflow in [backfill-via-mcp.md](backfill-via-mcp.md). The core operation links exact canonical-name matches:

```sql
UPDATE workout_logs wl
SET template_id = wt.id
FROM workout_templates wt
WHERE wl.canonical_name = wt.canonical_name
  AND wl.template_id IS NULL
  AND wt.canonical_name IS NOT NULL;
```

After the SQL update, review the most common unmatched canonical names and either create missing templates or leave them unlinked until the workout structure is clarified.

### Backfill eligibility

- Valid `canonical_name` on the workout log
- No existing `template_id`
- A matching template with the same `canonical_name`

Skipped rows usually mean the workout has no structured name yet, the template does not exist, or the workout was already linked.

---

## 📊 Matching Priority Logic

When matching workouts to templates:

1. **User Templates First**: Your own templates matching the canonical name
2. **Community Templates**: Public templates with highest `usage_count`

Example:
```
Workout: "4x500m/1:00r" → Canonical: "4x500m/1:00r"

Search:
  1. Check user's templates for "4x500m/1:00r"
  2. If none, check community templates
  3. Return template with highest usage_count
```

---

## 🎯 What Gets Matched

The backfill script works on workouts that already have `canonical_name` populated. This happens automatically when:
- ✅ Workouts are synced from Concept2 (calculated during sync)
- ✅ Workouts have interval data that can be parsed

The `canonical_name` is the RWN (Rowing Workout Notation) form like:
- `4x500m/1:00r` (4 x 500m intervals with 1 min rest)
- `10000m` (10k steady state)
- `8x1:00/1:00r` (8 x 1 min on/off)

**Backfill eligibility:**
- ✅ Valid `canonical_name` (not null)
- ✅ No existing `template_id` (not already linked)

**Skipped:**
- ❌ Workouts without `canonical_name` (can't match)
- ❌ Workouts already linked to templates
- ❌ Manual workouts without structured interval data

### How canonical_name is Generated

During Concept2 sync, the system:
1. Parses the workout's interval structure from raw Concept2 data
2. Converts it to canonical RWN notation using `calculateCanonicalName()`
3. Falls back to workout type + distance/time if intervals aren't available
4. Stores the result in `workout_logs.canonical_name`

This means **only Concept2-synced workouts** currently have canonical names. Manual workouts would need the `manual_rwn` field populated.

---

## 🔍 Troubleshooting

### No matches found?

**Cause**: No templates with matching canonical names exist.

**Solution**: 
1. Check your template library
2. Create templates for common workout patterns
3. Import community templates

### Script errors?

**Check**:
1. `.env` has `VITE_SUPABASE_URL` set
2. `.env` has `SUPABASE_SERVICE_ROLE_KEY` (not anon key!)
3. Database connection is working

### Want to rematch all workouts?

**Manual SQL** (use with caution):
```sql
-- Reset all template links
UPDATE workout_logs SET template_id = NULL;

-- Then re-run the template-linking SQL in docs/backfill-via-mcp.md
```

---

## 🚀 Future Enhancements

Potential improvements:
- [ ] UI button: "Find matching template" on workout detail page
- [ ] Bulk selection: "Match all unlinked workouts"
- [ ] Fuzzy matching: Match similar but not exact workouts
- [ ] Confidence scores: Show match quality (e.g., "95% match")
- [ ] Manual override: Select template even if different canonical form

---

## 📝 Example Usage

```bash
# Populate missing canonical names from raw workout data
npx tsx scripts/backfill_canonical.ts
```

```sql
-- Then link exact canonical-name matches via Supabase MCP / SQL editor
UPDATE workout_logs wl
SET template_id = wt.id
FROM workout_templates wt
WHERE wl.canonical_name = wt.canonical_name
  AND wl.template_id IS NULL
  AND wt.canonical_name IS NOT NULL;
```
