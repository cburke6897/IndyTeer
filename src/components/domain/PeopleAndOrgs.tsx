import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Avatar, OrgLogo, SafeImage } from '../ui/Avatar'
import { Badge, VerifiedMark } from '../ui/Badge'
import { Card } from '../ui/Card'
import { FollowButton } from './OpportunityParts'
import { formatHours, plural } from '../../lib/utils'
import { useSession } from '../../store/session'
import { activeOppCount, followerCount } from '../../store/selectors'
import type { OrgProfile, VolunteerProfile } from '../../types'

export function OrgCard({ org }: { org: OrgProfile }) {
  const { db } = useSession()
  const active = activeOppCount(db, org.id)
  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <div className="h-20 bg-navy-800">
        <SafeImage src={org.cover} alt="" className="size-full opacity-70" />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <Link to={`/app/organizations/${org.id}`} className="-mt-8 w-fit"><OrgLogo org={org} size="lg" className="ring-4 ring-white" /></Link>
        <Link to={`/app/organizations/${org.id}`} className="mt-3 inline-flex items-center gap-1.5 hover:underline">
          <h3 className="text-base leading-snug">{org.name}</h3>
          {org.verified && <VerifiedMark size={16} />}
        </Link>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin size={12} /> {org.city}, IN · {org.type}</p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink/85">{org.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {org.focus.map((f) => <Badge key={f} tone="navy">{f}</Badge>)}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          <div className="text-xs text-muted">
            <p className="font-semibold text-navy">{plural(active, 'active opportunity', 'active opportunities')}</p>
            <p>{followerCount(db, org).toLocaleString()} followers</p>
          </div>
          <FollowButton orgId={org.id} size="md" />
        </div>
      </div>
    </Card>
  )
}

export function VolunteerCard({ volunteer, hours, events, extra, actions }: {
  volunteer: VolunteerProfile; hours: number; events: number; extra?: ReactNode; actions?: ReactNode
}) {
  return (
    <Card className="flex flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start gap-3">
        <Avatar person={volunteer} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-navy">{volunteer.firstName} {volunteer.lastName}</p>
          <p className="truncate text-[13px] text-muted">{volunteer.headline}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin size={12} /> {volunteer.city}, {volunteer.state}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 divide-x divide-line rounded-md bg-surface py-2.5 text-center">
        <div><dd className="text-lg font-bold text-navy">{formatHours(hours)}</dd><dt className="text-xs text-muted">Verified hours</dt></div>
        <div><dd className="text-lg font-bold text-navy">{events}</dd><dt className="text-xs text-muted">Events attended</dt></div>
      </dl>
      <div className="mt-3 space-y-1 text-[13px] text-muted">
        <p className="flex items-center gap-2"><Mail size={13} className="shrink-0" /><span className="truncate">{volunteer.firstName.toLowerCase()}.{volunteer.lastName.toLowerCase()}@example.com</span></p>
        {volunteer.phone && <p className="flex items-center gap-2"><Phone size={13} className="shrink-0" />{volunteer.phone}</p>}
      </div>
      {extra}
      <div className="mt-auto flex gap-2 pt-4">{actions}</div>
    </Card>
  )
}
