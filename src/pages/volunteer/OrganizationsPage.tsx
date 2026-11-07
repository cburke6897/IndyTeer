import { useMemo, useState } from 'react'
import { SearchX } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { FilterSelect } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { OrgCard } from '../../components/domain/PeopleAndOrgs'
import { CATEGORIES } from '../../lib/constants'
import { plural } from '../../lib/utils'
import { useSession } from '../../store/session'
import { activeOppCount, isFollowing } from '../../store/selectors'

export default function OrganizationsPage() {
  const { db, volunteer } = useSession()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState('All')
  const [scope, setScope] = useState<'all' | 'following'>('all')

  const orgs = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.organizations
      .filter((o) => (focus === 'All' || o.focus.includes(focus)) && (scope === 'all' || isFollowing(db, volunteer!.id, o.id)))
      .filter((o) => !term || `${o.name} ${o.description} ${o.city} ${o.type}`.toLowerCase().includes(term))
      .sort((a, b) => activeOppCount(db, b.id) - activeOppCount(db, a.id))
  }, [db, q, focus, scope, volunteer])

  return (
    <div>
      <PageHeader title="Organizations" description="Follow the groups you care about to see their opportunities and updates in your feed." />
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <SearchInput value={q} onChange={setQ} placeholder="Search organizations" className="w-full sm:w-72" />
        <FilterSelect label="Area of focus" value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="All">All areas of focus</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </FilterSelect>
        <div className="flex rounded-md border border-line-strong bg-white p-0.5" role="group" aria-label="Show">
          {(['all', 'following'] as const).map((s) => (
            <button key={s} aria-pressed={scope === s} onClick={() => setScope(s)} className={`h-8 rounded px-3 text-[13px] font-semibold transition-colors ${scope === s ? 'bg-navy text-white' : 'text-muted hover:text-navy'}`}>{s === 'all' ? 'All' : 'Following'}</button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted">{plural(orgs.length, 'organization')}</span>
      </div>
      {orgs.length === 0 ? (
        <EmptyState icon={<SearchX size={20} />} title="No organizations found" message={scope === 'following' ? 'You aren’t following any organizations that match.' : 'Try a different search or area of focus.'} action={<Button onClick={() => { setQ(''); setFocus('All'); setScope('all') }}>Reset filters</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{orgs.map((o) => <OrgCard key={o.id} org={o} />)}</div>
      )}
    </div>
  )
}
