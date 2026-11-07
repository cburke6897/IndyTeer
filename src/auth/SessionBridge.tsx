import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { useProfileContext } from './useProfileContext'
import { shouldDropTemporarySession } from './rememberMe'
import { hydrate, registerAccountReloader } from '../store/sync'
import { getUser } from '../lib/api/users'
import { listMyMemberships } from '../lib/api/organizations'

/**
 * Keeps the client cache in step with the real session. Signed out: loads the public data only.
 * Signed in: once the user row and memberships are ready, loads everything the person may see.
 * Render once inside <ProfileProvider>.
 */
export function SessionBridge() {
  const { user, loading, signOut } = useAuth()
  const { profile, memberships, loading: profileLoading, setProfile, setMemberships } = useProfileContext()

  useEffect(() => {
    if (shouldDropTemporarySession()) void signOut().catch(() => undefined)
  }, [signOut])

  // Lets actions reload the account (profile + memberships) and wait until the new data is in place.
  useEffect(() => {
    if (!user) return
    return registerAccountReloader(async () => {
      const [freshProfile, freshMemberships] = await Promise.all([getUser(user.id), listMyMemberships()])
      setProfile(freshProfile)
      setMemberships(freshMemberships)
      await hydrate({ authUser: user, profile: freshProfile, memberships: freshMemberships })
    })
  }, [user, setProfile, setMemberships])

  useEffect(() => {
    if (loading) return
    if (!user) { void hydrate(null); return }
    // Signed in: wait for the user row. If it failed to load, the guards show an error screen.
    if (profileLoading || !profile) return
    void hydrate({ authUser: user, profile, memberships })
  }, [loading, user, profile, memberships, profileLoading])

  return null
}
