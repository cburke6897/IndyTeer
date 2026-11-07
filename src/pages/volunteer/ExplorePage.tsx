import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { FilterSelect } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { OpportunityCard } from '../../components/domain/OpportunityCards'
import { CATEGORIES, OPP_TYPES } from '../../lib/constants'
import { addDays, plural, todayISO } from '../../lib/utils'
import { useSession } from '../../store/session'
import { getOrg, oppTypes, openOpps, spotsLeft } from '../../store/selectors'

const SORTS = [
  ['soonest', 'Soonest date'], ['newest', 'Recently posted'], ['spots', 'Most spots available'], ['hours', 'Most volunteer hours'],
] as const

export default function ExplorePage() {
  const { db } = useSession()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [city, setCity] = useState('All')
  const [category, setCategory] = useState('All')
  const [date, setDate] = useState('any')
  const [type, setType] = useState('All')
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>('soonest')

  const all = openOpps(db)
  const cities = useMemo(() => [...new Set(all.map((o) => o.city))].sort(), [all])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const today = todayISO()
    const limit = date === 'today' ? today : date === 'week' ? addDays(today, 7) : date === 'month' ? addDays(today, 30) : null
    return all
      .filter((o) => {
        if (city !== 'All' && o.city !== city) return false
        if (category !== 'All' && o.category !== category) return false
        if (type !== 'All' && !oppTypes(o).includes(type)) return false
        if (limit && (o.date > limit || (o.recurrence === 'none' && o.date < today))) return false
        if (term) {
          const org = getOrg(db, o.orgId)
          if (!`${o.title} ${o.description} ${o.category} ${o.city} ${o.location} ${org?.name ?? ''} ${o.skills.join(' ')}`.toLowerCase().includes(term)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
        if (sort === 'spots') return spotsLeft(db, b) - spotsLeft(db, a)
        if (sort === 'hours') return b.hours - a.hours
        return a.date.localeCompare(b.date)
      })
  }, [all, db, q, city, category, date, type, sort])

  const filtered = q || city !== 'All' || category !== 'All' || date !== 'any' || type !== 'All'
  const clear = () => { setQ(''); setCity('All'); setCategory('All'); setDate('any'); setType('All') }

  return (
    <div>
      <PageHeader title="Explore opportunities" description="Browse volunteer opportunities from organizations across Indiana." />
      <div className="sticky top-16 z-10 -mx-4 mb-6 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchInput value={q} onChange={setQ} placeholder="Search by title, cause, or organization" className="w-full sm:w-80" />
          <FilterSelect label="Location" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="All">All locations</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </FilterSelect>
          <FilterSelect label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </FilterSelect>
          <FilterSelect label="Date" value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="any">Any date</option>
            <option value="today">Today</option>
            <option value="week">Next 7 days</option>
            <option value="month">Next 30 days</option>
          </FilterSelect>
          <FilterSelect label="Opportunity type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All types</option>
            {OPP_TYPES.map((t) => <option key={t}>{t}</option>)}
          </FilterSelect>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[13px] text-muted sm:inline">Sort by</span>
            <FilterSelect label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </FilterSelect>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{plural(results.length, 'opportunity', 'opportunities')}</p>
        {filtered && <Button size="sm" variant="ghost" onClick={clear}>Clear filters</Button>}
      </div>

      {results.length === 0 ? (
        <EmptyState icon={<SearchX size={20} />} title="No opportunities found" message="Try widening your filters or searching for a different cause." action={<Button onClick={clear}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((o) => <OpportunityCard key={o.id} opp={o} />)}
        </div>
      )}
    </div>
  )
}
