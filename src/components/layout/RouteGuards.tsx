import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { AccountType } from '../../types'
import { homePathFor } from '../../store/selectors'
import { useSession } from '../../store/session'
import { SessionLoading } from './SessionLoading'
import { SessionError } from './SessionError'

/** Requires a fully onboarded session of the given account type. */
export function RequireRole({ role }: { role: AccountType }) {
  const { user, loading, profileError, retryProfile } = useSession()
  const location = useLocation()
  if (loading) return <SessionLoading />
  if (profileError) return <SessionError message={profileError} onRetry={retryProfile} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.accountType || !user.onboarded) return <Navigate to={homePathFor(user)} replace />
  if (user.accountType !== role) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Requires a session that has not finished onboarding. */
export function RequireOnboarding() {
  const { user, loading, profileError, retryProfile } = useSession()
  if (loading) return <SessionLoading />
  if (profileError) return <SessionError message={profileError} onRetry={retryProfile} />
  if (!user) return <Navigate to="/login" replace />
  if (user.accountType && user.onboarded) return <Navigate to={homePathFor(user)} replace />
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
