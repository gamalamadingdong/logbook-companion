# Template Strategy — ScheduleBoard Stack

Date: September 30, 2025 (Updated)

## Purpose
Extract the battle-tested **infrastructure and tech stack patterns** from ScheduleBoard v2 into a production-ready starter template. This is NOT a business logic abstraction system - it's a solid foundation of proven patterns that you copy and customize for your specific needs.

## Core Philosophy
**"Copy-and-Adapt" Infrastructure, Not Business Logic Configuration**

This template provides:
- ✅ **Tech Stack Foundation**: React + TypeScript + Vite + Supabase + Capacitor fully configured
- ✅ **Infrastructure Patterns**: Multi-tenant database, auth, subscriptions, notifications
- ✅ **Component Templates**: Production-quality UI components you fork and customize
- ✅ **Build Automation**: Mobile versioning, deployment scripts, CI/CD templates
- ✅ **Integration Modules**: Optional Stripe, Resend, Twilio via CLI selection

- ❌ **NOT Business Logic**: No HVAC vs cleaning vs personal care abstractions
- ❌ **NOT Configuration-Driven**: No complex business type enum systems
- ❌ **NOT One-Size-Fits-All**: You own the code and customize everything

## Goals
- **Fast Project Setup**: Complete full-stack app (web + mobile + backend) in minutes
- **Production Infrastructure**: Multi-tenant, secure, scalable from day one
- **Mobile-First Ready**: iOS/Android deployment automation and App Store compliance
- **Proven Patterns**: Battle-tested from ScheduleBoard v2's production use
- **Developer Freedom**: Clear customization points, no framework lock-in

## Enhanced Template Contents (Production-Ready)

### Core Packages (Monorepo Structure)
- **packages/web** — React + TypeScript + Vite with complete mobile-first responsive design
- **packages/mobile** — Capacitor 7+ with iOS/Android deployment automation and App Store compliance
- **packages/functions** — 30+ production Supabase Edge Functions (auth, notifications, automation, subscriptions)
- **packages/shared** — Typed interfaces, mobile utilities, and cross-platform components
- **packages/ui** — Complete shadcn/ui system with mobile optimizations and touch-friendly interactions

### Mobile-First Component Library
- **Smart Components**: `SmartDashboard`, `TodaysWork`, `ResponsiveJobs` with role-based routing
- **Navigation**: `MobileBottomNav` (3-tab optimization), `AppSidebar` with responsive behavior
- **Schedule Management**: `ScheduleBoardMobile` with native swipe gestures and touch interactions
- **Job Management**: `MobileJobs`, `MobileJobDetail` with one-handed mobile optimization
- **Subscription System**: `FeatureGate`, mobile compliance, and tier-based access control

### Infrastructure & Automation
- **Build Automation**: `increment-ios-build.js`, `increment-android-build.js` for automated app store versioning
- **Timezone Utilities**: `dateUtils.ts` with locale-safe date operations (fixes UTC conversion bugs)
- **Mobile Detection**: `use-mobile.ts` hook for responsive behavior and device-specific optimizations
- **Deployment Scripts**: One-command iOS/Android builds with automated version management

### Production Edge Functions Library
- **Authentication**: `create-invite`, `process-invite`, `send-invite-email` with business onboarding
- **Notifications**: `notification-orchestrator`, `send-push-notification`, `send-sms-notification`
- **Automation**: `automated-daily-schedule`, `automated-status-updates`, `test-daily-automation`
- **Subscriptions**: `create-subscription-intent`, `stripe-webhooks`, `manage-subscription-tier`
- **Business Logic**: `convert-bid-to-job`, `admin-upgrade-business`, `delete-user-account`

### Documentation & Guides
- **Mobile Deployment**: Complete iOS/Android app store submission guides
- **App Store Compliance**: Payment processing policies and mobile subscription handling
- **Component Library**: Interactive documentation with mobile-first examples
- **Subscription Setup**: Stripe integration and feature gating implementation
- **Timezone Handling**: Best practices for cross-timezone service businesses

## CLI Generator (Simple Feature Selection)

### Interactive Project Setup
```bash
npx create-sge-app my-new-app

🚀 Project name: my-new-app
📱 Include mobile (Capacitor)? (Y/n)
💳 Add Stripe subscriptions? (Y/n)
� Add email (Resend)? (y/N)
� Add SMS (Twilio)? (y/N)
� Add Google Places? (y/N)
```

### What Gets Generated
- **Always Included**: React + TypeScript + Vite + Supabase + Multi-tenant database
- **If Mobile**: Capacitor config, build scripts, iOS/Android projects
- **If Stripe**: Subscription tables, webhook handlers, feature gate components
- **If Resend**: Email Edge Functions, template examples
- **If Twilio**: SMS notification functions
- **If Places**: Google Maps integration, address lookup

### What You Customize Yourself
- Your business logic (jobs, appointments, services, projects)
- Your data models beyond the core multi-tenant foundation
- Your UI/UX specific to your industry
- Your workflow automations
- Your feature set and terminology

### Monorepo Architecture (Recommended)
- **Development Efficiency**: Shared types, utilities, and CI pipelines
- **Mobile Integration**: Seamless web/mobile code sharing with Capacitor
- **Component Library**: Centralized UI components with mobile-first design
- **Function Sharing**: Edge functions accessible across web and mobile platforms

## Mobile-First Architecture Decisions

### Progressive Disclosure Strategy
- **Smart Dashboard**: Automatically routes field workers to `TodaysWork` component based on role
- **3-Tab Navigation**: Optimized `MobileBottomNav` reduces cognitive load and improves task completion
- **Context-Aware Views**: Smart routing based on user permissions and device capabilities

### Native Mobile Patterns
- **Touch Targets**: 44px minimum touch targets throughout the application
- **Swipe Gestures**: `ScheduleBoardMobile` supports native swipe navigation patterns
- **Bottom Sheets**: Modal patterns optimized for one-handed mobile use
- **Keyboard Handling**: Automatic layout adjustments for mobile keyboards and safe areas

### Cross-Platform Deployment
- **Capacitor 7.4+**: Latest cross-platform native features and optimizations
- **App Store Compliance**: Built-in subscription handling that adheres to iOS/Android policies
- **Automated Versioning**: Build number auto-increment for seamless store submissions
- **Native Features**: Camera access, GPS location, push notifications, phone dialing integration

## Security & Compliance Framework

### App Store Policy Compliance
- **Payment Processing**: Mobile users redirected to web for subscription management
- **Content Guidelines**: No payment UI exposed in mobile apps, compliance with store policies
- **Privacy & Data**: GDPR-ready user data management and account deletion workflows

### Multi-Tenant Security Architecture
- **Row Level Security**: Comprehensive RLS policies for complete business isolation
- **Role-Based Permissions**: 7-tier permission system from USER to OWNER with feature gating
- **Audit Trails**: Complete business operation logging and compliance tracking
- **Data Encryption**: At-rest and in-transit encryption with proper key management

## Infrastructure & Automation

### Supabase & Functions
- Keep canonical DB schema in `infra/supabase_schema.sql` with comprehensive RLS policies
- 30+ production Edge Functions following security best practices and idempotent patterns
- Automated deployment scripts with environment validation and rollback capabilities
- Function monitoring, error tracking, and performance optimization built-in

### CI/CD & Deployment
- **GitHub Actions Templates**: Automated testing, building, and deployment workflows
- **Mobile Build Automation**: iOS/Android version increment and store submission preparation  
- **Function Deployment**: Automated Supabase function deployment with environment management
- **Security Scanning**: Automated dependency scanning and security vulnerability detection

### Build & Version Management
- **Automated Versioning**: `increment-ios-build.js` and `increment-android-build.js` for store submissions
- **Cross-Platform Builds**: Single command builds for web, iOS, and Android deployment
- **Environment Management**: Secure handling of production, staging, and development environments
- **Deployment Validation**: Automated testing and validation before production deployment

## Component Library & Design System

### Mobile-Optimized Components
- **Smart Dashboard**: Role-based dashboard that adapts to user permissions and device type
- **Today's Work**: Field worker optimized view with GPS integration and offline capabilities
- **Responsive Navigation**: 3-tab mobile navigation with desktop sidebar progressive enhancement
- **Touch-Optimized Forms**: Mobile-friendly input patterns with validation and error handling

### Subscription & Feature Management
- **Feature Gating**: `FeatureGate` component with tier-based access control and upgrade prompts
- **Mobile Compliance**: App Store policy compliant subscription flows and payment handling
- **Permission System**: Granular role-based component and feature access control
- **Upgrade Flows**: Context-aware subscription upgrade suggestions and onboarding

### Utility Libraries
- **Date Handling**: Timezone-safe date utilities preventing UTC conversion bugs
- **Mobile Detection**: Responsive behavior hooks and device capability detection
- **Form Management**: Mobile-optimized form patterns with validation and accessibility
- **Navigation**: Cross-platform routing with deep linking and state preservation

## Maintenance & Upgrades Strategy

### Centralized Component Library (Recommended)
- **Scoped Package**: `@scheduleboard/components` with semantic versioning
- **Component Updates**: Centralized maintenance with automated dependency updates
- **Breaking Changes**: Clear migration guides and deprecation warnings
- **Documentation**: Interactive component library with mobile-first examples

### Template Synchronization Options
- **Option A (Template Repo)**: GitHub template with periodic manual updates
- **Option B (Automated Sync)**: Upstream template merging with conflict resolution
- **Option C (Package Management)**: Centralized component library with semver updates
- **Hybrid Approach**: Core components as packages, infrastructure as template

### Version Management
- **Component Library**: Semantic versioning with clear release notes and migration guides
- **Template Updates**: Automated dependency updates with security patch prioritization
- **Mobile App Versions**: Automated build number increment tied to CI/CD pipeline

## Production Deployment Checklist

### Mobile App Store Preparation
- ✅ App Store compliance for payment processing (redirect to web)
- ✅ Automated build version incrementing for iOS and Android
- ✅ Native feature integration (camera, GPS, push notifications)
- ✅ Cross-platform testing across iOS 15+ and Android 8+
- ✅ App icons, splash screens, and store assets preparation

### Infrastructure Readiness
- ✅ Multi-tenant Row Level Security policies implemented and tested
- ✅ Subscription management with Stripe integration and webhook handling
- ✅ Email delivery system with Resend integration and template management
- ✅ Edge Functions deployed with proper environment variable management
- ✅ Monitoring, logging, and error tracking systems configured

### Security & Compliance
- ✅ GDPR compliance with user data export and deletion capabilities
- ✅ App Store payment policy compliance for mobile subscriptions
- ✅ Multi-tenant data isolation with comprehensive audit trails
- ✅ Secure environment variable management and secret handling

## Implementation Roadmap

### Phase 1: Template Repository Creation
1. **Create `@scheduleboard/starter-template`** with complete mobile-first architecture
2. **CLI Generator Development** with business-specific prompts and automated setup
3. **Component Library Extraction** into reusable, versioned packages
4. **Documentation Site** with interactive examples and deployment guides

### Phase 2: Advanced Automation
1. **CI/CD Templates** for automated testing, building, and app store submission
2. **Mobile Build Pipeline** with automated versioning and store asset generation
3. **Environment Management** with secure secret handling and multi-environment support
4. **Monitoring Integration** with comprehensive logging and error tracking

### Phase 3: Ecosystem Development
1. **Business-Specific Templates** for HVAC, plumbing, electrical, landscaping verticals
2. **Plugin System** for third-party integrations and custom business logic
3. **Migration Tools** for existing applications to adopt the ScheduleBoard architecture
4. **Community Contributions** with clear contribution guidelines and component standards

## Contact & Next Steps

Ready to implement? This production-ready template incorporates:
- 30+ mobile-optimized React components with touch-friendly interactions
- Complete Capacitor mobile deployment with automated app store versioning
- 30+ Supabase Edge Functions covering authentication, notifications, and business logic
- Comprehensive subscription management with App Store policy compliance
- Multi-tenant security architecture with role-based permissions
- Automated build and deployment systems for web, iOS, and Android

The template can be scaffolded immediately with full mobile deployment capabilities and production-ready infrastructure.
