import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Building2, CalendarCheck, ChevronDown, Clock, Compass, LayoutDashboard, ListChecks, LogOut, Menu,
  PlusCircle, Settings, UserCircle, Users, X, ClipboardList,
} from 'lucide-react'
import { Logo } from '../ui/Logo'
import { Avatar, OrgLogo } from '../ui/Avatar'
import { Dropdown, MenuItem } from '../ui/Dropdown'
import { SearchInput } from '../ui/SearchInput'
import { LinkButton } from '../ui/Button'
import { cn, timeAgo } from '../../lib/utils'
import { useSession } from '../../store/session'
import { markNotificationRead, markNotificationsRead } from '../../store/actions'
import { useLogout } from '../../auth/useLogout'
import type { AccountType } from '../../types'

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

const iconProps = { size: 18, strokeWidth: 1.9 }
const volunteerNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: <LayoutDashboard {...iconProps} />, end: true },
  { to: '/app/explore', label: 'Explore Opportunities', icon: <Compass {...iconProps} /> },
  { to: '/app/events', label: 'My Events', icon: <CalendarCheck {...iconProps} /> },
  { to: '/app/hours', label: 'My Volunteer Hours', icon: <Clock {...iconProps} /> },
  { to: '/app/organizations', label: 'Organizations', icon: <Building2 {...iconProps} /> },
  { to: '/app/profile', label: 'My Profile', icon: <UserCircle {...iconProps} /> },
  { to: '/app/settings', label: 'Settings', icon: <Settings {...iconProps} /> },
]
const orgNav: NavItem[] = [
  { to: '/org', label: 'Overview', icon: <LayoutDashboard {...iconProps} />, end: true },
  { to: '/org/opportunities', label: 'My Opportunities', icon: <ListChecks {...iconProps} />, end: true },
  { to: '/org/opportunities/new', label: 'Create Opportunity', icon: <PlusCircle {...iconProps} /> },
  { to: '/org/registrations', label: 'Registrations', icon: <ClipboardList {...iconProps} /> },
  { to: '/org/volunteers', label: 'Volunteers', icon: <Users {...iconProps} /> },
  { to: '/org/profile', label: 'Organization Profile', icon: <Building2 {...iconProps} /> },
  { to: '/org/analytics', label: 'Analytics', icon: <BarChart3 {...iconProps} /> },
  { to: '/org/settings', label: 'Settings', icon: <Settings {...iconProps} /> },
]

export function AppShell({ role }: { role: AccountType }) {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setDrawer(false)
  }
  const nav = role === 'volunteer' ? volunteerNav : orgNav

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex">
        <SidebarContent nav={nav} role={role} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/55" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] animate-fade-in flex-col bg-navy">
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute top-4 right-3 rounded p-1 text-white/70 hover:text-white"><X size={20} /></button>
            <SidebarContent nav={nav} role={role} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar role={role} onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ nav, role }: { nav: NavItem[]; role: AccountType }) {
  const { org, volunteer } = useSession()
  return (
    <>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to={role === 'volunteer' ? '/app' : '/org'}><Logo light /></Link>
      </div>
      <div className="px-3 pb-2">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold tracking-wider text-white/45 uppercase">
          {role === 'volunteer' ? 'Volunteer' : 'Organization'} workspace
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-white/10 text-white before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-gold' : 'text-white/70 hover:bg-white/5 hover:text-white',
              )
            }
          >
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
        {role === 'volunteer' && volunteer ? <Avatar person={volunteer} size="sm" /> : org ? <OrgLogo org={org} size="sm" /> : null}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{role === 'volunteer' ? `${volunteer?.firstName} ${volunteer?.lastName}` : org?.name}</p>
          <p className="truncate text-xs text-white/55">Indiana, USA</p>
        </div>
      </div>
    </>
  )
}

function Topbar({ role, onMenu }: { role: AccountType; onMenu: () => void }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} aria-label="Open menu" className="-ml-1 rounded-md p-2 text-navy hover:bg-surface lg:hidden"><Menu size={20} /></button>
      <Link to={role === 'volunteer' ? '/app' : '/org'} className="lg:hidden"><Logo /></Link>
      {role === 'volunteer' ? (
        <form
          className="ml-2 hidden max-w-md flex-1 sm:block"
          onSubmit={(e) => { e.preventDefault(); navigate(`/app/explore${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); setQ('') }}
        >
          <SearchInput value={q} onChange={setQ} placeholder="Search opportunities, causes, organizations…" />
        </form>
      ) : (
        <div className="hidden flex-1 sm:block" />
      )}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {role === 'organization' && <LinkButton to="/org/opportunities/new" size="sm" variant="accent" icon={<PlusCircle size={15} />} className="max-sm:hidden">New opportunity</LinkButton>}
        <NotificationsMenu />
        <UserMenu role={role} />
      </div>
    </header>
  )
}

function NotificationsMenu() {
  const { db, user } = useSession()
  const navigate = useNavigate()
  if (!user) return null
  const mine = db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const unread = mine.filter((n) => !n.read).length
  return (
    <Dropdown
      label="Notifications"
      panelClassName="w-[min(22rem,calc(100vw-2rem))] !py-0"
      trigger={() => (
        <span className="relative flex size-9 items-center justify-center rounded-md text-navy transition-colors hover:bg-surface">
          <Bell size={19} />
          {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] leading-4 font-bold text-navy-950">{unread}</span>}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-navy">Notifications</p>
            {unread > 0 && <button onClick={() => markNotificationsRead(user.id)} className="text-xs font-semibold text-navy-700 hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {mine.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</p>}
            {mine.slice(0, 12).map((n) => (
              <button
                key={n.id}
                onClick={() => { markNotificationRead(n.id); close(); if (n.link) navigate(n.link) }}
                className={cn('flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface', !n.read && 'bg-gold-50/50')}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-gold-600')} />
                <span>
                  <span className="block text-[13px] leading-snug text-ink">{n.text}</span>
                  <span className="mt-1 block text-xs text-muted">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  )
}

function UserMenu({ role }: { role: AccountType }) {
  const { volunteer, org, user } = useSession()
  const navigate = useNavigate()
  const logout = useLogout()
  const base = role === 'volunteer' ? '/app' : '/org'
  const name = role === 'volunteer' ? `${volunteer?.firstName ?? ''} ${volunteer?.lastName ?? ''}` : org?.name ?? ''
  return (
    <Dropdown
      label="Account menu"
      panelClassName="w-60"
      trigger={() => (
        <span className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 transition-colors hover:bg-surface">
          {role === 'volunteer' && volunteer ? <Avatar person={volunteer} size="sm" /> : org ? <OrgLogo org={org} size="sm" /> : null}
          <ChevronDown size={14} className="text-muted" />
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-3.5 pb-3 pt-2">
            <p className="truncate text-sm font-bold text-navy">{name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            <p className="mt-1.5 inline-block rounded bg-gold-50 px-1.5 text-[11px] font-semibold text-gold-700">{role === 'volunteer' ? 'Volunteer account' : 'Organization account'}</p>
          </div>
          <div className="py-1">
            <MenuItem icon={<UserCircle size={16} />} onClick={() => { close(); navigate(role === 'volunteer' ? '/app/profile' : '/org/profile') }}>{role === 'volunteer' ? 'My profile' : 'Organization profile'}</MenuItem>
            <MenuItem icon={<Settings size={16} />} onClick={() => { close(); navigate(`${base}/settings`) }}>Settings</MenuItem>
          </div>
          <div className="border-t border-line pt-1">
            <MenuItem icon={<LogOut size={16} />} onClick={() => { close(); void logout() }}>Log out</MenuItem>
          </div>
        </>
      )}
    </Dropdown>
  )
}
