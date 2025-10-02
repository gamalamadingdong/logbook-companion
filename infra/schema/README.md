# SGE Template - Database Schema

Complete database foundation for multi-tenant SaaS applications with subscription management, authentication, and notification systems.

## 📦 What's Included

### Core Schema Files

1. **`core.sql`** - Multi-tenant foundation
   - User profiles and authentication
   - Business/tenant management
   - Role-based access control (RBAC)
   - Subscription management (Stripe)
   - Notification system
   - Usage tracking

2. **`rls-policies.sql`** - Row Level Security
   - Business data isolation
   - Role-based permissions
   - Secure multi-tenant access

3. **`functions.sql`** - Helper functions (coming soon)
   - User role checks
   - Business permission helpers
   - Notification utilities

## 🔧 Prerequisites

### Required Supabase Extensions

These are automatically available in Supabase projects:

1. **`auth` schema** - Supabase Authentication
   - User management (`auth.users`)
   - Sessions and tokens
   - OAuth providers
   - MFA support

2. **`pg_cron` extension** - Scheduled jobs
   - Automated cleanup tasks
   - Daily maintenance
   - Scheduled notifications
   - Usage metric aggregation

### Enable Extensions

Run in your Supabase SQL editor:

```sql
-- Enable UUID extension (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## 🚀 Installation

### Step 1: Set Up Fresh Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for project initialization
4. Open SQL Editor

### Step 2: Apply Core Schema

```sql
-- Copy and paste contents of core.sql
-- This creates all tables, indexes, and triggers
```

**Tables created:**
- `profiles` - User profiles
- `businesses` - Multi-tenant businesses
- `user_business_roles` - RBAC system
- `business_invites` - Invitation system
- `subscription_events` - Stripe webhooks
- `usage_metrics` - Billing data
- `notifications` - Notification queue
- `notification_preferences` - User preferences
- `notification_deliveries` - Delivery tracking
- `notification_history` - Audit trail
- `push_tokens` - Mobile push notifications

### Step 3: Apply RLS Policies

```sql
-- Copy and paste contents of rls-policies.sql
-- This enforces security and data isolation
```

**Policies created:**
- Business data isolation
- Role-based access control
- User profile management
- Invitation system security
- Notification access control

### Step 4: Verify Installation

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Verify app_role enum
SELECT enum_range(NULL::app_role);
```

Expected output:
```
{owner,admin,manager,employee,viewer,user}
```

## 📋 Schema Overview

### Multi-Tenant Architecture

```
auth.users (Supabase)
    ↓
profiles (Your app users)
    ↓
user_business_roles (Links users to businesses with roles)
    ↓
businesses (Tenant isolation)
    ↓
[Your business-specific tables]
```

### Key Features

✅ **Multi-tenant isolation** - Complete data separation per business
✅ **Role-based access** - 6-tier permission system (owner → admin → manager → employee → viewer → user)
✅ **Subscription management** - Stripe integration ready
✅ **Invitation system** - Onboard users with email invites
✅ **Notification system** - Multi-channel (in-app, email, SMS, push)
✅ **Mobile-ready** - Push token management for iOS/Android
✅ **Audit trails** - Track notification history and user actions
✅ **GDPR compliant** - Account deletion support

## 🎯 Customization Guide

### 1. Adjust Role Hierarchy

Edit the `app_role` enum in `core.sql`:

```sql
-- Default roles:
CREATE TYPE app_role AS ENUM (
  'owner',      -- Full access + billing
  'admin',      -- Full access, no billing
  'manager',    -- Operations access
  'employee',   -- Standard user
  'viewer',     -- Read-only
  'user'        -- Default
);

-- Add custom roles:
CREATE TYPE app_role AS ENUM (
  'owner',
  'admin',
  'manager',
  'contractor',  -- Add this
  'client',      -- Add this
  'employee',
  'viewer',
  'user'
);
```

### 2. Customize Subscription Tiers

Edit the `businesses` table CHECK constraint:

```sql
subscription_tier text DEFAULT 'free'::text CHECK (
  subscription_tier = ANY (ARRAY[
    'free'::text,
    'starter'::text,     -- Change 'professional' to 'starter'
    'growth'::text,      -- Change 'enterprise' to 'growth'
    'enterprise'::text   -- Keep or add more tiers
  ])
)
```

### 3. Define Feature Flags

Update `features_enabled` array for your app:

```sql
-- In businesses table default:
features_enabled text[] DEFAULT ARRAY['core'::text]

-- Customize for your features:
features_enabled text[] DEFAULT ARRAY[
  'core'::text,
  'api_access'::text,
  'custom_branding'::text,
  'advanced_analytics'::text,
  'priority_support'::text
]
```

### 4. Customize Notification Types

Edit notification type CHECK constraint:

```sql
-- Default types:
type text NOT NULL CHECK (type = ANY (ARRAY[
  'system'::text,
  'reminder'::text,
  'alert'::text,
  'info'::text
]))

-- Add your notification types:
type text NOT NULL CHECK (type = ANY (ARRAY[
  'system'::text,
  'order_update'::text,
  'payment_reminder'::text,
  'booking_confirmed'::text,
  'custom_alert'::text
]))
```

## 📅 Scheduled Jobs (pg_cron)

### Setting Up Cron Jobs

The `pg_cron` extension is used for scheduled maintenance tasks.

#### Example: Clean Up Old Notifications

```sql
-- Run daily at 2 AM UTC to delete old notifications
SELECT cron.schedule(
  'cleanup-old-notifications',        -- Job name
  '0 2 * * *',                        -- Cron expression (2 AM daily)
  $$
  DELETE FROM public.notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status = 'archived';
  $$
);
```

#### Example: Aggregate Daily Usage Metrics

```sql
-- Run daily at 1 AM UTC to aggregate usage
SELECT cron.schedule(
  'aggregate-daily-usage',
  '0 1 * * *',
  $$
  INSERT INTO public.usage_metrics (business_id, metric_type, metric_value, period_start, period_end)
  SELECT 
    business_id,
    'daily_active_users' as metric_type,
    COUNT(DISTINCT user_id) as metric_value,
    CURRENT_DATE - 1 as period_start,
    CURRENT_DATE - 1 as period_end
  FROM public.user_business_roles
  WHERE status = 'active'
  GROUP BY business_id;
  $$
);
```

#### View Scheduled Jobs

```sql
-- List all cron jobs
SELECT * FROM cron.job ORDER BY jobid;

-- View job execution history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

#### Remove a Scheduled Job

```sql
-- Unschedule by name
SELECT cron.unschedule('cleanup-old-notifications');
```

### Recommended Cron Jobs

Add these to your Supabase project:

1. **Clean up expired invitations** (daily)
2. **Archive old notifications** (daily)
3. **Aggregate usage metrics** (daily)
4. **Check subscription status** (hourly)
5. **Cleanup expired sessions** (weekly)

## 🔐 Security Best Practices

### 1. Always Use RLS

```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;
```

### 2. Test Policies Thoroughly

Create test users with different roles and verify access:

```sql
-- As a test user, try to access another business's data
SET ROLE authenticated;
SET request.jwt.claim.sub = 'test-user-id';

-- Should return empty (no access to other businesses)
SELECT * FROM businesses WHERE id != 'your-business-id';
```

### 3. Use Service Role Sparingly

Only Edge Functions should use `service_role` key. Never expose it to clients.

### 4. Monitor Audit Logs

Track sensitive operations:

```sql
-- View recent notification history
SELECT * FROM notification_history 
WHERE action = 'deleted'
ORDER BY timestamp DESC;
```

## 🧪 Testing Checklist

After applying the schema:

- [ ] All tables created successfully
- [ ] RLS enabled on all tables
- [ ] Policies applied without errors
- [ ] `app_role` enum exists with correct values
- [ ] Indexes created for performance
- [ ] Triggers working (`updated_at` auto-updates)
- [ ] Foreign keys enforce relationships
- [ ] Can create test user and profile
- [ ] Can create test business
- [ ] Can assign user to business with role
- [ ] Business isolation works (users can't see other businesses)
- [ ] Role-based access works (employees can't delete business)
- [ ] Invitations can be created and processed
- [ ] Notifications can be created
- [ ] Cron extension enabled

## 📊 Database Statistics

After setup, you should have:

- **11 core tables** for multi-tenant SaaS
- **~30 RLS policies** for security
- **~10 indexes** for performance
- **5 triggers** for automation
- **1 custom enum** (app_role)
- **3+ helper functions** for permissions

## 🚨 Troubleshooting

### Error: `type "app_role" already exists`

```sql
-- Drop and recreate
DROP TYPE IF EXISTS app_role CASCADE;
-- Then run core.sql again
```

### Error: `RLS policy already exists`

```sql
-- Drop all policies for a table
DROP POLICY IF EXISTS "policy_name" ON table_name;
-- Then run rls-policies.sql again
```

### Can't access data from Edge Functions

Make sure you're using the `service_role` key in Edge Functions:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use service role, not anon key
);
```

### Performance Issues

```sql
-- Analyze query performance
EXPLAIN ANALYZE 
SELECT * FROM notifications WHERE user_id = 'user-id';

-- Check missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

## 📚 Next Steps

1. ✅ **Apply schema** to your Supabase project
2. ✅ **Test multi-tenancy** with sample data
3. ✅ **Set up cron jobs** for maintenance
4. 🔜 **Extract Edge Functions** for auth and notifications
5. 🔜 **Set up Stripe integration** for subscriptions
6. 🔜 **Configure Resend** for email notifications

## 🔗 Related Documentation

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [PostgreSQL Enums](https://www.postgresql.org/docs/current/datatype-enum.html)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

## 💡 Architecture Notes

### Why This Structure?

1. **`profiles` extends `auth.users`** - Keeps auth separate from app data
2. **`user_business_roles` as junction** - Enables many-to-many with roles
3. **`business_id` everywhere** - Tenant isolation at database level
4. **Separate notification tables** - Scalability for high-volume notifications
5. **`subscription_events` table** - Audit trail for billing events
6. **Push tokens separate** - Allows multiple devices per user

### Design Decisions

- ✅ **Enum for roles** - Type safety and constraint enforcement
- ✅ **JSONB for flexible data** - Settings, metadata without schema changes
- ✅ **Timestamp tracking** - `created_at` and `updated_at` everywhere
- ✅ **Soft deletes available** - Add `deleted_at` column if needed
- ✅ **Cascade deletes** - Clean up related data automatically
- ✅ **Unique constraints** - Prevent duplicate invites, tokens, etc.

---

**Schema Version**: 1.0.0  
**Last Updated**: October 2, 2025  
**Extracted From**: [ScheduleBoard v2](https://github.com/gamalamadingdong/scheduleboardv2)
