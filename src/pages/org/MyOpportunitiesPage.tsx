import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, Eye, MapPin, Pencil, PlusCircle, Trash2, Users } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button, LinkButton } from '../../components/ui/Button'
import { SafeImage } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { ConfirmDialog } from '../../components/ui/Modal'
import { oppImage } from '../../components/domain/oppImage'
import { formatDate, plural, timeRange } from '../../lib/utils'
import { useSession } from '../../store/session'
import { oppBucket, oppRegs, orgOpps, recurrenceLabel, takenSpots, type OppBucket } from '../../store/selectors'
import { deleteOpportunity } from '../../store/actions'
import { toast } from '../../store/toast'
import type { Opportunity } from '../../types'

const empty: Record<OppBucket, string> = {
  active: 'Opportunities happening today or repeating on a schedule show up here.',
  upcoming: 'Future one-time events will appear here once published.',
  completed: 'Events that have already taken place will show here.',
  draft: 'Save an opportunity as a draft to finish it later.',
}

export default function MyOpportunitiesPage() {
  const { db, org } = useSession()
  const navigate = useNavigate()
  const [tab, setTab] = useState<OppBucket>('active')
  const [del, setDel] = useState<Opportunity | null>(null)
  const opps = orgOpps(db, org!.id)
  const groups: Record<OppBucket, Opportunity[]> = { active: [], upcoming: [], completed: [], draft: [] }
  opps.forEach((o) => groups[oppBucket(o)].push(o))
  groups.completed.sort((a, b) => b.date.localeCompare(a.date))
  groups.active.sort((a, b) => a.date.localeCompare(b.date))
  groups.upcoming.sort((a, b) => a.date.localeCompare(b.date))
  const list = groups[tab]
  const delCount = del ? oppRegs(db, del.id).length : 0

  return (
    <div>
      <PageHeader title="My opportunities" description="Create, edit, and manage every opportunity your organization offers." actions={<LinkButton to="/org/opportunities/new" variant="accent" icon={<PlusCircle size={16} />}>Create opportunity</LinkButton>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { id: 'active', label: 'Active', count: groups.active.length },
        { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
        { id: 'completed', label: 'Completed', count: groups.completed.length },
        { id: 'draft', label: 'Drafts', count: groups.draft.length },
      ]} />

      {list.length === 0 ? (
        <EmptyState icon={<ClipboardList size={20} />} title={`No ${tab === 'draft' ? 'draft' : tab} opportunities`} message={empty[tab]} action={<LinkButton to="/org/opportunities/new" variant="primary">Create opportunity</LinkButton>} />
      ) : (
        <div className="space-y-3">
          {list.map((o) => {
            const regs = oppRegs(db, o.id)
            const pending = regs.filter((r) => r.status === 'pending').length
            const taken = takenSpots(db, o.id)
            const attended = regs.filter((r) => r.attended).length
            return (
              <Card key={o.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <Link to={`/org/opportunities/${o.id}`} className="shrink-0"><SafeImage src={oppImage(o)} alt="" className="aspect-[16/10] w-full rounded-md lg:w-40" /></Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">{o.category}</Badge>
                    {o.recurrence !== 'none' && <Badge>{recurrenceLabel(o.recurrence)}</Badge>}
                    {pending > 0 && <Badge tone="gold">{pending} pending</Badge>}
                  </div>
                  <Link to={`/org/opportunities/${o.id}`}><h3 className="mt-1.5 text-base leading-snug hover:underline">{o.title}</h3></Link>
                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {formatDate(o.date)} · {timeRange(o.startTime, o.endTime)}</span>
                    <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {o.virtual ? 'Virtual' : o.city}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 lg:px-4">
                  <div className="text-center"><p className="text-xl font-bold text-navy">{taken}<span className="text-sm font-medium text-muted">/{o.spots}</span></p><p className="text-xs text-muted">{tab === 'completed' ? plural(attended, 'attendee') : 'registered'}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.status === 'draft'
                    ? <Button size="sm" variant="accent" icon={<Pencil size={14} />} onClick={() => navigate(`/org/opportunities/${o.id}/edit`)}>Edit & publish</Button>
                    : <>
                      <LinkButton to={`/org/registrations?opp=${o.id}`} size="sm" variant="secondary" icon={<Users size={14} />}>Registrations</LinkButton>
                      <LinkButton to={`/org/opportunities/${o.id}`} size="sm" variant="secondary" icon={<Eye size={14} />}>View</LinkButton>
                      <LinkButton to={`/org/opportunities/${o.id}/edit`} size="sm" variant="secondary" icon={<Pencil size={14} />}>Edit</LinkButton>
                    </>}
                  <Button size="sm" variant="dangerOutline" aria-label={`Delete ${o.title}`} icon={<Trash2 size={14} />} onClick={() => setDel(o)} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        destructive
        title="Delete this opportunity?"
        message={<><strong>{del?.title}</strong> and its {plural(delCount, 'registration')} will be permanently removed. Volunteers will no longer see it.</>}
        confirmLabel="Delete opportunity"
        onConfirm={() => { if (!del) return; deleteOpportunity(del.id); toast('Opportunity deleted.', 'info') }}
      />
    </div>
  )
}
