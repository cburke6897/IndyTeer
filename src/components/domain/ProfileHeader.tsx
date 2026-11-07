import type { ReactNode } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { Avatar, OrgLogo, SafeImage } from '../ui/Avatar'
import { VerifiedMark } from '../ui/Badge'
import { Card } from '../ui/Card'
import { formatDate } from '../../lib/utils'
import type { OrgProfile, VolunteerProfile } from '../../types'

export function VolunteerProfileHeader({ volunteer, actions }: { volunteer: VolunteerProfile; actions?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-32 bg-navy sm:h-40" style={{ backgroundImage: 'linear-gradient(135deg, #142C5B 55%, #244B85)' }}>
        <div className="h-full w-full opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle, #F5C542 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
      </div>
      <div className="px-5 pb-5 sm:px-7">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
          <Avatar person={volunteer} size="2xl" className="ring-4 ring-white" />
          {actions && <div className="flex gap-2 pb-1">{actions}</div>}
        </div>
        <h1 className="mt-3 text-2xl leading-tight">{volunteer.firstName} {volunteer.lastName}</h1>
        <p className="mt-0.5 text-[15px] text-ink/80">{volunteer.headline}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {volunteer.city}, {volunteer.state}</span>
          {volunteer.joinedAt && <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> Volunteering since {formatDate(volunteer.joinedAt, { month: 'long', year: 'numeric' })}</span>}
        </p>
      </div>
    </Card>
  )
}

export function OrgProfileHeader({ org, actions, meta }: { org: OrgProfile; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-36 bg-navy-800 sm:h-48">
        <SafeImage src={org.cover} alt="" className="size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/40 to-transparent" />
      </div>
      <div className="px-5 pb-5 sm:px-7">
        <div className="relative z-10 -mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
          <OrgLogo org={org} size="2xl" className="relative z-10 rounded-lg bg-white ring-4 ring-white" />
          {actions && <div className="flex gap-2 pb-1">{actions}</div>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-2xl leading-tight">{org.name}</h1>
          {org.verified && <VerifiedMark size={20} />}
        </div>
        <p className="mt-0.5 text-[15px] text-ink/80">{org.type} · {org.focus.join(', ')}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {org.city}, {org.state}</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> Founded {org.founded}</span>
          {meta}
        </p>
      </div>
    </Card>
  )
}
