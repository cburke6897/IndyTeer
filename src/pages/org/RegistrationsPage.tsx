import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { SearchInput } from '../../components/ui/SearchInput'
import { FilterSelect } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { RegistrationTable, type RegRow } from '../../components/domain/RegistrationTable'
import { useSession } from '../../store/session'
import { getOpp, getVolunteer, orgOpps, orgRegistrations } from '../../store/selectors'

type Tab = 'all' | 'pending' | 'approved' | 'verify' | 'closed'
const PAGE = 25

export default function RegistrationsPage() {
  const { db, org } = useSession()
  const [params, setParams] = useSearchParams()
  const oppFilter = params.get('opp') ?? 'all'
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const opps = orgOpps(db, org!.id).filter((o) => o.status === 'published').sort((a, b) => b.date.localeCompare(a.date))
  const rows: RegRow[] = useMemo(() => orgRegistrations(db, org!.id).flatMap((reg) => {
    const volunteer = getVolunteer(db, reg.volunteerId)
    const opp = getOpp(db, reg.oppId)
    return volunteer && opp ? [{ reg, volunteer, opp }] : []
  }), [db, org])

  const inOpp = rows.filter((r) => oppFilter === 'all' || r.opp.id === oppFilter)
  const counts = {
    all: inOpp.length,
    pending: inOpp.filter((r) => r.reg.status === 'pending').length,
    approved: inOpp.filter((r) => r.reg.status === 'approved').length,
    verify: inOpp.filter((r) => r.reg.status === 'approved' && r.reg.attended && !r.reg.hoursVerified).length,
    closed: inOpp.filter((r) => ['declined', 'removed', 'cancelled'].includes(r.reg.status)).length,
  }
  const term = q.trim().toLowerCase()
  const shown = inOpp
    .filter((r) => {
      const s = r.reg.status
      if (tab === 'pending') return s === 'pending'
      if (tab === 'approved') return s === 'approved'
      if (tab === 'verify') return s === 'approved' && r.reg.attended && !r.reg.hoursVerified
      if (tab === 'closed') return ['declined', 'removed', 'cancelled'].includes(s)
      return true
    })
    .filter((r) => !term || `${r.volunteer.firstName} ${r.volunteer.lastName} ${r.opp.title}`.toLowerCase().includes(term))
    .sort((a, b) => (a.reg.status === 'pending' ? 0 : 1) - (b.reg.status === 'pending' ? 0 : 1) || b.opp.date.localeCompare(a.opp.date) || a.volunteer.lastName.localeCompare(b.volunteer.lastName))

  return (
    <div>
      <PageHeader title="Registrations" description="Approve volunteers, record attendance, and verify hours. Changes apply instantly." />
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchInput value={q} onChange={(v) => { setQ(v); setLimit(PAGE) }} placeholder="Search volunteers or opportunities" className="w-full sm:w-72" />
        <FilterSelect label="Opportunity" value={oppFilter} className="max-w-xs" onChange={(e) => { setParams(e.target.value === 'all' ? {} : { opp: e.target.value }); setLimit(PAGE) }}>
          <option value="all">All opportunities</option>
          {opps.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </FilterSelect>
      </div>
      <Tabs className="mb-5" value={tab} onChange={(t) => { setTab(t); setLimit(PAGE) }} tabs={[
        { id: 'all', label: 'All', count: counts.all },
        { id: 'pending', label: 'Pending approval', count: counts.pending },
        { id: 'approved', label: 'Approved', count: counts.approved },
        { id: 'verify', label: 'Hours to verify', count: counts.verify },
        { id: 'closed', label: 'Declined / canceled', count: counts.closed },
      ]} />

      {shown.length === 0 ? (
        <EmptyState icon={<ClipboardList size={20} />} title="No registrations here" message="Nothing matches the current filters." action={<Button onClick={() => { setTab('all'); setQ(''); setParams({}) }}>Reset filters</Button>} />
      ) : (
        <>
          <RegistrationTable rows={shown.slice(0, limit)} />
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>Showing {Math.min(limit, shown.length)} of {shown.length}</span>
            {shown.length > limit && <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>Show more</Button>}
          </div>
        </>
      )}
    </div>
  )
}
