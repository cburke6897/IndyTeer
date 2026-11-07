import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { shouldDropTemporarySession } from './rememberMe'
import { syncAuthUser } from '../store/actions'

/**
 * Keeps the app's local data store in step with the one real session source (Supabase Auth).
 * Render once inside <AuthProvider>.
 */
export function SessionBridge() {
  const { user, loading, signOut } = useAuth()

  useEffect(() => {
    if (shouldDropTemporarySession()) void signOut().catch(() => undefined)
  }, [signOut])

  useEffect(() => {
    if (loading) return
    syncAuthUser(user)
  }, [loading, user])

  return null
}
