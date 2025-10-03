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

#### `lib/serviceIntegration.ts`
Service integration patterns for external APIs with retry logic, failover, and multi-backend support.

```typescript
import { HttpServiceClient, MultiBackendService, createServiceFromEnv } from '@sge/shared/lib/serviceIntegration';

// Create HTTP client for external service
const client = new HttpServiceClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key',
  timeout: 30000,
  retryAttempts: 3
});

// Make requests with automatic retry
const response = await client.get('/users/123');
if (response.success) {
  console.log('User data:', response.data);
}

// Multi-backend setup with failover
const multiService = new MultiBackendService();
multiService.registerBackend({
  type: 'azure',
  priority: 1,
  config: { baseUrl: 'https://primary-service.com', apiKey: 'key1' }
});
multiService.registerBackend({
  type: 'aws', 
  priority: 2,
  config: { baseUrl: 'https://backup-service.com', apiKey: 'key2' }
});

// Execute with automatic failover
const result = await multiService.executeWithFailover(async (client) => {
  return client.get('/data');
});
```

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
