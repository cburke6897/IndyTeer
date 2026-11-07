import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { signInWithEmail, signOut, signUpWithEmail } from './authService'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let disposed = false
    let authEventObserved = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventObserved = true
      if (!disposed) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    // Subscribe before reading storage so a sign-in/sign-out event cannot be
    // overwritten by a slower initial session read.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!disposed && !authEventObserved) setSession(data.session)
      })
      .catch(() => {
        if (!disposed && !authEventObserved) setSession(null)
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })

    return () => {
      disposed = true
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signUp: signUpWithEmail,
    signIn: signInWithEmail,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
