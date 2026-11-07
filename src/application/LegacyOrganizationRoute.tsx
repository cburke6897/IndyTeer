import { Navigate, useParams } from 'react-router-dom'
import { useAccount } from './context'

// Preserve existing bookmarks while allowing a user to belong to several teams.
export function LegacyOrganizationRoute() {
  const account = useAccount()
  const tail = useParams()['*'] || ''
  const organization =
    account.data!.memberships.find((m) => m.status === 'active' && m.role === 'owner') ||
    account.data!.memberships.find((m) => m.status === 'active')
  if (!organization) return <Navigate to="/app/organizations" replace />
  const base = '/manage/' + organization.organization_id
  if (tail === 'settings') return <Navigate to="/app/settings" replace />
  if (tail === 'profile') return <Navigate to={base + '/settings'} replace />
  if (/^volunteers\/[^/]+$/.test(tail))
    return <Navigate to={'/people/' + tail.split('/')[1]} replace />
  if (/^opportunities\/[^/]+$/.test(tail) && tail !== 'opportunities/new')
    return <Navigate to={'/app/' + tail} replace />
  return <Navigate to={base + (tail ? '/' + tail : '')} replace />
}
