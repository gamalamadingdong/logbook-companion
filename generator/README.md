# CLI Generator Documentation

## Overview

The **create-sge-app** CLI tool provides an interactive way to scaffold new SGE applications with battle-tested infrastructure components.

## Installation

### Global Installation (Recommended)
```bash
npm install -g @sge/create-app
create-sge-app my-app
```

### NPX (No Installation Required)
```bash
npx @sge/create-app my-app
```

### Local Development
```bash
cd generator
npm install
npm run build
node dist/index.js my-app
```

## Usage

### Interactive Mode (Recommended)

```bash
create-sge-app
```

The CLI will guide you through:
1. **Project name** - Name of your application (lowercase-with-hyphens)
2. **Package manager** - npm, yarn, or pnpm (auto-detected)
3. **Authentication** - Include Supabase auth system
4. **Mobile support** - Include iOS/Android via Capacitor
5. **Subscriptions** - Include Stripe subscription management
6. **Notifications** - Include multi-channel notification system
7. **Email provider** - Choose Resend, SendGrid, or skip
8. **Dependency installation** - Install now or skip

### Non-Interactive Mode

```bash
create-sge-app my-app --no-mobile --no-subscriptions
```

#### Available Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--skip-install` | Skip dependency installation | `false` |
| `--no-mobile` | Exclude mobile app support | Included |
| `--no-subscriptions` | Exclude Stripe subscriptions | Included |
| `--no-notifications` | Exclude notification system | Included |
| `--no-auth` | Exclude authentication | Included |
| `--email <provider>` | Email provider (resend\|sendgrid\|none) | `resend` |
| `--pm <manager>` | Package manager (npm\|yarn\|pnpm) | Auto-detect |

### Examples

**Minimal setup (web only, no subscriptions):**
```bash
create-sge-app my-web-app --no-mobile --no-subscriptions
```

**Full-featured mobile app:**
```bash
create-sge-app my-mobile-app --email resend
```

**API-only backend:**
```bash
create-sge-app my-api --no-mobile --skip-install
```

## What Gets Generated

### Core Files

```
my-app/
├── .env                        # Environment configuration (generated)
├── .env.example                # Example environment variables
├── package.json                # Project configuration (customized)
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite build configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── infra/
│   └── schema/
│       ├── core.sql            # Database schema (11 tables)
│       ├── rls-policies.sql    # Row-level security policies
│       └── README.md           # Database documentation
├── packages/
│   ├── functions/              # Supabase Edge Functions
│   │   ├── auth/               # Authentication functions (5)
│   │   ├── notifications/      # Notification system (3)
│   │   └── subscriptions/      # Stripe integration (5)
│   ├── shared/                 # Shared utilities
│   ├── ui/                     # Reusable UI components
│   └── mobile/                 # Capacitor mobile config (if enabled)
├── scripts/
│   ├── increment-ios-build.js  # iOS version management
│   └── increment-android-build.js  # Android version management
└── docs/                       # Comprehensive documentation
```

### Environment Variables

The CLI generates a `.env` file with configuration for:

- **Supabase** - Project URL, anon key, service role key
- **Stripe** - Secret key, publishable key, webhook secret
- **Email** - Resend or SendGrid API keys
- **Application** - App name and metadata

### Customization by Feature

| Feature Disabled | Files/Folders Removed |
|------------------|-----------------------|
| `--no-mobile` | `packages/mobile/`, mobile scripts |
| `--no-subscriptions` | `packages/functions/subscriptions/` |
| `--no-notifications` | `packages/functions/notifications/` |
| `--no-auth` | `packages/functions/auth/` |

## Configuration

### API Keys Collection

During interactive setup, the CLI will prompt for API keys:

1. **Supabase Configuration** (if auth enabled)
   - Project URL: `https://xxx.supabase.co`
   - Anon key: Public key for client-side
   - Service role key: Server-side key for Edge Functions

2. **Stripe Configuration** (if subscriptions enabled)
   - Secret key: `sk_test_xxx` or `sk_live_xxx`
   - Publishable key: `pk_test_xxx` or `pk_live_xxx`
   - Webhook secret: `whsec_xxx`

3. **Email Configuration** (if notifications enabled)
   - Resend API key: `re_xxx`
   - SendGrid API key: `SG.xxx`

**Note:** All API keys are optional during setup. You can configure them later in the `.env` file.

### Validation

The CLI validates:
- ✅ Project name format (lowercase, hyphens only)
- ✅ Supabase URL format (https://xxx.supabase.co)
- ✅ Directory doesn't already exist (prompts for overwrite)

## Post-Generation Setup

### 1. Navigate to Project
```bash
cd my-app
```

### 2. Install Dependencies (if skipped)
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Environment
Edit `.env` with your actual API keys:
```bash
code .env
```

### 4. Set Up Supabase Database

Run the SQL files in your Supabase project:

1. Go to Supabase Dashboard → SQL Editor
2. Run `infra/schema/core.sql` - Creates tables
3. Run `infra/schema/rls-policies.sql` - Sets up security

**Or use Supabase CLI:**
```bash
supabase db push
```

### 5. Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy create-invite
supabase functions deploy notification-orchestrator
supabase functions deploy stripe-webhooks
```

### 6. Configure Stripe Webhooks (if using subscriptions)

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhooks`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret to `.env`

### 7. Configure Email Domain (if using Resend)

1. Go to Resend Dashboard → Domains
2. Add and verify your domain
3. Update `.env` with verified sender email

### 8. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## Mobile App Setup (if enabled)

### iOS Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Add iOS platform:**
```bash
npm run mobile:setup
```

3. **Sync Capacitor:**
```bash
npx cap sync ios
```

4. **Open Xcode:**
```bash
npx cap open ios
```

5. **Configure signing in Xcode**
   - Select your team
   - Update bundle identifier

6. **Run on simulator or device**

### Android Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Add Android platform:**
```bash
npm run mobile:setup
```

3. **Sync Capacitor:**
```bash
npx cap sync android
```

4. **Open Android Studio:**
```bash
npx cap open android
```

5. **Run on emulator or device**

### Mobile Development Commands

```bash
# iOS
npm run ios:dev              # Build and open in Xcode
npm run ios:sync             # Sync changes to iOS
npm run version:ios          # Increment build number

# Android
npm run android:dev          # Build and open in Android Studio
npm run android:build        # Build production APK
npm run version:android      # Increment version code

# Both platforms
npm run mobile:sync          # Sync changes to both platforms
```

## Troubleshooting

### "Directory already exists"

The CLI will prompt to overwrite. Answer `Y` to remove the existing directory.

### "npm ERR! Unsupported URL Type"

This indicates workspace protocol issues. Run:
```bash
cd your-project
npm install
```

### TypeScript Errors After Generation

This is normal for Edge Functions (Deno-specific imports). The code will work in Supabase's Deno runtime.

### Cannot Find Module Errors

Install dependencies:
```bash
npm install
```

### Supabase CLI Not Found

Install Supabase CLI:
```bash
npm install -g supabase
```

### Mobile Build Fails

Ensure you have the required tools:
- **iOS:** Xcode 14+, CocoaPods
- **Android:** Android Studio, JDK 11+

## CLI Development

### Project Structure

```
generator/
├── src/
│   └── index.ts            # Main CLI implementation
├── dist/                   # Compiled JavaScript (generated)
├── package.json            # CLI dependencies
└── tsconfig.json           # TypeScript configuration
```

### Building the CLI

```bash
cd generator
npm install
npm run build
```

### Testing Locally

```bash
cd generator
npm run build
node dist/index.js test-app
```

### Publishing to npm

```bash
cd generator
npm version patch          # Increment version
npm run build              # Build distribution
npm publish               # Publish to npm
```

## Features Reference

### Authentication System
- **5 Edge Functions** for invite-based user onboarding
- **Multi-tenant architecture** with business isolation
- **Role-based access control** (6 permission levels)
- **GDPR-compliant** account deletion
- **Email verification** and password reset

**Files:**
- `packages/functions/auth/create-invite/`
- `packages/functions/auth/process-invite/`
- `packages/functions/auth/send-invite-email/`
- `packages/functions/auth/get-invite/`
- `packages/functions/auth/delete-user-account/`

### Notification System
- **3 Edge Functions** for multi-channel delivery
- **Email, SMS, Push, In-app** channels
- **Priority-based routing** with user preferences
- **Quiet hours** with automatic rescheduling
- **Delivery tracking** and status updates

**Files:**
- `packages/functions/notifications/orchestrator/`
- `packages/functions/notifications/send-email/`
- `packages/functions/notifications/cleanup/`

### Stripe Subscriptions
- **5 Edge Functions** for subscription management
- **Webhook synchronization** for real-time updates
- **Payment intent creation** for embedded flows
- **Subscription status** checking and reconciliation
- **Tier management** with proration

**Files:**
- `packages/functions/subscriptions/stripe-webhooks/` (CRITICAL)
- `packages/functions/subscriptions/create-intent/`
- `packages/functions/subscriptions/verify-session/`
- `packages/functions/subscriptions/check-status/`
- `packages/functions/subscriptions/manage-tier/`

### Mobile App Support
- **Capacitor 7** for iOS and Android compilation
- **Native API access** (camera, geolocation, storage)
- **App Store compliance** with proper permissions
- **Build automation** scripts for versioning

**Files:**
- `packages/mobile/` - Capacitor configuration
- `scripts/increment-ios-build.js` - iOS versioning
- `scripts/increment-android-build.js` - Android versioning

## Support & Resources

### Documentation
- `README.md` - Project overview
- `docs/QUICKSTART.md` - Quick start guide
- `docs/DEVELOPMENT-ROADMAP.md` - Development roadmap
- `packages/functions/*/README.md` - Function-specific docs

### Community
- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share ideas

### Related Projects
- [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2) - Production application using this template

## Version History

### v1.0.0 (Current)
- ✅ Interactive CLI with prompts
- ✅ Non-interactive mode with flags
- ✅ Template cloning and customization
- ✅ Environment configuration generation
- ✅ Feature-based file removal
- ✅ Dependency installation
- ✅ Comprehensive documentation
- ✅ 13 production-ready Edge Functions
- ✅ Multi-tenant database schema
- ✅ Mobile app support (iOS/Android)

## License

MIT License - See LICENSE file for details

---

**Generated by create-sge-app v1.0.0**
