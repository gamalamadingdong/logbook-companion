import { createContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, type UserProfile } from '../services/supabase'

/** How long to wait for initial session before giving up (ms) */
const SESSION_TIMEOUT_MS = 15_000

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  tokensReady: boolean // True after C2 tokens have been restored from DB
  signOut: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  clearStaleSession: () => Promise<void> // Manual escape hatch for stuck sessions
  isAuthenticated: boolean // Added for compatibility with existing code
  token: string | null // Added for compatibility
  login: () => void // Deprecated compatibility stub
  logout: () => void // Deprecated compatibility stub
  loginAsGuest?: () => Promise<void>
  isGuest?: boolean
  isCoach: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

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

  const createBasicProfile = useCallback(async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          display_name: email.split('@')[0],
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

      // Check if user has coach role in any team (drives isCoach for route gating)
      const { data: coachRow } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'coach')
        .limit(1)
        .maybeSingle()
      setIsCoachRole(!!coachRow)
    } catch (error) {
      console.error('Exception in fetchProfile:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [user?.email, createBasicProfile])

  // Restore C2 tokens from database to localStorage
  const restoreC2Tokens = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('concept2_token, concept2_refresh_token, concept2_expires_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        // No integrations row or other error - that's fine, user just hasn't connected C2 yet
        if (error.code !== 'PGRST116') {
          console.error('Error fetching C2 tokens:', error);
        }
        return;
      }

      if (data?.concept2_token) {
        localStorage.setItem('concept2_token', data.concept2_token);
      }
      if (data?.concept2_refresh_token) {
        localStorage.setItem('concept2_refresh_token', data.concept2_refresh_token);
      }
      if (data?.concept2_expires_at) {
        localStorage.setItem('concept2_expires_at', data.concept2_expires_at);
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

  const signUp = async (email: string, password: string, _displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      // Optimistic profile creation
      createBasicProfile(data.user.id, email)
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
    setProfile({
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
    } as any);

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
