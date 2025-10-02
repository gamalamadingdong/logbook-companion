# Quick Start Guide

## 🚀 Getting Started with Your SGE Template

### Step 1: Install Dependencies

Run this in the root of `sge-starter/`:

```bash
npm install
```

This will install dependencies for:
- Root workspace
- `packages/shared`
- `packages/ui`
- `generator` (CLI tool)

### Step 2: Verify the Extraction

Check that everything was created correctly:

```bash
# Check package structure
ls packages/shared
ls packages/ui
ls scripts

# Verify files exist
cat packages/shared/lib/dateUtils.ts
cat packages/ui/auth/ProtectedRoute.tsx
cat scripts/increment-ios-build.js
```

### Step 3: Test the Utilities (Optional)

Create a test file to verify the utilities work:

`test-extraction.ts`
```typescript
import { getTodayLocalString, parseDateString } from './packages/shared/lib/dateUtils';
import { useIsMobile } from './packages/shared/hooks/use-mobile';

// Test date utilities
console.log('Today:', getTodayLocalString());
console.log('Parsed date:', parseDateString('2025-10-02'));

// Test mobile detection (in a React component)
function TestComponent() {
  const isMobile = useIsMobile();
  console.log('Is mobile?', isMobile);
  return null;
}
```

### Step 4: Complete Option B (Database)

Follow the instructions in:
📄 `docs/OPTION-B-DATABASE-EXTRACTION.md`

Create these files:
```
infra/schema/
├── core.sql           ← Extract multi-tenant tables
├── rls-policies.sql   ← Extract security policies
└── README.md          ← Migration instructions
```

---

## 📦 What's Available Now

### Utilities (@sge/shared)

```typescript
// Date utilities
import { 
  getLocalDateString,
  getTodayLocalString,
  parseDateString,
  isToday,
  formatScheduleDate
} from '@sge/shared/lib/dateUtils';

// Mobile detection
import { useIsMobile } from '@sge/shared/hooks/use-mobile';

// Mobile compliance (App Store)
import { 
  isMobileApp,
  handleMobileSubscriptionUpgrade,
  getSubscriptionText
} from '@sge/shared/lib/mobileCompliance';
```

### Components (@sge/ui)

```typescript
// Route guards (needs customization)
import { ProtectedRoute, PublicRoute } from '@sge/ui/auth/ProtectedRoute';

// Tailwind utilities
import { cn } from '@sge/ui/lib/utils';
```

### Build Scripts

```bash
npm run version:ios        # Increment iOS build
npm run version:android    # Increment Android build
npm run version:increment  # Both platforms
```

---

## 🔧 Customization Checklist

Before using in a real project:

### ProtectedRoute Component
- [ ] Replace `user` and `loading` placeholders with your auth hook
- [ ] Update business association check logic
- [ ] Adjust redirect paths (`/auth`, `/onboarding`, etc.)
- [ ] Customize loading UI if desired

### Mobile Compliance
- [ ] Update `baseUrl` in `mobileCompliance.ts` to your domain
- [ ] Test subscription flow on iOS/Android
- [ ] Verify App Store compliance

### Database Schema (Option B)
- [ ] Customize `app_role` enum for your app
- [ ] Adjust subscription tiers if needed
- [ ] Add/remove tables as needed
- [ ] Extract and apply RLS policies

---

## 📚 Documentation

- **Overview:** `docs/PHASE-1-SUMMARY.md`
- **Progress Tracking:** `docs/EXTRACTION-PROGRESS.md`
- **Database Instructions:** `docs/OPTION-B-DATABASE-EXTRACTION.md`
- **Utility Guide:** `packages/shared/README.md`
- **Component Guide:** `packages/ui/README.md`
- **Build Scripts:** `scripts/README.md`

---

## 🐛 Troubleshooting

### Module Not Found Errors

If you see import errors:
```bash
# Install dependencies
npm install

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

The shared and ui packages may show errors until dependencies are installed:
```bash
# Install workspace dependencies
npm install

# If using specific packages in your app:
npm install react react-dom react-router-dom
npm install @capacitor/core
```

### Build Script Errors

If version increment scripts fail:
```bash
# Make sure iOS/Android projects exist:
npx cap add ios
npx cap add android

# Then try again:
npm run version:ios
```

---

## ✅ Verification Checklist

Run through this checklist to verify Phase 1 completion:

- [ ] Dependencies installed (`npm install`)
- [ ] `packages/shared` exists with 3 files
- [ ] `packages/ui` exists with 2 files
- [ ] `scripts/` has increment scripts
- [ ] All README files are readable
- [ ] No TypeScript errors in packages
- [ ] Ready to start Option B (database extraction)

---

## 🚀 Next Steps

1. ✅ Complete Option B (database schema)
2. 📋 Plan Week 2 component extractions
3. 🔧 Set up example app using these packages
4. 📱 Test mobile build automation

---

**You're ready to go!** Start with Option B database extraction and you'll have the complete foundation. 🎉
