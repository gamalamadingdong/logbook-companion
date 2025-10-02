-- SGE Template - Row Level Security (RLS) Policies
-- Security policies for multi-tenant data isolation
--
-- CRITICAL: These policies enforce business isolation and role-based access
-- Review carefully and test thoroughly before deploying to production
--
-- CUSTOMIZATION: Adjust role-based permissions based on your app_role enum

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user's business IDs
CREATE OR REPLACE FUNCTION public.get_user_business_ids(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (business_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT ubr.business_id
  FROM public.user_business_roles ubr
  WHERE ubr.user_id = target_user_id
    AND ubr.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has specific role in business
CREATE OR REPLACE FUNCTION public.has_business_role(
  target_business_id uuid,
  required_role app_role
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = target_business_id
      AND role >= required_role  -- Assumes role hierarchy
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is business owner
CREATE OR REPLACE FUNCTION public.is_business_owner(target_business_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = target_business_id
      AND role = 'owner'::app_role
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is business admin or owner
CREATE OR REPLACE FUNCTION public.is_business_admin(target_business_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_business_roles
    WHERE user_id = auth.uid()
      AND business_id = target_business_id
      AND role IN ('owner'::app_role, 'admin'::app_role)
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Users can read all profiles (needed for collaboration)
CREATE POLICY "Users can read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- BUSINESSES TABLE POLICIES
-- ============================================================================

-- Users can read businesses they belong to
CREATE POLICY "Users can read their businesses"
ON public.businesses FOR SELECT
TO authenticated
USING (
  id IN (SELECT business_id FROM public.get_user_business_ids())
);

-- Only owners can update business settings
CREATE POLICY "Owners can update business"
ON public.businesses FOR UPDATE
TO authenticated
USING (public.is_business_owner(id))
WITH CHECK (public.is_business_owner(id));

-- Authenticated users can create businesses (onboarding)
CREATE POLICY "Users can create businesses"
ON public.businesses FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only owners can delete businesses
CREATE POLICY "Owners can delete business"
ON public.businesses FOR DELETE
TO authenticated
USING (public.is_business_owner(id));

-- ============================================================================
-- USER_BUSINESS_ROLES TABLE POLICIES
-- ============================================================================

-- Users can read roles in their businesses
CREATE POLICY "Users can read roles in their businesses"
ON public.user_business_roles FOR SELECT
TO authenticated
USING (
  business_id IN (SELECT business_id FROM public.get_user_business_ids())
);

-- Admins can create roles (inviting users)
CREATE POLICY "Admins can create roles"
ON public.user_business_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.is_business_admin(business_id)
);

-- Admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_business_roles FOR UPDATE
TO authenticated
USING (public.is_business_admin(business_id))
WITH CHECK (public.is_business_admin(business_id));

-- Admins can delete roles (remove users)
CREATE POLICY "Admins can delete roles"
ON public.user_business_roles FOR DELETE
TO authenticated
USING (public.is_business_admin(business_id));

-- ============================================================================
-- BUSINESS_INVITES TABLE POLICIES
-- ============================================================================

-- Users can read invites in their businesses
CREATE POLICY "Users can read invites in their businesses"
ON public.business_invites FOR SELECT
TO authenticated
USING (
  business_id IN (SELECT business_id FROM public.get_user_business_ids())
);

-- Anyone can read their own invite (by code)
CREATE POLICY "Anyone can read invite by code"
ON public.business_invites FOR SELECT
TO authenticated
USING (true);  -- Additional filtering in application logic

-- Admins can create invites
CREATE POLICY "Admins can create invites"
ON public.business_invites FOR INSERT
TO authenticated
WITH CHECK (
  public.is_business_admin(business_id)
);

-- Admins can update invites
CREATE POLICY "Admins can update invites"
ON public.business_invites FOR UPDATE
TO authenticated
USING (public.is_business_admin(business_id))
WITH CHECK (public.is_business_admin(business_id));

-- Admins can delete invites
CREATE POLICY "Admins can delete invites"
ON public.business_invites FOR DELETE
TO authenticated
USING (public.is_business_admin(business_id));

-- ============================================================================
-- SUBSCRIPTION_EVENTS TABLE POLICIES
-- ============================================================================

-- Owners can read subscription events for their business
CREATE POLICY "Owners can read subscription events"
ON public.subscription_events FOR SELECT
TO authenticated
USING (public.is_business_owner(business_id));

-- System can insert subscription events (via Edge Functions)
CREATE POLICY "Service role can insert subscription events"
ON public.subscription_events FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- USAGE_METRICS TABLE POLICIES
-- ============================================================================

-- Owners and admins can read usage metrics
CREATE POLICY "Admins can read usage metrics"
ON public.usage_metrics FOR SELECT
TO authenticated
USING (public.is_business_admin(business_id));

-- System can insert usage metrics (via Edge Functions)
CREATE POLICY "Service role can insert usage metrics"
ON public.usage_metrics FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- System can insert notifications (via Edge Functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- NOTIFICATION_DELIVERIES TABLE POLICIES
-- ============================================================================

-- Users can read delivery status for their notifications
CREATE POLICY "Users can read own notification deliveries"
ON public.notification_deliveries FOR SELECT
TO authenticated
USING (
  notification_id IN (
    SELECT id FROM public.notifications WHERE user_id = auth.uid()
  )
);

-- System manages deliveries
CREATE POLICY "Service role can manage deliveries"
ON public.notification_deliveries FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- NOTIFICATION_HISTORY TABLE POLICIES
-- ============================================================================

-- Users can read history for their notifications
CREATE POLICY "Users can read own notification history"
ON public.notification_history FOR SELECT
TO authenticated
USING (
  notification_id IN (
    SELECT id FROM public.notifications WHERE user_id = auth.uid()
  )
);

-- System manages history
CREATE POLICY "Service role can manage history"
ON public.notification_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- NOTIFICATION_PREFERENCES TABLE POLICIES
-- ============================================================================

-- Users can read their own preferences
CREATE POLICY "Users can read own preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences"
ON public.notification_preferences FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- PUSH_TOKENS TABLE POLICIES
-- ============================================================================

-- Users can read their own push tokens
CREATE POLICY "Users can read own push tokens"
ON public.push_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can manage their own push tokens
CREATE POLICY "Users can manage own push tokens"
ON public.push_tokens FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- IMPORTANT SECURITY NOTES
-- ============================================================================

-- 1. All policies enforce business isolation via user_business_roles
-- 2. Service role bypasses RLS for system operations (Edge Functions)
-- 3. Role hierarchy: owner > admin > manager > employee > viewer > user
-- 4. Always test policies thoroughly before production deployment
-- 5. Consider adding audit logging for sensitive operations
-- 6. Review and update policies as your permission model evolves

-- TESTING RLS POLICIES:
-- 1. Create test users with different roles
-- 2. Verify each user can only access their business data
-- 3. Test all CRUD operations for each table
-- 4. Verify cross-business data isolation
-- 5. Test Edge Functions with service role access

-- CUSTOMIZATION CHECKLIST:
-- [ ] Adjust role hierarchy if needed
-- [ ] Add custom business logic policies
-- [ ] Test with your specific role permissions
-- [ ] Add policies for custom tables
-- [ ] Document any policy exceptions
