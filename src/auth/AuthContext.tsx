import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, type UserProfile } from '../services/supabase'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  signOut: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  isAuthenticated: boolean // Added for compatibility with existing code
  token: string | null // Added for compatibility
  login: () => void // Deprecated compatibility stub
  logout: () => void // Deprecated compatibility stub
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

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
        } else {
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
          setSession(session)
          setUser(session.user)
          setLoading(false)
          fetchProfile(session.user.id)
        } else {
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile])

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
    await supabase.auth.signOut()
    // Clear C2 Tokens
    localStorage.removeItem('concept2_token');
    localStorage.removeItem('concept2_refresh_token');
    localStorage.removeItem('concept2_expires_at');

    setSession(null)
    setUser(null)
    setProfile(null)
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

  const value = {
    user,
    profile,
    session,
    loading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    // Compat
    isAuthenticated: !!session,
    token, // Keeping this for C2 calls if needed
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
