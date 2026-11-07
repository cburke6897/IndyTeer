import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CalendarCheck, CalendarDays, CheckCircle2, Clock, Newspaper, SearchX, Sparkles } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { StatCard } from '../../components/ui/StatCard'
import { SearchInput } from '../../components/ui/SearchInput'
import { Tabs } from '../../components/ui/Tabs'
import { EmptyState } from '../../components/ui/EmptyState'
import { OrgLogo, SafeImage } from '../../components/ui/Avatar'
import { LinkButton } from '../../components/ui/Button'
import { OpportunityPost, PostCard } from '../../components/domain/OpportunityCards'
import { FollowButton } from '../../components/domain/OpportunityParts'
import { CATEGORIES } from '../../lib/constants'
import { cn, formatDate, formatHours, plural, timeRange, todayISO } from '../../lib/utils'
import { useSession } from '../../store/session'
import {
  followedOrgs, getOpp, getOrg, hourEntries, hourTotals, isFollowing, isPast, myRegistration, openOpps, volunteerRegistrations,
} from '../../store/selectors'
import { oppImage } from '../../components/domain/oppImage'
import type { Opportunity, Post } from '../../types'

type FeedItem = { kind: 'opp'; opp: Opportunity; at: string } | { kind: 'post'; post: Post; at: string }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const { db, volunteer } = useSession()
  const [tab, setTab] = useState<'all' | 'following'>('all')
  const [category, setCategory] = useState('All')
  const [q, setQ] = useState('')

  const vid = volunteer!.id
  const totals = hourTotals(hourEntries(db, vid))
  const regs = volunteerRegistrations(db, vid)
  const today = todayISO()
  const upcoming = regs
    .filter((r) => r.status === 'pending' || r.status === 'approved')
    .map((r) => ({ reg: r, opp: getOpp(db, r.oppId) }))
    .filter((x): x is { reg: typeof x.reg; opp: Opportunity } => !!x.opp && !isPast(x.opp) && x.opp.date >= today)
    .sort((a, b) => a.opp.date.localeCompare(b.opp.date))
  const following = followedOrgs(db, vid)

  const recommended = useMemo(() => openOpps(db)
    .filter((o) => !myRegistration(db, vid, o.id) || myRegistration(db, vid, o.id)?.status === 'cancelled')
    .map((o) => ({ o, score: (volunteer!.interests.includes(o.category) ? 2 : 0) + (isFollowing(db, vid, o.orgId) ? 1 : 0) + (o.skills.some((s) => volunteer!.skills.includes(s)) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.o.date.localeCompare(b.o.date))
    .slice(0, 4).map((x) => x.o), [db, vid, volunteer])

  const feed = useMemo(() => {
    const term = q.trim().toLowerCase()
    const followed = new Set(db.follows.filter((f) => f.volunteerId === vid).map((f) => f.orgId))
    const items: FeedItem[] = [
      ...openOpps(db).map((opp) => ({ kind: 'opp' as const, opp, at: opp.createdAt })),
      ...db.posts.map((post) => ({ kind: 'post' as const, post, at: post.createdAt })),
    ]
    return items
      .filter((it) => {
        const orgId = it.kind === 'opp' ? it.opp.orgId : it.post.orgId
        if (tab === 'following' && !(orgId && followed.has(orgId))) return false
        const org = getOrg(db, orgId)
        if (category !== 'All') {
          if (it.kind === 'opp' ? it.opp.category !== category : !org?.focus.includes(category)) return false
        }
        if (term) {
          const hay = it.kind === 'opp'
            ? `${it.opp.title} ${it.opp.description} ${it.opp.category} ${it.opp.city} ${org?.name ?? ''}`
            : `${it.post.title} ${it.post.body} ${org?.name ?? ''}`
          if (!hay.toLowerCase().includes(term)) return false
        }
        return true
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [db, tab, category, q, vid])

  const next = upcoming[0]

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-lg bg-navy p-6 text-white sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 opacity-[0.07] sm:block" style={{ backgroundImage: 'radial-gradient(circle, #F5C542 2px, transparent 2px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 h-1 w-10 bg-gold" />
            <h1 className="!text-white text-2xl sm:text-[28px]">{greeting()}, {volunteer!.firstName}</h1>
            <p className="mt-1.5 max-w-xl text-[15px] text-white/75">
              {next
                ? <>Your next event is <strong className="text-white">{next.opp.title}</strong> on {formatDate(next.opp.date, { weekday: 'long', month: 'short', day: 'numeric' })}.</>
                : 'You have nothing scheduled yet. Find an opportunity that matches your interests.'}
            </p>
          </div>
          <LinkButton to="/app/explore" variant="accent" size="lg" icon={<ArrowRight size={17} />} className="flex-row-reverse">Find opportunities</LinkButton>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your impact">
        <StatCard label="Total volunteer hours" value={formatHours(totals.total)} icon={<Clock size={16} />} accent hint={`${formatHours(totals.verified)} verified`} />
        <StatCard label="Completed events" value={totals.completed} icon={<CheckCircle2 size={16} />} hint="Attended and logged" />
        <StatCard label="Upcoming events" value={upcoming.length} icon={<CalendarCheck size={16} />} hint={upcoming.length ? 'Registered' : 'Nothing scheduled'} />
        <StatCard label="Organizations followed" value={following.length} icon={<Building2 size={16} />} hint={<Link to="/app/organizations" className="font-semibold text-navy-700 hover:underline">Discover more</Link>} />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Feed */}
        <section aria-label="Feed" className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <Tabs className="border-0" tabs={[{ id: 'all', label: 'For you' }, { id: 'following', label: 'Following', count: following.length }]} value={tab} onChange={setTab} />
              <SearchInput value={q} onChange={setQ} placeholder="Search the feed" className="sm:w-64" />
            </div>
            <div className="scrollbar-thin flex gap-2 overflow-x-auto overflow-y-hidden border-t border-line px-4 py-3">
              {['All', ...CATEGORIES].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={cn('h-8 shrink-0 rounded-md border px-3 text-[13px] font-medium transition-colors', category === c ? 'border-navy bg-navy text-white' : 'border-line-strong bg-white text-ink hover:bg-navy-50')}
                >
                  {c}
                </button>
              ))}
            </div>
          </Card>

          {feed.length === 0 ? (
            <EmptyState
              icon={tab === 'following' ? <Newspaper size={20} /> : <SearchX size={20} />}
              title={tab === 'following' ? 'Nothing from organizations you follow' : 'No posts match your filters'}
              message={tab === 'following' ? 'Follow organizations to see their opportunities and updates here.' : 'Try a different category or clear your search.'}
              action={tab === 'following' ? <LinkButton to="/app/organizations" variant="primary">Find organizations</LinkButton> : undefined}
            />
          ) : (
            feed.map((it) => it.kind === 'opp' ? <OpportunityPost key={`o${it.opp.id}`} opp={it.opp} /> : <PostCard key={`p${it.post.id}`} post={it.post} />)
          )}
        </section>

        {/* Right rail */}
        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card>
            <CardHeader title="Your upcoming events" action={<Link to="/app/events" className="text-xs font-semibold text-navy-700 hover:underline">View all</Link>} />
            {upcoming.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No upcoming events yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.slice(0, 4).map(({ opp, reg }) => (
                  <li key={opp.id}>
                    <Link to={`/app/opportunities/${opp.id}`} className="flex gap-3 px-5 py-3 hover:bg-surface/60">
                      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-navy-50 text-navy">
                        <span className="text-[10px] leading-none font-bold uppercase">{formatDate(opp.date, { month: 'short' })}</span>
                        <span className="text-base leading-tight font-bold">{formatDate(opp.date, { day: 'numeric' })}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-navy">{opp.title}</span>
                        <span className="block text-xs text-muted">{timeRange(opp.startTime, opp.endTime).split(' – ')[0]} · {reg.status === 'pending' ? 'Pending approval' : 'Confirmed'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recommended for you" subtitle="Based on your interests and skills" />
            {recommended.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">You’ve registered for everything we found.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recommended.map((o) => {
                  const org = getOrg(db, o.orgId)
                  return (
                    <li key={o.id}>
                      <Link to={`/app/opportunities/${o.id}`} className="flex gap-3 px-5 py-3 hover:bg-surface/60">
                        <SafeImage src={oppImage(o)} alt="" className="size-12 shrink-0 rounded-md" />
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm leading-snug font-semibold text-navy">{o.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted">{org?.name} · {formatDate(o.date, { month: 'short', day: 'numeric' })}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="border-t border-line px-5 py-3"><Link to="/app/explore" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-700 hover:underline"><Sparkles size={14} /> See all opportunities</Link></div>
          </Card>

          <Card>
            <CardHeader title="Organizations you follow" />
            {following.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">You’re not following anyone yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {following.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <Link to={`/app/organizations/${o.id}`}><OrgLogo org={o} size="sm" /></Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/app/organizations/${o.id}`} className="block truncate text-sm font-semibold text-navy hover:underline">{o.name}</Link>
                      <p className="text-xs text-muted">{plural(openOpps(db).filter((x) => x.orgId === o.id).length, 'open opportunity', 'open opportunities')}</p>
                    </div>
                    <FollowButton orgId={o.id} />
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line px-5 py-3 text-xs text-muted"><CalendarDays size={13} className="mr-1 inline" /> Hours verified by organizations appear on your profile.</div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
