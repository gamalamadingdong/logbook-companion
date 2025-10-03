# Legacy Application Migration to SGE Template

🎯 **MIGRATION STRATEGY:** Transform legacy system using SGE Template as the target architecture

## 📋 Project & Business Context

{{PROJECT_DESCRIPTION}}

---

## Project Overview
**Migration Target:** {{project_name}}
**Business Type:** {{business_type}}
**Migration Scope:** {{migration_scope}}
**Timeline:** {{timeline}}
**Target Architecture:** SGE Template (React + Supabase + TypeScript)

## SGE Template Foundation

### Target Architecture Components
**The SGE template provides these ready-to-use components for your migration:**

- **🎨 Frontend Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui components
- **🗄️ Backend Stack:** Supabase (PostgreSQL + Edge Functions + Auth + Realtime + Storage)
- **📱 Mobile Stack:** Capacitor for native iOS/Android compilation
- **💳 Payment Stack:** Stripe integration with subscription management (`packages/functions/subscriptions/`)
- **📧 Email Stack:** Resend/SendGrid integration with templates (`packages/functions/notifications/`)
- **🔐 Auth Stack:** Complete authentication system (`packages/functions/auth/`)
- **🏗️ Architecture:** Multi-tenant SaaS with role-based access control (`infra/schema/`)

### Migration Philosophy
**Don't rebuild from scratch - adapt to proven SGE patterns:**
1. **Map legacy entities** to SGE data models (see `infra/schema/core.sql`)
2. **Adopt SGE components** instead of recreating UI (see `packages/ui/`)
3. **Use SGE integration patterns** for external services (see `packages/functions/`)
4. **Follow SGE mobile patterns** for responsive design (see `packages/shared/hooks/use-mobile.tsx`)

## Legacy System Analysis

### Current Architecture → SGE Mapping
<!-- AI should analyze legacy system and map to SGE template components -->
- **Framework/Technology:** [Current] → React + TypeScript + Vite
- **Database:** [Current] → Supabase PostgreSQL with SGE schema patterns
- **Authentication:** [Current] → Supabase Auth with SGE role patterns
- **Key Dependencies:** [Current] → SGE template dependencies
- **Deployment Model:** [Current] → Vercel + Supabase deployment

### Business Logic Inventory
<!-- AI should catalog existing business logic -->
- **Core Features:** [List primary features to migrate]
- **Business Rules:** [Document critical business logic]
- **Data Models:** [Catalog existing data structures]
- **Integration Points:** [External systems and APIs]
- **User Workflows:** [Key user journey patterns]

### Technical Debt Assessment
<!-- AI should identify technical debt and modernization opportunities -->
- **Outdated Dependencies:** [Libraries/frameworks to modernize]
- **Security Vulnerabilities:** [Known security issues to address]
- **Performance Issues:** [Scalability and performance bottlenecks]
- **Code Quality Issues:** [Areas needing refactoring]
- **Testing Gaps:** [Missing test coverage areas]

## Interactive Discovery Insights

⚠️ **CRITICAL SECTION:** Document key insights from AI interactive discovery session

### Business Logic Deep Dive
<!-- Fill after interactive AI discovery session -->
- **Critical Business Rules:** [Complex business logic not obvious from code]
- **Edge Cases & Exceptions:** [Important edge cases and error handling requirements]
- **User Workflow Insights:** [How users actually interact with critical features]
- **Domain-Specific Requirements:** [Industry or business-specific needs]

### Migration Risk Assessment
<!-- Fill after interactive discovery session -->
- **High-Risk Areas:** [Functionality requiring extra care during migration]
- **Critical Dependencies:** [Systems or processes that cannot fail]
- **Timing Constraints:** [Business cycles or deadlines affecting migration timing]
- **User Impact Concerns:** [Areas where users are most sensitive to changes]

### Strategic Migration Decisions
<!-- Fill after interactive discovery session -->
- **Feature Priority Adjustments:** [Changes to feature priorities based on discovery]
- **Architecture Decisions:** [Key technical decisions influenced by business understanding]
- **Integration Strategy:** [Approach for handling external systems based on discovered requirements]
- **User Experience Strategy:** [UX improvements and migration approach based on user insights]

### Discovery Session Summary
- **Session Date:** [Date of interactive discovery]
- **Key Participants:** [Who was involved in discovery]
- **Major Insights:** [Top 3-5 insights that changed understanding]
- **Strategy Adjustments:** [How discovery changed the original migration approach]

## Migration Strategy

### Phase 1: Foundation & Infrastructure
**Duration:** {{phase1_duration}}
**Goal:** Establish SGE template foundation with core infrastructure

**Activities:**
- [ ] Generate SGE template with target business type configuration
- [ ] Set up Supabase backend with schema design
- [ ] Configure authentication and basic user management
- [ ] Establish CI/CD pipeline and deployment infrastructure
- [ ] Create development environment setup

**Success Criteria:**
- SGE template running with basic auth
- Database schema supports core entities
- Development workflow established

### Phase 2: Data Migration & Core Features
**Duration:** {{phase2_duration}}
**Goal:** Migrate core data and implement essential features

**Activities:**
- [ ] Design data migration scripts from legacy system
- [ ] Implement core business logic in SGE architecture
- [ ] Migrate user accounts and essential data
- [ ] Develop key user workflows in new system
- [ ] Create parallel running capability for validation

**Success Criteria:**
- Core features functional in SGE template
- Data successfully migrated with integrity validation
- Basic user workflows operational

### Phase 3: Feature Parity & Enhancement
**Duration:** {{phase3_duration}}
**Goal:** Achieve feature parity and add SGE template enhancements

**Activities:**
- [ ] Complete remaining feature migration
- [ ] Implement SGE template-specific enhancements (notifications, subscriptions, etc.)
- [ ] Performance optimization and scaling preparation
- [ ] Comprehensive testing and quality assurance
- [ ] User acceptance testing and feedback incorporation

**Success Criteria:**
- Full feature parity achieved
- SGE enhancements integrated
- Performance meets or exceeds legacy system

### Phase 4: Cutover & Optimization
**Duration:** {{phase4_duration}}
**Goal:** Complete migration and optimize new system

**Activities:**
- [ ] Final data synchronization and cutover
- [ ] DNS and traffic routing to new system
- [ ] Legacy system decommissioning plan execution
- [ ] Post-migration monitoring and optimization
- [ ] Documentation and knowledge transfer completion

**Success Criteria:**
- All users migrated to new system
- Legacy system safely decommissioned
- New system stable and optimized

## Risk Assessment & Mitigation

### High-Risk Areas
<!-- AI should identify high-risk migration areas -->
1. **Data Migration Complexity**
   - Risk: Data loss or corruption during migration
   - Mitigation: Comprehensive backup strategy, incremental migration, validation checks

2. **Feature Compatibility**
   - Risk: Business logic differences between systems
   - Mitigation: Detailed business logic analysis, prototype validation, user testing

3. **User Adoption**
   - Risk: User resistance to new interface/workflows
   - Mitigation: Phased rollout, training programs, feedback collection

4. **Integration Dependencies**
   - Risk: Breaking existing system integrations
   - Mitigation: Integration mapping, API compatibility layer, testing harness

### Contingency Plans
- **Rollback Strategy:** [Plan for reverting to legacy system if needed]
- **Parallel Operation:** [Strategy for running both systems during transition]
- **Emergency Procedures:** [Critical issue response protocols]

## Resource Requirements

### Development Team
- **Technical Lead:** 1 FTE for architecture and oversight
- **Full-Stack Developers:** {{dev_team_size}} FTE for implementation
- **Data Migration Specialist:** 0.5 FTE for data strategy and execution
- **QA Engineer:** 0.5 FTE for testing and validation

### Infrastructure
- **Development Environment:** {{dev_infrastructure}}
- **Staging Environment:** {{staging_infrastructure}}  
- **Production Environment:** {{prod_infrastructure}}
- **Migration Tools:** {{migration_tools}}

### Timeline & Milestones
- **Phase 1 Completion:** {{phase1_end_date}}
- **Phase 2 Completion:** {{phase2_end_date}}
- **Phase 3 Completion:** {{phase3_end_date}}
- **Go-Live Date:** {{go_live_date}}

## Success Metrics

### Technical Metrics
- **Performance:** Page load times < 2s (target: 50% improvement over legacy)
- **Reliability:** 99.9% uptime (target: improvement over legacy)
- **Security:** Zero critical vulnerabilities, modern auth standards
- **Maintainability:** 90% test coverage, documented architecture

### Business Metrics
- **User Satisfaction:** Net Promoter Score > 7 (target: 20% improvement)
- **Feature Usage:** 90% feature adoption within 3 months
- **Operational Efficiency:** 30% reduction in maintenance overhead
- **Time to Market:** 50% faster feature deployment cycle

## Communication Plan

### Stakeholder Updates
- **Weekly:** Technical team sync and progress review
- **Bi-weekly:** Business stakeholder progress reports
- **Monthly:** Executive summary and milestone review
- **Ad-hoc:** Critical issue escalation and resolution

### User Communication
- **Pre-Migration:** System overview, training materials, timeline communication
- **During Migration:** Progress updates, feature previews, training sessions  
- **Post-Migration:** Support resources, feedback collection, optimization updates

## Quality Assurance Strategy

### Testing Approach
- **Unit Testing:** Minimum 90% coverage for business logic
- **Integration Testing:** All external system connections validated
- **End-to-End Testing:** Critical user workflows automated
- **Performance Testing:** Load testing at 150% expected capacity
- **Security Testing:** Penetration testing and vulnerability assessment

### Validation Process
- **Data Integrity:** Checksums and business rule validation for migrated data
- **Feature Parity:** Side-by-side comparison testing with legacy system
- **User Acceptance:** Structured UAT process with key user representatives
- **Regression Testing:** Comprehensive testing after each deployment

---

## Migration Checklist

### Pre-Migration
- [ ] Legacy system analysis completed
- [ ] Business requirements documented
- [ ] Technical architecture approved  
- [ ] Resource allocation confirmed
- [ ] Risk mitigation plans in place

### During Migration
- [ ] Phase gates and milestone reviews
- [ ] Continuous testing and validation
- [ ] Stakeholder communication maintained
- [ ] Issue tracking and resolution
- [ ] Progress monitoring against timeline

### Post-Migration
- [ ] System performance monitoring
- [ ] User feedback collection and analysis
- [ ] Legacy system decommissioning
- [ ] Documentation and knowledge transfer
- [ ] Lessons learned documentation

---

*This migration plan should be customized based on the specific legacy system analysis and business requirements gathered through the AI-assisted discovery process.*