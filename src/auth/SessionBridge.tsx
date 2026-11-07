import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { useProfileContext } from './useProfileContext'
import { shouldDropTemporarySession } from './rememberMe'
import { syncAuthUser } from '../store/actions'

/**
 * Keeps the app's local data store in step with the real session (Supabase Auth) and the
 * public.users row and memberships. Render once inside <ProfileProvider>.
 */
export function SessionBridge() {
  const { user, loading, signOut } = useAuth()
  const { profile, memberships, loading: profileLoading } = useProfileContext()
  const hasOrganization = memberships.some((m) => m.status === 'active')

  useEffect(() => {
    if (shouldDropTemporarySession()) void signOut().catch(() => undefined)
  }, [signOut])

  useEffect(() => {
    if (loading) return
    if (!user) return syncAuthUser(null, null)
    // Signed in: wait for the database profile. If it failed to load, the guards show an error.
    if (profileLoading || !profile) return
    syncAuthUser(user, profile, hasOrganization)
  }, [loading, user, profile, profileLoading, hasOrganization])

  return null
}
