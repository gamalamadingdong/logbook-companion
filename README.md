# SGE Starter Template

# SGE Starter Template

# SGE Starter Template

> **Infrastructure, not abstraction.** A production-ready tech stack with proven patterns from [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2).

## 🎯 What is this?

A **tech stack starter template** that gives you production-ready infrastructure so you can focus on building your unique business logic.

**What you get:**
- ✅ Multi-tenant database with security (11 tables, ~30 RLS policies)
- ✅ Auth and invitation system
- ✅ Subscription management (Stripe)
- ✅ Multi-channel notifications (email, SMS, push)
- ✅ Mobile apps (iOS/Android) with build automation
- ✅ Utilities and component templates

**What you build:**
- Your domain models (jobs, appointments, services, etc.)
- Your business logic (scheduling, workflows, calculations)
- Your UI/UX (customized for your users)

**Philosophy:** Copy-and-adapt components with clear TODO markers, not configuration-driven business logic abstraction.

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **Mobile**: Capacitor 7 (iOS + Android)
- **Payments**: Stripe (optional)
- **Email**: Resend (optional)
- **SMS**: Twilio (optional)

## ✅ Current Status

**Phases 1-4: COMPLETE** (100% ✅)

### Foundation & Infrastructure
- ✅ **@sge/shared** - Foundation utilities (3 files)
- ✅ **@sge/ui** - Component templates (2 files)
- ✅ **Build Scripts** - iOS/Android versioning (2 scripts)
- ✅ **Database Schema** - Multi-tenant foundation (3 SQL files)

### Edge Functions (13 Functions)
- ✅ **Authentication** - 5 functions (invitations, onboarding, GDPR)
- ✅ **Notifications** - 3 functions (orchestration, email, cleanup)
- ✅ **Subscriptions** - 5 functions (Stripe integration, webhooks, tier management)

**Total:** 24 production-ready files (~6,500 lines of code + docs)

[📖 See Phase 4 Summary](./docs/PHASE-4-SUMMARY.md)

## 🏁 Quick Start

## 🎯 What is this?

A **tech stack starter template** that gives you production-ready infrastructure so you can focus on building your unique business logic.

**What you get:**
- ✅ Multi-tenant database with security (11 tables, ~30 RLS policies)
- ✅ Auth and invitation system
- ✅ Subscription management (Stripe)
- ✅ Multi-channel notifications (email, SMS, push)
- ✅ Mobile apps (iOS/Android) with build automation
- ✅ Utilities and component templates

**What you build:**
- Your domain models (jobs, appointments, services, etc.)
- Your business logic (scheduling, workflows, calculations)
- Your UI/UX (customized for your users)

**Philosophy:** Copy-and-adapt components with clear TODO markers, not configuration-driven business logic abstraction.

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **Mobile**: Capacitor 7 (iOS + Android)
- **Payments**: Stripe (optional)
- **Email**: Resend (optional)
- **SMS**: Twilio (optional)

## 🎯 What is This?

**SGE (Service Grid Engine) Starter** is a configurable foundation for building multi-tenant SaaS applications with:
- React + TypeScript + Vite (web)
- Capacitor (iOS/Android)
- Supabase (backend + auth + db)
- Tailwind + shadcn/ui (styling)
- Stripe (payments - optional)
- Vercel (hosting)

**Not a framework. Not a boilerplate.** It's a **production-quality starter** with proven patterns you can copy and adapt.

## ✅ Current Status

**Phase 1: COMPLETE** (70%)

- ✅ **@sge/shared** - Foundation utilities (date handling, mobile detection, App Store compliance)
- ✅ **@sge/ui** - Component templates (auth guards, utilities)
- ✅ **Build Scripts** - iOS/Android versioning automation
- 🔨 **Database Schema** - Multi-tenant foundation (in progress - see Option B)

## � Quick Start

### For Template Development:

```bash
# Clone the template
cd sge-starter

# Install dependencies
npm install

# Start development
npm run dev
```

### To Use the Template:

```bash
# Coming soon: CLI generator
npx create-sge-app my-app

# For now: Copy packages manually
cp -r packages/shared my-app/packages/
cp -r packages/ui my-app/packages/
cp -r scripts my-app/scripts/
```

## 📦 What's Included

### Packages

#### **@sge/shared** - Foundation Utilities
```typescript
// Timezone-safe date handling
import { getTodayLocalString, parseDateString } from '@sge/shared/lib/dateUtils';

// Mobile detection
import { useIsMobile } from '@sge/shared/hooks/use-mobile';

// App Store compliance
import { handleMobileSubscriptionUpgrade } from '@sge/shared/lib/mobileCompliance';
```

#### **@sge/ui** - Component Library
```typescript
// Route guards (copy & customize)
import { ProtectedRoute, PublicRoute } from '@sge/ui/auth/ProtectedRoute';

// Tailwind utilities
import { cn } from '@sge/ui/lib/utils';
```

### Build Automation

```bash
# Increment iOS build number (required for App Store)
npm run version:ios

# Increment Android versionCode (required for Play Store)
npm run version:android

# Both platforms
npm run version:increment
```

### Database Schema (Coming in Option B)

Multi-tenant foundation with:
- Business/tenant isolation
- Role-based access control (RBAC)
- Subscription management (Stripe)
- Notification system
- Invitation flows

## 📋 Development Phases

### ✅ Phase 1: Foundation (Week 1) - 70% COMPLETE
- ✅ Repository structure created
- ✅ @sge/shared package with utilities
- ✅ @sge/ui package with component templates
- ✅ Build automation scripts
- 🔨 Database schema extraction (your next task)

### Phase 2: Component Library (Week 2)
- [ ] Mobile navigation components
- [ ] Form components with validation
- [ ] Loading states and feedback
- [ ] Subscription UI components

### Phase 3: Backend (Week 3)
- [ ] Supabase Edge Functions (auth, invites, notifications)
- [ ] RLS policies and security
- [ ] Email templates (Resend)
- [ ] Stripe integration module

### Phase 4: CLI Generator (Week 4)
- [ ] Interactive project setup
- [ ] Optional integration modules
- [ ] Automated configuration
## 📚 Documentation

**Start here:**
- 📄 **[QUICKSTART.md](docs/QUICKSTART.md)** - Get up and running
- 📄 **[PHASE-1-SUMMARY.md](docs/PHASE-1-SUMMARY.md)** - What we've built
- 📄 **[OPTION-B-DATABASE-EXTRACTION.md](docs/OPTION-B-DATABASE-EXTRACTION.md)** - Your next task

**Package docs:**
- 📦 **[packages/shared/README.md](packages/shared/README.md)** - Utilities guide
- 📦 **[packages/ui/README.md](packages/ui/README.md)** - Component guide
- 🔧 **[scripts/README.md](scripts/README.md)** - Build automation

**Planning docs:**
- 📋 **[EXTRACTION-PROGRESS.md](docs/EXTRACTION-PROGRESS.md)** - Detailed progress
- 📋 **[EXTRACTION-PLAN.md](docs/EXTRACTION-PLAN.md)** - Overall strategy
- 📋 **[TEMPLATE-STRATEGY.md](docs/TEMPLATE-STRATEGY.md)** - High-level vision

## 🎯 Design Philosophy

### What This Template IS:
- ✅ **Production-quality tech stack** with proven patterns
- ✅ **Copy-and-adapt components** you customize per project
- ✅ **Mobile-first** with iOS/Android automation built-in
- ✅ **Monetization-ready** with subscription foundation
- ✅ **Battle-tested** from ScheduleBoard v2 production use

### What This Template is NOT:
- ❌ Not a rigid framework with complex abstractions
- ❌ Not business logic you configure via settings
- ❌ Not a one-size-fits-all solution
- ❌ Not a black box - you own and modify everything

### How to Use It:
1. **Clone** the template for a new project
2. **Copy** the utilities and components you need
3. **Customize** the TODOs for your specific use case  
4. **Build** your custom business logic on top
5. **Deploy** with confidence (automation included)

## � Repository Structure

```
sge-starter/
├── docs/                   # Complete documentation
│   ├── QUICKSTART.md      # Start here
│   ├── PHASE-1-SUMMARY.md # What's been built
│   └── OPTION-B-*.md      # Your next step
│
├── packages/              # Monorepo packages
│   ├── shared/           # ✅ Utilities (dates, mobile, compliance)
│   ├── ui/               # ✅ Component templates (auth, utils)
│   ├── web/              # Coming: React app shell
│   ├── mobile/           # Coming: Capacitor setup
│   └── functions/        # Coming: Supabase Edge Functions
│
├── scripts/              # ✅ Build automation (iOS/Android)
├── infra/                # 🔨 Database schema (your turn)
├── generator/            # Coming: CLI tool
└── examples/             # Coming: Reference implementations
```

## 🚀 Next Steps

### For You (Option B):
1. Read `docs/OPTION-B-DATABASE-EXTRACTION.md`
2. Extract multi-tenant database schema from ScheduleBoard
3. Create `infra/schema/` with core tables and RLS policies

### After Option B:
- **Week 2:** Extract mobile navigation, forms, subscription UI
- **Week 3:** Extract Supabase Edge Functions (auth, notifications)
- **Week 4:** Build CLI generator with integration options

## 🎯 Target Applications

This template is ideal for:

### Service Businesses
- Field service management (HVAC, plumbing, electrical)
- Maintenance services (cleaning, landscaping)
- Personal care (beauty, fitness, tutoring)
- Professional services (consulting, training)

### SaaS Products
- B2B productivity tools
- Multi-tenant applications
- Mobile-first platforms
- Subscription-based services

### Key Features:
- ✅ Multi-tenant with business isolation
- ✅ Role-based access control
- ✅ Subscription management (Stripe)
- ✅ iOS/Android native apps (Capacitor)
- ✅ Real-time updates (Supabase)
- ✅ App Store compliant

## 🤝 Contributing

This template is extracted from ScheduleBoard v2. To contribute:

1. Test extracted components in real projects
2. Suggest additional patterns to extract
3. Improve documentation and examples
4. Report issues with customization points

## 📝 License

MIT License - Use freely for your projects

## 🙏 Credits

Extracted from [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2) production codebase.

---

**Ready to start?** Check out [QUICKSTART.md](docs/QUICKSTART.md) and [PHASE-1-SUMMARY.md](docs/PHASE-1-SUMMARY.md)!
- Custom implementation services: $15,000-50,000
- Revenue sharing on deployed applications: 5-15%

## 🔗 Links to ScheduleBoard

This template extracts proven components and patterns from the production ScheduleBoard v2 application:
- **Source Repository**: `../scheduleboardv2/`
- **Component Source**: `../scheduleboardv2/src/components/`
- **Edge Functions**: `../scheduleboardv2/supabase/functions/`
- **Mobile Implementation**: `../scheduleboardv2/android/` & `../scheduleboardv2/ios/`

## 📖 Documentation

See the `docs/` folder for:
- **Template Strategy**: Overall approach and market positioning
- **Component Extraction Plan**: Systematic extraction from ScheduleBoard
- **Market Opportunities**: Analysis of target applications
- **Implementation Guides**: Step-by-step development instructions

---

**Next Steps**: Review `docs/TEMPLATE-STRATEGY.md` and `docs/EXTRACTION-PLAN.md` to understand the complete template development roadmap.

Last Updated: October 1, 2025