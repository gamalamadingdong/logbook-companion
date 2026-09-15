import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, type UserProfile } from '../services/supabase'
import { AuthContext } from './authContextDef'

/** How long to wait for initial session before giving up (ms) */
const SESSION_TIMEOUT_MS = 15_000

const ADMIN_USER_ID = '93c46300-57eb-48c8-b35c-cc49c76cfa66';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [tokensReady, setTokensReady] = useState(false)
  const [isCoachRole, setIsCoachRole] = useState(false)
  const isGuestMode = useRef(false);

  // Legacy C2 Token (Keep for now to avoid breaking sync immediately)
  const [c2Token] = useState<string | null>(localStorage.getItem('concept2_token'));

  /** Manually clear a stuck/stale session — exposed to UI as escape hatch */
  const clearStaleSession = useCallback(async () => {
    console.warn('Manually clearing stale session')
    // Remove Supabase auth keys from localStorage directly
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('sb-'))
    keysToRemove.forEach(k => localStorage.removeItem(k))
    // Also call signOut to clean up internal state
    await supabase.auth.signOut().catch(() => { /* ignore */ })
    setSession(null)
    setUser(null)
    setProfile(null)
    setTokensReady(true)
    setLoading(false)
  }, [])

  const createBasicProfile = useCallback(async (userId: string, email: string, displayName?: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          display_name: displayName?.trim() || email.split('@')[0],
          email: email,
          skill_level: 'novice',
          profile_visibility: 'public',
          share_workouts: true,
          share_progress: true
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating profile:', error)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } catch (error) {
      console.error('Exception creating profile:', error)
      setProfile(null)
    }
  }, [])

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile? Create one.
          await createBasicProfile(userId, user?.email || 'Unknown')
        } else {
          console.error('Error fetching profile:', error)
        }
      } else {
        setProfile(data)
      }

      // Check if user has team-scoped coach/coxswain access, org-scoped coach access,
      // or an approved coaching request.
      const { data: coachRow } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userId)
        .in('role', ['coach', 'coxswain'])
        .limit(1)
        .maybeSingle()

      let isCoach = !!coachRow
      if (!isCoach) {
        const { data: orgCoachRow } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()
        isCoach = !!orgCoachRow
      }
      if (!isCoach) {
        const { data: approvedRequest } = await supabase
          .from('coaching_access_requests')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle()
        isCoach = !!approvedRequest
      }
      setIsCoachRole(isCoach)
    } catch (error) {
      console.error('Exception in fetchProfile:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [user?.email, createBasicProfile])

  // Restore C2 tokens from database to localStorage
  const restoreC2Tokens = useCallback(async (userId: string) => {
    try {
      const localToken = localStorage.getItem('concept2_token');
      const localRefreshToken = localStorage.getItem('concept2_refresh_token');
      const localExpiresAt = localStorage.getItem('concept2_expires_at');

      const { data, error } = await supabase
        .from('user_integrations')
        .select('concept2_token, concept2_refresh_token, concept2_expires_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching C2 tokens:', error);
        return;
      }

      const dbToken = data?.concept2_token;
      const dbRefreshToken = data?.concept2_refresh_token;
      const dbExpiresAt = data?.concept2_expires_at;

      if (dbToken) {
        localStorage.setItem('concept2_token', dbToken);
      }
      if (dbRefreshToken) {
        localStorage.setItem('concept2_refresh_token', dbRefreshToken);
      }
      if (dbExpiresAt) {
        localStorage.setItem('concept2_expires_at', dbExpiresAt);
      }

      // Self-heal path: if DB has missing Concept2 fields but local storage has values,
      // persist local values so future sessions restore correctly.
      const shouldBackfillToken = !dbToken && !!localToken;
      const shouldBackfillRefresh = !dbRefreshToken && !!localRefreshToken;
      const shouldBackfillExpiry = !dbExpiresAt && !!localExpiresAt;

      if (shouldBackfillToken || shouldBackfillRefresh || shouldBackfillExpiry) {
        const { error: upsertErr } = await supabase
          .from('user_integrations')
          .upsert({
            user_id: userId,
            concept2_token: localToken,
            concept2_refresh_token: localRefreshToken,
            concept2_expires_at: localExpiresAt
          }, { onConflict: 'user_id' });

        if (upsertErr) {
          console.error('Error backfilling C2 tokens to database:', upsertErr);
        }
      }

      // Notify any listeners (Sync page, status badges) that token state may have changed.
      window.dispatchEvent(new CustomEvent('concept2-token-updated'));
      if (!localStorage.getItem('concept2_token')) {
        window.dispatchEvent(new CustomEvent('concept2-reconnect-required'));
      }
    } catch (err) {
      console.error('Exception restoring C2 tokens:', err);
    }
  }, []);

  useEffect(() => {
    // 1. Check Initial Session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          // Session check returned an error — but DON'T nuke the session.
          // It could be a transient network issue. Let onAuthStateChange handle recovery.
          console.warn('Session check error (non-fatal):', error.message)
          // Fall through: treat as "no session for now" but don't sign out
          setTokensReady(true)
          setLoading(false)
          return
        }
        if (session?.user) {
          setSession(session)
          setUser(session.user)
          setLoading(false)
          fetchProfile(session.user.id)
          restoreC2Tokens(session.user.id).finally(() => setTokensReady(true))
        } else {
          setTokensReady(true) // No user, no tokens to restore
          setLoading(false)
        }
      } catch (err) {
        // Network error during session check — DON'T clear session.
        // It may still be valid once connectivity is restored.
        console.warn('Network error checking session (non-fatal):', err)
        setTokensReady(true)
        setLoading(false)
      }
    }
    getInitialSession()

    // 1b. Safety timeout — if loading doesn't resolve, stop waiting but DON'T destroy the session.
    // The manual clearStaleSession() escape hatch exists for genuinely stuck sessions.
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn(`Session check timed out after ${SESSION_TIMEOUT_MS}ms — unlocking UI (session preserved)`)
          setTokensReady(true)
          return false
        }
        return prev
      })
    }, SESSION_TIMEOUT_MS)

    // 2. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && !session) {
          // Unusual: refresh event without session. Log but don't nuke — SDK may retry.
          console.warn('TOKEN_REFRESHED fired without session — ignoring (SDK will retry)')
          return
        }
        if (session?.user) {
          isGuestMode.current = false; // Real login overrides guest
          setSession(session)
          setUser(session.user)
          setLoading(false)
          fetchProfile(session.user.id)
          setTokensReady(false) // Reset while restoring
          restoreC2Tokens(session.user.id).finally(() => setTokensReady(true))
        } else {
          // Only clear if NOT in guest mode
          if (!isGuestMode.current) {
            setSession(null)
            setUser(null)
            setProfile(null)
          }
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  }, [fetchProfile, restoreC2Tokens])

  // --- Auth Actions ---

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      // Optimistic profile creation
      createBasicProfile(data.user.id, email, displayName)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // NOTE: We intentionally do NOT clear C2 tokens here.
      // The Concept2 connection is independent of the app login.
      // Users who sign out and sign back in should remain connected to C2.
      // Tokens are stored per-user in the DB and restored on login.

      setSession(null)
      setUser(null)
      setProfile(null)
      isGuestMode.current = false;
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  // --- Legacy / Compatibility ---
  const token = c2Token; // Needed for Sync.tsx?
  const login = () => { /* no-op, use signIn */ };
  const logout = signOut;

  // --- Guest Mode ---
  const loginAsGuest = useCallback(async () => {
    setLoading(true);
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    isGuestMode.current = true;

    // Mock Session/User
    const guestUser = {
      id: 'guest_user_123',
      email: 'guest@demo.co',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as User;

    setUser(guestUser);

    // Mock Profile
    const guestProfile: UserProfile = {
      id: 'guest_profile_123',
      user_id: 'guest_user_123',
      email: 'guest@demo.co',
      display_name: 'Guest Rower',
      created_at: new Date().toISOString(),
      onboarding_completed: true,
      skill_level: 'intermediate',
      profile_visibility: 'public',
      share_workouts: true,
      share_progress: true
    };
    setProfile(guestProfile);

    setSession({
      access_token: 'mock_token',
      refresh_token: 'mock_refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: guestUser
    } as Session);

    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const isAdmin = user?.id === ADMIN_USER_ID;

  const value = {
    user,
    profile,
    session,
    loading,
    profileLoading,
    tokensReady,
    signUp,
    signIn,
    signOut,
    resetPassword,
    clearStaleSession,
    loginAsGuest,
    isGuest: user?.id === 'guest_user_123',
    isCoach: isCoachRole,
    isAdmin,
    refreshProfile,
    // Compat
    isAuthenticated: !!session,
    token,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
