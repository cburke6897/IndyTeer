import { useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'
import { ProfileContext, type ProfileContextValue } from './ProfileContext'

/** Loads the database profile once for the signed-in user. Render inside <AuthProvider>. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const { profile, memberships, loading, error, setProfile } = useProfile(user?.id, attempt)

  const value: ProfileContextValue = {
    profile,
    memberships,
    loading,
    error,
    setProfile,
    retry: () => setAttempt((n) => n + 1),
  }
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
