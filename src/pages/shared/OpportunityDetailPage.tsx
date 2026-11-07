import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, Laptop, MapPin, Pencil, Repeat, ShieldCheck, Trash2, Users } from 'lucide-react'
import { Badge, VerifiedMark } from '../../components/ui/Badge'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { OrgLogo, SafeImage } from '../../components/ui/Avatar'
import { ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { FollowButton, MetaItem, RegistrationControl, SaveButton, SpotsLabel } from '../../components/domain/OpportunityParts'
import { oppImage } from '../../components/domain/oppImage'
import { formatDate, formatDateLong, formatHours, plural, timeRange } from '../../lib/utils'
import { useSession } from '../../store/session'
import { getOpp, getOrg, oppBucket, oppRegs, recurrenceLabel, registrationClosed, takenSpots } from '../../store/selectors'
import { deleteOpportunity } from '../../store/actions'
import { act } from '../../store/act'

/** Shared detail view: volunteers get registration controls, owning organizations get management actions. */
export default function OpportunityDetailPage() {
  const { id } = useParams()
  const { db, volunteer, org: myOrg } = useSession()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const opp = getOpp(db, id)
  const backTo = volunteer ? '/app/explore' : '/org/opportunities'

  if (!opp || (opp.status === 'draft' && opp.orgId !== myOrg?.id)) {
    return <EmptyState title="Opportunity not found" message="It may have been removed by the organization." action={<LinkButton to={backTo} variant="primary">Go back</LinkButton>} />
  }
  const org = getOrg(db, opp.orgId)
  const owner = !!myOrg && opp.orgId === myOrg.id
  const regs = oppRegs(db, opp.id)
  const closed = registrationClosed(opp)

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:underline"><ArrowLeft size={15} /> Back</button>

      <Card className="overflow-hidden">
        <SafeImage src={oppImage(opp)} alt={opp.title} className="aspect-[21/8] w-full" />
        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">{opp.category}</Badge>
              {opp.status === 'draft' && <Badge tone="gold">Draft</Badge>}
              {opp.virtual && <Badge icon={<Laptop size={12} />}>Virtual</Badge>}
              {opp.recurrence !== 'none' && <Badge icon={<Repeat size={12} />}>{recurrenceLabel(opp.recurrence)}</Badge>}
              {opp.skills.length > 0 && <Badge>Skills-based</Badge>}
            </div>
            <h1 className="mt-3 text-[28px] leading-tight">{opp.title}</h1>

            {org && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface/60 p-3">
                <Link to={volunteer ? `/app/organizations/${org.id}` : '/org/profile'} className="flex min-w-0 items-center gap-3">
                  <OrgLogo org={org} size="md" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-semibold text-navy">{org.name}{org.verified && <VerifiedMark />}</span>
                    <span className="block text-xs text-muted">{org.type} · {org.city}, IN</span>
                  </span>
                </Link>
                {!owner && <FollowButton orgId={org.id} />}
              </div>
            )}

            <h2 className="mt-8 text-base">About this opportunity</h2>
            <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink/90">{opp.description}</p>

            {opp.instructions && (
              <>
                <h2 className="mt-7 text-base">Before you come</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/90">{opp.instructions}</p>
              </>
            )}

            <h2 className="mt-7 text-base">Requirements</h2>
            <ul className="mt-2 space-y-1.5 text-[15px] text-ink/90">
              <li className="flex gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-navy-700" />{opp.minAge ? `Volunteers must be ${opp.minAge} or older.` : 'Open to volunteers of all ages (minors with a guardian).'}</li>
              <li className="flex gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-navy-700" />{opp.skills.length ? `Helpful skills: ${opp.skills.join(', ')}.` : 'No special skills needed. Training provided on site.'}</li>
            </ul>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-line p-4">
              <div className="space-y-3.5">
                <MetaItem icon={<CalendarDays size={16} />} className="items-start text-ink"><span><strong className="block font-semibold">{formatDateLong(opp.date)}</strong><span className="text-muted">{timeRange(opp.startTime, opp.endTime)}</span></span></MetaItem>
                <MetaItem icon={opp.virtual ? <Laptop size={16} /> : <MapPin size={16} />} className="items-start text-ink"><span><strong className="block font-semibold">{opp.location}</strong><span className="text-muted">{opp.address}</span></span></MetaItem>
                <MetaItem icon={<Clock size={16} />} className="text-ink"><span><strong className="font-semibold">{formatHours(opp.hours)}</strong> estimated volunteer {opp.hours === 1 ? 'hour' : 'hours'}</span></MetaItem>
                <MetaItem icon={<Users size={16} />} className="text-ink"><span><strong className="font-semibold">{takenSpots(db, opp.id)}</strong> of {opp.spots} spots filled · <SpotsLabel opp={opp} /></span></MetaItem>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{closed ? 'Registration has closed.' : `Register by ${formatDate(opp.deadline, { month: 'long', day: 'numeric' })}.`}</p>
            </div>

            {volunteer && opp.status === 'published' && (
              <div className="flex items-center gap-2">
                <div className="flex-1"><RegistrationControl opp={opp} block /></div>
                <SaveButton oppId={opp.id} />
              </div>
            )}

            {owner && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">{oppBucket(opp)} · {plural(regs.filter((r) => r.status === 'pending' || r.status === 'approved').length, 'registration')}</p>
                <LinkButton to={`/org/opportunities/${opp.id}/edit`} variant="primary" icon={<Pencil size={15} />} className="w-full">Edit opportunity</LinkButton>
                <LinkButton to={`/org/registrations?opp=${opp.id}`} variant="secondary" icon={<Users size={15} />} className="w-full">Manage registrations</LinkButton>
                <Button variant="dangerOutline" icon={<Trash2 size={15} />} className="w-full" onClick={() => setConfirmDelete(true)}>Delete</Button>
                <ConfirmDialog
                  open={confirmDelete}
                  onClose={() => setConfirmDelete(false)}
                  destructive
                  title="Delete this opportunity?"
                  message={<><strong>{opp.title}</strong> and its {plural(regs.length, 'registration')} will be permanently removed. This can’t be undone.</>}
                  confirmLabel="Delete opportunity"
                  onConfirm={() => { void act(deleteOpportunity(opp.id), 'Opportunity deleted.', 'info').then((ok) => { if (ok) navigate('/org/opportunities') }) }}
                />
              </div>
            )}
          </aside>
        </div>
      </Card>
    </div>
  )
}
