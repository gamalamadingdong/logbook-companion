# @sge/shared

Shared utilities, types, and hooks for SGE template applications.

## 📦 Contents

### Utilities

#### `lib/dateUtils.ts`
Timezone-safe date utilities that prevent off-by-one errors.

```typescript
import { getLocalDateString, getTodayLocalString, parseDateString, isToday } from '@sge/shared/lib/dateUtils';

// Get today's date without timezone issues
const today = getTodayLocalString(); // "2025-10-02"

// Parse a date string safely
const date = parseDateString("2025-10-02");

// Check if a date is today
if (isToday(date)) {
  console.log("It's today!");
}
```

#### `lib/mobileCompliance.ts`
App Store and Play Store compliance utilities for subscription management.

```typescript
import { isMobileApp, handleMobileSubscriptionUpgrade, getSubscriptionText } from '@sge/shared/lib/mobileCompliance';

// Check if running as native app
if (isMobileApp()) {
  console.log("Running in native mobile app");
}

// Handle subscription upgrade (opens web browser on mobile)
const handled = handleMobileSubscriptionUpgrade('premium', 'https://yourapp.com');

// Get platform-appropriate UI text
const text = getSubscriptionText();
console.log(text.upgradeButton); // "Manage Subscription" on mobile, "Upgrade Plan" on web
```

**⚠️ Important**: Update the `baseUrl` in `mobileCompliance.ts` to your app's domain.

### Hooks

#### `hooks/use-mobile.tsx`
React hook for responsive mobile detection.

```typescript
import { useIsMobile } from '@sge/shared/hooks/use-mobile';

function MyComponent() {
  const isMobile = useIsMobile();
  
  return (
    <div>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
```

## 🔧 Installation

This package is part of the SGE monorepo and is automatically available to other workspace packages.

## 📝 License

MIT

## 🎯 Source

Extracted from [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2) production codebase.
