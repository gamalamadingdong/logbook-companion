# Decision Log: Architectural Decision Records (ADRs)

**Format**: Each decision includes Context, Decision, Rationale, Consequences, and Alternatives Considered

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

## ADR-005: Supabase Over Firebase

**Date**: Early development  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Need backend-as-a-service for database, auth, and serverless functions.

### Decision
Use Supabase (PostgreSQL-based) instead of Firebase (NoSQL).

### Rationale
1. **SQL Database**: Better for relational data (businesses, users, jobs)
2. **RLS Built-in**: Multi-tenant isolation at database level
3. **Open Source**: Can self-host if needed
4. **Developer Experience**: Better tooling and TypeScript support

### Consequences
**Positive**:
- Powerful PostgreSQL features
- Type-safe generated types
- Built-in RLS for security
- Excellent documentation

**Negative**:
- Smaller ecosystem than Firebase
- Slightly higher learning curve
- Real-time features less mature

### Alternatives Considered
1. **Firebase**: NoSQL less ideal for relational data, rejected
2. **AWS Amplify**: Too complex, rejected
3. **Custom Backend**: Too much work, rejected
4. **Hasura + PostgreSQL**: Supabase provides more out-of-box, rejected

---

## ADR-006: Tailwind CSS + shadcn/ui Over Material-UI

**Date**: Early development  
**Status**: Accepted  
**Author**: Sam Gammon

### Context
Need UI framework for consistent, professional-looking components.

### Decision
Use Tailwind CSS with shadcn/ui components instead of component libraries like Material-UI or Ant Design.

### Rationale
1. **Customization**: Full control over component styling
2. **Bundle Size**: Only ship components we use
3. **Modern**: Utility-first CSS is current best practice
4. **Copy-Paste Components**: shadcn/ui provides starting points we own

### Consequences
**Positive**:
- Complete style control
- Smaller bundle sizes
- Modern development experience
- Easy to customize per business type

**Negative**:
- More initial setup work
- Need to implement accessibility manually
- Less "batteries included" than MUI

### Alternatives Considered
1. **Material-UI**: Too opinionated, hard to customize, rejected
2. **Ant Design**: Similar issues to MUI, rejected
3. **Chakra UI**: Good but prefer Tailwind approach, rejected
4. **Plain CSS**: Too much work, rejected

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
