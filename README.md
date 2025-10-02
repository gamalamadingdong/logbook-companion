# SGE Starter Template

> **Infrastructure, not abstraction.** A production-ready tech stack with proven patterns from [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2).

## 🎯 What is this?

A **tech stack starter template** that gives you production-ready infrastructure so you can focus on building your unique business logic.

**What you get:**
- ✅ Multi-tenant database with security (11 tables, ~30 RLS policies)
- ✅ Auth and invitation system (5 Edge Functions)
- ✅ Subscription management with Stripe (5 Edge Functions)
- ✅ Multi-channel notifications (3 Edge Functions)
- ✅ Mobile apps (iOS/Android) with build automation
- ✅ CLI generator for instant project scaffolding

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

## ✅ Current Status

**Phases 1-5: COMPLETE** (100% ✅)

### CLI Generator (Phase 5 - NEW!)
- ✅ **create-sge-app** - Interactive project scaffolding
- ✅ **720 lines** - Full-featured CLI implementation
- ✅ **750+ lines** - Comprehensive documentation
- ✅ **Feature toggles** - Auth, mobile, subscriptions, notifications
- ✅ **Smart defaults** - Auto-detect package manager, validate inputs
- ✅ **Beautiful UX** - Colors, spinners, clear feedback

### Foundation & Infrastructure (Phases 1-2)
- ✅ **@sge/shared** - Foundation utilities (3 files)
- ✅ **@sge/ui** - Component templates (2 files)
- ✅ **Build Scripts** - iOS/Android versioning (2 scripts)
- ✅ **Database Schema** - Multi-tenant foundation (3 SQL files)

### Edge Functions (Phases 3-4) - 13 Functions
- ✅ **Authentication** - 5 functions (invitations, onboarding, GDPR)
- ✅ **Notifications** - 3 functions (orchestration, email, cleanup)
- ✅ **Subscriptions** - 5 functions (Stripe integration, webhooks, tier management)

**Total:** 27 production-ready files (~8,000 lines of code + docs)

[📖 See Complete Journey](./docs/COMPLETE-EXTRACTION-JOURNEY.md) | [📖 Phase 5 Summary](./docs/PHASE-5-CLI-COMPLETE.md)

## 🏁 Quick Start

### Option 1: Use CLI Generator (Recommended)

> **Note:** The CLI tool is not yet published to npm. Use the local instructions below.

```bash
# Clone this repository first
git clone https://github.com/gamalamadingdong/sge-starter.git
cd sge-starter

# Build the CLI tool
cd generator
npm install
npm run build

# Run the CLI (from generator directory)
node dist/index.js my-app

# Or run interactively
node dist/index.js

# With options
node dist/index.js my-app --no-mobile --no-subscriptions --pm npm
```

**After publishing to npm, you'll be able to use:**
```bash
npx @sge/create-app my-app
```

**CLI Features:**
- ✅ Interactive prompts for configuration
- ✅ Auto-generates `.env` with your API keys
- ✅ Removes unused features automatically
- ✅ Installs dependencies
- ✅ Shows clear next steps

**Available Flags:**
- `--skip-install` - Skip dependency installation
- `--no-mobile` - Exclude mobile app support
- `--no-subscriptions` - Exclude Stripe subscriptions
- `--no-notifications` - Exclude notification system
- `--no-auth` - Exclude authentication
- `--email <provider>` - Email provider (resend|sendgrid|none)
- `--pm <manager>` - Package manager (npm|yarn|pnpm)

[📖 Full CLI Documentation](./generator/README.md)

### Option 2: Manual Clone

```bash
# Clone the repository
git clone https://github.com/gamalamadingdong/sge-starter.git my-app
cd my-app

# Install dependencies
npm install

# Copy .env.example and configure
cp .env.example .env
# Edit .env with your Supabase, Stripe, and Resend keys

# Start development
npm run dev
```

## 📦 What's Included

### Foundation Utilities (`packages/shared/`)
```typescript
// Timezone-safe date handling
import { getTodayLocalString, parseDateString } from '@sge/shared/lib/dateUtils';

// Mobile detection
import { useIsMobile } from '@sge/shared/hooks/use-mobile';

// App Store compliance
import { handleMobileSubscriptionUpgrade } from '@sge/shared/lib/mobileCompliance';
```

### UI Components (`packages/ui/`)
```typescript
// Route guards
import { ProtectedRoute } from '@sge/ui/auth/ProtectedRoute';

// Utilities
import { cn } from '@sge/ui/lib/utils';
```

### Database Schema (`infra/schema/`)
Multi-tenant architecture with:
- **11 tables**: businesses, profiles, user_business_roles, invitations, notifications, etc.
- **~30 RLS policies**: Business-level isolation and role-based access
- **GDPR compliant**: Account deletion with cascade
- **Subscription ready**: Stripe integration tables

[📖 Database Documentation](./infra/schema/README.md)

### Edge Functions (`packages/functions/`)

#### Authentication (5 functions)
- **create-invite** - Generate invitation tokens
- **process-invite** - Handle invitation acceptance
- **send-invite-email** - Email delivery via Resend
- **get-invite** - Retrieve invitation details
- **delete-user-account** - GDPR-compliant deletion

[📖 Auth Documentation](./packages/functions/auth/README.md)

#### Notifications (3 functions)
- **orchestrator** - Multi-channel routing (email, SMS, push, in-app)
- **send-email** - Resend integration with templates
- **cleanup** - Automated notification cleanup

[📖 Notifications Documentation](./packages/functions/notifications/README.md)

#### Subscriptions (5 functions)
- **stripe-webhooks** - Webhook handler (CRITICAL)
- **create-intent** - Payment intent creation
- **verify-session** - Session verification
- **check-status** - Status synchronization
- **manage-tier** - Tier management

[📖 Subscriptions Documentation](./packages/functions/subscriptions/README.md)

### Build Automation (`scripts/`)
```bash
# Increment iOS build number (required for App Store)
npm run version:ios

# Increment Android versionCode (required for Play Store)
npm run version:android

# Both platforms
npm run version:increment
```

## 🚀 After Generation

### 1. Configure Environment
Edit `.env` with your API keys:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

STRIPE_SECRET_KEY=sk_test_xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

RESEND_API_KEY=re_xxx
```

### 2. Deploy Database Schema
Run SQL files in Supabase Dashboard → SQL Editor:
1. `infra/schema/core.sql` - Creates tables
2. `infra/schema/rls-policies.sql` - Sets up security

Or use Supabase CLI:
```bash
supabase db push
```

### 3. Deploy Edge Functions
```bash
# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy create-invite
supabase functions deploy notification-orchestrator
supabase functions deploy stripe-webhooks
```

### 4. Configure Stripe Webhooks
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhooks`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret to `.env`

### 5. Configure Email Domain (Resend)
1. Go to Resend Dashboard → Domains
2. Add and verify your domain
3. Update `.env` with verified sender email

### 6. Start Development
```bash
npm run dev
```
Visit `http://localhost:5173`

## 📱 Mobile App Setup

### iOS
```bash
# Sync Capacitor
npm run ios:sync

# Open in Xcode
npx cap open ios

# Configure signing and run on simulator/device
```

### Android
```bash
# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Run on emulator/device
```

### Mobile Commands
```bash
npm run ios:dev              # Build and open in Xcode
npm run android:dev          # Build and open in Android Studio
npm run version:ios          # Increment build number
npm run version:android      # Increment version code
npm run mobile:sync          # Sync both platforms
```

## 🎯 Design Philosophy

### What This Template IS:
- ✅ **Production-quality infrastructure** - Battle-tested from ScheduleBoard v2
- ✅ **Copy-and-adapt components** - Clear TODO markers for customization
- ✅ **Mobile-first** - iOS/Android automation built-in
- ✅ **Monetization-ready** - Stripe subscriptions included
- ✅ **Multi-tenant** - Business isolation with RLS policies

### What This Template is NOT:
- ❌ Not a rigid framework with complex abstractions
- ❌ Not business logic configured via settings
- ❌ Not a one-size-fits-all solution
- ❌ Not a black box - you own and modify everything

### How to Use It:
1. **Generate** project with `create-sge-app`
2. **Configure** API keys and deploy infrastructure
3. **Customize** TODO markers for your use case
4. **Build** your custom business logic on top
5. **Deploy** with confidence (automation included)

## 📁 Repository Structure

```
sge-starter/
├── docs/                     # Complete documentation
│   ├── QUICKSTART.md         # Getting started guide
│   ├── COMPLETE-EXTRACTION-JOURNEY.md  # Full project history
│   ├── PHASE-5-CLI-COMPLETE.md         # CLI generator docs
│   └── ...                   # Phase summaries and guides
│
├── packages/
│   ├── shared/              # Foundation utilities
│   ├── ui/                  # UI components
│   ├── functions/           # Supabase Edge Functions
│   │   ├── auth/           # Authentication (5 functions)
│   │   ├── notifications/  # Notifications (3 functions)
│   │   └── subscriptions/  # Stripe integration (5 functions)
│   └── mobile/             # Capacitor configuration
│
├── infra/
│   └── schema/             # Database schema and RLS policies
│
├── scripts/                # Build automation (iOS/Android)
├── generator/              # CLI tool (create-sge-app)
└── examples/               # Example implementations
```

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
- ✅ Role-based access control (6 tiers)
- ✅ Subscription management (Stripe)
- ✅ iOS/Android native apps (Capacitor)
- ✅ Real-time updates (Supabase)
- ✅ App Store compliant

## 📚 Documentation

### Getting Started
- 📄 **[QUICKSTART.md](docs/QUICKSTART.md)** - Quick start guide
- 📄 **[CLI-GENERATOR-READY.md](docs/CLI-GENERATOR-READY.md)** - CLI usage guide
- 📄 **[COMPLETE-EXTRACTION-JOURNEY.md](docs/COMPLETE-EXTRACTION-JOURNEY.md)** - Full project history

### Package Documentation
- 📦 **[packages/shared/README.md](packages/shared/README.md)** - Utilities guide
- 📦 **[packages/ui/README.md](packages/ui/README.md)** - Component guide
- 📦 **[generator/README.md](generator/README.md)** - CLI documentation

### Feature Documentation
- 🔐 **[packages/functions/auth/README.md](packages/functions/auth/README.md)** - Authentication
- 🔔 **[packages/functions/notifications/README.md](packages/functions/notifications/README.md)** - Notifications
- 💳 **[packages/functions/subscriptions/README.md](packages/functions/subscriptions/README.md)** - Subscriptions
- 🗄️ **[infra/schema/README.md](infra/schema/README.md)** - Database schema

### Development
- 📋 **[DEVELOPMENT-ROADMAP.md](docs/DEVELOPMENT-ROADMAP.md)** - Development timeline
- 📋 **[TEMPLATE-PHILOSOPHY.md](docs/TEMPLATE-PHILOSOPHY.md)** - Design principles
- 📋 **[TEMPLATE-STRATEGY.md](docs/TEMPLATE-STRATEGY.md)** - Technical strategy

## 🚀 Time to Value

### Before SGE Template
```
1. Research tech stack (weeks)
2. Set up database (days)
3. Implement authentication (weeks)
4. Add notifications (weeks)
5. Integrate Stripe (weeks)
6. Configure mobile (weeks)
7. Set up build automation (days)
8. Write documentation (weeks)

Total: 2-3 months
```

### With SGE Template
```
1. Run create-sge-app (5 minutes)
2. Configure API keys (10 minutes)
3. Deploy database schema (5 minutes)
4. Deploy Edge Functions (10 minutes)
5. Start building business logic (immediately)

Total: 30 minutes to production-ready
```

**Time Saved:** 2-3 months → 30 minutes = **99% faster**

## 📦 Publishing the CLI to npm (Optional)

To make the CLI globally available via `npx @sge/create-app`:

```bash
# Navigate to generator directory
cd generator

# Ensure you're logged in to npm
npm login

# Update version if needed
npm version patch  # or minor/major

# Build the package
npm run build

# Publish to npm (first time: use --access public for scoped packages)
npm publish --access public

# After publishing, users can run:
npx @sge/create-app my-app
```

**Requirements:**
- npm account with publishing permissions
- Proper scoping (`@sge/create-app`)
- Built dist/ directory
- Valid package.json configuration

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

Built with proven patterns from real production use.

---

**Ready to start?** 

**Local Usage:** Clone this repo, build the generator, and run `node generator/dist/index.js my-app`

**After npm publish:** `npx @sge/create-app my-app`

**Last Updated:** October 2, 2025
