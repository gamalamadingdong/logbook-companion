---
applyTo: '**'
---

# SGE Template - Project Instructions & Context

## Critical Technical Components
backend db provider: supabase (configurable per generated project)
frontend framework: react + typescript + vite
mobile framework: capacitor
ui framework: tailwind + shadcn/ui
hosting provider: vercel (configurable)
template scope: multi-business-type service applications
email provider: resend (configurable)
payment provider: stripe (configurable)

## Important Links

- [Source Repository](https://github.com/gamalamadingdong/scheduleboardv2) - Production ScheduleBoard v2
- [Template Repository](https://github.com/your-org/sge-template) - This template project
- [Component Source](../scheduleboardv2/src/components/) - Extract components from here

## Project Overview

**SGE Template** is a production-ready foundation for creating high-quality applications using proven architecture patterns. This foundation ensures we can systematically extract ScheduleBoard v2's production-quality components while making them adaptable across different application types. The parallel development approach allows ScheduleBoard to continue evolving while we build a reusable template system.

**CURRENT STATUS**: Template foundation established. Focus has returned to ScheduleBoard v2 production release preparations. Template extraction will resume after ScheduleBoard production deployment.

### Mission
Transform the battle-tested ScheduleBoard v2 architecture into a comprehensive, reusable template that accelerates high-quality application development across web, iOS, and Android platforms for personal business ventures.

### Template Target Applications
Service businesses (HVAC, plumbing, cleaning), productivity applications, mobile-first SaaS products, e-commerce platforms, content management systems, and any application requiring proven mobile-optimized architecture with real-time capabilities.

## Technology Stack & Architecture

### Core Technologies
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth)
- **Mobile**: Capacitor (for native mobile app compilation)
- **Email**: Resend (resend.dev domain)
- **Domain**: scheduleboard.co
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context + Custom hooks


### Key Architectural Decisions
- **Multi-tenant SaaS**: Complete tenant isolation with business-based data segregation
- **Mobile-first responsive design**: Works seamlessly across web, iOS, and Android
- **Real-time capabilities**: Live updates using Supabase realtime subscriptions
- **Role-based access control**: 7-tier permission system from USER to OWNER
- **Offline-capable**: Core functionality available without internet

## Template Architecture Guidelines

**CRITICAL**: This is a TEMPLATE project that extracts and generalizes components from ScheduleBoard v2. Always reference both:
- **Source Schema**: `../scheduleboardv2/docs/db/supabase_schema.sql` - Production ScheduleBoard schema
- **Template Schema**: `infra/schema/` - Generalized templates for different business types

### Template Core Entities (Generalized)
- **businesses**: Multi-tenant foundation with configurable business_type (hvac, cleaning, etc.)
- **profiles**: User profiles with role-based access across business types
- **user_business_roles**: Permission system adaptable to different service industries
- **service_items**: Generalized work units (jobs, tasks, appointments, services)
- **clients**: Customer/client management adaptable to different terminology
- **workers**: Service providers (technicians, cleaners, specialists, contractors)
- **service_instances**: Scheduled occurrences of service items

### Business Type Adaptation
- **Configurable terminology**: "jobs" vs "appointments" vs "services" vs "projects"
- **Industry-specific fields**: Equipment tracking for trades, compliance for regulated services
- **Flexible workflows**: Different status progressions per business type
- **Feature toggles**: Enable/disable features based on business requirements

### Template Schema Patterns
- All entities include `business_type` enum for industry-specific variations
- Configurable field visibility based on BusinessConfig
- Extensible status workflows per industry
- Multi-tenant isolation preserved across all business types

## Code Quality Standards

### TypeScript Standards
- **Strict mode enabled**: No `any` types unless absolutely necessary
- **Interface definitions**: All data structures must have proper interfaces
- **Null safety**: Always handle potential null/undefined values
- **Generic types**: Use generics for reusable components and functions

### React Best Practices
- **Functional components only**: No class components
- **Custom hooks**: Extract complex logic into reusable hooks
- **Error boundaries**: Implement proper error handling
- **Loading states**: Always provide user feedback during async operations
- **Accessibility**: WCAG 2.1 AA compliance for all interactive elements

### Database Interaction Patterns
- **Always use typed Supabase client**: Leverage generated types
- **Row Level Security (RLS)**: All queries must respect business isolation
- **Error handling**: Graceful degradation for database failures
- **Optimistic updates**: Update UI immediately, rollback on failure

## Email Integration Guidelines

### Resend Configuration
- **Domain**: All emails sent from `*@scheduleboard.co` (verified domain)
- **Templates**: HTML templates with fallback text versions
- **Error handling**: Graceful fallback when email delivery fails
- **Development**: Use Resend's test mode for development

### Email Types
- **Authentication**: Account verification and password reset
- **Invitations**: Business invite emails with direct onboarding links
- **Notifications**: Job updates, schedule changes, system alerts
- **Transactional**: Confirmations, receipts, status updates

## Mobile/Capacitor Considerations

### Cross-Platform Compatibility
- **Responsive design**: Mobile-first approach with desktop enhancements
- **Touch interactions**: Optimized for mobile gestures and interactions
- **Native features**: Camera access, geolocation, push notifications
- **Offline storage**: Local data persistence using Capacitor storage

### Performance Optimization
- **Lazy loading**: Route-based code splitting
- **Image optimization**: Responsive images with proper sizing
- **Bundle size**: Monitor and optimize JavaScript bundle sizes
- **Memory management**: Efficient component lifecycle management

## Security & Privacy Requirements

### Authentication & Authorization
- **Supabase Auth**: Leverages built-in authentication with email verification
- **Role-based access**: Enforced at both API and UI levels
- **Session management**: Secure token handling and refresh
- **Multi-factor auth**: Available for enhanced security

### Data Protection
- **Business isolation**: Complete tenant data segregation
- **Audit trails**: Track all business-critical operations
- **Data encryption**: At rest and in transit
- **GDPR compliance**: User data deletion and export capabilities


## Template Development Workflow Guidelines

### Component Extraction & Generalization
- **Systematic extraction**: Use `scripts/extract-components.js` to extract from ScheduleBoard v2
- **Generalization patterns**: Remove business-specific logic, add configuration options
- **Business type adaptation**: Make components work across HVAC, cleaning, personal care, etc.
- **Preserve mobile-first**: Maintain all touch optimizations and responsive behavior

### Template Code Organization
- **Monorepo structure**: `packages/` for reusable components, `generator/` for CLI tool
- **Business configuration**: All components accept BusinessConfig for terminology and features
- **Feature toggles**: Components adapt based on business type requirements
- **Extraction mapping**: Document source→template mapping for all extracted components

### Testing Strategy
- **Unit tests**: Critical business logic and utility functions
- **Integration tests**: Database operations and API endpoints
- **E2E tests**: Critical user workflows (auth, onboarding, job creation)
- **Manual testing**: Cross-platform compatibility verification

### Performance Monitoring
- **Core Web Vitals**: Monitor loading performance and user experience
- **Database performance**: Query optimization and indexing
- **Error tracking**: Comprehensive error logging and monitoring
- **User analytics**: Track feature usage and adoption patterns

## Documentation Requirements

### Code Documentation
- **JSDoc comments**: For all public functions and complex logic
- **README files**: For each major feature or module
- **API documentation**: For all custom hooks and utilities
- **Database documentation**: Schema changes and migration notes

### Architecture Documentation
- **Decision records**: Document significant architectural decisions
- **Integration guides**: How to connect with external services
- **Deployment guides**: Step-by-step deployment and configuration
- **Troubleshooting guides**: Common issues and solutions

## Template Quality Assurance Checklist

Before implementing any template feature or component extraction:

1. **Component Generalization**: Verify component works across multiple business types (HVAC, cleaning, etc.)
2. **BusinessConfig Integration**: Ensure component respects business type configuration
3. **Type Safety**: Maintain strict TypeScript compilation across all business configurations
4. **Cross-Platform Preservation**: Verify mobile optimizations preserved during extraction
5. **Feature Toggle Testing**: Test component with different feature combinations enabled/disabled
6. **CLI Generation Testing**: Verify component works in generated projects
7. **Documentation Completeness**: Document business type variations and configuration options
8. **Source Mapping**: Document extraction source and generalization changes applied
9. **Library Imports**: Ensure no deprecated or insecure libraries are used.  Also ensure the libraries proposed exist and are well maintained.



## Template Development Principles

**Primary Goal**: Transform ScheduleBoard v2's proven architecture into a flexible, reusable template that accelerates personal business application development with consistent quality and mobile-first excellence.

**Key Priorities**:
1. **Maintain Production Quality**: All extracted components must preserve the mobile-first, production-ready quality of ScheduleBoard v2
2. **Enable Business Type Flexibility**: Components must adapt seamlessly across HVAC, cleaning, personal care, and other service industries
3. **Preserve Mobile Excellence**: All touch interactions, responsive behavior, and App Store compliance must be maintained
4. **Documentation Completeness**: Every extraction and generalization must be thoroughly documented with business type examples

Remember: We prioritize **proven patterns over experimental solutions**. When extracting components, choose generalization approaches that maintain the battle-tested quality of ScheduleBoard v2 while enabling flexibility across different service business types.

Remember: You should thoroughly explain your reasoning for template extraction decisions. Consider the implications of generalization on both complexity and the goal of accelerating diverse application development. Clarify any ambiguities about component requirements before proceeding. Ask clarifying questions about component extraction scope and target application types. Be very positive about the template's potential while being critical of overly complex generalization approaches. Focus on maintainable solutions that preserve ScheduleBoard's production quality while enabling rapid application development across various domains.