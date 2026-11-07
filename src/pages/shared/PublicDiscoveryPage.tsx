import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Compass,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Logo } from '../../components/ui/Logo'
import { Button, LinkButton } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/button-styles'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchInput } from '../../components/ui/SearchInput'
import { FilterSelect } from '../../components/ui/Field'
import { formatDate, formatTime } from '../../lib/utils'
import {
  getPublicOpportunities,
  publicSourceLink,
  type PublicOpportunity,
} from '../../lib/discovery'

export default function PublicDiscoveryPage() {
  const [items, setItems] = useState<PublicOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All causes')
  const [state, setState] = useState('All locations')
  const [visible, setVisible] = useState(20)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void getPublicOpportunities(controller.signal)
      .then((rows) => {
        if (active) {
          setItems(rows)
          setLoading(false)
          setError('')
        }
      })
      .catch(() => {
        if (active) {
          setError(
            'Public discovery is temporarily unavailable. You can still use the rest of IndyTeer.',
          )
          setLoading(false)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [attempt])

  const rows = items.filter(
    (item) =>
      (category === 'All causes' || item.category === category) &&
      (state === 'All locations' || item.state === state) &&
      `${item.title} ${item.organizer} ${item.city} ${item.location}`
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
  )
  const refresh = () => {
    setLoading(true)
    setError('')
    setAttempt((value) => value + 1)
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="IndyTeer home">
            <Logo />
          </Link>
          <LinkButton to="/" variant="ghost" size="sm" icon={<ArrowLeft size={16} />}>
            Back to home
          </LinkButton>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-xl bg-navy px-6 py-9 sm:px-10 sm:py-12">
          <Compass
            className="pointer-events-none absolute -right-10 -top-12 size-72 rotate-12 text-white/5"
            strokeWidth={1}
            aria-hidden="true"
          />
          <p className="relative flex items-center gap-2 text-sm font-bold tracking-wide text-gold">
            <Sparkles size={16} /> INDYTEER DISCOVER
          </p>
          <h1 className="relative mt-4 max-w-2xl text-3xl leading-tight !text-white sm:text-[42px]">
            Real opportunities.
            <br />
            <span className="text-gold">No account needed.</span>
          </h1>
          <p className="relative mt-4 max-w-2xl text-base leading-relaxed text-white/75">
            Find genuine volunteer opportunities from approved public sources. Browse freely and
            sign up directly with the original organizer.
          </p>
          <div className="relative mt-6 flex flex-wrap gap-3 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-gold" /> Original sources retained
            </span>
            <span>•</span>
            <span>Automatically collected, never automatically booked</span>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">Find your next good cause</h2>
            <p className="mt-1 text-sm text-muted">
              External listings are separate from registrations managed inside IndyTeer.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={refresh}
          >
            Refresh listings
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 rounded-lg border border-line bg-white p-3">
          <div className="min-w-0 flex-1 basis-64">
            <SearchInput
              value={q}
              onChange={(value) => {
                setQ(value)
                setVisible(20)
              }}
              placeholder="Search public opportunities, places, causes…"
            />
          </div>
          <FilterSelect
            label="Cause"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setVisible(20)
            }}
          >
            <option>All causes</option>
            {[...new Set(items.map((item) => item.category))].sort().map((value) => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Location"
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              setVisible(20)
            }}
          >
            <option>All locations</option>
            {[...new Set(items.map((item) => item.state).filter(Boolean))].sort().map((value) => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
        </div>

        {loading && (
          <p role="status" className="py-12 text-center text-muted">
            Loading public opportunities…
          </p>
        )}
        {!loading && error && (
          <div className="mt-6">
            <EmptyState
              icon={<Compass size={22} />}
              title="Discovery is taking a break"
              message={error}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={refresh}>Try again</Button>
                  <LinkButton to="/" variant="secondary">
                    Back to home
                  </LinkButton>
                </div>
              }
            />
          </div>
        )}
        {!loading && !error && (
          <>
            <p className="my-4 text-sm text-muted" aria-live="polite">
              {rows.length} public {rows.length === 1 ? 'opportunity' : 'opportunities'}
            </p>
            {!rows.length && (
              <EmptyState
                icon={<Compass size={22} />}
                title="No matching opportunities"
                message="Try another search or check back when new source listings arrive."
              />
            )}
            <div className="grid gap-5 md:grid-cols-2">
              {rows.slice(0, visible).map((item) => (
                <PublicListing key={item.id} item={item} />
              ))}
            </div>
            {rows.length > visible && (
              <div className="mt-6 text-center">
                <Button variant="secondary" onClick={() => setVisible((value) => value + 20)}>
                  Show more opportunities
                </Button>
              </div>
            )}
          </>
        )}
        <p className="mt-8 rounded-lg border border-gold-100 bg-gold-50 p-4 text-sm leading-relaxed text-ink">
          Availability, capacity and requirements belong to the original organizer. Check their
          listing before travelling or signing up. Browsing here does not register you or create a
          commitment.
        </p>
      </main>
      <footer className="border-t border-line bg-white px-5 py-6 text-center text-sm text-muted">
        IndyTeer · Public discovery · No login required
      </footer>
    </div>
  )
}

function PublicListing({ item }: { item: PublicOpportunity }) {
  const source = publicSourceLink(item.sourceUrl)
  const signup = publicSourceLink(item.applicationUrl) || source
  const checked = new Date(item.observedAt)
  return (
    <Card className="flex min-w-0 flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="gold">External listing</Badge>
        <Badge tone="navy">{item.category}</Badge>
      </div>
      <p className="mt-4 text-sm text-muted">{item.organizer}</p>
      <h3 className="mt-1 text-xl leading-snug">
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-navy-700 hover:underline"
        >
          {item.title}
        </a>
      </h3>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={15} />
          {item.date ? formatDate(item.date) : 'Date to confirm'}
          {item.startTime ? ` · ${formatTime(item.startTime)}` : ''}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={15} />
          {[item.city, item.state].filter(Boolean).join(', ') || 'Location to confirm'}
        </span>
      </div>
      {item.timezone && (
        <p className="mt-1 text-xs text-muted">
          Times are local to {item.timezone.replaceAll('_', ' ')}.
        </p>
      )}
      <p className="mt-4 text-[15px] leading-relaxed text-ink/85">{item.summary}</p>
      {item.reasons?.some((reason) => reason.includes('conflict')) && (
        <p className="mt-3 text-sm text-gold-700">
          The source contains conflicting schedule details. Confirm directly with the organizer.
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="mt-4 text-xs text-muted">
          {Number.isNaN(checked.getTime())
            ? 'Check original source'
            : `Source checked ${checked.toLocaleDateString('en-US')}`}
        </p>
        {signup && (
          <a
            href={signup}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('primary', 'sm', 'mt-4')}
          >
            Visit original signup <ArrowUpRight size={15} />
          </a>
        )}
      </div>
    </Card>
  )
}
