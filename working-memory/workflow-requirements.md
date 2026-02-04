# Workflow Requirements & Constraints

**Date:** February 4, 2026  
**Scope:** Data Sync, Template Matching, Trend Analysis, Community Features  
**Out of Scope:** PM5 instrumentation (for now)

---

## 🎯 Core Goals

1. **Sync data consistently** - Every workout lands in the same canonical form regardless of source
2. **Draw consistent comparisons** - Compare workout A to workout B accurately
3. **Enable trend analysis** - Track performance over time on the same workout type
4. **Build community around templates** - Share, discover, rate workout structures

---

## 🔺 The Trinity (Immutable Law)

```
RWN String (DNA)  ←→  Parsed Structure (Body)  ←→  Canonical Name (Key)
```

**Critical Property**: Round-trip consistency
- `parse(rwn) → structure` MUST be reversible
- `calculateCanonicalName(structure)` MUST be deterministic
- Same workout always produces same canonical name regardless of origin

**Why This Matters**:
| Without Trinity | With Trinity |
|----------------|--------------|
| "4x500m" ≠ "4 × 500m" | Both → `4x500m/0:00r` |
| Manual entry ≠ C2 sync | Both → same canonical |
| Template ≠ Logged workout | Match by canonical key |

---

## 📊 Data Flow Invariants

### Constraint 1: Single Source of Truth for Matching

```
workout_logs.canonical_name  ═══════╗
                                    ╠════ STRING EQUALITY ═══► Match!
workout_templates.canonical_name ═══╝
```

**No fuzzy matching required for core use case** - Canonical names ARE the matching key.

### Constraint 2: Canonical Name = Structure Summary (No Guidance)

Canonical names strip all guidance to enable matching regardless of intensity targets:

| Full RWN | Canonical Name |
|----------|---------------|
| `4x500m@2k/2:00r` | `4x500m/2:00r` |
| `4x500m@1:45/2:00r` | `4x500m/2:00r` |
| `4x500m@UT1/2:00r` | `4x500m/2:00r` |

**Why**: Different users target different paces, but the workout STRUCTURE is what we compare.

### Constraint 3: Tags are Metadata, Not Part of Canonical

```
10:00#warmup + 5000m + 10:00#cooldown
       ↓
canonical: v10:00/5000m/10:00
```

Tags (`#warmup`, `#cooldown`, `#test`) are preserved in structure for semantic overlay, but excluded from canonical name to enable matching.

**Why**: The shape matters for matching. Tags overlay meaning after match.

---

## 🔄 Sync Workflow Requirements

### Workflow A: C2 → LogbookCompanion

```
1. Fetch raw intervals from Concept2 API
2. structureToIntervals(c2Data) → C2Interval[]
3. calculateCanonicalName(intervals) → canonical_name
4. Store: workout_logs { ...data, canonical_name }
5. Match: SELECT template WHERE canonical_name = ?
6. If match: Overlay template structure for semantic tags
```

### Workflow B: Template → Workout → C2

```
1. User clicks "Do This Workout" on template
2. parseRWN(template.rwn) → WorkoutStructure
3. Create planned workout with template_id link
4. User completes on erg, syncs from C2
5. Auto-match via canonical_name (should hit same template)
6. Track completion, update usage_count
```

### Workflow C: Create Template from Completed Workout

```
1. User views completed workout
2. canonical_name already computed
3. Click "Save as Template"
4. Pre-fill: name, rwn (from canonical), structure
5. User adds tags (#warmup segments), description
6. Save template with same canonical_name → instant match on future completions
```

---

## ⚡ Warmup/Cooldown Handling

### The Problem

```
User executes: 10:00 warmup + 5x500m@2k/2:00r + 5:00 cooldown
C2 records:    10:00 + 5x500m + 5:00 (no semantic tags)
```

**Without tags**: Can't distinguish warmup/work/cooldown intervals.

### The Solution: Template-Based Semantic Overlay

```typescript
// Matching happens on canonical shape
"v10:00/5x500m/5:00" === "v10:00/5x500m/5:00"  ✓

// After match, overlay template structure
template.structure.steps[0].tags = ['warmup']
template.structure.steps[1..5] = work intervals
template.structure.steps[6].tags = ['cooldown']

// Now we can filter for "work only" analysis
workIntervals = intervals.filter((i, idx) => 
  !template.steps[idx].tags?.includes('warmup') &&
  !template.steps[idx].tags?.includes('cooldown')
);
```

### Key Principle: Tags Inform Analysis, Not Matching

- **Matching**: Pure structure comparison (canonical name equality)
- **Analysis**: Template tags enable work-only stats, segmented display
- **No template?**: All intervals treated as work (graceful degradation)

---

## 📏 Canonical Name Generation Rules

### Standard Distances (Round to nearest)
```
100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 
4000, 5000, 6000, 7500, 10000, 15000, 21097, 30000, 42195
```
- Tolerance: ±20m or ±1% (whichever larger)
- Example: 498m → 500m, 4997m → 5000m

### Pattern Formats
| Pattern | Canonical Format |
|---------|-----------------|
| Single distance | `5000m` |
| Single time | `30:00` |
| Uniform intervals | `4x500m/2:00r` |
| Variable distances | `v500/1000/500m` |
| Variable times | `v5:00/10:00/5:00` |
| Mixed type | `v10:00/5000m/10:00` |
| Nested | `4x(4x250m/0:45r)/5:00r` |

### Rest Formatting
- Always `M:SSr` format (never `SSsr` to avoid stroke rate confusion)
- Zero rest: `0:00r` (explicit)
- Undefined rest: NOT in canonical (handled separately)

---

## 🎯 Matching Confidence Levels

For future enhancement (fuzzy matching):

| Confidence | Description | Example |
|------------|-------------|---------|
| 100% | Exact canonical match | `4x500m/2:00r` = `4x500m/2:00r` |
| 95% | Within distance tolerance | `4x498m/2:00r` → `4x500m/2:00r` |
| 80% | Same shape, different rest | `4x500m/1:30r` ≈ `4x500m/2:00r` |
| 60% | Similar structure, different count | `3x500m/2:00r` ≈ `4x500m/2:00r` |
| <50% | No match | Show suggestions |

**MVP**: Only 100% matches (string equality). Fuzzy matching is Phase 2.

---

## 🏗️ Database Constraints

### workout_logs
```sql
canonical_name TEXT NOT NULL,          -- Computed from intervals
template_id UUID REFERENCES workout_templates(id),  -- Optional link
```

### workout_templates  
```sql
rwn TEXT NOT NULL,                     -- Full RWN with guidance/tags
canonical_name TEXT NOT NULL,          -- Stripped key for matching
workout_structure JSONB NOT NULL,      -- Parsed structure
```

### Indexes (Critical for Performance)
```sql
CREATE INDEX idx_logs_canonical ON workout_logs(canonical_name);
CREATE INDEX idx_templates_canonical ON workout_templates(canonical_name);
```

---

## ✅ Verification Checklist

Before any change to the trinity:

- [ ] `parseRWN()` handles the new syntax
- [ ] `structureToRWN()` can regenerate it
- [ ] `calculateCanonicalName()` produces consistent output
- [ ] Round-trip test passes: `parse(rwn) → structure → canonicalName` = expected
- [ ] Existing canonical names remain unchanged (migration needed?)

### Test Cases to Always Pass
```typescript
const tests = [
  { rwn: '4x500m/2:00r', canonical: '4x500m/2:00r' },
  { rwn: '5000m@UT2', canonical: '5000m' },
  { rwn: '10:00#warmup + 5000m + 5:00#cooldown', canonical: 'v10:00/5000m/5:00' },
  { rwn: '3x12:00/3:00r@UT1', canonical: '3x12:00/3:00r' },
];
```

---

## 🚫 Anti-Patterns to Avoid

1. **Don't** include guidance in canonical name
2. **Don't** include tags in canonical name  
3. **Don't** use fuzzy string matching for core matching
4. **Don't** store calculated fields that can be derived from structure
5. **Don't** break round-trip consistency for "convenience"
6. **Don't** create parallel naming systems (one canonical = one structure)

---

## 🎯 Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Match rate | >90% | Templates should match logged workouts |
| False positive rate | <1% | Wrong template linked |
| Round-trip fidelity | 100% | Parser ↔ Structure lossless |
| Query performance | <100ms | Canonical index lookup |

---

## 📝 Open Questions

1. **Nested intervals**: Is `4x(4x250m/0:45r)/5:00r` the right canonical format?
2. **Multiple templates same canonical**: Which takes priority? Most popular? User's own first?
3. **Canonical migration**: If we fix a bug in naming, how to handle existing data?
4. **Deleted templates**: Keep canonical_name on workout_logs even if template deleted?

---

*This document defines immutable constraints. Changes require team discussion and migration plan.*
