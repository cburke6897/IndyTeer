import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, CalendarDays, CalendarX, Clock, MapPin } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Card } from '../../components/ui/Card'
import { SafeImage } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/Button'
import { RegistrationControl, RegStatusBadge, SaveButton } from '../../components/domain/OpportunityParts'
import { oppImage } from '../../components/domain/oppImage'
import { formatDate, formatHours, timeRange } from '../../lib/utils'
import { useSession } from '../../store/session'
import { getOpp, getOrg, isPast, volunteerRegistrations } from '../../store/selectors'
import type { Opportunity, Registration } from '../../types'

type Tab = 'upcoming' | 'past' | 'canceled' | 'saved'

export default function MyEventsPage() {
  const { db, volunteer } = useSession()
  const [tab, setTab] = useState<Tab>('upcoming')
  const rows = volunteerRegistrations(db, volunteer!.id)
    .map((reg) => ({ reg, opp: getOpp(db, reg.oppId) }))
    .filter((x): x is { reg: Registration; opp: Opportunity } => !!x.opp)

  const live = rows.filter((r) => r.reg.status === 'pending' || r.reg.status === 'approved')
  const upcoming = live.filter((r) => !isPast(r.opp)).sort((a, b) => a.opp.date.localeCompare(b.opp.date))
  const past = live.filter((r) => isPast(r.opp)).sort((a, b) => b.opp.date.localeCompare(a.opp.date))
  const canceled = rows.filter((r) => ['cancelled', 'declined', 'removed'].includes(r.reg.status))
  const saved = db.saved.filter((s) => s.volunteerId === volunteer!.id).map((s) => getOpp(db, s.oppId)).filter((o): o is Opportunity => !!o)

  const data = { upcoming, past, canceled }
  const list = tab === 'saved' ? [] : data[tab]

  return (
    <div>
      <PageHeader title="My events" description="Everything you’ve registered for, in one place." actions={<LinkButton to="/app/explore" variant="accent">Find more events</LinkButton>} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { id: 'past', label: 'Past', count: past.length },
          { id: 'canceled', label: 'Canceled', count: canceled.length },
          { id: 'saved', label: 'Saved', count: saved.length },
        ]}
      />

      {tab === 'saved' ? (
        saved.length === 0 ? (
          <EmptyState icon={<Bookmark size={20} />} title="No saved opportunities" message="Tap the bookmark on any opportunity to save it for later." action={<LinkButton to="/app/explore" variant="primary">Explore opportunities</LinkButton>} />
        ) : (
          <div className="space-y-3">
            {saved.map((o) => <EventRow key={o.id} opp={o} saved />)}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'canceled' ? <CalendarX size={20} /> : <CalendarDays size={20} />}
          title={tab === 'upcoming' ? 'No upcoming events' : tab === 'past' ? 'No past events yet' : 'No canceled registrations'}
          message={tab === 'upcoming' ? 'Register for an opportunity and it will show up here.' : undefined}
          action={tab === 'upcoming' ? <LinkButton to="/app/explore" variant="primary">Explore opportunities</LinkButton> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {list.map(({ reg, opp }) => <EventRow key={reg.id} opp={opp} reg={reg} mode={tab} />)}
        </div>
      )}
    </div>
  )
}

function EventRow({ opp, reg, mode, saved }: { opp: Opportunity; reg?: Registration; mode?: Tab; saved?: boolean }) {
  const { db } = useSession()
  const org = getOrg(db, opp.orgId)
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Link to={`/app/opportunities/${opp.id}`} className="shrink-0"><SafeImage src={oppImage(opp)} alt="" className="aspect-[16/10] w-full rounded-md sm:w-44" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="navy">{opp.category}</Badge>
          {reg && <RegStatusBadge status={reg.status} />}
          {mode === 'past' && reg && (reg.attended ? <Badge tone="success">Attended</Badge> : <Badge>Attendance not recorded</Badge>)}
        </div>
        <Link to={`/app/opportunities/${opp.id}`}><h3 className="mt-1.5 text-base leading-snug hover:underline">{opp.title}</h3></Link>
        <p className="text-[13px] text-muted">{org?.name}</p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {formatDate(opp.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · {timeRange(opp.startTime, opp.endTime)}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {opp.virtual ? 'Virtual' : `${opp.location}, ${opp.city}`}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {formatHours(opp.hours)} hrs</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        {(mode === 'upcoming' || saved || mode === 'canceled') && <RegistrationControl opp={opp} />}
        {saved && <SaveButton oppId={opp.id} />}
        <LinkButton to={`/app/opportunities/${opp.id}`} size="sm" variant="secondary">View details</LinkButton>
      </div>
    </Card>
  )
}
