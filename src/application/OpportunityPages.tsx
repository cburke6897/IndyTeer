import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, MapPin, ArrowRight } from 'lucide-react'
import { Button, LinkButton } from '../components/ui/Button'
import { TextInput, TextArea, SelectInput } from '../components/ui/Field'
import { CATEGORY_IMAGE, CATEGORIES, INDIANA_CITIES } from '../lib/constants'
import * as opportunities from '../lib/api/opportunities'
import * as registrations from '../lib/api/registrations'
import { db } from '../lib/api/client'
import { saveOpportunity, unsaveOpportunity } from '../lib/api/saved'
import { uploadOpportunityImage, validateImage } from '../lib/api/storage'
import { useResource, useAction } from './hooks'
import { useAccount } from './context'
import { Empty, Page, Panel, Pill, QueryState } from './ui'
import { shortTime, imageUrl, splitList } from './format'
import type { Opportunity, OpportunityInsert, PublicOrganization } from '../types/models'

export function OpportunityCard({
  opportunity,
  organization,
}: {
  opportunity: Opportunity
  organization?: Record<string, unknown> | null
}) {
  const picture =
    opportunity.image_url ||
    imageUrl('opportunity-images', opportunity.image_path) ||
    CATEGORY_IMAGE[opportunity.category]
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
      {picture && <img src={picture} alt="" className="h-42 w-full object-cover" />}
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap gap-2">
          <Pill>{opportunity.category}</Pill>
          {opportunity.virtual && <Pill>Virtual</Pill>}
        </div>
        <h2 className="text-xl leading-tight">
          <Link to={'/app/opportunities/' + opportunity.id}>{opportunity.title}</Link>
        </h2>
        <p className="text-sm text-muted">
          {String(organization?.name || 'Community organization')}
        </p>
        <p className="flex items-center gap-2 text-sm">
          <CalendarDays size={15} />
          {opportunity.event_date} · {shortTime(opportunity.start_time)}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted">
          <MapPin size={15} />
          {opportunity.city} · {opportunity.timezone === 'America/Chicago' ? 'Central' : 'Eastern'}
        </p>
        <p className="line-clamp-2 text-sm text-muted">{opportunity.description}</p>
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-navy-700"
          to={'/app/opportunities/' + opportunity.id}
        >
          View opportunity <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}
export function ExplorePage() {
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    city: '',
    startDate: '',
    endDate: '',
    virtual: false,
  })
  const [page, setPage] = useState(1)
  const query = useResource(
    useCallback(
      () =>
        opportunities.listOpportunities({
          ...filters,
          virtual: filters.virtual ? true : undefined,
          page,
          pageSize: 12,
        }),
      [filters, page],
    ),
  )
  function set(key: keyof typeof filters, value: string | boolean) {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }
  return (
    <Page
      title="Find your next opportunity"
      subtitle="Give your time to a cause that matters to you."
    >
      <Panel>
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput
            label="Search opportunities"
            placeholder="Try tutoring or cleanup"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
          <SelectInput
            label="Cause"
            value={filters.category}
            onChange={(e) => set('category', e.target.value)}
          >
            <option value="">All causes</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectInput>
          <SelectInput
            label="City"
            value={filters.city}
            onChange={(e) => set('city', e.target.value)}
          >
            <option value="">All cities</option>
            {INDIANA_CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectInput>
          <TextInput
            label="From date"
            type="date"
            value={filters.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
          <TextInput
            label="To date"
            type="date"
            value={filters.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={filters.virtual}
              onChange={(e) => set('virtual', e.target.checked)}
            />
            Virtual opportunities only
          </label>
        </div>
      </Panel>
      {query.loading || query.error ? (
        <QueryState {...query} />
      ) : query.data?.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} organization={o.organization} />
          ))}
        </div>
      ) : (
        <Empty>No opportunities match these filters. Try a different cause or date.</Empty>
      )}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={page === 1 || query.loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted">Page {page}</span>
        <Button
          variant="secondary"
          disabled={query.loading || (query.data?.length ?? 0) < 12}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </Page>
  )
}
export function OpportunityDetailPage() {
  const { opportunityId = '' } = useParams()
  const account = useAccount()
  const action = useAction()
  const [message, setMessage] = useState('')
  const query = useResource(
    useCallback(async () => {
      const [opportunity, availability, myRegistrations, saved] = await Promise.all([
        opportunities.getOpportunity(opportunityId),
        opportunities.getOpportunityAvailability(opportunityId),
        registrations.listMyRegistrations(),
        db
          .from('saved_opportunities')
          .select('opportunity_id')
          .eq('user_id', account.data!.profile.id)
          .eq('opportunity_id', opportunityId),
      ])
      if (saved.error) throw saved.error
      return {
        opportunity,
        availability,
        registration: myRegistrations.find((r) => r.opportunity_id === opportunityId),
        saved: !!saved.data.length,
      }
    }, [opportunityId, account.data]),
  )
  if (query.loading || !query.data) return <QueryState {...query} />
  const { opportunity: o, availability, registration, saved } = query.data
  const organization = o.organization as PublicOrganization | null
  async function mutate(task: () => Promise<unknown>, text: string) {
    await action.run(task, text)
    query.refresh()
  }
  return (
    <Page
      title={o.title}
      subtitle={organization?.name || 'Volunteer opportunity'}
      actions={
        <LinkButton to="/app/explore" variant="secondary">
          Back to explore
        </LinkButton>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Panel>
          {(o.image_url || o.image_path) && (
            <img
              src={o.image_url || imageUrl('opportunity-images', o.image_path)}
              alt=""
              className="mb-6 max-h-90 w-full rounded-lg object-cover"
            />
          )}
          <Pill>{o.category}</Pill>
          <h2 className="mt-6 mb-3 text-lg">About this opportunity</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-muted">{o.description}</p>
          {o.instructions && (
            <>
              <h2 className="mt-6 mb-3 text-lg">Before you arrive</h2>
              <p className="whitespace-pre-wrap text-muted">{o.instructions}</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {o.skills.map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
          </div>
          {organization && (
            <Link
              className="mt-6 block font-semibold text-navy-700 underline"
              to={'/app/organizations/' + o.organization_id}
            >
              About {organization.name}
            </Link>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Event details">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted">Date and time</dt>
                <dd className="mt-1 font-semibold">
                  {o.event_date}
                  <br />
                  {shortTime(o.start_time)}–{shortTime(o.end_time)} ·{' '}
                  {o.timezone === 'America/Chicago' ? 'Central' : 'Eastern'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Location</dt>
                <dd>
                  {o.virtual ? 'Online' : o.location}
                  <br />
                  {o.address} {o.city}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Available places</dt>
                <dd>
                  {availability.spots_left} of {availability.spots}
                </dd>
              </div>
              {o.hours && (
                <div>
                  <dt className="text-muted">Expected hours</dt>
                  <dd>{o.hours}</dd>
                </div>
              )}
              {o.min_age && (
                <div>
                  <dt className="text-muted">Minimum age</dt>
                  <dd>{o.min_age}</dd>
                </div>
              )}
              {o.registration_deadline && (
                <div>
                  <dt className="text-muted">Register by</dt>
                  <dd>{o.registration_deadline}</dd>
                </div>
              )}
            </dl>
          </Panel>
          <Panel title="Your registration">
            {registration && (
              <div className="mb-4">
                <Pill>{registration.status}</Pill>
              </div>
            )}
            {registration && ['pending', 'approved'].includes(registration.status) && !registration.attended && o.starts_at>new Date().toISOString() ? (
              <Button
                variant="secondary"
                disabled={action.busy}
                onClick={() =>
                  void mutate(
                    () => registrations.cancelRegistration(registration.id),
                    'Registration cancelled.',
                  )
                }
              >
                Cancel registration
              </Button>
            ) : !registration || registration.status === 'cancelled' ? (
              <div className="space-y-4">
                <TextArea
                  label="Message to the organization"
                  optional
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button
                  disabled={action.busy || availability.spots_left < 1 || o.starts_at<=new Date().toISOString()}
                  onClick={() =>
                    void mutate(
                      () => registrations.registerForOpportunity(o.id, message),
                      'Registration submitted.',
                    )
                  }
                >
                  {o.starts_at<=new Date().toISOString()?'Registration closed':availability.spots_left < 1 ? 'Event is full' : 'Register for this event'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">
                This registration is closed. Contact the organization if you need help.
              </p>
            )}
            <Button
              variant="ghost"
              className="mt-3"
              disabled={action.busy}
              onClick={() =>
                void mutate(
                  () => (saved ? unsaveOpportunity(o.id) : saveOpportunity(o.id)),
                  saved ? 'Removed from saved.' : 'Opportunity saved.',
                )
              }
            >
              {saved ? 'Unsave opportunity' : 'Save for later'}
            </Button>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
export function MyEventsPage() {
  const action = useAction()
  const [tab, setTab] = useState<'registrations' | 'saved'>('registrations')
  const query = useResource(
    useCallback(async () => {
      const [events, saved] = await Promise.all([
        registrations.listMyRegistrations(),
        db.from('saved_opportunities').select('opportunity:opportunities(*)'),
      ])
      if (saved.error) throw saved.error
      return { events, saved: saved.data }
    }, []),
  )
  return (
    <Page title="My events" subtitle="Your commitments and the opportunities you’re considering.">
      <div className="flex gap-2">
        <Button
          variant={tab === 'registrations' ? 'primary' : 'secondary'}
          onClick={() => setTab('registrations')}
        >
          Registrations
        </Button>
        <Button variant={tab === 'saved' ? 'primary' : 'secondary'} onClick={() => setTab('saved')}>
          Saved opportunities
        </Button>
      </div>
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : tab === 'saved' ? (
        query.data.saved.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {query.data.saved.map((row, index) =>
              row.opportunity ? (
                <OpportunityCard
                  key={index}
                  opportunity={row.opportunity as unknown as Opportunity}
                />
              ) : null,
            )}
          </div>
        ) : (
          <Empty>Save an opportunity from Explore to find it here.</Empty>
        )
      ) : query.data.events.length ? (
        <div className="space-y-4">
          {query.data.events.map((r) => {
            const o = r.opportunity as unknown as Opportunity | null
            return (
              <Panel key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <Pill>{r.status}</Pill>
                    <h2 className="mt-3 text-lg">
                      <Link to={'/app/opportunities/' + r.opportunity_id}>
                        {o?.title || 'Opportunity'}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {o?.event_date} · {o?.city}
                    </p>
                    {r.hours_verified && (
                      <p className="mt-2 text-sm text-success">{r.hours} verified hours</p>
                    )}
                  </div>
                  {['pending', 'approved'].includes(r.status) && !r.attended && o && o.starts_at>new Date().toISOString() && (
                    <Button
                      variant="secondary"
                      disabled={action.busy}
                      onClick={async () => {
                        await action.run(
                          () => registrations.cancelRegistration(r.id),
                          'Registration cancelled.',
                        )
                        query.refresh()
                      }}
                    >
                      Cancel registration
                    </Button>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      ) : (
        <Empty>
          You haven’t registered for an opportunity yet.{' '}
          <Link className="underline" to="/app/explore">
            Explore events
          </Link>
        </Empty>
      )}
    </Page>
  )
}
export function OpportunityEditorPage() {
  const { organizationId = '', opportunityId } = useParams()
  const query = useResource(
    useCallback(
      () => (opportunityId ? opportunities.getOpportunity(opportunityId) : Promise.resolve(null)),
      [opportunityId],
    ),
  )
  if (query.loading) return <QueryState {...query} />
  if (query.error) return <QueryState {...query} />
  if (query.data && query.data.organization_id !== organizationId)
    return <Empty>This opportunity belongs to a different organization.</Empty>
  return (
    <OpportunityForm
      key={opportunityId || 'new'}
      organizationId={organizationId}
      existing={query.data}
    />
  )
}
function OpportunityForm({
  organizationId,
  existing,
}: {
  organizationId: string
  existing: Opportunity | null
}) {
  const account = useAccount()
  const membership = account.data!.memberships.find(
    (m) => m.organization_id === organizationId && m.status === 'active',
  )
  const canEdit = membership && ['owner', 'admin'].includes(membership.role)
  const navigate = useNavigate()
  const action = useAction()
  const [image, setImage] = useState<File | undefined>()
  const [occurrences, setOccurrences] = useState('4')
  const [form, setForm] = useState({
    title: existing?.title || '',
    description: existing?.description || '',
    category: existing?.category || 'Environment',
    city: existing?.city || '',
    location: existing?.location || '',
    address: existing?.address || '',
    event_date: existing?.event_date || new Date().toISOString().slice(0, 10),
    start_time: existing?.start_time?.slice(0, 5) || '09:00',
    end_time: existing?.end_time?.slice(0, 5) || '12:00',
    timezone: existing?.timezone || 'America/Indiana/Indianapolis',
    spots: String(existing?.spots || 10),
    hours: String(existing?.hours || 3),
    registration_deadline: existing?.registration_deadline || '',
    min_age: existing?.min_age ? String(existing.min_age) : '',
    skills: existing?.skills.join(', ') || '',
    recurrence: existing?.recurrence || 'none',
    instructions: existing?.instructions || '',
    virtual: existing?.virtual || false,
  })
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const publish = submitter?.value === 'publish'
    const result = await action.run(
      async () => {
        if (image) validateImage(image)
        const { spots, hours, min_age, skills, registration_deadline, ...rest } = form
        const input = {
          ...rest,
          organization_id: organizationId,
          spots: Number(spots),
          hours: Number(hours),
          min_age: min_age ? Number(min_age) : null,
          skills: splitList(skills),
          registration_deadline: registration_deadline || null,
        } as OpportunityInsert
        const series = !existing && form.recurrence !== 'none'
        const saved = existing
          ? [await opportunities.updateOpportunity(existing.id, input)]
          : series
            ? await opportunities.createOpportunitySeries(
                { ...input, status: publish && !image ? 'published' : 'draft' },
                Number(occurrences),
              )
            : [await opportunities.createOpportunity(input)]
        if (image)
          for (const occurrence of saved) await uploadOpportunityImage(occurrence.id, image)
        if (publish && (!series || image))
          for (const occurrence of saved) await opportunities.publishOpportunity(occurrence.id)
        return saved[0]
      },
      publish ? 'Opportunity published.' : 'Opportunity saved.',
    )
    if (result.ok) navigate('/manage/' + organizationId + '/opportunities')
  }
  if (!canEdit)
    return <Empty>Only active organization owners and admins can edit opportunities.</Empty>
  return (
    <Page
      title={existing ? 'Edit opportunity' : 'Create an opportunity'}
      subtitle="Event dates and times use the selected event time zone."
    >
      <Panel>
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <TextInput
            label="Title"
            minLength={3}
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
          <SelectInput
            label="Cause"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {[...new Set([...CATEGORIES, form.category])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectInput>
          <TextArea
            label="Description"
            minLength={20}
            required
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            wrapperClassName="md:col-span-2"
          />
          <TextInput
            label="City"
            required
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
          />
          <TextInput
            label="Venue or meeting link"
            required
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
          <TextInput
            label="Address"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
          <SelectInput
            label="Time zone"
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          >
            <option value="America/Indiana/Indianapolis">Eastern — Indianapolis</option>
            <option value="America/Chicago">Central — Chicago</option>
          </SelectInput>
          <TextInput
            label="Event date"
            type="date"
            required
            value={form.event_date}
            onChange={(e) => set('event_date', e.target.value)}
          />
          <TextInput
            label="Registration deadline"
            type="date"
            value={form.registration_deadline}
            onChange={(e) => set('registration_deadline', e.target.value)}
          />
          <TextInput
            label="Starts at"
            type="time"
            required
            value={form.start_time}
            onChange={(e) => set('start_time', e.target.value)}
          />
          <TextInput
            label="Ends at"
            type="time"
            required
            value={form.end_time}
            onChange={(e) => set('end_time', e.target.value)}
          />
          <TextInput
            label="Available places"
            type="number"
            min={1}
            required
            value={form.spots}
            onChange={(e) => set('spots', e.target.value)}
          />
          <TextInput
            label="Expected hours"
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            required
            value={form.hours}
            onChange={(e) => set('hours', e.target.value)}
          />
          <TextInput
            label="Minimum age"
            type="number"
            min={1}
            max={99}
            optional
            value={form.min_age}
            onChange={(e) => set('min_age', e.target.value)}
          />
          <SelectInput
            label="Recurrence"
            value={form.recurrence}
            onChange={(e) => set('recurrence', e.target.value)}
          >
            <option value="none">One-time</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="monthly">Monthly</option>
          </SelectInput>
          {!existing && form.recurrence !== 'none' && (
            <TextInput
              label="Number of occurrences"
              type="number"
              min={1}
              max={24}
              required
              value={occurrences}
              onChange={(e) => setOccurrences(e.target.value)}
              hint="Each occurrence is a separate event with its own places and registrations."
            />
          )}
          {existing?.recurrence !== 'none' && existing && (
            <p className="text-sm text-muted md:col-span-2">
              Changes apply to this event only. Other events in the series keep their own dates and
              registrations.
            </p>
          )}
          <TextInput
            label="Useful skills"
            value={form.skills}
            onChange={(e) => set('skills', e.target.value)}
            hint="Separate skills with commas."
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.virtual}
              onChange={(e) => set('virtual', e.target.checked)}
            />
            Virtual event
          </label>
          <TextArea
            label="Instructions for volunteers"
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            wrapperClassName="md:col-span-2"
          />
          <label className="text-sm font-semibold md:col-span-2">
            Event image
            <input
              className="mt-2 block text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImage(e.target.files?.[0])}
            />
          </label>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <Button type="submit" variant="secondary" value="draft" disabled={action.busy}>
              Save {existing?.status === 'published' ? 'changes' : 'draft'}
            </Button>
            <Button type="submit" value="publish" disabled={action.busy}>
              {action.busy ? 'Saving…' : 'Publish opportunity'}
            </Button>
            <LinkButton variant="ghost" to={'/manage/' + organizationId + '/opportunities'}>
              Cancel
            </LinkButton>
          </div>
        </form>
      </Panel>
    </Page>
  )
}
