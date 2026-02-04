# Workout Templates Feature Plan

**Date:** February 4, 2026  
**Status:** Draft v1  
**Goal:** Enable community-driven workout template creation, discovery, and usage tracking

---

## 🎯 Product Vision

Enable rowers to:
1. **Discover** proven workout templates from the community
2. **Create** and share their favorite workouts using an intuitive builder
3. **Track** performance over time on specific workout types
4. **Learn** RWN notation progressively (not required upfront)

### Success Metrics
- Template creation rate (target: 50+ templates in first month)
- Template usage rate (completed workouts linked to templates)
- Completion rate (% of started templates that get finished)
- Community engagement (ratings, remixes, comments)

---

## 👥 User Journeys

### Journey 1: Discovery - "I want to find a workout for today"
1. Browse templates page (sorted by popular/newest/difficulty)
2. Filter by duration, distance, type, difficulty
3. Preview template details (estimated time, description, rating)
4. Click "Do This Workout" → creates planned workout entry
5. Complete workout on erg → sync from Concept2
6. Rate/review the template

### Journey 2: Creation - "I want to share my favorite workout"
1. Click "Create Template" from templates page
2. Use visual builder (no RWN knowledge needed initially)
3. Build intervals step-by-step with live preview
4. Name, describe, tag the workout
5. Preview generated RWN notation
6. Publish (public) or save (private)

### Journey 3: Usage - "I want to track this workout type"
1. View template detail page
2. See "Your History" section (past completions of this template)
3. Compare performance over time
4. See community stats (avg watts, completion time, difficulty ratings)

---

## 🎨 UX Design - Progressive Disclosure

### Level 1: Simple Visual Builder (Beginner-friendly)

**Workout Type Selection:**
```
┌─────────────────────────────────────────────┐
│  What type of workout?                      │
│                                             │
│  [ Distance ]  [ Time ]  [ Intervals ]     │
│                                             │
│  [ Just Row ]  [ Advanced (RWN) ]          │
└─────────────────────────────────────────────┘
```

**Distance Workout Builder:**
```
┌─────────────────────────────────────────────┐
│  Distance Workout                           │
│                                             │
│  Total Distance: [_____] meters             │
│                                             │
│  ☐ Add splits every [_____] meters         │
│                                             │
│  Target Pace: [___:__] /500m (optional)    │
│                                             │
│  💡 This will create: "5000m"               │
└─────────────────────────────────────────────┘
```

**Interval Builder:**
```
┌─────────────────────────────────────────────┐
│  Interval Workout                           │
│                                             │
│  Interval 1                                 │
│  ├─ Distance: [1000] m                      │
│  ├─ Rest: [3]:[00]                         │
│  └─ Target Pace: [2:00] /500m (optional)   │
│                                             │
│  [ 📋 Copy × 3 ]  [ + Add Interval ]       │
│                                             │
│  Preview: 4x1000m/3:00r                     │
│  Est. Time: ~24 min  |  Total: 4000m       │
└─────────────────────────────────────────────┘
```

### Level 2: Hybrid Mode (Show RWN as they build)
```
┌────────────────┬────────────────┐
│ Visual Builder │ Live RWN       │
├────────────────┼────────────────┤
│ Int 1: 1000m   │ 4x1000m/3:00r  │
│ Rest: 3:00     │                │
│ × 4 times      │ ✓ Valid RWN    │
│                │ ⚡ 24 min       │
│ [Save]         │ 🏃 4000m       │
└────────────────┴────────────────┘
```

### Level 3: Direct RWN Input (Power users)
```
┌─────────────────────────────────────────────┐
│  RWN Editor                                 │
│                                             │
│  > 8x500m/1:30r @ 2:00/500m                │
│                                             │
│  ✓ Valid RWN                                │
│  ✓ 8 intervals detected                     │
│  ✓ Total: 4000m work + rest                │
│  ✓ Est. time: 24 minutes                    │
│                                             │
│  [Parse & Save]                             │
└─────────────────────────────────────────────┘
```

---

## 🏗️ Data Architecture

### Core Principle: RWN as the Universal Key

**Key Insight:** RWN canonical naming serves as the **linking mechanism** between completed workouts and templates.

#### Three Representations of a Workout

Every workout exists in three complementary forms:

**1. Full RWN (User-Facing)**
```
3000m@AT/5:00r + 2500m@AT/5:00r + 2000m@AT/5:00r
```
- Human-readable with full guidance (@AT pace, rest times)
- Used for display, template creation, workout programming
- Preserves all user intent and targets

**2. Canonical Name (System Matching Key)**
```
v3000/2500/2000m
```
- Compact identifier for matching/grouping
- Strips guidance, keeps core structure
- Generated automatically from full RWN
- Used as foreign key for linking workouts to templates

**3. Parsed Structure (Execution/Validation)**
```json
{
  "type": "variable",
  "steps": [
    { "type": "work", "value": 3000, "target_pace": "AT", "duration_type": "distance" },
    { "type": "rest", "value": 300, "duration_type": "time" },
    { "type": "work", "value": 2500, "target_pace": "AT", "duration_type": "distance" },
    { "type": "rest", "value": 300, "duration_type": "time" },
    { "type": "work", "value": 2000, "target_pace": "AT", "duration_type": "distance" },
    { "type": "rest", "value": 300, "duration_type": "time" }
  ]
}
```
- Machine-executable format
- Used for PM5 programming, validation, duration estimation
- Enables workout builder UI (reverse: structure → form inputs)

#### How Matching Works

```
Completed Workout:         Template:
├─ canonical_name:         ├─ canonical_name:
│  "v3000/2500/2000m"     │  "v3000/2500/2000m"
│                         │
└─ Matches! ──────────────┘

Even if full RWN differs:
- Workout: "3000m@2:00/5:00r + 2500m@2:05/5:00r + 2000m@2:00/5:00r"
- Template: "3000m@AT/5:00r + 2500m@AT/5:00r + 2000m@AT/5:00r"
→ Both generate same canonical name → Match! ✓
```

**Benefits:**
- ✅ **Automatic linking** - String equality check (no fuzzy logic needed)
- ✅ **Historical analysis** - Find all attempts at same workout regardless of source
- ✅ **Template discovery** - "You've done this 5 times - save as template?"
- ✅ **Standard distance rounding helps** - 4x998m → "4x1000m/3:00r" → matches template
- ✅ **One-click template creation** - Already have the RWN from completed workout

**Matching Logic:**
```typescript
// After Concept2 sync completes
async function autoLinkToTemplate(workoutLog) {
  const { data: templates } = await supabase
    .from('workout_templates')
    .select('id')
    .eq('rwn', workoutLog.canonical_name)  // Simple string match!
    .eq('is_public', true)
    .limit(1);
  
  if (templates?.[0]) {
    await linkCompletion(workoutLog.id, templates[0].id);
    await incrementTemplateUsage(templates[0].id);
  }
}
```

**This Enables:**
1. Automatic template matching during sync
2. "Create template from workout" feature (instant - just copy canonical_name → rwn)
3. "Find similar workouts" (query by canonical_name)
4. Community stats ("This workout has been completed 147 times by 45 users")

### Database Schema

```sql
-- Core template table
CREATE TABLE workout_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Template Definition
    name TEXT NOT NULL,
    description TEXT,
    rwn TEXT NOT NULL,  -- Source of truth
    
    -- Metadata (auto-calculated from RWN)
    estimated_duration_min INTEGER,
    estimated_distance_m INTEGER,
    interval_count INTEGER,
    workout_type TEXT,  -- 'distance', 'time', 'interval', 'justrow'
    
    -- Categorization
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    category TEXT,  -- 'endurance', 'intervals', 'power', 'recovery'
    tags TEXT[],
    
    -- Targets (optional)
    target_watts INTEGER,
    target_pace INTEGER,  -- seconds per 500m
    
    -- Community Features
    is_public BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    avg_rating NUMERIC(3,2),
    fork_count INTEGER DEFAULT 0,
    forked_from UUID REFERENCES workout_templates(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link completed workouts to templates
CREATE TABLE workout_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_log_id UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
    template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    
    completed_at TIMESTAMPTZ NOT NULL,
    
    -- Performance tracking
    actual_watts INTEGER,
    actual_pace INTEGER,
    performance_vs_target NUMERIC(5,2),  -- % deviation
    
    -- User feedback
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template ratings/reviews
CREATE TABLE template_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    helpful_votes INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(template_id, user_id)  -- One review per user per template
);

-- Template collections (future feature)
CREATE TABLE template_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_templates (
    collection_id UUID REFERENCES template_collections(id) ON DELETE CASCADE,
    template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (collection_id, template_id)
);
```

### Indexes
```sql
CREATE INDEX idx_templates_public ON workout_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_templates_usage ON workout_templates(usage_count DESC);
CREATE INDEX idx_templates_rating ON workout_templates(avg_rating DESC);
CREATE INDEX idx_templates_created_by ON workout_templates(created_by);
CREATE INDEX idx_completions_template ON workout_completions(template_id);
CREATE INDEX idx_completions_user ON workout_completions(user_id);
```

---

## 💻 Technical Implementation

### Phase 1: MVP (2-3 weeks)

**Components to Build:**
1. `TemplateBuilder.tsx` - Visual builder with form inputs
2. `TemplateBrowser.tsx` - Browse/search templates
3. `TemplateDetail.tsx` - Template detail page with usage stats
4. `IntervalBuilder.tsx` - Reusable interval input component

**Services:**
```typescript
// src/services/templateService.ts
export const templateService = {
  createTemplate: async (data: CreateTemplateInput) => { },
  getTemplate: async (id: string) => { },
  searchTemplates: async (filters: TemplateFilters) => { },
  rateTemplate: async (templateId: string, rating: number) => { },
  
  // Link completed workout to template
  linkCompletion: async (workoutLogId: string, templateId: string) => { },
  
  // Get user's history with this template
  getTemplateHistory: async (templateId: string, userId: string) => { }
};
```

**RWN Integration:**
```typescript
// src/utils/rwnParser.ts

// Existing: intervals → RWN
export function calculateCanonicalName(intervals): string;

// New: RWN → intervals (reverse)
export function parseRWN(rwn: string): Interval[] {
  // Parse "4x1000m/3:00r" → 4 intervals of 1000m with 3min rest
  // Parse "v500/1000/2000m" → variable intervals
  // Parse ladder/pyramid patterns
}

// New: Validate RWN
export function validateRWN(rwn: string): { valid: boolean; errors: string[] };

// New: Estimate duration from RWN
export function estimateDuration(rwn: string, targetPace?: number): number;
```

**Workflow: Template → Workout:**
```typescript
// When user clicks "Do This Workout" on template
async function startTemplateWorkout(templateId: string) {
  const template = await templateService.getTemplate(templateId);
  
  // Create a planned workout
  const workoutLog = await workoutService.createWorkout({
    template_id: templateId,
    canonical_name: template.rwn,
    workout_name: template.name,
    status: 'planned',  // New status
    distance_meters: template.estimated_distance_m,
    // Pre-fill from template
  });
  
  navigate(`/workout/${workoutLog.id}`);
}

// During Concept2 sync, check if matches template
async function matchWorkoutToTemplate(workoutLog) {
  const { data: templates } = await supabase
    .from('workout_templates')
    .select('id')
    .eq('rwn', workoutLog.canonical_name)
    .limit(1);
  
  if (templates?.[0]) {
    await templateService.linkCompletion(workoutLog.id, templates[0].id);
  }
}
```

### Phase 2: Engagement Features (1-2 weeks)

**Features:**
- [ ] Template detail page with usage stats
- [ ] "Popular Templates" page
- [ ] "My Templates" page
- [ ] Rating system (1-5 stars)
- [ ] Usage counter auto-increment
- [ ] Template history chart (similar to workout history)

### Phase 3: Community Features (2-3 weeks)

**Features:**
- [ ] Fork/remix templates (create variation)
- [ ] Comments on templates
- [ ] Difficulty auto-calculation based on pace/power
- [ ] Collections ("My Favorite Interval Workouts")
- [ ] Template recommendations based on history
- [ ] "Workout of the Week" feature

---

## 🎮 Gamification Ideas

### Badges
- **Template Architect** - Created 10 templates
- **Coach** - Your template used 50+ times
- **Trendsetter** - Created template with >100 uses
- **Completionist** - Used 25 different templates
- **Dedicated** - Completed same template 10+ times

### Stats to Display
- "Your template '8x500m Pyramid' has been used 47 times!"
- "Avg community watts: 245W (you: 267W 🔥)"
- "94% completion rate"
- "Most popular tag: #pete-plan"

---

## 🚀 Recommended Start Point

**Week 1: Database & Core Services**
1. Create database schema (migrations)
2. Implement `templateService.ts`
3. Add RWN parser functions (`parseRWN`, `validateRWN`)

**Week 2: Basic UI**
4. Build simple interval builder component
5. Template creation wizard (distance/time/intervals only)
6. Template browser with search/filters

**Week 3: Integration**
7. "Do This Workout" flow (template → planned workout)
8. **Auto-matching during Concept2 sync** (link completed workouts to templates by RWN)
9. Template detail page with basic stats
10. **"Create Template from Workout" button** (one-click - reuse canonical_name)

**Week 4+: Polish & Community**
11. Ratings/reviews
12. Popular templates page
13. Template history charts (reuse existing WorkoutHistory component with template filter)
14. Fork/remix features
15. **"Similar Workouts" feature** (find completions with matching canonical_name)

---

## 📝 Open Questions / Decisions Needed

1. **RWN Editor Complexity**: How robust should the RWN parser be initially? Start with simple patterns or full spec?
   - **Note**: Parser mainly needed for "Advanced" mode - most users will use visual builder

2. **Template Ownership**: Can users edit their templates after publishing? Or force "fork" workflow to preserve history?
   - **Leaning toward**: Allow edits, but track version history

3. **Auto-Matching Priority**: If multiple templates match same RWN, which one to link?
   - **Proposal**: Most popular template (highest usage_count)
   - Or: User's own template first, then community templates

4. **Difficulty Calculation**: Manual user input or auto-calculate from pace/watts targets?
   - **Hybrid approach**: Auto-suggest based on targets, allow manual override

5. **Template Versioning**: Support versions (v1, v2) or always fork?
   - **Decision needed**: Probably start without versioning, add if needed

6. **Moderation**: How to handle inappropriate/spam templates? Flag system? Admin review?
   - **Start simple**: Flag button, admin review queue

7. **Template Discovery from Existing Workouts**: Should we prompt users to create templates?
   - **Proposal**: "You've done '4x1000m/3:00r' 5 times. Save as template?" notification
   
8. **Duplicate Templates**: What if someone creates template with same RWN as existing?
   - **Options**: 
     - Block creation, suggest existing template
     - Allow duplicates but show "Similar templates" during creation
     - Auto-merge into single template with multiple authors (complex)

---

## 🎯 Shape-Based Template Matching & Semantic Overlay

### The Problem: Concept2 Data Lacks Semantic Tags

When syncing from Concept2, we receive raw interval data without semantic meaning:
```json
// What PM5 stores and returns
{
  "intervals": [
    { "type": "time", "time": 6000, "distance": 2400 },  // 10:00
    { "type": "distance", "distance": 5000, "time": 12000 }, // 5000m
    { "type": "time", "time": 6000, "distance": 1800 }   // 10:00
  ]
}
// Missing: Which interval is warmup? Work? Cooldown?
```

**RWN Template** preserves this information:
```
[w]10:00 + 5000m + [c]10:00
Canonical: v10:00/5000/10:00
```

### The Solution: Shape Matching → Template Association → Semantic Overlay

**Step 1: Match by "Shape" (Canonical Name)**
```typescript
// Template canonical: "v10:00/5000/10:00"
// Workout canonical: "v10:00/5000/10:00" (calculated from C2 intervals)
// Match! → Associate workout with template
```

**Step 2: Overlay Template Structure onto Workout Intervals**
```typescript
// Template has full structure with blockType
template.structure.steps = [
  { type: "work", duration_type: "time", value: 600, blockType: "warmup" },
  { type: "work", duration_type: "distance", value: 5000, blockType: "main" },
  { type: "work", duration_type: "time", value: 600, blockType: "cooldown" }
]

// Map to workout intervals by index:
workout.intervals[0] → template.steps[0] → warmup
workout.intervals[1] → template.steps[1] → main (work)
workout.intervals[2] → template.steps[2] → cooldown
```

**Step 3: Smart Analysis - Main Block Only**
```typescript
function getMainBlock(workout, template) {
  if (!template) return workout.intervals;
  
  return workout.intervals.filter((interval, idx) => {
    const step = template.workout_structure.steps[idx];
    return !step?.blockType || step.blockType === 'main';
  });
}

// Now calculate stats on JUST the 5000m work:
const workIntervals = getWorkIntervalsOnly(workout, template);
const workDistance = sum(workIntervals.map(i => i.distance)); // 5000m
const workTime = sum(workIntervals.map(i => i.time)); // 12000 (20:00)
const avgPace = (workTime / 10) / (workDistance / 500); // 2:00 /500m
```

### Benefits

1. **Accurate Performance Tracking**
   - Track "true" 5k time (20:00), not total workout time (35:00)
   - Progression charts show work-only stats
   - Compare apples-to-apples across sessions

2. **Better UX - Segmented Display**
   ```
   ┌─────────────────────────────────────────┐
   │ 5000m Test with Warmup/Cooldown        │
   │ Template: "5k Benchmark"                │
   ├─────────────────────────────────────────┤
   │ 🔥 10:00 warmup   (2400m @ 2:05)       │
   │ ⚡ 5000m WORK     (20:00 @ 2:00) ← MAIN │
   │ 🧊 10:00 cooldown (1800m @ 2:46)       │
   ├─────────────────────────────────────────┤
   │ Work Stats (5000m only):                │
   │   Time: 20:00                           │
   │   Pace: 2:00 /500m                      │
   │   Watts: 185                            │
   └─────────────────────────────────────────┘
   ```

3. **Smart Analytics**
   - Filter charts to work-only data
   - Community stats: "Avg 5k time: 19:45" (excludes warmup/cooldown)
   - Difficulty ratings based on work intensity

4. **Graceful Degradation**
   - No template match? Show all intervals as work
   - Template exists but user deviated? Best-effort mapping by position

### Implementation Details

**Auto-Matching During Sync**
```typescript
// In useConcept2Sync.ts or similar
async function syncWorkout(c2Workout) {
  // 1. Calculate canonical name from raw intervals
  const canonical = calculateCanonicalName(c2Workout.intervals);
  
  // 2. Find matching template
  const { data: template } = await supabase
    .from('workout_templates')
    .select('id, workout_structure')
    .eq('canonical_name', canonical)
    .eq('workout_type', 'erg')
    .eq('is_public', true)
    .order('usage_count', { ascending: false })
    .limit(1)
    .single();
  
  // 3. Save workout WITH template association
  await supabase.from('workout_logs').insert({
    ...workoutData,
    canonical_name: canonical,
    template_id: template?.id, // Link to template
  });
  
  // 4. Increment template usage
  if (template) {
    await supabase.rpc('increment_template_usage', { 
      template_id: template.id 
    });
  }
}
```

**Work-Only Stats Calculation**
```typescript
// In workoutAnalysis.ts
export function calculateWorkStats(workout: WorkoutLog) {
  // If no template, analyze all intervals
  if (!workout.template_id) {
    return analyzeAllIntervals(workout.intervals);
  }
  
  // Load template structure
  const template = await getTemplate(workout.template_id);
  
  // Filter to work intervals only
  const workIntervals = workout.intervals.filter((interval, idx) => {
    const step = template.workout_structure.steps[idx];
    return !step?.tags?.includes('warmup') && 
           !step?.tags?.includes('cooldown') &&
           !step?.tags?.includes('rest');
  });
  
  return {
    totalDistance: sum(workIntervals.map(i => i.distance)),
    totalTime: sum(workIntervals.map(i => i.time)),
    avgPace: calculateAvgPace(workIntervals),
    avgWatts: calculateAvgWatts(workIntervals),
    avgSPM: calculateAvgSPM(workIntervals),
  };
}
```

**UI Components**
```typescript
// SegmentedWorkoutDisplay.tsx
function SegmentedWorkoutDisplay({ workout, template }) {
  return (
    <div>
      {workout.intervals.map((interval, idx) => {
        const step = template?.workout_structure.steps[idx];
        const badge = getIntervalBadge(step?.tags);
        
        return (
          <IntervalRow
            key={idx}
            interval={interval}
            badge={badge} // 🔥 warmup, ⚡ work, 🧊 cooldown
            isMainWork={!step?.tags?.length}
          />
        );
      })}
      
      {template && (
        <WorkStatsPanel 
          stats={calculateWorkStats(workout)} 
          label="Work Stats (excluding warmup/cooldown)"
        />
      )}
    </div>
  );
}
```

### Fuzzy Matching (Future Enhancement)

For slight variations in execution:
```typescript
// Template: "10:00 + 5000m + 10:00"
// Actual:   "9:47 + 5100m + 9:52" (user stopped early, went over distance)

// Solution: Match by "shape similarity"
// - Same interval count ✓
// - Same type pattern (time, distance, time) ✓
// - Values within tolerance (±10% or ±1 min)
// → Confidence: 85% match → Ask user to confirm association
```

### Tasks to Implement

- [ ] **Phase 1: Core Matching**
  - [ ] Add `canonical_name` column to `workout_templates` table
  - [ ] Backfill canonical names for existing templates
  - [ ] Update template creation to auto-generate canonical name
  - [ ] Implement auto-matching in Concept2 sync hook
  - [ ] Add `template_id` foreign key to `workout_logs`

- [ ] **Phase 2: Work-Only Analysis**
  - [ ] Create `getMainBlock()` utility function (renamed from getWorkIntervalsOnly)
  - [ ] Update `calculateWorkStats()` to use template-aware filtering
  - [ ] Add work-only stats to workout detail page
  - [ ] Filter progression charts to work intervals only

- [ ] **Phase 3: Enhanced UI**
  - [ ] Create `SegmentedWorkoutDisplay` component with badges
  - [ ] Show "Matched Template" badge on workout cards
  - [ ] Add "Work Stats" vs "Total Stats" toggle
  - [ ] Template association manual override UI

- [ ] **Phase 4: Community Stats**
  - [ ] Calculate avg work stats across all template completions
  - [ ] Show percentile rankings ("You're in top 15% for this workout")
  - [ ] Community leaderboard for each template

---

## ✅ Design Decisions (Finalized 2026-02-04)

### 1. Block Tag Notation
**Decision:** Use bracket prefix notation `[w]`, `[c]`, `[t]` as the canonical format for warmup/cooldown/test.

| Tag | Meaning | Example |
|:----|:--------|:--------|
| `[w]` | Warmup | `[w]10:00 + 5x500m/1:00r` |
| `[c]` | Cooldown | `5x500m/1:00r + [c]5:00` |
| `[t]` | Test/Benchmark | `[w]2000m + [t]2000m` |

- Legacy `#warmup`, `#cooldown`, `#test` still parse correctly (backward compatible)
- Parser outputs bracket notation as canonical form
- Added to RWN spec Section 10

### 2. "Main" Block is Implicit
**Decision:** Untagged segments default to `blockType: 'main'`. No explicit `[m]` tag needed.
- Most workouts are "main only" - requiring explicit marking adds noise
- Pattern follows common notation conventions

### 3. Naming: `getMainBlock()` not `getWorkIntervalsOnly()`
**Decision:** Rename utility function to `getMainBlock()` because:
- "Work" can be intervals, fixed distance, fixed time, or variable patterns
- The function filters by block type (strips warmup/cooldown), not by "interval-ness"

### 4. Template Matching Ignores Tags
**Decision:** `canonical_name` is computed *after* stripping block tags.
- `5x500m/1:00r` and `[w]10:00 + 5x500m/1:00r + [c]5:00` both have canonical: `5x500m/1:00r`
- This enables templates WITH warmup/cooldown to match workouts WITHOUT (and vice versa)
- Tags are semantic metadata for analysis, NOT part of the matching key

### 5. Multiple Template Matching Priority
**Decision:** When multiple templates match the same canonical_name:
1. **User's own template first** (if exists)
2. **Most popular community template** (highest usage_count)

---

## 🔄 Iteration Notes

*Add notes here as we refine the plan*

- [ ] Review database schema
- [ ] Finalize UX flow for builder
- [x] Decide on RWN parser scope → Support bracket tags + legacy inline tags
- [ ] Plan migration strategy for existing workouts
- [x] **Document shape-based matching approach** (2026-02-04)
- [x] **Add block tag notation `[w]`, `[c]`, `[t]` to RWN spec** (2026-02-04)
- [x] **Implement blockType in parser and types** (2026-02-04)
- [ ] Test auto-matching with real Concept2 sync data
- [ ] Implement work-only stats calculation after workout pruning complete
