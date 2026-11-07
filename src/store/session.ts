import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useProfileContext } from '../auth/useProfileContext'
import { ctxKey } from '../data/remote'
import { useDB } from './store'
import { refresh } from './sync'
import { sessionOrg, sessionUser, sessionVolunteer, staffOrgs } from './selectors'

/** Which part of the app the person is in: their own volunteering, or an organization they manage. */
export function useArea(): 'user' | 'org' {
  return useLocation().pathname.startsWith('/org') ? 'org' : 'user'
}

/**
 * Current session. Supabase Auth is the single source of truth for "who is signed in"; everything
 * else comes from the database through the client cache (see ./sync).
 *
 * Everyone is a standard user. `volunteer` is the person's own profile (in the user area) and `org`
 * is the organization they manage (in the /org area). `orgs` lists every organization they manage.
 *
 * - `loading`: session, user row or data still loading, or the cache was built from older inputs.
 * - `profileError`: signed in, but the user row or the data could not be loaded. Not signed out.
 */
export function useSession() {
  const db = useDB()
  const area = useArea()
  const { user: authUser, loading: authLoading } = useAuth()
  const { profile, memberships, loading: profileLoading, error: profileError, retry } = useProfileContext()
  const loadError = db.loadError
  const synced = !!authUser && !!profile && db.ready && db.sessionUserId === authUser.id && db.key === ctxKey({ profile, memberships })
  const failed = !!authUser && ((!profileLoading && !!profileError) || (!!profile && !!loadError))
  const loading = !failed && (authLoading || (!!authUser && !synced))
  const user = synced ? sessionUser(db) : null
  const own = user ? sessionVolunteer(db) : null
  const managed = user ? sessionOrg(db) : null
  const orgs = user ? staffOrgs(db) : []
  const retryProfile = () => { retry(); void refresh() }
  return {
    db, user, area, orgs, activeOrg: managed,
    volunteer: area === 'org' ? null : own,
    org: area === 'org' ? managed : null,
    loading, profileError: failed ? (profileError ?? loadError) : null, retryProfile,
  }
}
