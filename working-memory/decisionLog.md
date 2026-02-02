# Decision Log: Architectural Decision Records (ADRs)

**Format**: Each decision includes Context, Decision, Rationale, Consequences, and Alternatives Considered

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
