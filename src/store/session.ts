import { useAuth } from '../auth/useAuth'
import { useDB } from './store'
import { sessionOrg, sessionUser, sessionVolunteer } from './selectors'

/**
 * Current session. Supabase Auth (via AuthProvider) is the single source of truth for
 * "who is signed in"; the local store supplies the user's profile and app data.
 * `loading` is true until Supabase has restored the session and the local user is in sync.
 */
export function useSession() {
  const db = useDB()
  const { user: authUser, loading: authLoading } = useAuth()
  const synced = !!authUser && db.sessionUserId === authUser.id
  const loading = authLoading || (!!authUser && !synced)
  const user = authUser && synced ? sessionUser(db) : null
  const volunteer = user ? sessionVolunteer(db) : null
  const org = user ? sessionOrg(db) : null
  return { db, user, volunteer, org, loading }
}
