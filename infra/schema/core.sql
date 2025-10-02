-- SGE Template - Core Multi-Tenant Schema
-- Extracted from ScheduleBoard v2
-- 
-- This schema provides the foundation for multi-tenant SaaS applications
-- with subscription management, role-based access control, and notification system.
--
-- USAGE:
-- 1. Review and customize the app_role enum for your application
-- 2. Adjust subscription tiers and features as needed
-- 3. Run this in your Supabase project SQL editor
-- 4. Apply RLS policies (see rls-policies.sql)
--
-- CUSTOMIZATION POINTS:
-- - app_role enum: Add/remove roles for your access model
-- - subscription_tier CHECK: Adjust tier names
-- - features_enabled: Define your feature flags
-- - notification types: Customize for your app

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

-- Role-based access control enum
-- CUSTOMIZE: Add/remove roles based on your application needs
CREATE TYPE app_role AS ENUM (
  'owner',      -- Full access including billing and business deletion
  'admin',      -- Full operational access, no billing
  'manager',    -- Manage operations, limited settings access
  'employee',   -- Standard user access
  'viewer',     -- Read-only access
  'user'        -- Default role
);

-- ============================================================================
-- CORE USER MANAGEMENT
-- ============================================================================

-- Profiles table (extends auth.users)
-- This is the foundation for all user data in the application
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
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MULTI-TENANT BUSINESS FOUNDATION
-- ============================================================================

-- Businesses table (multi-tenant foundation)
-- CUSTOMIZE: Adjust subscription tiers, features, and business-specific fields
CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text,
  description text,
  industry text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  
  -- Subscription Management (Stripe integration)
  -- CUSTOMIZE: Adjust tier names and statuses for your pricing model
  subscription_status text DEFAULT 'trial'::text CHECK (
    subscription_status = ANY (ARRAY[
      'trial'::text,
      'active'::text,
      'past_due'::text,
      'canceled'::text,
      'incomplete'::text
    ])
  ),
  subscription_tier text DEFAULT 'free'::text CHECK (
    subscription_tier = ANY (ARRAY[
      'free'::text,
      'professional'::text,
      'enterprise'::text
    ])
  ),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamp with time zone DEFAULT (now() + '14 days'::interval),
  billing_email text,
  payment_method_id text,
  subscription_current_period_start timestamp with time zone,
  subscription_current_period_end timestamp with time zone,
  
  -- Business Configuration
  timezone text DEFAULT 'America/New_York'::text,
  
  -- Feature Flags
  -- CUSTOMIZE: Define your application's feature flags
  features_enabled text[] DEFAULT ARRAY['core'::text],
  
  -- Usage Tracking
  usage_metrics jsonb DEFAULT '{}'::jsonb,
  
  -- Billing Information
  billing_address jsonb,
  tax_id text,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLE-BASED ACCESS CONTROL
-- ============================================================================

-- User-Business-Role associations
-- Links users to businesses with specific roles
CREATE TABLE public.user_business_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user'::app_role,
  status text DEFAULT 'active'::text CHECK (
    status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text])
  ),
  invited_by uuid,
  invited_at timestamp with time zone,
  joined_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT user_business_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_business_roles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_business_roles_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT user_business_roles_invited_by_fkey 
    FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Ensure one role per user per business
  CONSTRAINT user_business_roles_unique_user_business 
    UNIQUE (user_id, business_id)
);

-- Enable RLS
ALTER TABLE public.user_business_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INVITATION SYSTEM
-- ============================================================================

-- Business invitations
-- Allows users to invite others to join their business
CREATE TABLE public.business_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee'::text,
  email text,
  expires_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (
    status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])
  ),
  created_by_user_id uuid NOT NULL,
  used_by_user_id uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT business_invites_pkey PRIMARY KEY (id),
  CONSTRAINT business_invites_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT business_invites_created_by_user_id_fkey 
    FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT business_invites_used_by_user_id_fkey 
    FOREIGN KEY (used_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.business_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUBSCRIPTION & PAYMENT TRACKING
-- ============================================================================

-- Subscription events (Stripe webhooks)
-- Tracks all subscription-related events from Stripe
CREATE TABLE public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  stripe_event_id text UNIQUE,
  stripe_subscription_id text,
  stripe_customer_id text,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT subscription_events_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_events_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Usage metrics for billing and analytics
CREATE TABLE public.usage_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  metric_type text NOT NULL,
  metric_value integer NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT usage_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT usage_metrics_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTIFICATION SYSTEM
-- ============================================================================

-- Notifications table
-- CUSTOMIZE: Adjust notification types for your application
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid,
  
  -- Notification Type
  -- CUSTOMIZE: Define your notification types
  type text NOT NULL CHECK (type = ANY (ARRAY[
    'system'::text,
    'reminder'::text,
    'alert'::text,
    'info'::text
  ])),
  
  title text NOT NULL,
  message text NOT NULL,
  
  -- Status
  status text NOT NULL DEFAULT 'unread'::text CHECK (
    status = ANY (ARRAY['unread'::text, 'read'::text, 'archived'::text])
  ),
  
  -- Priority
  priority text NOT NULL DEFAULT 'normal'::text CHECK (
    priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])
  ),
  
  -- Data and metadata
  data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Delivery channels
  channels text[] DEFAULT ARRAY['in-app'::text],
  delivery_status jsonb DEFAULT '{}'::jsonb,
  
  -- Scheduling
  scheduled_for timestamp with time zone,
  expires_at timestamp with time zone,
  
  -- Timestamps
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT notifications_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notification delivery tracking
CREATE TABLE public.notification_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL CHECK (
    status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'read'::text])
  ),
  provider_id text,
  provider_response jsonb,
  error_message text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT notification_deliveries_notification_id_fkey 
    FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Notification history (audit trail)
CREATE TABLE public.notification_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  action text NOT NULL CHECK (
    action = ANY (ARRAY['created'::text, 'read'::text, 'archived'::text, 'deleted'::text])
  ),
  user_id uuid,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  details jsonb,
  
  CONSTRAINT notification_history_pkey PRIMARY KEY (id),
  CONSTRAINT notification_history_notification_id_fkey 
    FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE,
  CONSTRAINT notification_history_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Notification preferences
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  notification_type text NOT NULL,
  
  -- Channel preferences
  in_app_enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT true,
  
  -- Quiet hours
  quiet_hours_start time without time zone,
  quiet_hours_end time without time zone,
  timezone text DEFAULT 'UTC'::text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT notification_preferences_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- One preference per user per business per notification type
  CONSTRAINT notification_preferences_unique 
    UNIQUE (user_id, business_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Push notification tokens (mobile)
CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (
    platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])
  ),
  device_info jsonb,
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT push_tokens_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Unique token per user per platform
  CONSTRAINT push_tokens_unique_token UNIQUE (user_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Profiles indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Business indexes
CREATE INDEX idx_businesses_stripe_customer ON public.businesses(stripe_customer_id);
CREATE INDEX idx_businesses_subscription_status ON public.businesses(subscription_status);

-- User-Business-Role indexes
CREATE INDEX idx_user_business_roles_user_id ON public.user_business_roles(user_id);
CREATE INDEX idx_user_business_roles_business_id ON public.user_business_roles(business_id);
CREATE INDEX idx_user_business_roles_status ON public.user_business_roles(status);

-- Invitation indexes
CREATE INDEX idx_business_invites_code ON public.business_invites(invite_code);
CREATE INDEX idx_business_invites_email ON public.business_invites(email);
CREATE INDEX idx_business_invites_status ON public.business_invites(status);

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_business_id ON public.notifications(business_id);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Push token indexes
CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON public.push_tokens(is_active) WHERE is_active = true;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_business_roles_updated_at BEFORE UPDATE ON public.user_business_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users';
COMMENT ON TABLE public.businesses IS 'Multi-tenant business entities with subscription management';
COMMENT ON TABLE public.user_business_roles IS 'Role-based access control linking users to businesses';
COMMENT ON TABLE public.business_invites IS 'Invitation system for onboarding new users to businesses';
COMMENT ON TABLE public.subscription_events IS 'Stripe webhook events for subscription tracking';
COMMENT ON TABLE public.usage_metrics IS 'Usage tracking for billing and analytics';
COMMENT ON TABLE public.notifications IS 'Multi-channel notification system';
COMMENT ON TABLE public.notification_preferences IS 'User notification channel preferences';
COMMENT ON TABLE public.push_tokens IS 'Push notification tokens for mobile devices';

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Apply RLS policies from rls-policies.sql
-- 2. Set up Supabase Edge Functions for auth and notifications
-- 3. Configure Stripe webhook endpoint
-- 4. Customize notification types and subscription tiers for your app
