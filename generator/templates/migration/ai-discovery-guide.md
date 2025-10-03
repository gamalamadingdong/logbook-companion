# AI-Assisted Legacy System Discovery Guide

This guide helps AI analyze existing codebases and gather migration requirements through structured discovery sessions.

## Phase 1: Codebase Analysis Framework

### Initial Code Scanning
Use these prompts to guide AI analysis of the existing system:

**Architecture Analysis:**
```
Please analyze this codebase and provide:
1. **Technology Stack Identification:**
   - Primary framework/language
   - Database technology and ORM/query patterns
   - Authentication/authorization approach
   - Frontend architecture (SPA, SSR, mobile, etc.)
   - Build tools and dependency management
   - Deployment and hosting patterns

2. **Code Structure Assessment:**
   - Project organization and folder structure
   - Separation of concerns (MVC, layered, etc.)
   - Code quality indicators (TypeScript usage, linting, etc.)
   - Test coverage and testing patterns
   - Documentation quality and completeness

3. **Business Logic Inventory:**
   - Core domain models and entities
   - Key business processes and workflows
   - Integration points and external dependencies
   - User roles and permissions structure
   - Data validation and business rules
```

**Technical Debt Evaluation:**
```
Assess the technical health of this codebase:
1. **Dependency Analysis:**
   - Outdated or deprecated packages
   - Security vulnerabilities in dependencies
   - Licensing compatibility issues
   - Package size and bundle analysis

2. **Code Quality Issues:**
   - Duplication and maintainability concerns
   - Performance bottlenecks and optimization opportunities
   - Security vulnerabilities and best practice violations
   - Error handling and logging patterns
   - Scalability limitations

3. **Migration Complexity Factors:**
   - Custom implementations vs. standard patterns
   - Tightly coupled components requiring refactoring
   - Legacy browser/platform compatibility requirements
   - Complex database schemas or migrations needed
   - Integration complexity with external systems
```

### File Analysis Priorities
Focus AI analysis on these key files (in order of importance):

1. **Configuration Files:** `package.json`, `requirements.txt`, `Gemfile`, etc.
2. **Database Schema:** Migration files, schema definitions, ORM models
3. **Authentication/Authorization:** User models, auth middleware, permission systems
4. **API Routes/Controllers:** REST endpoints, GraphQL schemas, route definitions
5. **Business Logic:** Service layers, domain models, core algorithms
6. **Frontend Components:** Main layouts, key user interface components
7. **Integration Code:** External API clients, webhook handlers, queue processors

## Phase 2: Interactive Discovery Session

### Pre-Session Preparation
Before starting the discovery session with the user, AI should:
1. Complete initial codebase analysis
2. Prepare specific questions based on findings
3. Identify areas needing clarification
4. Draft preliminary migration complexity assessment

### Discovery Questions Framework

#### Business Context & Goals
```
Let's start by understanding your business context and migration goals:

1. **Business Overview:**
   - What type of business/industry is this application serving?
   - Who are the primary users (internal staff, customers, partners)?
   - What are the core business processes this system supports?

2. **Migration Drivers:**
   - What's motivating this migration/refactoring project?
   - Are there specific pain points with the current system?
   - What business outcomes are you hoping to achieve?

3. **Success Criteria:**
   - How will you measure the success of this migration?
   - Are there specific performance, scalability, or user experience goals?
   - What would make this project a clear win for your organization?
```

#### Technical Requirements & Constraints
```
Now let's dive into technical requirements and constraints:

1. **System Requirements:**
   - Do you need to maintain backward compatibility with existing data?
   - Are there specific performance requirements (response times, concurrent users)?
   - What are your security and compliance requirements?

2. **Infrastructure Constraints:**
   - Do you have preferences for cloud providers or hosting approaches?
   - Are there budget constraints that might influence technology choices?
   - Do you have existing infrastructure that needs to be considered?

3. **Team & Timeline:**
   - What's your development team's experience with modern web technologies?
   - Do you have a target timeline or deadline for this migration?
   - Are there external factors (vendor contracts, business events) influencing timing?
```

#### Feature Prioritization
```
Let's prioritize what needs to be migrated and what can be enhanced:

1. **Core Feature Assessment:**
   Based on my analysis, I identified these main features: [LIST FEATURES]
   - Which of these are absolutely critical for day-one functionality?
   - Are there any features you'd like to retire or significantly change?
   - What new capabilities would you like to add during the migration?

2. **User Experience Priorities:**
   - Are there specific user workflows that are particularly important to preserve?
   - What are the most common user complaints about the current system?
   - Are there modern UX patterns you'd like to adopt?

3. **Integration Requirements:**
   - Which external system integrations are critical to maintain?
   - Are there new integrations you'd like to add during the migration?
   - Do you have API consumers that need to be considered?
```

#### Risk Assessment & Mitigation
```
Let's identify and plan for potential risks:

1. **Technical Risks:**
   Based on my analysis, I see these potential technical challenges: [LIST CHALLENGES]
   - How critical is system uptime during the migration?
   - Do you have the ability to run systems in parallel during transition?
   - Are there particular areas where you've had problems before?

2. **Business Risks:**
   - Are there seasonal or cyclical business patterns we need to work around?
   - How much user training/change management is feasible?
   - What's your tolerance for temporary feature gaps during migration?

3. **Resource Constraints:**
   - What development resources can be allocated to this project?
   - Do you need to maintain the existing system while building the new one?
   - Are there external consultants or contractors involved?
```

### Discovery Session Output Template
At the end of the discovery session, AI should produce:

```markdown
# Discovery Session Summary

## Business Context
- **Industry/Domain:** [Identified business type]
- **Primary Users:** [User roles and personas]
- **Core Business Value:** [Main business processes supported]

## Migration Drivers
- **Primary Motivation:** [Why migrating now]
- **Pain Points:** [Current system issues]
- **Success Metrics:** [How success will be measured]

## Technical Assessment
- **Current Stack:** [Technology summary from analysis]
- **Complexity Score:** [High/Medium/Low with justification]
- **Key Technical Challenges:** [Major technical hurdles]

## Requirements & Constraints
- **Must-Have Features:** [Critical functionality]
- **Nice-to-Have Features:** [Enhancement opportunities]
- **Technical Constraints:** [Infrastructure, security, performance requirements]
- **Timeline Constraints:** [Deadline and milestone requirements]

## Migration Strategy Recommendation
- **Recommended Approach:** [Big bang, phased, parallel, etc.]
- **Suggested Timeline:** [High-level timeline with phases]
- **Risk Mitigation:** [Key risk areas and mitigation strategies]

## Next Steps
1. Generate detailed migration plan with phases and timelines
2. Create technical architecture design for SGE template configuration
3. Develop data migration strategy and scripts
4. Set up project structure and development workflow
```

## Phase 3: Migration Plan Generation

### Plan Customization Prompts
After discovery, use these prompts to generate the detailed migration plan:

```
Based on the discovery session findings, please customize the migration plan template with:

1. **Business-Specific Configuration:**
   - Configure SGE template for [BUSINESS_TYPE] with appropriate entity names
   - Customize workflow templates for identified business processes
   - Set up role-based access control matching current user roles

2. **Technical Architecture Plan:**
   - Map current data models to Supabase schema design
   - Plan API compatibility layer for external integrations
   - Design authentication migration strategy from [CURRENT_AUTH] to Supabase Auth
   - Create component migration plan from [CURRENT_FRONTEND] to SGE UI patterns

3. **Phased Implementation Strategy:**
   - Break down features into logical migration phases
   - Identify dependencies and prerequisite work
   - Plan parallel operation strategy if needed
   - Create rollback procedures for each phase

4. **Resource and Timeline Planning:**
   - Estimate effort for each migration phase based on complexity analysis
   - Identify skill gaps and training needs
   - Plan testing strategy appropriate for system criticality
   - Create milestone schedule aligned with business constraints
```

## Phase 4: Implementation Guidance

### AI-Assisted Development Workflow
During implementation, AI should provide ongoing guidance:

1. **Code Generation:** Generate SGE template components based on legacy patterns
2. **Migration Scripts:** Create data migration and transformation scripts
3. **Testing Strategy:** Generate test suites covering critical business logic
4. **Documentation:** Maintain architecture decisions and migration progress
5. **Quality Assurance:** Review code against SGE template patterns and best practices

### Progress Tracking Prompts
```
Please review migration progress and provide:
1. **Completed Work Assessment:** What has been successfully migrated?
2. **Remaining Work Analysis:** What still needs to be done?
3. **Risk Updates:** Any new risks or issues identified?
4. **Timeline Adjustments:** Are we on track with the original plan?
5. **Quality Review:** Does the migrated code follow SGE template patterns?
```

---

This framework enables AI to systematically analyze legacy systems, gather comprehensive requirements through structured discovery, and generate detailed migration plans tailored to specific business needs and technical constraints.