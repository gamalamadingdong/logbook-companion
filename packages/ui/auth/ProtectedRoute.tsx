/**
 * Protected Route Component
 * Handles authentication and business association checks
 * 
 * @source Adapted from ScheduleBoard v2
 * @license MIT
 * 
 * CUSTOMIZATION REQUIRED:
 * - Update AuthContext import to match your auth setup
 * - Customize business association check logic
 * - Adjust redirect paths for your app structure
 */
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional: Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Optional: Custom auth check function */
  checkAuth?: () => Promise<boolean>;
  /** Optional: Redirect path when not authenticated */
  redirectTo?: string;
  /** Optional: Paths to skip business/role checks */
  skipChecksFor?: string[];
}

/**
 * ProtectedRoute - Guards routes that require authentication
 * 
 * USAGE:
 * ```tsx
 * <ProtectedRoute>
 *   <YourComponent />
 * </ProtectedRoute>
 * ```
 * 
 * CUSTOMIZE:
 * 1. Import your auth context/hook (e.g., useAuth from your auth system)
 * 2. Update the business association logic for your app
 * 3. Adjust redirect paths (/auth, /onboarding, etc.)
 * 4. Customize the loading UI
 * 
 * EXAMPLE WITH SUPABASE:
 * ```tsx
 * import { useAuth } from '@/context/AuthContext';
 * import { supabase } from '@/lib/supabase';
 * 
 * // Then use user, loading from your auth context
 * const { user, loading } = useAuth();
 * ```
 */
export function ProtectedRoute({ 
  children, 
  loadingComponent,
  redirectTo = '/auth',
  skipChecksFor = ['/onboarding', '/accept-invite', '/auth']
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // TODO: Replace with your auth hook
  // Example: const { user, loading } = useAuth();
  const user = null; // REPLACE THIS
  const loading = false; // REPLACE THIS

  // Cache last checked user to avoid repeated checks
  const lastCheckedUserId = useRef<string | null>(null);
  const lastHasAccess = useRef<boolean | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    // Don't redirect if not authenticated
    if (!loading && !user) {
      if (location.pathname !== redirectTo) {
        navigate(redirectTo, { replace: true });
      }
      return;
    }

    // Skip business checking for certain routes
    const skipBusinessCheck = skipChecksFor.includes(location.pathname);
    
    if (user && !loading && !skipBusinessCheck) {
      // If we've already checked this user and got a definitive result, use it
      const userId = (user as any).id || (user as any).uid; // Adapt based on your auth system
      
      if (lastCheckedUserId.current === userId && lastHasAccess.current !== null) {
        if (!lastHasAccess.current) {
          navigate('/onboarding', { replace: true });
        }
        return;
      }

      // Prevent concurrent checks for the same user
      if (checkingRef.current && lastCheckedUserId.current === userId) {
        return;
      }
      
      checkingRef.current = true;
      lastCheckedUserId.current = userId;

      let cancelled = false;
      const checkBusinessAssociation = async () => {
        try {
          // TODO: Replace with your business association check
          // Example with Supabase:
          // const { data: roles } = await supabase
          //   .rpc('get_user_business_roles', { target_user_id: userId });
          // const hasBusinessRoles = roles && roles.length > 0;
          
          const hasBusinessRoles = true; // REPLACE THIS with your logic

          if (cancelled) return;
          
          // Cache result
          lastCheckedUserId.current = userId;
          lastHasAccess.current = hasBusinessRoles;
          checkingRef.current = false;

          if (!hasBusinessRoles) {
            navigate('/onboarding', { replace: true });
          }
        } catch (error) {
          if (cancelled) return;
          
          console.error('[ProtectedRoute] Error checking access:', error);
          
          // Cache negative result to avoid tight retry loops
          lastCheckedUserId.current = userId;
          lastHasAccess.current = false;
          checkingRef.current = false;

          navigate('/onboarding', { replace: true });
        }
      };

      checkBusinessAssociation();

      return () => {
        cancelled = true;
      };
    }
  }, [user, loading, navigate, location.pathname, redirectTo, skipChecksFor]);

  if (loading) {
    return loadingComponent || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

/**
 * PublicRoute - For pages that should only be accessible when NOT authenticated
 * (e.g., login, signup pages)
 */
export function PublicRoute({ 
  children,
  redirectTo = '/dashboard'
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const navigate = useNavigate();
  
  // TODO: Replace with your auth hook
  const user = null; // REPLACE THIS
  const loading = false; // REPLACE THIS

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, redirectTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}
