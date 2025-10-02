# @sge/ui

Reusable UI components for SGE template applications. Components are extracted from ScheduleBoard v2 and designed to be copied and adapted for your specific needs.

## 📦 Contents

### Authentication Components

#### `auth/ProtectedRoute.tsx`
Route guard for authenticated pages with business association checks.

```typescript
import { ProtectedRoute, PublicRoute } from '@sge/ui/auth/ProtectedRoute';

// Protect authenticated routes
<ProtectedRoute>
  <YourDashboard />
</ProtectedRoute>

// Public routes (redirect if authenticated)
<PublicRoute redirectTo="/dashboard">
  <LoginPage />
</PublicRoute>
```

**⚠️ CUSTOMIZATION REQUIRED:**
1. Replace the `user` and `loading` placeholders with your auth hook
2. Update business association check logic
3. Adjust redirect paths for your app
4. Customize loading UI

**Example with Supabase:**
```typescript
import { useAuth } from '@/context/AuthContext';

// In ProtectedRoute.tsx, replace:
const user = null; // REPLACE THIS
const loading = false; // REPLACE THIS

// With:
const { user, loading } = useAuth();
```

### Utilities

#### `lib/utils.ts`
Tailwind CSS class merging utility (standard shadcn/ui pattern).

```typescript
import { cn } from '@sge/ui/lib/utils';

<div className={cn("base-classes", conditionalClass && "conditional-classes")} />
```

## 🎨 Design Philosophy

These components are **templates, not rigid abstractions**. They're designed to be:

1. **Copied and adapted** - Fork them for your specific needs
2. **Well-documented** - Clear comments on what to customize
3. **Production-ready** - Battle-tested patterns from ScheduleBoard v2
4. **Mobile-optimized** - Touch-friendly and responsive

## 🔧 Installation

This package is part of the SGE monorepo and is automatically available to other workspace packages.

## 📚 Component Categories

### Coming Soon
- **Navigation** - Mobile bottom nav, sidebar, app shell
- **Forms** - Form components with validation
- **Data Display** - Tables, lists, cards
- **Feedback** - Loading states, toasts, modals
- **Mobile** - Touch-optimized components and gestures

## 🎯 Source

Components extracted from [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2) production codebase.

## 📝 Usage Pattern

1. **Copy** the component to your app
2. **Customize** the TODOs and placeholders
3. **Adapt** the styling and behavior
4. **Test** thoroughly in your context

These are starting points, not dependencies you import directly in production. Think of them as **copy-paste templates** with production-quality patterns built in.

## 📖 License

MIT
