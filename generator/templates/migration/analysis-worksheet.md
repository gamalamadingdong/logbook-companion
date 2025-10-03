# Legacy System Analysis Worksheet

## System Overview
**Project Name:** ___________________________
**Current Technology Stack:** ___________________________
**Business Domain:** ___________________________
**Analysis Date:** ___________________________

## 📋 Codebase Analysis Checklist

### Technology Stack Assessment
- [ ] **Primary Framework/Language:** ___________________________
- [ ] **Database Technology:** ___________________________
- [ ] **Authentication System:** ___________________________
- [ ] **Frontend Architecture:** ___________________________
- [ ] **Build Tools:** ___________________________
- [ ] **Testing Framework:** ___________________________
- [ ] **Deployment Method:** ___________________________

### Code Quality Metrics
- [ ] **TypeScript Usage:** □ Full □ Partial □ None
- [ ] **Test Coverage:** _____ % (estimated)
- [ ] **Linting/Code Standards:** □ Yes □ No
- [ ] **Documentation Quality:** □ Good □ Fair □ Poor
- [ ] **Dependency Health:** □ Up-to-date □ Some outdated □ Many outdated

### Business Logic Inventory
#### Core Entities/Models
1. ___________________________
2. ___________________________
3. ___________________________
4. ___________________________
5. ___________________________

#### Key Business Processes
1. ___________________________
2. ___________________________
3. ___________________________
4. ___________________________

#### User Roles & Permissions
1. ___________________________
2. ___________________________
3. ___________________________

### Integration Points
- [ ] **External APIs:** ___________________________
- [ ] **Third-party Services:** ___________________________
- [ ] **Database Integrations:** ___________________________
- [ ] **File Storage:** ___________________________
- [ ] **Payment Processing:** ___________________________
- [ ] **Email/Notifications:** ___________________________

## 🚨 Technical Debt Assessment

### High Priority Issues
- [ ] **Security Vulnerabilities:** ___________________________
- [ ] **Performance Bottlenecks:** ___________________________
- [ ] **Scalability Limitations:** ___________________________
- [ ] **Deprecated Dependencies:** ___________________________

### Medium Priority Issues
- [ ] **Code Duplication:** ___________________________
- [ ] **Poor Error Handling:** ___________________________
- [ ] **Missing Tests:** ___________________________
- [ ] **Inconsistent Patterns:** ___________________________

### Low Priority Issues
- [ ] **Documentation Gaps:** ___________________________
- [ ] **Code Style Issues:** ___________________________
- [ ] **Minor Refactoring Opportunities:** ___________________________

## 💼 Business Context Assessment

### Migration Drivers
- [ ] **Technology Modernization**
- [ ] **Performance Issues** 
- [ ] **Security Concerns**
- [ ] **Scalability Needs**
- [ ] **Maintenance Burden**
- [ ] **Team Skill Alignment**
- [ ] **Cost Optimization**
- [ ] **Feature Development Speed**

### Business Constraints
- [ ] **Timeline:** ___________________________
- [ ] **Budget:** ___________________________
- [ ] **Team Size:** ___________________________
- [ ] **Uptime Requirements:** ___________________________
- [ ] **Compliance Requirements:** ___________________________

### Success Criteria
1. ___________________________
2. ___________________________
3. ___________________________

## 🎯 Migration Complexity Assessment

### Low Complexity Indicators □
- [ ] Standard framework patterns
- [ ] Simple data models
- [ ] Minimal custom business logic
- [ ] Few external integrations
- [ ] Good test coverage
- [ ] Clear separation of concerns

### Medium Complexity Indicators □
- [ ] Some custom implementations
- [ ] Moderate business logic complexity
- [ ] Several external integrations
- [ ] Mixed code quality
- [ ] Partial test coverage
- [ ] Some tightly coupled components

### High Complexity Indicators □
- [ ] Heavy custom implementations
- [ ] Complex business rules
- [ ] Many external dependencies
- [ ] Legacy patterns throughout
- [ ] Poor or no test coverage
- [ ] Highly coupled architecture

**Overall Complexity Rating:** □ Low □ Medium □ High

## 📊 Migration Strategy Recommendation

### Recommended Approach
- [ ] **Big Bang Migration** (Complete replacement)
- [ ] **Phased Migration** (Feature-by-feature)
- [ ] **Parallel Development** (Build alongside existing)
- [ ] **Incremental Modernization** (Gradual improvement)

### Justification
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

### Estimated Timeline
- **Phase 1 (Foundation):** _____ weeks
- **Phase 2 (Core Features):** _____ weeks
- **Phase 3 (Full Migration):** _____ weeks
- **Phase 4 (Optimization):** _____ weeks

**Total Estimated Duration:** _____ weeks

### Resource Requirements
- **Developers:** _____ FTE
- **Designer:** _____ FTE
- **QA:** _____ FTE
- **DevOps:** _____ FTE
- **Project Manager:** _____ FTE

## 🔍 Areas Requiring Interactive Discovery

*These questions should be explored during the AI interactive discovery session (see ai-discovery-guide.md)*

### Critical Business Logic ⚡
- [ ] **Complex workflow identified:** ___________________________  
  *Questions to explore in AI chat:* What business scenarios trigger this? What are the edge cases?

- [ ] **Business rules not evident in code:** ___________________________  
  *Questions to explore in AI chat:* Are there unwritten business rules? Validation logic?

- [ ] **User workflow complexity:** ___________________________  
  *Questions to explore in AI chat:* How do users actually use this feature? Pain points?

### Integration & Data Dependencies 🔗
- [ ] **External system integration:** ___________________________  
  *Questions to explore in AI chat:* Error handling? Timing requirements? Fallback procedures?

- [ ] **Data relationships and constraints:** ___________________________  
  *Questions to explore in AI chat:* Critical data integrity rules? Migration dependencies?

### Risk Areas Needing Clarification ⚠️
- [ ] **High-risk functionality:** ___________________________  
  *Questions to explore in AI chat:* What happens when this fails? Recovery procedures?

- [ ] **Performance-critical areas:** ___________________________  
  *Questions to explore in AI chat:* Usage patterns? Acceptable performance thresholds?

## ✅ Analysis Workflow Checklist

⚠️ **IMPORTANT:** Complete automated analysis BEFORE interactive discovery session

### Phase 1: Automated Analysis
- [ ] Complete technical codebase analysis using AI discovery guide
- [ ] Fill out all technical assessment sections above
- [ ] Identify areas needing clarification (mark in sections above)
- [ ] Document findings and prepare questions for interactive session

### Phase 2: Interactive AI Discovery Session (CRITICAL)
- [ ] **Start AI chat session** using prompts from ai-discovery-guide.md
- [ ] **Ask clarifying questions** about complex business logic and workflows
- [ ] **Validate AI understanding** of critical system behavior and edge cases  
- [ ] **Explore user experience** requirements and pain points
- [ ] **Assess migration risks** and dependencies through discussion
- [ ] **Document session insights** in migration-plan.md

### Phase 3: Migration Planning  
- [ ] Update migration-plan.md with interactive discovery insights
- [ ] Generate detailed migration plan using AI with discovered context
- [ ] Design SGE template configuration based on business understanding
- [ ] Create implementation roadmap with validated requirements

### Planning Phase
- [ ] Generate detailed migration plan using templates
- [ ] Create SGE template configuration for business type
- [ ] Design data migration strategy
- [ ] Estimate resource requirements and timeline

### Preparation Phase
- [ ] Set up development environment
- [ ] Create project repository structure
- [ ] Establish CI/CD pipeline
- [ ] Begin Phase 1 implementation planning

---

**Analysis Completed By:** ___________________________
**Review Date:** ___________________________
**Next Review:** ___________________________