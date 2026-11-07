import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { FilterSelect } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/Button'
import { VolunteerCard } from '../../components/domain/PeopleAndOrgs'
import { formatDate, plural } from '../../lib/utils'
import { useSession } from '../../store/session'
import { orgVolunteers } from '../../store/selectors'

export default function VolunteersPage() {
  const { db, org } = useSession()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'hours' | 'events' | 'recent'>('hours')
  const all = orgVolunteers(db, org!.id)
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return all
      .filter((v) => !term || `${v.volunteer.firstName} ${v.volunteer.lastName} ${v.volunteer.city} ${v.volunteer.skills.join(' ')}`.toLowerCase().includes(term))
      .sort((a, b) => sort === 'events' ? b.events - a.events : sort === 'recent' ? b.lastDate.localeCompare(a.lastDate) : b.hours - a.hours)
  }, [all, q, sort])

  return (
    <div>
      <PageHeader title="Volunteers" description={`${plural(all.length, 'volunteer')} have attended your events.`} />
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, city, or skill" className="w-full sm:w-72" />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[13px] text-muted sm:inline">Sort by</span>
          <FilterSelect label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="hours">Most hours</option><option value="events">Most events</option><option value="recent">Most recent</option>
          </FilterSelect>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title="No volunteers yet" message="Volunteers appear here after you mark them as attended." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v) => (
            <VolunteerCard
              key={v.volunteer.id}
              volunteer={v.volunteer}
              hours={v.hours}
              events={v.events}
              extra={<p className="mt-2 text-xs text-muted">Last volunteered {formatDate(v.lastDate)}</p>}
              actions={<LinkButton to={`/org/volunteers/${v.volunteer.id}`} size="sm" variant="secondary" className="flex-1">View profile</LinkButton>}
            />
          ))}
        </div>
      )}
    </div>
  )
}
