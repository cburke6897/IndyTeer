import { useAuth } from '../auth/useAuth'
import { useProfileContext } from '../auth/useProfileContext'
import { useDB } from './store'
import { sessionOrg, sessionUser, sessionVolunteer } from './selectors'

/**
 * Current session. Supabase Auth is the single source of truth for "who is signed in", and the
 * database profile (public.profiles) is the source for account type, name and avatar. The local
 * store supplies the remaining prototype data (opportunities, registrations, ...).
 *
 * - `loading`: session or profile still loading, or the local user is not yet in sync.
 * - `profileError`: signed in, but the profile row could not be loaded. Not the same as signed out.
 */
export function useSession() {
  const db = useDB()
  const { user: authUser, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, error: profileError, retry } = useProfileContext()
  const synced = !!authUser && !!profile && db.sessionUserId === authUser.id
  const failed = !!authUser && !profileLoading && !!profileError
  const loading = !failed && (authLoading || (!!authUser && !synced))
  const user = synced ? sessionUser(db) : null
  const volunteer = user ? sessionVolunteer(db) : null
  const org = user ? sessionOrg(db) : null
  return { db, user, volunteer, org, loading, profileError: failed ? profileError : null, retryProfile: retry }
}
