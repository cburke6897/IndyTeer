import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { useProfileContext } from './useProfileContext'
import { shouldDropTemporarySession } from './rememberMe'
import { hydrate } from '../store/sync'

/**
 * Keeps the client cache in step with the real session. Signed out: loads the public data only.
 * Signed in: once the user row and memberships are ready, loads everything the person may see.
 * Render once inside <ProfileProvider>.
 */
export function SessionBridge() {
  const { user, loading, signOut } = useAuth()
  const { profile, memberships, loading: profileLoading } = useProfileContext()

  useEffect(() => {
    if (shouldDropTemporarySession()) void signOut().catch(() => undefined)
  }, [signOut])

  useEffect(() => {
    if (loading) return
    if (!user) { void hydrate(null); return }
    // Signed in: wait for the user row. If it failed to load, the guards show an error screen.
    if (profileLoading || !profile) return
    void hydrate({ authUser: user, profile, memberships })
  }, [loading, user, profile, memberships, profileLoading])

  return null
}
