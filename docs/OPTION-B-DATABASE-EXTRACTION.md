# Option B: Database Schema Extraction Instructions

## 🎯 Objective

Extract the multi-tenant database foundation from ScheduleBoard v2 and create a reusable schema template for SGE projects.

## 📋 Tables to Extract

From `scheduleboardv2/docs/db/supabase_schema.sql`, extract these **foundational tables**:

### 1. Core Multi-Tenant Tables

#### **businesses** ✅ Extract
```sql
CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text,
  description text,
  industry text, -- Keep generic
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  
  -- Subscription fields (keep as-is for monetization)
  subscription_status text DEFAULT 'trial'::text,
  subscription_tier text DEFAULT 'free'::text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
  billing_email text,
  payment_method_id text,
  subscription_current_period_start timestamp with time zone,
  subscription_current_period_end timestamp with time zone,
  
  -- REMOVE THESE (ScheduleBoard-specific):
  -- daily_schedule_auto_send boolean
  -- daily_schedule_send_time time
  -- daily_schedule_timezone text
  -- notification_settings jsonb
  -- employee_limit integer
  -- employee_addon_packs integer
  
  -- Keep these:
  timezone text DEFAULT 'America/New_York'::text,
  features_enabled text[] DEFAULT ARRAY['core'::text],
  usage_metrics jsonb DEFAULT '{}'::jsonb,
  billing_address jsonb,
  tax_id text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
);
```

#### **profiles** ✅ Extract as-is
```sql
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text,
  last_name text,
  email text,
  role text DEFAULT 'user'::text CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'manager'::text])),
  display_name text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
```

#### **user_business_roles** ✅ Extract (modify enum type)
```sql
-- First, create the role enum (customize roles for your app)
CREATE TYPE app_role AS ENUM (
  'owner',      -- Full access, billing control
  'admin',      -- Full access, no billing
  'manager',    -- Manage operations, no settings
  'employee',   -- Standard access
  'viewer',     -- Read-only access
  'user'        -- Default role
);

CREATE TABLE public.user_business_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user'::app_role,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text])),
  invited_by uuid,
  invited_at timestamp with time zone,
  joined_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT user_business_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_business_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_business_roles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT user_business_roles_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
);
```

### 2. Authentication & Invitation System

#### **business_invites** ✅ Extract as-is
```sql
CREATE TABLE public.business_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee'::text,
  email text,
  expires_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_by_user_id uuid NOT NULL,
  used_by_user_id uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT business_invites_pkey PRIMARY KEY (id),
  CONSTRAINT business_invites_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT business_invites_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT business_invites_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES auth.users(id)
);
```

### 3. Subscription & Payment Tracking

#### **subscription_events** ✅ Extract as-is
```sql
CREATE TABLE public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  stripe_event_id text UNIQUE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT subscription_events_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
```

#### **usage_metrics** ✅ Extract as-is
```sql
CREATE TABLE public.usage_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  metric_type text NOT NULL,
  metric_value integer NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT usage_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT usage_metrics_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
```

### 4. Notification System Foundation

#### **notifications** ✅ Extract (simplify for template)
```sql
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY[
    'system'::text,
    'reminder'::text,
    'alert'::text,
    'info'::text
  ])),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread'::text CHECK (status = ANY (ARRAY['unread'::text, 'read'::text, 'archived'::text])),
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  channels text[] DEFAULT ARRAY['in-app'::text],
  delivery_status jsonb DEFAULT '{}'::jsonb,
  scheduled_for timestamp with time zone,
  expires_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
```

#### **notification_preferences** ✅ Extract as-is
```sql
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  notification_type text NOT NULL,
  in_app_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT true,
  quiet_hours_start time without time zone,
  quiet_hours_end time without time zone,
  timezone text DEFAULT 'UTC'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notification_preferences_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
```

#### **push_tokens** ✅ Extract as-is
```sql
CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])),
  device_info jsonb,
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
```

---

## ❌ Tables to SKIP (Business-Specific)

These are ScheduleBoard-specific and should NOT be extracted into the template:

- ❌ **jobs** - Business-specific
- ❌ **job_instances** - Business-specific
- ❌ **job_tasks** - Business-specific
- ❌ **job_documents** - Business-specific
- ❌ **job_status_history** - Business-specific
- ❌ **job_notes** - Business-specific
- ❌ **bids** - ScheduleBoard-specific feature
- ❌ **customers** - Will create generic "clients" template later
- ❌ **customer_contacts** - Part of clients template
- ❌ **customer_bids** - Business-specific
- ❌ **employees** - ScheduleBoard-specific (worker management)
- ❌ **crews** - ScheduleBoard-specific
- ❌ **crew_members** - ScheduleBoard-specific
- ❌ **equipment** - Trades-specific
- ❌ **daily_schedule_notifications** - ScheduleBoard-specific

---

## 📝 Step-by-Step Extraction Process

### Step 1: Create the Schema File

Create a new file: `sge-starter/infra/schema/core.sql`

```sql
-- SGE Template - Core Multi-Tenant Schema
-- Extracted from ScheduleBoard v2
-- 
-- This schema provides the foundation for multi-tenant SaaS applications
-- with subscription management, role-based access control, and notification system.
--
-- USAGE:
-- 1. Review and customize the app_role enum for your application
-- 2. Adjust subscription tiers and features as needed
-- 3. Run this in your Supabase project
-- 4. Add RLS policies (see rls-policies.sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create role enum (customize for your app)
CREATE TYPE app_role AS ENUM (
  'owner',
  'admin',
  'manager',
  'employee',
  'viewer',
  'user'
);

-- [Copy the extracted tables here]
```

### Step 2: Copy Each Table

Copy the table definitions from above into `core.sql` in this order:

1. `profiles` (extends auth.users)
2. `businesses` (multi-tenant foundation)
3. `user_business_roles` (role-based access)
4. `business_invites` (invitation system)
5. `subscription_events` (Stripe webhooks)
6. `usage_metrics` (billing)
7. `notifications` (notification system)
8. `notification_preferences` (user preferences)
9. `push_tokens` (mobile push)

### Step 3: Extract RLS Policies

You'll need to extract Row Level Security (RLS) policies from ScheduleBoard. Look for policies related to the extracted tables.

**Where to find them:**
- In Supabase dashboard: Authentication > Policies
- Or search the ScheduleBoard schema for `CREATE POLICY`

**Key policies to extract:**
- Business isolation (users can only see their business data)
- Role-based access (admins vs users vs employees)
- Profile access (users can read others, only update self)

Create a new file: `sge-starter/infra/schema/rls-policies.sql`

### Step 4: Create Migration Template

Create `sge-starter/infra/schema/README.md` with instructions on how to apply the schema to a new Supabase project.

---

## 🔧 Customization Guide

### For Each New Project:

1. **Customize app_role enum**
   - Add/remove roles based on your access model
   - Example: Add 'contractor', 'client', 'partner', etc.

2. **Adjust subscription tiers**
   - Modify `subscription_tier` CHECK constraint
   - Add custom tier-specific features

3. **Configure features_enabled**
   - Define feature flags for your app
   - Example: `['core', 'analytics', 'api_access', 'custom_branding']`

4. **Simplify if needed**
   - Remove subscription fields if not monetizing
   - Remove notification tables if not using notifications
   - Keep only what you need

---

## ✅ Verification Checklist

After extraction:

- [ ] All foreign key relationships are intact
- [ ] All `business_id` columns exist for multi-tenancy
- [ ] No ScheduleBoard-specific fields remain (jobs, employees, equipment refs)
- [ ] app_role enum is defined before user_business_roles table
- [ ] RLS policies extracted and documented
- [ ] Migration instructions are clear
- [ ] Schema is tested in a fresh Supabase project

---

## 📚 Next Steps

After completing this extraction:

1. Test the schema in a fresh Supabase project
2. Create seed data for development
3. Document the role hierarchy and permissions
4. Extract related Supabase Edge Functions (create-invite, process-invite, etc.)
5. Create a CLI command to scaffold this for new projects

---

## 🎯 Goal

Create a **production-ready multi-tenant foundation** that any SGE project can use as a starting point, with clear customization points and no business-specific logic.
