import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  Compass,
  CalendarDays,
  Clock3,
  Building2,
  UserRound,
  Settings,
  Newspaper,
  Bell,
  LogOut,
  LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/ui/Logo'
import { Button } from '../components/ui/Button'
import { AccountProvider } from './AccountProvider'
import { useAccount } from './context'
import { useAction } from './hooks'
import { QueryState } from './ui'

export function ProtectedWorkspace() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)
    return (
      <p role="status" className="p-12 text-center">
        Restoring your session…
      </p>
    )
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return (
    <AccountProvider key={user.id}>
      <Workspace />
    </AccountProvider>
  )
}
function Workspace() {
  const account = useAccount()
  const auth = useAuth()
  const action = useAction()
  const location = useLocation()
  if (account.loading || !account.data)
    return (
      <main className="mx-auto max-w-xl p-8">
        <Logo />
        <QueryState {...account} />
        <Button variant="secondary" onClick={() => void action.run(auth.signOut)} className="mt-4">
          Log out
        </Button>
      </main>
    )
  const { profile, memberships, organizations } = account.data
  if (
    !profile.onboarded &&
    !['/onboarding', '/app/profile', '/app/settings'].includes(location.pathname)
  )
    return <Navigate to="/onboarding" replace />
  const links = [
    ['/app', 'Overview', LayoutDashboard],
    ['/app/explore', 'Explore', Compass],
    ['/app/events', 'My events', CalendarDays],
    ['/app/hours', 'My hours', Clock3],
    ['/app/organizations', 'Organizations', Building2],
    ['/app/feed', 'Community', Newspaper],
    ['/app/notifications', 'Notifications', Bell],
    ['/app/profile', 'My profile', UserRound],
    ['/app/settings', 'Settings', Settings],
  ] as const
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-line bg-white px-5 sm:px-8">
        <Link to="/app" aria-label="IndyTeer home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted sm:inline">
            {profile.full_name || auth.user?.email}
          </span>
          <Button
            variant="ghost"
            disabled={action.busy}
            icon={<LogOut size={16} />}
            onClick={() => void action.run(auth.signOut)}
          >
            Log out
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-white p-4 lg:min-h-[calc(100vh-72px)] lg:border-r lg:border-b-0">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {links.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/app'}
                className={({ isActive }) =>
                  'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ' +
                  (isActive ? 'bg-gold-50 text-navy' : 'text-muted hover:bg-navy-50')
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 hidden border-t border-line pt-5 lg:block">
            <p className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">
              Your organizations
            </p>
            {memberships
              .filter((m) => m.status === 'active')
              .map((m) => (
                <Link
                  key={m.organization_id}
                  className="mt-2 block rounded-lg px-3 py-2 text-sm hover:bg-navy-50"
                  to={'/manage/' + m.organization_id}
                >
                  {organizations.find((o) => o.id === m.organization_id)?.name || 'Organization'}
                  <span className="block text-xs text-muted">{m.role}</span>
                </Link>
              ))}
            <Link
              className="mt-3 block px-3 text-sm font-semibold text-navy-700"
              to="/app/organizations/new"
            >
              + Create organization
            </Link>
          </div>
          {profile.is_platform_admin && (
            <Link className="mt-4 block px-3 font-semibold text-navy-700" to="/admin">
              Platform administration
            </Link>
          )}
        </aside>
        <main className="min-w-0 p-5 sm:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
