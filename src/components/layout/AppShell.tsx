import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Building2, CalendarCheck, Check, ChevronDown, ChevronsUpDown, Clock, Compass, HeartHandshake, LayoutDashboard,
  ListChecks, LogOut, Menu, PlusCircle, Settings, UserCircle, UserCog, Users, X, ClipboardList,
} from 'lucide-react'
import { Logo } from '../ui/Logo'
import { Avatar, OrgLogo } from '../ui/Avatar'
import { Dropdown, MenuItem } from '../ui/Dropdown'
import { SearchInput } from '../ui/SearchInput'
import { LinkButton } from '../ui/Button'
import { cn, timeAgo } from '../../lib/utils'
import { useSession } from '../../store/session'
import { markNotificationRead, markNotificationsRead, setActiveOrg } from '../../store/actions'
import { memberRole, sessionVolunteer } from '../../store/selectors'
import { act } from '../../store/act'
import { useLogout } from '../../auth/useLogout'

type Area = 'user' | 'org'

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number }

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
  { to: '/org/people', label: 'People', icon: <UserCog {...iconProps} /> },
  { to: '/org/profile', label: 'Organization Profile', icon: <Building2 {...iconProps} /> },
  { to: '/org/analytics', label: 'Analytics', icon: <BarChart3 {...iconProps} /> },
  { to: '/org/settings', label: 'Settings', icon: <Settings {...iconProps} /> },
]

export function AppShell({ area }: { area: Area }) {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setDrawer(false)
  }
  const { db, activeOrg } = useSession()
  const waiting = activeOrg ? (db.orgPeople[activeOrg.id] ?? []).filter((p) => p.status === 'pending').length : 0
  const nav = area === 'user' ? volunteerNav : orgNav.map((n) => (n.to === '/org/people' ? { ...n, badge: waiting } : n))

  return (
    <div className="min-h-screen bg-surface">
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-gold px-4 py-3 text-base font-semibold text-navy-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to main content</a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex">
        <SidebarContent nav={nav} area={area} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/55" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] animate-fade-in flex-col bg-navy">
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute top-4 right-3 rounded p-1 text-white/70 hover:text-white"><X size={20} /></button>
            <SidebarContent nav={nav} area={area} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar area={area} onMenu={() => setDrawer(true)} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ nav, area }: { nav: NavItem[]; area: Area }) {
  const { db, orgs } = useSession()
  const me = sessionVolunteer(db)
  return (
    <>
      {area === 'org' ? (
        <>
          {/* The organization being managed is the first thing in the sidebar, top left. */}
          <div className="shrink-0 px-3 pt-4 [&>div>button]:w-full"><OrgSwitcher /></div>
          <div className="px-5 pt-3 pb-1"><Link to="/org" aria-label="IndyTeer home"><Logo light /></Link></div>
        </>
      ) : (
        <>
          <div className="flex h-16 shrink-0 items-center px-5">
            <Link to="/app" aria-label="IndyTeer home"><Logo light /></Link>
          </div>
          <div className="px-3 pb-2">
            <p className="px-3 pb-2 pt-3 text-xs font-semibold tracking-wider text-white/60 uppercase">Volunteering</p>
          </div>
        </>
      )}
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
            <span className="flex-1">{n.label}</span>
            {!!n.badge && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy-950" aria-label={`${n.badge} waiting`}>{n.badge}</span>}
          </NavLink>
        ))}
      </nav>
      {area === 'user' && (
        <div className="mx-3 mb-3 rounded-lg border border-white/10 bg-white/5 p-3">
          {orgs.length === 0 ? (
            <>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-white"><Building2 size={15} className="text-gold" /> Run an organization?</p>
              <p className="mt-1 text-xs leading-snug text-white/60">Create one to post opportunities and manage volunteers.</p>
              <LinkButton to="/create-organization" size="sm" variant="accent" className="mt-2.5 w-full">Create organization</LinkButton>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold tracking-wider text-white/45 uppercase">Your organizations</p>
              <div className="[&>div>button]:w-full"><OrgSwitcher compact /></div>
            </>
          )}
        </div>
      )}
      {area === 'org' && (
        <Link to="/app" className="mx-3 mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"><HeartHandshake size={17} /> Back to volunteering</Link>
      )}
      <div className="m-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
        {me ? <Avatar person={me} size="sm" /> : null}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{me ? `${me.firstName} ${me.lastName}` : ''}</p>
          <p className="truncate text-xs text-white/55">Indiana, USA</p>
        </div>
      </div>
    </>
  )
}

/** Lists the organizations the user manages, switches between them, and offers to create another. */
function OrgSwitcher({ compact, variant = 'dark' }: { compact?: boolean; variant?: 'dark' | 'light' }) {
  const { orgs, activeOrg } = useSession()
  const navigate = useNavigate()
  const current = activeOrg ?? orgs[0]
  const light = variant === 'light'
  return (
    <Dropdown
      label={`Selected organization: ${current?.name ?? 'none'}. Switch organization`}
      align="left"
      panelClassName="w-72"
      trigger={() => (
        <span className={cn('flex w-full items-center gap-3 rounded-lg text-left transition-colors', light ? 'border border-line-strong bg-white p-1.5 pr-2 hover:bg-surface' : compact ? 'mt-1.5 bg-white/5 p-2 hover:bg-white/10' : 'bg-white/10 p-3 hover:bg-white/15')}>
          {current && <OrgLogo org={current} size={light ? 'sm' : 'md'} />}
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-base font-bold', light ? 'text-navy' : 'text-white')}>{current?.name}</span>
            {!light && <span className="block text-sm text-white/70">{compact ? 'Manage' : orgs.length > 1 ? 'Switch organization' : 'Your organization'}</span>}
          </span>
          <ChevronsUpDown size={16} className={cn('shrink-0', light ? 'text-muted' : 'text-white/70')} aria-hidden="true" />
        </span>
      )}
    >
      {(close) => (
        <>
          <p className="px-3.5 pb-1 pt-1 text-xs font-semibold tracking-wider text-muted uppercase">Your organizations</p>
          {orgs.map((o) => (
            <MenuItem key={o.id} icon={o.id === current?.id ? <Check size={16} className="text-navy" /> : <span className="size-4" />} onClick={() => { close(); setActiveOrg(o.id); navigate('/org') }}>
              <span className="truncate">{o.name}{o.id === current?.id ? ' (selected)' : ''}</span>
            </MenuItem>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            <MenuItem icon={<PlusCircle size={16} />} onClick={() => { close(); navigate('/create-organization') }}>Create another organization</MenuItem>
            <MenuItem icon={<HeartHandshake size={16} />} onClick={() => { close(); navigate('/app') }}>Back to volunteering</MenuItem>
          </div>
        </>
      )}
    </Dropdown>
  )
}

function Topbar({ area, onMenu }: { area: Area; onMenu: () => void }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} className="-ml-1 inline-flex items-center gap-2 rounded-md p-2 text-base font-semibold text-navy hover:bg-surface lg:hidden" aria-label="Open menu"><Menu size={22} /><span className="max-sm:sr-only">Menu</span></button>
      {area === 'org'
        ? <div className="min-w-0 max-w-[52%] sm:max-w-sm lg:hidden [&>div]:min-w-0 [&>div>button]:w-full [&>div>button]:min-w-0"><OrgSwitcher variant="light" /></div>
        : <Link to="/app" className="lg:hidden" aria-label="IndyTeer home"><Logo /></Link>}
      {area === 'user' ? (
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
        {area === 'org' && <LinkButton to="/org/opportunities/new" variant="accent" icon={<PlusCircle size={16} />} className="max-sm:hidden">New opportunity</LinkButton>}
        <NotificationsMenu />
        <UserMenu area={area} />
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
            {unread > 0 && <button onClick={() => void act(markNotificationsRead())} className="text-xs font-semibold text-navy-700 hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {mine.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</p>}
            {mine.slice(0, 12).map((n) => (
              <button
                key={n.id}
                onClick={() => { void act(markNotificationRead(n.id)); close(); if (n.link) navigate(n.link) }}
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

function UserMenu({ area }: { area: Area }) {
  const { db, user, orgs, activeOrg } = useSession()
  const me = sessionVolunteer(db)
  const navigate = useNavigate()
  const logout = useLogout()
  const inOrg = area === 'org' && !!activeOrg
  const base = inOrg ? '/org' : '/app'
  const name = me ? `${me.firstName} ${me.lastName}` : ''
  const role = activeOrg ? memberRole(db, activeOrg.id) : null
  return (
    <Dropdown
      label="Account menu"
      panelClassName="w-64"
      trigger={() => (
        <span className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 transition-colors hover:bg-surface">
          {inOrg && activeOrg ? <OrgLogo org={activeOrg} size="sm" /> : me ? <Avatar person={me} size="sm" /> : null}
          <ChevronDown size={14} className="text-muted" />
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-3.5 pb-3 pt-2">
            <p className="truncate text-sm font-bold text-navy">{name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            {inOrg && activeOrg && <p className="mt-1.5 inline-block max-w-full truncate rounded bg-gold-50 px-1.5 text-[11px] font-semibold text-gold-700">{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member'} of {activeOrg.name}</p>}
          </div>
          <div className="py-1">
            <MenuItem icon={<UserCircle size={16} />} onClick={() => { close(); navigate(inOrg ? '/org/profile' : '/app/profile') }}>{inOrg ? 'Organization profile' : 'My profile'}</MenuItem>
            <MenuItem icon={<Settings size={16} />} onClick={() => { close(); navigate(`${base}/settings`) }}>Settings</MenuItem>
          </div>
          <div className="border-t border-line py-1">
            {inOrg
              ? <MenuItem icon={<HeartHandshake size={16} />} onClick={() => { close(); navigate('/app') }}>Back to volunteering</MenuItem>
              : orgs.length > 0
                ? <MenuItem icon={<Building2 size={16} />} onClick={() => { close(); navigate('/org') }}>Manage {activeOrg?.name ?? 'organization'}</MenuItem>
                : <MenuItem icon={<PlusCircle size={16} />} onClick={() => { close(); navigate('/create-organization') }}>Create an organization</MenuItem>}
          </div>
          <div className="border-t border-line pt-1">
            <MenuItem icon={<LogOut size={16} />} onClick={() => { close(); void logout() }}>Log out</MenuItem>
          </div>
        </>
      )}
    </Dropdown>
  )
}
