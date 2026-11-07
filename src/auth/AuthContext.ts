import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { signInWithEmail, signOut, signUpWithEmail } from './authService'

export type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: typeof signUpWithEmail
  signIn: typeof signInWithEmail
  signOut: typeof signOut
}

export const AuthContext = createContext<AuthContextValue | null>(null)
