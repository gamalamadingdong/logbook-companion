# Component Extraction Plan — ScheduleBoard to SGE Template

Date: October 2, 2025 (Updated)

## 🎯 Template Strategy: Infrastructure, Not Abstraction

**CRITICAL**: This is a **tech stack starter template**, NOT a business logic abstraction framework.

### What This Template IS:
✅ **Infrastructure Foundation**: Multi-tenant database, auth, RLS, subscriptions, notifications  
✅ **Tech Stack Setup**: React + TypeScript + Vite + Supabase + Capacitor pre-configured  
✅ **Component Templates**: Production-quality UI you copy and customize (with clear TODO markers)  
✅ **Build Automation**: Mobile versioning scripts, deployment automation  
✅ **Integration Modules**: Optional Stripe/Resend/Twilio/Places via CLI selection  

### What This Template is NOT:
❌ **NOT Business Logic**: No HVAC vs cleaning vs massage abstractions  
❌ **NOT Configuration System**: No business_type enums or feature toggle complexity  
❌ **NOT One-Size-Fits-All**: You write your domain logic, we provide infrastructure  
❌ **NOT A Framework**: No lock-in, you own all the code  

### Extraction Philosophy
1. **Infrastructure First**: Database patterns, auth flows, subscription management
2. **Utilities & Hooks**: Date handling, mobile detection, compliance helpers
3. **Component Templates**: Copy-and-adapt UI with clear customization points ("TODO: Replace with your...")
4. **Build Automation**: Scripts that work for any app name/domain
5. **Integration Examples**: Show how ScheduleBoard uses Stripe/Resend, you adapt for your needs

---

## ✅ Completed Extractions

### Phase 1: Foundation Setup (COMPLETED)

#### **@sge/shared Package** ✅
- ✅ `lib/dateUtils.ts` - Timezone-safe date utilities
- ✅ `hooks/use-mobile.tsx` - Mobile detection hook
- ✅ `lib/mobileCompliance.ts` - App Store compliance utilities
- ✅ Package configuration and TypeScript setup

#### **Build Automation Scripts** ✅
- ✅ `scripts/increment-ios-build.js` - iOS version management
- ✅ `scripts/increment-android-build.js` - Android version management
- ✅ Documentation and npm script integration

#### **@sge/ui Package** ✅
- ✅ `auth/ProtectedRoute.tsx` - Route guards with clear customization points
- ✅ `lib/utils.ts` - Tailwind class merging utility
- ✅ Package structure and documentation

---

## 📋 Next Steps

### Phase 2: Database Foundation (COMPLETED ✅)
*Multi-tenant infrastructure with subscriptions and notifications*

| Component | Source Path | Template Destination | Status |
|-----------|------------|---------------------|--------|
| Core Schema | `docs/db/supabase_schema.sql` | `infra/schema/core.sql` | ✅ 11 tables extracted |
| RLS Policies | `docs/db/supabase_schema.sql` | `infra/schema/rls-policies.sql` | ✅ ~30 policies extracted |
| Schema Guide | N/A | `infra/schema/README.md` | ✅ Complete setup documentation |

### **Phase 1: Foundation (COMPLETED ✅)**
*Infrastructure, utilities, and build automation*

| Component | Source Path | Template Destination | Status |
|-----------|------------|---------------------|--------|
| Date Utilities | `src/lib/dateUtils.ts` | `packages/shared/lib/dateUtils.ts` | ✅ Extracted |
| Mobile Detection | `src/hooks/use-mobile.ts` | `packages/shared/hooks/use-mobile.tsx` | ✅ Extracted |
| Mobile Compliance | `src/lib/mobileSubscriptionCompliance.ts` | `packages/shared/lib/mobileCompliance.ts` | ✅ Extracted |
| iOS Build Script | `scripts/increment-ios-build.js` | `scripts/increment-ios-build.js` | ✅ Extracted |
| Android Build Script | `scripts/increment-android-build.js` | `scripts/increment-android-build.js` | ✅ Extracted |
| Auth Component | `src/components/auth/ProtectedRoute.tsx` | `packages/ui/auth/ProtectedRoute.tsx` | ✅ Extracted with TODOs |
| Tailwind Utils | `src/lib/utils.ts` | `packages/ui/lib/utils.ts` | ✅ Extracted |

### **Phase 3: Edge Functions (NEXT - Week 3)**
*Backend infrastructure for auth, notifications, subscriptions*

| Function Category | Priority | Extraction Approach |
|-------------------|----------|--------------------|
| **Auth & Invites** | HIGH | Extract as-is, already generic |
| **Notifications** | HIGH | Extract with TODO markers for customization |
| **Subscriptions** | MEDIUM | Extract if using Stripe (CLI option) |
| **Automation** | LOW | Reference examples, implement per-project |

### **NOT EXTRACTING: Business Logic**
*These stay in ScheduleBoard - too specific to HVAC/scheduling*

| Component | Why Not Extracting |
|-----------|-------------------|
| Job/Bid Management | HVAC-specific terminology and workflows |
| Equipment Tracking | Trade-specific, not universal |
| Schedule Board UI | Highly customized for field service workflows |
| Customer Management | Would need heavy customization anyway |

**Instead:** Provide clear examples in documentation of how ScheduleBoard implements these, and developers build their own domain logic.

---

## 🗄️ Database Schema (COMPLETED ✅)

### **Multi-Tenant Infrastructure**
*Foundation for any SaaS application*

```sql
-- Extracted to: infra/schema/core.sql
-- Status: COMPLETE ✅

✅ Core Tables (11 total):
- businesses (multi-tenant foundation)
- profiles (user management)
- user_business_roles (6-tier RBAC)
- business_invites (onboarding system)
- subscription_events (Stripe webhooks)
- usage_metrics (billing data)
- notifications (multi-channel queue)
- notification_preferences (user settings)
- notification_deliveries (tracking)
- notification_history (audit trail)
- push_tokens (mobile notifications)

✅ Security (infra/schema/rls-policies.sql):
- ~30 Row Level Security policies
- Business data isolation
- Role-based permissions
- Helper functions (get_user_business_ids, is_business_owner, is_business_admin)
```

### **What You Customize:**
- Add your domain-specific tables (jobs, appointments, projects, etc.)
- Define your own status enums and workflows
- Add industry-specific fields
- Create custom indexes for your queries
- Build your business logic on this foundation

---

## ⚙️ Edge Functions Extraction

### **Authentication & User Management**
*Extract as-is, already generic*

| Function | Source | Template Destination | Changes Needed |
|----------|---------|---------------------|----------------|
| `create-invite` | `supabase/functions/create-invite` | `packages/functions/auth/create-invite` | None, already generic |
| `process-invite` | `supabase/functions/process-invite` | `packages/functions/auth/process-invite` | None |
| `send-invite-email` | `supabase/functions/send-invite-email` | `packages/functions/auth/send-invite-email` | Parameterize email templates |

### **Notification System**
*Highly reusable across service businesses*

| Function | Source | Template Destination | Changes Needed |
|----------|---------|---------------------|----------------|
| `notification-orchestrator` | `supabase/functions/notification-orchestrator` | `packages/functions/notifications/orchestrator` | Add business type routing |
| `send-push-notification` | `supabase/functions/send-push-notification` | `packages/functions/notifications/push` | None |
| `automated-status-updates` | `supabase/functions/automated-status-updates` | `packages/functions/automation/status-updates` | Generalize status types |

### **Subscription Management**
*Critical for template monetization*

| Function | Source | Template Destination | Changes Needed |
|----------|---------|---------------------|----------------|
| `stripe-webhooks` | `supabase/functions/stripe-webhooks` | `packages/functions/payments/stripe-webhooks` | None, already generic |
| `create-subscription-intent` | `supabase/functions/create-subscription-intent` | `packages/functions/payments/create-intent` | Add template-specific tiers |

---

## 🛠️ Revised Development Timeline

### **Week 1-2: Foundation (COMPLETED ✅)**

**Accomplished:**
- ✅ Monorepo structure with npm workspaces
- ✅ @sge/shared package (dateUtils, use-mobile, mobileCompliance)
- ✅ @sge/ui package (ProtectedRoute, utils)
- ✅ Build automation scripts (iOS/Android versioning)
- ✅ Database schema (11 tables, ~30 RLS policies)
- ✅ Edge Functions analysis and extraction plan
- ✅ Complete documentation

**Result:** 11 production-ready files, ready for immediate use

### **Week 3: Edge Functions Extraction**

**Priority 1: Core Infrastructure (3-4 days)**
```bash
# Extract auth & invitation system
cp ../scheduleboardv2/supabase/functions/create-invite packages/functions/auth/
cp ../scheduleboardv2/supabase/functions/process-invite packages/functions/auth/
cp ../scheduleboardv2/supabase/functions/get-invite packages/functions/auth/
cp ../scheduleboardv2/supabase/functions/send-invite-email packages/functions/auth/
cp ../scheduleboardv2/supabase/functions/delete-user-account packages/functions/auth/

# Extract notification infrastructure
cp ../scheduleboardv2/supabase/functions/notification-orchestrator packages/functions/notifications/
cp ../scheduleboardv2/supabase/functions/send-notification-email packages/functions/notifications/
```

**Add TODO Markers:**
- "TODO: Customize email templates for your brand"
- "TODO: Add your business-specific notification types"
- "TODO: Configure your Resend domain"

**Priority 2: Optional Integrations (1-2 days)**
- Stripe functions (if CLI includes Stripe)
- Twilio functions (if CLI includes Twilio)
- Google Places (if CLI includes Places)

### **Week 4: CLI Generator**

**Build Interactive Setup:**
```typescript
// generator/src/index.ts
async function promptUser() {
  const answers = await inquirer.prompt([
    { name: 'projectName', message: 'Project name:' },
    { name: 'includeMobile', type: 'confirm', message: 'Include mobile (Capacitor)?' },
    { name: 'includeStripe', type: 'confirm', message: 'Add Stripe subscriptions?' },
    { name: 'includeResend', type: 'confirm', message: 'Add email (Resend)?' },
    { name: 'includeTwilio', type: 'confirm', message: 'Add SMS (Twilio)?' },
    { name: 'includePlaces', type: 'confirm', message: 'Add Google Places?' },
  ]);
  
  // Copy core infrastructure (always)
  // Conditionally copy integration modules
  // Generate .env template
  // Create setup guide
}
```

**Generated Project Structure:**
```
my-new-app/
├── packages/
│   ├── web/          # Always included
│   ├── mobile/       # If includeMobile
│   ├── functions/    # Core + selected integrations
│   ├── shared/       # Always included
│   └── ui/           # Always included
├── infra/
│   └── schema/       # Core multi-tenant schema
├── .env.example     # Based on selected integrations
└── README.md        # Custom setup instructions
```

---

## 🧪 Testing Strategy

### **Component Testing**
```bash
# Test extracted components across business types
npm run test:components

# Test mobile responsiveness
npm run test:mobile

# Test subscription flows
npm run test:subscriptions
```

### **Integration Testing**
```bash
# Test full application generation
npx @sge/create-app test-hvac-app --type=hvac
npx @sge/create-app test-cleaning-app --type=cleaning

# Test deployment automation
npm run test:build
npm run test:deploy
```

### **Performance Testing**
```bash
# Mobile performance
npm run test:lighthouse

# Load testing
npm run test:load

# Cross-platform testing
npm run test:ios
npm run test:android
```

---

## 📊 Success Metrics

### **Development Velocity**
- **Component Extraction**: >5 components per day
- **Generalization**: <2 hours per component average
- **Testing**: 100% component test coverage
- **Documentation**: Complete API docs for all components

### **Template Quality**
- **Mobile Performance**: <3 second load times
- **App Store Compliance**: 100% policy adherence
- **Security**: All RLS policies tested and verified
- **Cross-Platform**: Identical functionality iOS/Android/Web

### **Business Readiness**
- **CLI Generation**: <5 minutes from prompt to running app
- **Deployment**: One-command deployment to production
- **Documentation**: Complete guides for all business types
- **Examples**: Working examples for top 5 service business types

---

## 🚀 Deployment Pipeline

### **Template Development**
```bash
# Development workflow
git checkout -b feature/mobile-components
# Extract and generalize components
# Test across business types
# Submit PR with full test coverage

# Release workflow
npm run build:all
npm run test:full
npm run deploy:template
```

### **Generated Applications**
```bash
# Generated app deployment
npx @sge/create-app my-business
cd my-business
npm run build:mobile
npm run deploy:all  # Web + iOS + Android
```

---

## 📝 Documentation Requirements

### **Component Library Docs**
- **Interactive Storybook**: All components with business type variations
- **API Reference**: Complete TypeScript interface documentation
- **Usage Examples**: Code samples for each business type
- **Migration Guides**: From ScheduleBoard to template usage

### **Developer Guides**
- **Quick Start**: 5-minute setup to running app
- **Business Configuration**: Complete guide to business type customization
- **Mobile Deployment**: iOS/Android app store submission guides
- **Infrastructure Setup**: Supabase, Stripe, and service configuration

### **Business Templates**
- **HVAC Template**: Complete example with quotes, scheduling, compliance
- **Cleaning Template**: Checklists, photos, quality tracking
- **Trade Services**: Tools, materials, project management
- **Personal Care**: Appointments, client profiles, service history

---

This extraction plan ensures we maintain the production quality and mobile-first architecture of ScheduleBoard while creating a flexible, reusable template system for the entire human-centered service business market.

**Next Action**: Begin Week 1 foundation setup, starting with repository structure and core component extraction.