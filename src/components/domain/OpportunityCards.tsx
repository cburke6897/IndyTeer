import { Link } from 'react-router-dom'
import { CalendarDays, Clock, Laptop, MapPin, Megaphone, Repeat } from 'lucide-react'
import { Badge, VerifiedMark } from '../ui/Badge'
import { OrgLogo, SafeImage } from '../ui/Avatar'
import { Card } from '../ui/Card'
import { FollowButton, MetaItem, OrgNameLink, RegistrationControl, SaveButton, SpotsLabel } from './OpportunityParts'
import { oppImage } from './oppImage'
import { formatDate, formatHours, timeAgo, timeRange } from '../../lib/utils'
import { useSession } from '../../store/session'
import { getOrg } from '../../store/selectors'
import type { Opportunity, Post } from '../../types'

const dateLabel = (o: Opportunity) => formatDate(o.date, { weekday: 'short', month: 'short', day: 'numeric' })

/** LinkedIn-style feed post for an opportunity. */
export function OpportunityPost({ opp }: { opp: Opportunity }) {
  const { db } = useSession()
  const org = getOrg(db, opp.orgId)
  if (!org) return null
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/app/organizations/${org.id}`}><OrgLogo org={org} size="md" /></Link>
          <div className="min-w-0">
            <div className="text-sm"><OrgNameLink org={org} /></div>
            <p className="text-xs text-muted">{org.type} · {org.city}, IN · posted {timeAgo(opp.createdAt)}</p>
          </div>
        </div>
        <FollowButton orgId={org.id} />
      </div>
      <div className="px-5 pt-3 pb-3">
        <Link to={`/app/opportunities/${opp.id}`} className="group">
          <h3 className="text-[17px] leading-snug group-hover:underline">{opp.title}</h3>
        </Link>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink/85">{opp.description}</p>
      </div>
      <Link to={`/app/opportunities/${opp.id}`} aria-label={`View ${opp.title}`} className="relative block">
        <SafeImage src={oppImage(opp)} alt={opp.title} className="aspect-[16/7] w-full" />
        <Badge tone="navy" className="absolute top-3 left-3 border-white/0 bg-white/95 shadow-sm">{opp.category}</Badge>
      </Link>
      <div className="grid gap-x-6 gap-y-2 px-5 py-3.5 sm:grid-cols-2">
        <MetaItem icon={<CalendarDays size={15} />}>{dateLabel(opp)} · {timeRange(opp.startTime, opp.endTime)}</MetaItem>
        <MetaItem icon={opp.virtual ? <Laptop size={15} /> : <MapPin size={15} />}>{opp.virtual ? 'Virtual' : `${opp.location}, ${opp.city}`}</MetaItem>
        <MetaItem icon={<Clock size={15} />}>{formatHours(opp.hours)} volunteer {opp.hours === 1 ? 'hour' : 'hours'}</MetaItem>
        <span className="flex items-center gap-3">
          <SpotsLabel opp={opp} />
          {opp.recurrence !== 'none' && <MetaItem icon={<Repeat size={14} />}>Recurring</MetaItem>}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/50 px-5 py-3">
        <RegistrationControl opp={opp} />
        <div className="flex items-center gap-2">
          <SaveButton oppId={opp.id} />
          <Link to={`/app/opportunities/${opp.id}`} className="inline-flex h-9 items-center rounded-md border border-line-strong bg-white px-3.5 text-[13px] font-semibold text-navy hover:bg-navy-50">View details</Link>
        </div>
      </div>
    </Card>
  )
}

/** Compact grid card used in discovery and organization pages. */
export function OpportunityCard({ opp, base = '/app/opportunities' }: { opp: Opportunity; base?: string }) {
  const { db } = useSession()
  const org = getOrg(db, opp.orgId)
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <Link to={`${base}/${opp.id}`} className="relative block">
        <SafeImage src={oppImage(opp)} alt={opp.title} className="aspect-[16/9] w-full transition-transform duration-300 group-hover:scale-[1.02]" />
        <Badge className="absolute top-3 left-3 border-white/0 bg-white/95 text-navy-700 shadow-sm">{opp.category}</Badge>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {org && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <OrgLogo org={org} size="xs" className="rounded-sm" />
            <span className="truncate font-medium">{org.name}</span>
            {org.verified && <VerifiedMark size={13} />}
          </p>
        )}
        <Link to={`${base}/${opp.id}`}>
          <h3 className="mt-2 line-clamp-2 text-[15px] leading-snug hover:underline">{opp.title}</h3>
        </Link>
        <div className="mt-3 flex flex-col items-start gap-1.5">
          <MetaItem icon={<CalendarDays size={14} />}>{dateLabel(opp)} · {timeRange(opp.startTime, opp.endTime).split(' – ')[0]}</MetaItem>
          <MetaItem icon={opp.virtual ? <Laptop size={14} /> : <MapPin size={14} />}>{opp.virtual ? 'Virtual' : opp.city + ', IN'}</MetaItem>
          <MetaItem icon={<Clock size={14} />}>{formatHours(opp.hours)} hrs{opp.recurrence !== 'none' ? ' · Recurring' : ''}</MetaItem>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <SpotsLabel opp={opp} />
          <RegistrationControl opp={opp} />
        </div>
      </div>
    </Card>
  )
}

/** Organization update or IndyTeer announcement in the feed. */
export function PostCard({ post }: { post: Post }) {
  const { db } = useSession()
  const org = getOrg(db, post.orgId)
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {org ? (
              <Link to={`/app/organizations/${org.id}`}><OrgLogo org={org} size="md" /></Link>
            ) : (
              <span className="flex size-10 items-center justify-center rounded-md bg-gold text-navy-950"><Megaphone size={18} /></span>
            )}
            <div className="min-w-0">
              <div className="text-sm">{org ? <OrgNameLink org={org} /> : <span className="font-semibold text-navy">IndyTeer Team</span>}</div>
              <p className="text-xs text-muted">{org ? 'Organization update' : 'Announcement'} · {timeAgo(post.createdAt)}</p>
            </div>
          </div>
          {org && <FollowButton orgId={org.id} />}
        </div>
        <h3 className="mt-3 text-[16px] leading-snug">{post.title}</h3>
        <p className="mt-1.5 pb-4 text-sm leading-relaxed text-ink/85">{post.body}</p>
      </div>
      {post.image && <SafeImage src={post.image} alt="" className="aspect-[16/6] w-full" />}
    </Card>
  )
}
