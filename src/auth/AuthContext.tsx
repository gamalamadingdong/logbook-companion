import { createContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, type UserProfile } from '../services/supabase'

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
  isAuthenticated: boolean // Added for compatibility with existing code
  token: string | null // Added for compatibility
  login: () => void // Deprecated compatibility stub
  logout: () => void // Deprecated compatibility stub
  loginAsGuest?: () => Promise<void>
  isGuest?: boolean
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [tokensReady, setTokensReady] = useState(false)
  const isGuestMode = useRef(false);

  // Legacy C2 Token (Keep for now to avoid breaking sync immediately)
  const [c2Token] = useState<string | null>(localStorage.getItem('concept2_token'));

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
        console.log('Restored C2 token from database');
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
        const { data: { session } } = await supabase.auth.getSession()
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
      } catch {
        setLoading(false)
      }
    }
    getInitialSession()

    // 2. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
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

    return () => subscription.unsubscribe()
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
    loginAsGuest,
    isGuest: user?.id === 'guest_user_123',
    refreshProfile,
    // Compat
    isAuthenticated: !!session,
    token,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
