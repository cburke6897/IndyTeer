import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePathFor } from '../../store/selectors'
import { useSession } from '../../store/session'
import { SessionLoading } from './SessionLoading'
import { SessionError } from './SessionError'

/** Requires a signed-in user who has finished the standard onboarding. Everyone is a standard user. */
export function RequireOnboarded() {
  const { user, loading, profileError, retryProfile } = useSession()
  const location = useLocation()
  if (loading) return <SessionLoading />
  if (profileError) return <SessionError message={profileError} onRetry={retryProfile} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.onboarded) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/**
 * Requires an active owner or admin membership in at least one organization. Access comes from the
 * membership and its role, not from any account type. Everyone else goes back to the standard app.
 */
export function RequireOrganization() {
  const { user, activeOrg, loading, profileError, retryProfile } = useSession()
  const location = useLocation()
  if (loading) return <SessionLoading />
  if (profileError) return <SessionError message={profileError} onRetry={retryProfile} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.onboarded) return <Navigate to={homePathFor(user)} replace />
  if (!activeOrg) return <Navigate to="/app" replace />
  return <Outlet />
}

/** Requires a session that has not finished onboarding. */
export function RequireOnboarding() {
  const { user, loading, profileError, retryProfile } = useSession()
  if (loading) return <SessionLoading />
  if (profileError) return <SessionError message={profileError} onRetry={retryProfile} />
  if (!user) return <Navigate to="/login" replace />
  if (user.onboarded) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Login / signup / landing: bounce signed-in users to their home. */
export function PublicOnly() {
  const { user, loading, profileError, retryProfile } = useSession()
  if (loading) return <SessionLoading />
  if (profileError) return <SessionError message={profileError} onRetry={retryProfile} />
  if (user) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}
