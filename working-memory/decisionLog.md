# Decision Log: Architectural Decision Records (ADRs)

**Format**: Each decision includes Context, Decision, Rationale, Consequences, and Alternatives Considered

---

## ADR-015: Reconciliation Source Priority ("Swiss Cheese" Strategy)

**Date**: February 6, 2026
**Status**: Accepted
**Author**: AI Assistant

### Context
We capture workout data from multiple sources:
1.  **Manual Entry**: Fast, available to everyone, but low trust (typos).
2.  **Concept2 Logbook Sync**: High trust, verified data, but delayed (nightly/manual sync).
3.  **ErgLink Stream**: Real-time, high trust, but requires hardware.

We need to merge these streams without creating duplicate workout entries (e.g. "5k" manual entry AND "5k" C2 sync).

### Decision
**Implement a strict Source Priority Hierarchy ("Gold/Silver/Bronze"):**

-   **Gold (3)**: Concept2 Logbook (Verified Hardware Data)
-   **Silver (2)**: ErgLink Stream (Live Hardware Data)
-   **Bronze (1)**: Manual/OCR Entry (User Reported)

**Rule**: A workout log can only be updated by a source of **higher or equal** priority.
-   Manual (Bronze) -> C2 (Gold): **UPGRADE** (Update existing record).
-   C2 (Gold) -> Manual (Bronze): **IGNORE** (Keep existing high-quality record).

### Rationale
1.  **Single Source of Truth**: The most verifiable data wins.
2.  **User Convenience**: Users can log manually for instant gratification, knowing it will be "upgraded" to verified data later.
3.  **Data Integrity**: Prevents lower-quality manual data from overwriting hardware-verified data.

---

## ADR-013: Global Template Library with Personal Usage Tracking

**Date**: February 4, 2026  
**Status**: Accepted  
**Author**: AI Assistant (User Decision)

### Context
During template library implementation, we needed to decide:
1. Should templates be per-user (private) or global (shared)?
2. Should `usage_count` show personal stats or community stats?
3. How do we balance team/coaching needs with personal tracking?

### Decision
**Templates are global/shared, but usage tracking is personal:**
- Template library shows ALL templates across all users
- Template detail page shows global `usage_count` (community popularity)
- Template library stat shows personal "X workouts categorized" count
- Each user's workout-template links are private

### Rationale
1. **Team/Coaching Platform**: Coaches create templates for entire team to use
2. **Community Discovery**: See what templates are popular across all users
3. **Personal Progress**: Still track your own adoption/categorization
4. **Best of Both Worlds**: Global resources + personal metrics

### Implementation
```typescript
// Template fetch: No user filter (global)
const templates = await fetchTemplates({ workoutType: 'erg' });

// Personal stats: User-filtered count
const { count } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('template_id', 'is', null);
```

### Consequences
**Positive**:
- Coaches can create templates once, shared with whole team
- Athletes can discover popular community templates
- Personal progress still tracked ("347 workouts categorized")
- Enables future features: template recommendations, team challenges

**Negative**:
- Users see templates they may never use
- Could get cluttered with low-quality templates (needs moderation later)
- No "my templates" vs "community templates" distinction in UI yet

### Alternatives Considered
1. **Fully Private**: Each user sees only their own templates
   - PRO: Clean, personal library
   - CON: Coaches can't share, team coordination harder
   
2. **Hybrid**: Separate "My Templates" and "Community Templates"
   - PRO: Best organization
   - CON: More complex UI, premature for current user base

---

## ADR-014: Template Sorting Strategy (Popularity vs Recency)

**Date**: February 4, 2026  
**Status**: Accepted  
**Author**: AI Assistant

### Context
Template library needed a sensible default sort order. Two competing needs:
1. **Discovery**: New users want to see most popular/proven templates
2. **Active Training**: Regular users want recently used templates at top

### Decision
**Dual sort modes with "Most Popular" as default:**
- Default: Sort by `usage_count DESC` (global popularity)
- Alternative: Sort by `last_used_at DESC` (personal recency)
- User can toggle via dropdown in template library

### Rationale
1. **New User Experience**: "Most Popular" shows proven templates first
2. **Power User Experience**: "Recently Used" surfaces active training templates
3. **Data-Driven**: Both metrics automatically maintained by database triggers
4. **Low Complexity**: Simple dropdown, no complex filtering

### Implementation
```typescript
// Database trigger maintains both fields
CREATE TRIGGER trigger_update_template_usage_count
AFTER INSERT OR UPDATE OF template_id OR DELETE ON workout_logs
FOR EACH ROW
EXECUTE FUNCTION update_template_usage_count();

// Trigger updates: usage_count++, last_used_at = MAX(workout.created_at)

// UI sort options
<select value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
    <option value="popular">Most Popular</option>
    <option value="recent">Recently Used</option>
</select>
```

### Consequences
**Positive**:
- Automatic maintenance (no manual sorting logic)
- Serves both new and experienced users
- Performance: Indexed columns for fast sorting

**Negative**:
- Requires database migration (manual SQL execution needed)
- "Recently Used" only meaningful if user has linked workouts
- No "sort by name" option (could add later)

### Migration Status
**Pending**: `migration_add_last_used_at.sql` created but not applied
- Requires manual execution in Supabase SQL Editor (MCP lacks DDL permissions)
- Until applied, "Recently Used" sort will show all templates as null (undefined order)

---

## ADR-012: Template Quality Signals & Execution Tracking Strategy

**Date**: February 3, 2026  
**Status**: Proposed (Needs Decision)  
**Author**: AI Assistant

### Context
The database has rich quality metrics for `workout_templates`:
- `average_rating`, `rating_count` (user feedback)
- `usage_count`, `completion_rate` (engagement metrics)
- `validated` (expert approval)

These are currently **not exposed in the UI**. The question is: **How do we connect templates to actual workout execution?**

**Current System**:
- LogbookCompanion syncs completed workouts from Concept2 API (post-facto)
- Templates exist as "blueprints" but no "assign → execute → track" flow
- No way to know if a user "selected" a template vs. did a similar workout organically

### The Fundamental Question
**How do users interact with templates?**

### Option A: Retrospective Matching (Passive)
**Model**: User rows freely, system matches completed workouts to templates after the fact

**How it works**:
1. User completes workout on PM5
2. Sync from Concept2 API
3. Parser generates canonical name (`4x500m/1:00r`)
4. Match against templates with same canonical name
5. Prompt: "Was this workout based on [Template X]?"

**Pros**:
- No workflow changes (users keep rowing how they want)
- Works with existing PM5 setup
- Leverages RWN canonical names (the "Trinity")

**Cons**:
- Fuzzy matching (was `4x500m/1:05r` the same as template `4x500m/1:00r`?)
- Can't distinguish "used template" vs "coincidentally similar workout"
- Completion rate = meaningless (can't know if they intended to finish)

---

### Option B: Explicit Template Selection (Active)
**Model**: User selects template BEFORE workout, system tracks execution

**How it works**:
1. User browses template library
2. Clicks "Do This Workout"
3. **Sub-options**:
   - **B1 (PM5 Programming)**: Bluetooth/USB to PM5, program workout directly
   - **B2 (Manual Reference)**: Display workout on screen, user manually programs PM5
   - **B3 (Planned Workout)**: Mark as "planned", match post-sync

**Pros**:
- Clear intent tracking
- Accurate completion rates
- Can prompt for post-workout rating
- Enables "planned vs actual" analysis

**Cons**:
- Requires workflow change (users must "select" templates)
- B1 requires Bluetooth implementation (erg-link complexity)
- B2 requires user to manually mirror data (error-prone)
- B3 still has fuzzy matching issue

---

### Option C: Hybrid Approach
**Model**: Both passive matching + explicit selection

**How it works**:
1. **If user explicitly selects**: Track as "planned workout", strong link
2. **If synced workout matches template**: Suggest "Was this based on [X]?"
3. **Analytics distinguish**: "explicit uses" vs "possible matches"

**Pros**:
- Flexible (supports both power users and casual rowers)
- Gradual adoption (can add explicit selection later)
- Better data quality over time

**Cons**:
- Two tracking systems to maintain
- Complexity in analytics (how to weight "confirmed" vs "suggested" usage)

---

### Option D: Templates as Documentation Only
**Model**: Templates are reference/inspiration, not execution tracking

**How it works**:
- Templates are "workout recipes" users can browse
- No execution tracking at all
- Quality metrics come from explicit reviews only (not usage-based)

**Pros**:
- Simple, no execution complexity
- Aligns with current "sync-only" model

**Cons**:
- Loses valuable engagement data
- Can't measure which workouts are actually effective
- No feedback loop for template quality

---

### Recommended Decision Path

**Phase 1 (Now)**: Expose existing quality signals **without** execution tracking
- Show `validated`, `average_rating`, `rating_count` as badges
- Add "Review This Template" button (ratings without execution)
- Filter templates by quality/validation

**Phase 2 (Later)**: Implement retrospective matching (Option A or C)
- Use RWN canonical names to suggest template matches post-sync
- Prompt: "This looks like [Template]. Was it?"
- Track "confirmed matches" separately from "possible matches"

**Phase 3 (Future)**: Add explicit template selection (Option B or C)
- "Plan Workout" feature
- PM5 programming via Bluetooth (erg-link integration)
- Full planned-vs-actual analytics

### Open Questions
1. **Primary Use Case**: Are templates for "planning" or "inspiration"?
2. **User Workflow**: Do we want to change how users interact with workouts?
3. **PM5 Integration**: Is programming the monitor directly a goal?
4. **Data Quality**: Is fuzzy matching good enough, or do we need explicit tracking?

### Next Steps
- **Decision needed**: Which option aligns with product vision?
- **User Research**: How do coaches/athletes currently use workout templates?
- **Technical Spike**: How hard is PM5 Bluetooth programming?

---

## ADR-001: Instruction-Driven Over Code Generator

**Date**: December 15, 2025  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Initially planned to build a CLI generator (`npx @sge/generator new-app`) that would scaffold new projects. However, this approach has significant drawbacks:
- Complex to maintain (template files + generation logic)
- Less flexible than direct Copilot integration
- "Black box" generation obscures what's happening
- Hard to customize for specific business needs

### Decision
Use structured instruction files (`.github/instructions/`) with GitHub Copilot to guide implementation instead of a code generator.

### Rationale
1. **Copilot-native**: Instructions are automatically picked up by GitHub Copilot
2. **Transparent**: User sees exactly what's being created and why
3. **Flexible**: Easy to adapt instructions for specific business types
4. **Maintainable**: Markdown files are simpler than generation code
5. **Composable**: Mix and match patterns for specific needs

### Consequences
**Positive**:
- Easier to maintain and update
- More flexible for edge cases
- Better developer experience (understand what's happening)
- Leverages existing Copilot infrastructure

**Negative**:
- Requires GitHub Copilot (not free)
- Slightly less "automated" than CLI
- User needs to understand instruction structure

### Alternatives Considered
1. **Full CLI Generator**: Too complex, decided against
2. **Yeoman Generator**: Outdated tooling, rejected
3. **Manual README**: Not structured enough, too error-prone
4. **Hybrid Approach**: Generator + instructions, unnecessary complexity

### Implementation Notes
- Keep `generator/` directory as reference but deprecate
- Create comprehensive `.github/instructions/` structure
- Use Working Memory pattern for persistent context

---

## ADR-002: Working Memory Pattern for Persistent Context

**Date**: December 15, 2025  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
LLMs are stateless - they reset memory with every new session. For long-term projects, this "amnesia" is a critical bottleneck. Developers lose context when starting new chat sessions.

### Decision
Implement a "Working Memory" - file-system-based context management using structured markdown files iworking-memorymemory/` directory.

### Rationale
1. **Persistence**: Files maintain state across chat sessions
2. **Explicit**: Clear documentation of decisions and state
3. **Copilot-compatible**: Instructions in main prompt enforce reading/writing
4. **Proven**: Pattern used successfully by colleagues
5. **Human-readable**: Developers can read files directly

### Consequences
**Positive**:
- Consistent context across sessions
- Clear project state documentation
- Prevents repeated setup questions
- Forces explicit decision tracking

**Negative**:
- Requires discipline to update files
- Additional file maintenance overhead
- Can become stale if not updated

### Alternatives Considered
1. **Chat History Only**: Too unreliable, rejected
2. **Database State**: Over-engineered, rejected
3. **Git Commit Messages**: Not structured enough, insufficient
4. **External Wiki**: Adds complexity, want single repo

### Implementation Notes
Files created:
- `projectBrief.md`: Mission and non-negotiables
- `productContext.md`: User problems and business model
- `activeContext.md`: Current state (updated frequently)
- `systemPatterns.md`: Architectural patterns
- `techContext.md`: Stack and configuration
- `decisionLog.md`: This file - ADRs
- `implementationLog.md`: Feature implementation history

---

## ADR-003: Multi-Tenant SaaS Architecture

**Date**: Early development  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Template needs to support multiple independent businesses using the same codebase/infrastructure.

### Decision
Implement complete multi-tenant isolation with `business_id` foreign keys and Row Level Security (RLS).

### Rationale
1. **Cost Efficiency**: One database for all businesses
2. **Simplified Deployment**: Single codebase deployment
3. **Data Isolation**: RLS ensures complete separation
4. **Proven Pattern**: ScheduleBoard v2 validates this approach

### Consequences
**Positive**:
- Lower infrastructure costs
- Easier to maintain (one codebase)
- Proven to work in production

**Negative**:
- RLS policies must be correct (security critical)
- Slightly more complex queries
- Migration complexity across tenants

### Alternatives Considered
1. **Separate Database Per Business**: Too expensive, rejected
2. **Separate Deployments**: Maintenance nightmare, rejected
3. **Application-Level Isolation**: Less secure, rejected

---

## ADR-004: Capacitor Over React Native

**Date**: Early development  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Need mobile app compilation for iOS and Android.

### Decision
Use Capacitor to wrap web app as native mobile app instead of React Native.

### Rationale
1. **Code Reuse**: Same codebase for web and mobile
2. **Web Standards**: Use familiar React + web APIs
3. **Simpler**: Less platform-specific code than React Native
4. **Proven**: ScheduleBoard v2 uses Capacitor successfully

### Consequences
**Positive**:
- Single codebase for all platforms
- Faster development
- Web developer skills transfer directly

**Negative**:
- Slightly less "native" feel than React Native
- Some performance limitations vs pure native
- Requires understanding of mobile web quirks

### Alternatives Considered
1. **React Native**: Different codebase, more complexity, rejected
2. **Flutter**: Different language (Dart), rejected
3. **Native iOS + Android**: Too slow, rejected
4. **PWA Only**: App Store presence important, rejected

---

## ADR-005: Three-Repo Architecture with Shared Type Convention

**Date:** 2026-02-15  
**Status:** Accepted  
**Context:** The ecosystem has three distinct apps (LC, EL, Hub) with different runtimes and deployment targets but a shared Supabase backend. The old `train-better` repo contained mixed mobile app code and is being archived.

**Decision:**
- **3 separate repos**: `logbook-companion` (Next.js/Vercel), `erg-link` (React Native/Expo), `train-better-hub` (Next.js/Vercel)
- **Shared type convention**: All repos use `src/lib/types/` with `database.ts` (generated), `shared.ts` (manual, kept in sync), `supabase.ts` (client), `index.ts` (barrel)
- **Single Supabase project** serving all three apps (shared auth, shared schema, app-specific RLS)
- **No shared npm package** for now — duplicate `shared.ts` across repos (< 200 LOC); revisit if drift becomes a problem

**Consequences:**
- Each repo deploys independently with zero coordination
- Type drift is possible but manageable at current scale (solo developer, 3 repos)
- Old `train-better` repo archived as reference; OCR code documented in `working-memory/train-better-ocr-integration-brief.md`
- Hub gets full Next.js treatment (not static) to support feedback forms, roadmap, docs, auth landing

**Alternatives Rejected:**
- Monorepo (Turborepo/Nx): Next.js + Expo in same monorepo creates tooling friction without team-scale benefit
- Shared npm package: Overhead of publishing/versioning not justified for < 200 LOC of shared types

---

## Template for Future ADRs

```markdown
## ADR-XXX: [Title]

**Date**: [YYYY-MM-DD]  
**Status**: [Proposed | Accepted | Deprecated | Superseded]  
**Author**: [Name]

### Context
[What's the situation? What problem are we solving?]

### Decision
[What did we decide to do?]

### Rationale
[Why did we make this decision? List key reasons.]

### Consequences
**Positive**:
- [Good outcome 1]
- [Good outcome 2]

**Negative**:
- [Trade-off 1]
- [Trade-off 2]

### Alternatives Considered
1. **[Alternative 1]**: [Why rejected]
2. **[Alternative 2]**: [Why rejected]

### Implementation Notes
[Any specific details about how this was implemented]
```
