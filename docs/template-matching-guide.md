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

### Prerequisites

You need your Supabase credentials. The script will use either:
1. **Service Role Key** (preferred): `SUPABASE_SERVICE_ROLE_KEY`
2. **Anon Key** (fallback): `VITE_SUPABASE_ANON_KEY`

**Important**: The service role key can bypass RLS (Row Level Security), so use it carefully. For production, consider adding user authentication to the script.

### Step 1: Set Environment Variables

**Option A - Using .env file** (Recommended)
Your `.env` file should already have:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Optional, more powerful
```

**Option B - Inline (temporary)**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=your-key npx tsx scripts/backfill_workout_templates.ts
```

### Step 2: Run the Backfill Script

```bash
npx tsx scripts/backfill_workout_templates.ts
```

**What it does:**
- Finds all workouts with `canonical_name` but no `template_id`
- Matches them to templates using the same priority logic:
  1. Your personal templates (by `canonical_name`)
  2. Most popular community template (by `usage_count`)
- Updates `workout_logs.template_id` for each match

### Step 2: Review Results

The script will output:
```
✅ Matched: 45       # Workouts successfully linked
⚠️  Skipped: 12      # No matching template found
❌ Errors: 0         # Processing errors
```

### Step 3: Handle Unmatched Workouts

For workouts that couldn't be matched:
- They may have unique structures not in your template library
- You can create templates from them later
- Manual linking could be added as a future feature

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

-- Then re-run the backfill script
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
# Set environment variables
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run backfill
npx tsx scripts/backfill_workout_templates.ts
```

**Expected Output**:
```
🔍 Finding workouts without template links...

📊 Found 67 workouts to process

✅ Matched "4x500m/1:00r" → template abc-123
✅ Matched "10000m" → template def-456
⚠️  No match for "3x750m/2:30r" (workout xyz-789)
...

============================================================
📊 Backfill Complete:
   ✅ Matched: 45
   ⚠️  Skipped: 22
   ❌ Errors: 0
============================================================
```
