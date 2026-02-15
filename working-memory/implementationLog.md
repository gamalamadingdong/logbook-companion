# Implementation Log: Feature Development History

**Purpose**: Track what's been built, what worked, what failed, and why certain approaches were abandoned.

---

## Phase 14: Train Better Program Roadmap + Execution Spec (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

Created `working-memory/train-better-change-roadmap-spec.md` to operationalize the strategy docs into a single execution artifact.

#### Included in the spec
- Phase-gated roadmap (A-F) with objectives, deliverables, entry/exit criteria
- Workstream specs (Brand/UX, Platform/Domains, Auth/Integrations, Analytics, Change Ops)
- Dependencies, risks, mitigations, and governance cadence
- Issue-ready backlog epics and program completion definition
- Conditional execution tracks for coaching split and product rename

**Result**: ✅ You now have architecture + runbook + worksheet + execution roadmap artifacts needed to begin implementation planning and commit with a complete paper trail.

===

## Phase 13: Split + Naming Decision Worksheet (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

Added Section 10 to `working-memory/train-better-site-architecture.md` with a one-session decision framework:
- App split readiness scorecard (0-5 criteria)
- Explicit split thresholds (go/no-go)
- Naming scorecard across multiple candidates
- Naming decision threshold (when rename is justified)
- Required evidence checklist before decision
- Fill-in decision templates and immediate kickoff checklist

**Result**: ✅ Repeatable, evidence-based process to decide both app split timing and product naming without ad hoc debate.

===

## Phase 12: Coaching Split Strategy + Naming Exploration (February 15, 2026)

**Timeline**: February 15, 2026  
**Status**: ✅ Planning Complete

### What Was Added

#### 1. Split Strategy Section in Architecture Doc
Expanded `working-memory/train-better-site-architecture.md` with:
- Keep-unified-now recommendation for in-season execution
- Split-readiness trigger checklist (2+ trigger gate)
- Target post-split domain map including `coach.train-better.app`
- Four-phase migration roadmap (boundary hardening → shell split → optimization → packaging)
- Risk/mitigation notes for auth, UI drift, and user navigation confusion

#### 2. Product Naming Exploration
Added structured evaluation for whether to keep "Logbook Companion":
- Naming decision criteria (clarity, scope fit, brand coherence, distinctiveness, migration cost)
- Option analysis (keep, soft transition, full rename)
- Recommended path: keep current name now, strengthen subtitle, revisit with post-season evidence

**Result**: ✅ Decision-quality planning artifact for both app-boundary and naming strategy without forcing immediate architectural churn.

===

## Phase 11: Train Better Hub IA + Wireframes (February 13, 2026)

**Timeline**: February 13, 2026  
**Status**: ✅ Planning Complete

### What Was Built

#### 1. Umbrella Site Architecture Document
**Problem**: Domain rollout plan existed, but there was no dedicated product/UX architecture doc for how `train-better.app` should communicate and route users across Logbook Companion and ErgLink.

**Solution**:
- Added `working-memory/train-better-site-architecture.md` as a companion to `working-memory/domain-rollout-plan.md`.
- Defined brand model, messaging hierarchy, IA/site map, and cross-site communication strategy.

#### 2. Wireframe Set (ASCII)
**What was documented**:
- Home page wireframes (desktop + mobile)
- Product detail page wireframe
- Coaches journey page wireframe

#### 3. MVP Sequencing
**Implementation order**:
1. Ship hub homepage + product pages
2. Add docs/community/support pages
3. Add analytics events and funnel tracking
4. Iterate copy and routing based on spring season usage feedback

**Result**: ✅ Clear blueprint for building `train-better.app` as umbrella site while keeping app deployments independent (`log.*`, `erg.*`).

===

## Phase 6: Workout Capture Engine (Backend) (February 6, 2026)

**Timeline**: February 6, 2026
**Status**: ✅ Complete (Backend)

### What Was Built

#### 1. Reconciliation Engine
**Problem**: Duplicate data entering system from Manual + C2 sources.
**Solution**: "Swiss Cheese" layering with source priority (Gold/Silver/Bronze).
**Logic**:
- Check for existing workout within +/- 10 mins.
- If existing, check if new source > existing source (e.g. C2 > Manual).
- If update: Update in place. If new: Insert.

#### 2. RWN Canonical Naming Updates
**Problem**: Complex nested blocks (e.g., `2 x (4 x 500m)`) not naming correctly.
**Solution**:
- Recursive block structure detection.
- Updated `workoutNaming.ts` to generate `Nx(MxDIST)` strings.
- Saved canonical name to `notes` field for visibility.

#### 3. Power Distribution & Zone Analytics
**Problem**: Power distribution data was missing or incorrectly bucketed, leading to inaccurate "Time in Zone" charts.
**Solution**:
- Integrated `getPowerDistribution` from C2 API to fetch raw stroke buckets.
- Fixed bucketing logic to align with training zones.
- Upserted to `workout_power_distribution` table for fast analytics.
- Added graceful error handling (skips if RLS/Schema fails).

===

## Phase 5: Template System Enhancement (February 4, 2026)

**Timeline**: February 4, 2026  
**Status**: ✅ Complete (pending manual migration)

### What Was Built

#### 1. Template Linking & Display Fixes
**Problem**: Template links weren't displaying on WorkoutDetail page despite being set in database

**Root Cause**: `getWorkoutDetail()` returned only C2 API data (`raw_data`), stripping database metadata

**Solution**:
```typescript
// workoutService.ts - Merge database fields into returned object
return {
    ...data.raw_data,
    workout_name: canonicalName,
    template_id: data.template_id,      // ✅ Now included
    manual_rwn: data.manual_rwn,        // ✅ Now included
    is_benchmark: data.is_benchmark     // ✅ Now included
} as C2ResultDetail;
```

**Files Changed**:
- `src/services/workoutService.ts`

**Result**: ✅ Linked templates now display correctly on WorkoutDetail page

---

#### 2. Power Distribution Error Handling
**Problem**: 406 errors when accessing `workout_power_distribution` table blocked page rendering

**Root Cause**: RLS policy requires user owns workout; when data missing or access denied → 406

**Solution**:
```typescript
// Wrap query in try-catch, handle specific error codes
try {
    const { data, error } = await supabase
        .from('workout_power_distribution')
        .select('buckets')
        .eq('workout_id', workoutId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('406')) {
            console.log('Power distribution not available');
            return null; // Graceful degradation
        }
    }
} catch (err) {
    return null;
}
```

**Files Changed**:
- `src/services/workoutService.ts` - `getPowerBuckets()` function

**Result**: ✅ Pages no longer crash when power distribution unavailable

---

#### 3. Global Template Library with Personal Stats
**Design Decision**: Templates shared globally, but usage tracking is personal

**Implementation**:
```typescript
// Templates: No user filter (global library)
const templates = await fetchTemplates({ workoutType: 'erg' });

// Personal stat: User-filtered workout count
const { count } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('template_id', 'is', null);

// Display: "347 workouts categorized" (personal)
// vs template.usage_count (global community popularity)
```

**Files Changed**:
- `src/pages/TemplateLibrary.tsx` - Personal workout count query
- `src/services/templateService.ts` - No user filtering on templates

**Result**: ✅ Community template discovery + personal progress tracking

**See Also**: ADR-013 for decision rationale

---

#### 4. Template Sorting (Popularity vs Recency)
**Feature**: Sort templates by "Most Popular" or "Recently Used"

**Database Changes**:
```sql
-- Add last_used_at column
ALTER TABLE workout_templates 
ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast sorting
CREATE INDEX idx_workout_templates_last_used_at 
ON workout_templates(last_used_at DESC);

-- Update trigger to maintain both usage_count and last_used_at
CREATE OR REPLACE FUNCTION update_template_usage_count() ...
```

**UI Implementation**:
```typescript
// Sort options dropdown
<select value={sortOrder} onChange={...}>
    <option value="popular">Most Popular</option>
    <option value="recent">Recently Used</option>
</select>

// Query logic
if (sortBy === 'recent') {
    query.order('last_used_at', { ascending: false, nullsFirst: false });
} else {
    query.order('usage_count', { ascending: false });
}
```

**Files Changed**:
- `db/migrations/migration_add_last_used_at.sql` - Database migration (NOT YET APPLIED)
- `src/services/templateService.ts` - Added `sortBy` parameter
- `src/pages/TemplateLibrary.tsx` - Sort UI controls

**Result**: ✅ Code ready, ⏳ Pending manual SQL execution in Supabase

**See Also**: ADR-014 for decision rationale

---

#### 5. RWN Playground Enhancements
**Feature**: Better visualization and multi-modal workout examples

**Changes**:
1. **Categorized Examples**: Basic → Pace → Advanced → Multi-Modal
2. **Multi-Modal Examples Added**:
   - BikeErg: `Bike: 15000m`
   - SkiErg: `Ski: 8x500m/3:30r`
   - Circuit: `Row: 2000m + Bike: 5000m + Ski: 2000m`
   - Team Circuit: `3x(Row: 2000m/2:00r + Bike: 5000m/2:00r + Run: 800m/2:00r)`
3. **Layout Improvements**: Parsed structure now flex-grows to match examples height

**Files Changed**:
- `src/components/RWNPlayground.tsx` - Reorganized examples, flex layout

**Result**: ✅ Users can experiment with multi-step, multi-modal workouts

---

#### 6. RWN Specification Updates
**Feature**: Document chained guidance parameters

**Added Section 4.4**:
```markdown
### 4.4 Chaining Guidance Parameters
Multiple guidance parameters can be chained using multiple `@` symbols.

Examples:
- 30:00@UT2@r20 → 30 mins at UT2 pace, holding rate 20
- 5000m@2k+5@r28 → 5k at 2k+5 pace, holding rate 28
- 8x500m/1:00r@1:50@r32 → 500m intervals at 1:50 split and rate 32
```

**Files Changed**:
- `rwn/RWN_spec.md` - Added Section 4.4

**Result**: ✅ Specification now documents chaining syntax like `@UT2@r20`

---

#### 7. Menu & Terminology Updates
**Changes**:
- "Templates" → "Library" (clearer for community templates)
- "Analytics" → "Analysis" (user preference)

**Files Changed**:
- `src/components/Layout.tsx` - Navigation menu updates

**Result**: ✅ Improved terminology consistency

---

### What Worked
- ✅ **Graceful error handling**: Null checks prevent cascading failures
- ✅ **Database triggers**: Automatic maintenance of usage_count and last_used_at
- ✅ **Global templates**: Good for team/coaching platforms
- ✅ **Personal stats**: Users still see their own progress
- ✅ **RWN playground**: Interactive learning for complex workouts

### What Failed / Lessons Learned
- ❌ **MCP Server DDL limitations**: Can't apply migrations via MCP (permission denied)
- 📝 **Lesson**: Some operations require manual SQL execution in Supabase UI
- ❌ **Original stats confusion**: "Templates linked" was ambiguous (now "workouts categorized")
- 📝 **Lesson**: Metrics should be user-centric, not system-centric

### Pending Work
- ⏳ **Migration**: `migration_add_last_used_at.sql` needs manual execution
- ⏳ **Template effectiveness tracking**: Compare progress on same template over time
- ⏳ **Backfill script**: Auto-link entire workout history to templates
- ⏳ **Analytics improvements**: Training zone distribution, volume trends

---

## Phase 1: Foundation & Architecture (Completed)

**Timeline**: Initial development → December 2025  
**Status**: ✅ Complete

### What Was Built
1. **Monorepo Structure**
   - `packages/` organized by concern (auth, functions, ui, shared)
   - `infra/` for database schema and infrastructure
   - `scripts/` for build automation
   - Clear separation of concerns

2. **Database Schema (Multi-Tenant)**
   - Core entities: businesses, profiles, user_business_roles
   - Service business entities: service_items, clients, workers, service_instances
   - Row Level Security (RLS) policies for all tables
   - Audit trail pattern established

3. **Workspace Configuration**
   - TypeScript configured with strict mode
   - pnpm workspace setup
   - Shared tsconfig for consistency

### What Worked
- ✅ Monorepo structure keeps things organized
- ✅ Multi-tenant schema proven in ScheduleBoard v2
- ✅ RLS policies enforce security at database level
- ✅ TypeScript strict mode catches bugs early

### What Failed / Lessons Learned
- ❌ Initial plan for complex generator was over-engineered
- 📝 Lesson: Simpler instruction-driven approach is more maintainable

---

## Phase 2: Authentication System (Completed)

**Timeline**: Early development  
**Status**: ✅ Complete

### What Was Built
1. **Invite-Based Onboarding**
   - `create-invite` edge function: Creates invite records
   - `send-invite-email` edge function: Sends email via Resend
   - `process-invite` edge function: Creates account from invite
   - `get-invite` edge function: Retrieves invite details
   - `delete-user-account` edge function: Account deletion

2. **Email Integration (Resend)**
   - HTML email templates
   - Invite email with direct signup link
   - Verified domain: scheduleboard.co

3. **Role-Based Access**
   - 7-tier role system (USER → OWNER)
   - Enforced via RLS policies
   - Role assignment during invite acceptance

### What Worked
- ✅ Invite flow eliminates manual password setup
- ✅ Resend integration simple and reliable
- ✅ Role-based access clear and enforceable
- ✅ Edge Functions handle business logic securely

### What Failed / Lessons Learned
- ⚠️ Email template styling needs mobile testing
- 📝 Lesson: Always test emails on actual mobile devices
- 📝 Lesson: Edge Functions cold start can be slow (~2s)

---

## Phase 3: Notification System (Completed)

**Timeline**: Mid development  
**Status**: ✅ Complete

### What Was Built
1. **Orchestrator Pattern**
   - `notifications/orchestrator` routes notification requests
   - Determines channel (email, SMS, push) based on preferences
   - Handles retry logic and failure tracking

2. **Email Delivery**
   - `notifications/send-email` handles actual sending
   - Template selection based on notification type
   - HTML + text fallback

3. **Cleanup Job**
   - `notifications/cleanup` removes old notification records
   - Prevents database bloat
   - Runs on scheduled cron

### What Worked
- ✅ Orchestrator pattern allows future SMS/push addition
- ✅ Separation of routing from delivery is clean
- ✅ Cleanup job prevents database bloat

### What Failed / Lessons Learned
- 📝 Lesson: Need better monitoring for failed notifications
- 📝 Lesson: Retry logic should be exponential backoff

---

## Phase 4: Subscription & Payments (Completed)

**Timeline**: Mid development  
**Status**: ✅ Complete

### What Was Built
1. **Stripe Integration**
   - `subscriptions/create-intent` starts checkout
   - `subscriptions/verify-session` confirms payment
   - `subscriptions/stripe-webhooks` handles events
   - `subscriptions/check-status` validates active subscription
   - `subscriptions/manage-tier` updates plan

2. **Tiered Plans**
   - Free tier with limitations
   - Paid tiers with feature unlocks
   - Database fields track subscription status

3. **Webhook Handling**
   - Processes: payment_succeeded, subscription_updated, subscription_cancelled
   - Updates database on subscription changes
   - Idempotent webhook processing

### What Worked
- ✅ Stripe Checkout simplifies payment UI
- ✅ Webhooks keep database in sync
- ✅ Tiered access clear and enforceable
- ✅ Test mode makes development easy

### What Failed / Lessons Learned
- ⚠️ Webhook signature verification critical (security)
- 📝 Lesson: Always verify webhook signatures
- 📝 Lesson: Need clear upgrade prompts in UI

---

## Phase 5: Refactoring to Instruction-Driven (In Progress)

**Timeline**: December 15, 2025  
**Status**: 🚧 In Progress

### What's Being Built
1. **Working Memory Pattern**
   - `working-memoryory/` directory structure
   - Persistent context files (projectBrief, activeContext, etc.)
   - Integration into copilot-instructions.md

2. **Instruction Architecture**
   - Plan to create `.github/instructions/setup/`
   - Pattern documentation in `.github/instructions/patterns/`
   - Workflow templates in `.github/instructions/workflows/`
   - Business type examples

3. **Generator Deprecation**
   - Decision to move away from CLI generator
   - Keep `generator/` as reference for now
   - Focus on instruction-driven workflow

### What's Working
- ✅ Working Memory pattern solves stateless LLM problem
- ✅ Copilot-instructions.md updated with workflow
- ✅ Clear plan for instruction structure

### Current Challenges
- 🤔 Decide fate of `generator/` directory
- 🤔 How tightly to couple with ScheduleBoard v2
- 🤔 Business config: YAML vs markdown instructions

### Next Steps
1. Create `.github/instructions/setup/` structure
2. Write first setup guide (00-project-init.md)
3. Document database patterns
4. Create business type decision tree
5. Fill out remaining Working Memory files

---

## Phase 6: Component Extraction (Not Started)

**Timeline**: TBD  
**Status**: ❌ Not Started

### Planned Work
1. **Extract Core Components from ScheduleBoard v2**
   - Authentication UI components
   - Service item management components
   - Client/worker management components
   - Mobile-optimized input components

2. **Generalize Components**
   - Add BusinessConfig props
   - Make terminology configurable
   - Add feature toggle support

3. **Document Extraction**
   - Map source → template for each component
   - Document generalization decisions
   - Provide usage examples

### Dependencies
- Need Working Memory and instruction architecture complete first
- ScheduleBoard v2 production release should be stable

---

## Phase 7: Example Applications (Not Started)

**Timeline**: TBD  
**Status**: ❌ Not Started

### Planned Work
1. **HVAC Business Example**
   - Full implementation using template
   - Job tracking, technician scheduling
   - Equipment tracking

2. **Cleaning Business Example**
   - Recurring appointments
   - Team management
   - Route optimization

3. **Personal Care Example**
   - Appointment booking
   - Stylist schedules
   - Package/membership management

---

## Abandoned Approaches

### Generator CLI (Abandoned December 2025)
**Why Built**: Thought code generation would be faster  
**Why Abandoned**: Too complex to maintain, instruction-driven is better  
**What We Learned**: Copilot + instructions > custom CLI  
**Code Location**: `generator/` (kept as reference)

---

## Key Metrics & Learnings

### Development Velocity
- **Auth System**: ~3 days including edge functions
- **Notification System**: ~2 days with orchestrator pattern
- **Subscription System**: ~4 days including Stripe integration
- **Working Memory Setup**: ~1 day to establish pattern

### What Accelerates Development
1. ✅ Clear database schema defined upfront (data-first design)
2. ✅ Edge Functions for business logic (keeps frontend simple)
3. ✅ TypeScript strict mode (catches bugs early)
4. ✅ Supabase RLS (security built-in)
5. ✅ Working Memory (persistent context across sessions)

### What Slows Development
1. ⚠️ Over-engineering abstractions before needed (YAGNI violation)
2. ⚠️ Mobile testing on actual devices (necessary but time-consuming)
3. ⚠️ Webhook testing (need to use Stripe CLI or ngrok)
4. ⚠️ Cold start times on Edge Functions (2-3s on first request)

---

## Template for Future Entries

```markdown
## Phase X: [Feature Name] ([Status])

**Timeline**: [Start] → [End]  
**Status**: [Not Started | In Progress | Complete | Abandoned]

### What Was Built
1. **[Component/Feature 1]**
   - [Detail]
   - [Detail]

### What Worked
- ✅ [Success]
- ✅ [Success]

### What Failed / Lessons Learned
- ❌ [Failure]
- 📝 Lesson: [Learning]

### Metrics
- **Time Spent**: [X days/hours]
- **Lines of Code**: [Estimate]
- **Files Changed**: [Count]
```

---

# 🚀 LogbookAnalyzer Project Progress

*Separate from template history above.*

## Phase 1: Core Logic & Analytics (In Progress)

**Status**: 🚧 In Progress

### What Was Built
1.  **Workout Naming Engine**
    -   Canonical naming logic (`750/500/250...`)
    -   **Polish**: Added Fuzzy matching (avg distance), Ladder detection (`v100...1000m`), and Pyramid detection.
    -   **Refinement**: Prioritized Standard Time naming (e.g. `1x30:00`) over distance for single intervals.
    -   Handling of variable intervals and repeating patterns.
    -   Fixes for "Unstructured" misclassification.

2.  **Analytics Foundation**
    -   "Time in Zone" chart using aggregated power buckets (percentages).
    -   `PRList` component for displaying Personal Records.
    -   Raw data parsing for PR detection.

3.  **Sync Reliability**
    -   Retry logic and error handling for 500/CORS errors.
    -   Date handling fixes.

4.  **Guest Mode / Public Demo**
    -   Frontend-only implementation using curated mock data (`demoData.ts`).
    -   Bypassed Supabase calls for `isGuest` users to ensure security and prevent errors.
    -   Implemented in AuthContext, Analytics, Dashboard, and WorkoutDetail.

### Key Learnings
-   **Date Parsing**: Concept2 dates can be tricky; standardized on specific parsing logic.
-   **Interval Detection**: `rest_time` vs `rest_distance` requires careful handling for variable identifiers.

