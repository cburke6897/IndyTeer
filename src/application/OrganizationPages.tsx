import { useCallback, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { Button, LinkButton } from '../components/ui/Button'
import { TextInput, TextArea, SelectInput } from '../components/ui/Field'
import { ORG_TYPES } from '../lib/constants'
import { db } from '../lib/api/client'
import * as organizations from '../lib/api/organizations'
import { followOrganization, unfollowOrganization } from '../lib/api/follows'
import * as registrationAPI from '../lib/api/registrations'
import {
  listOpportunitiesByOrganization,
  deleteOpportunity,
  publishOpportunity,
} from '../lib/api/opportunities'
import { getOrgAnalytics, listOrgVolunteers } from '../lib/api/analytics'
import { uploadOrganizationImage } from '../lib/api/storage'
import { useAccount } from './context'
import { OrganizationContext, useOrganization } from './organization-context'
import { useAction, useResource } from './hooks'
import { Empty, Page, Panel, PersonLink, Pill, QueryState, Stat } from './ui'
import { imageUrl, splitList } from './format'
import type { Organization, Registration } from '../types/models'

export function OrganizationsPage() {
  const account = useAccount()
  const action = useAction()
  const [search, setSearch] = useState('')
  const query = useResource(
    useCallback(async () => {
      const [items, follows] = await Promise.all([
        organizations.listOrganizations({ q: search }),
        db
          .from('organization_follows')
          .select('organization_id')
          .eq('user_id', account.data!.profile.id),
      ])
      if (follows.error) throw follows.error
      return { items, followed: new Set(follows.data.map((f) => f.organization_id)) }
    }, [search, account.data]),
  )
  async function mutate(task: () => Promise<unknown>, text: string) {
    await action.run(task, text)
    query.refresh()
    account.refresh()
  }
  return (
    <Page
      title="Organizations"
      subtitle="Meet the teams making a difference across Indiana."
      actions={
        <LinkButton to="/app/organizations/new" variant="accent">
          Create organization
        </LinkButton>
      }
    >
      <Panel>
        <TextInput
          label="Find an organization"
          placeholder="Search by organization name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Panel>
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.items.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {query.data.items.map((o) => {
            const membership = account.data!.memberships.find((m) => m.organization_id === o.id)
            const followed = query.data!.followed.has(o.id)
            return (
              <Panel key={o.id}>
                <div className="flex items-center gap-4">
                  {o.logo_path ? (
                    <img
                      src={imageUrl('org-logos', o.logo_path)}
                      alt=""
                      className="size-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="rounded-lg bg-gold-50 p-3">
                      <Building2 className="text-navy" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg">
                      <Link to={'/app/organizations/' + o.id}>{o.name}</Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {o.city} {o.verified && '· Verified'}
                    </p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted">
                  {o.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={action.busy}
                    onClick={() =>
                      void mutate(
                        () => (followed ? unfollowOrganization(o.id) : followOrganization(o.id)),
                        followed ? 'Unfollowed organization.' : 'Following organization.',
                      )
                    }
                  >
                    {followed ? 'Unfollow' : 'Follow'}
                  </Button>
                  {membership?.status === 'active' ? (
                    <LinkButton size="sm" to={'/manage/' + o.id}>
                      Workspace
                    </LinkButton>
                  ) : membership?.status === 'invited' ? (
                    <Button
                      size="sm"
                      disabled={action.busy}
                      onClick={() =>
                        void mutate(
                          () => organizations.acceptOrganizationInvite(o.id),
                          'Invitation accepted.',
                        )
                      }
                    >
                      Accept invitation
                    </Button>
                  ) : membership?.status === 'pending' ? (
                    <Pill>Request pending</Pill>
                  ) : (
                    <Button
                      size="sm"
                      disabled={action.busy}
                      onClick={() =>
                        void mutate(
                          () => organizations.requestToJoinOrganization(o.id),
                          'Join request sent.',
                        )
                      }
                    >
                      Request to join
                    </Button>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      ) : (
        <Empty>No organizations found.</Empty>
      )}
    </Page>
  )
}
export function OrganizationDetailPage() {
  const { organizationId = '' } = useParams()
  const query = useResource(
    useCallback(async () => {
      const [organization, opportunities] = await Promise.all([
        organizations.getOrganization(organizationId),
        db
          .from('opportunities')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'published')
          .order('event_date'),
      ])
      if (opportunities.error) throw opportunities.error
      return { organization, opportunities: opportunities.data }
    }, [organizationId]),
  )
  const action = useAction()
  const account = useAccount()
  if (query.loading || !query.data) return <QueryState {...query} />
  const { organization: o, opportunities: events } = query.data
  const membership = account.data!.memberships.find((m) => m.organization_id === organizationId)
  return (
    <Page
      title={o.name}
      subtitle={[o.type, o.city, o.state].filter(Boolean).join(' · ')}
      actions={
        membership?.status === 'active' ? (
          <LinkButton to={'/manage/' + o.id}>Open workspace</LinkButton>
        ) : (
          <Button
            disabled={action.busy || membership?.status === 'pending'}
            onClick={async () => {
              await action.run(
                () =>
                  membership?.status === 'invited'
                    ? organizations.acceptOrganizationInvite(o.id)
                    : organizations.requestToJoinOrganization(o.id),
                membership?.status === 'invited' ? 'Invitation accepted.' : 'Join request sent.',
              )
              account.refresh()
            }}
          >
            {membership?.status === 'invited'
              ? 'Accept invitation'
              : membership?.status === 'pending'
                ? 'Request pending'
                : 'Request to join'}
          </Button>
        )
      }
    >
      {o.cover_path && (
        <img
          src={imageUrl('org-covers', o.cover_path)}
          alt=""
          className="max-h-70 w-full rounded-xl object-cover"
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_1fr]">
        <Panel title="Our work">
          <p className="whitespace-pre-wrap leading-relaxed text-muted">{o.description}</p>
          {o.mission && (
            <>
              <h3 className="mt-6 mb-2">Our mission</h3>
              <p className="text-muted">{o.mission}</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {o.focus.map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
          {o.website && /^https?:\/\//.test(o.website) && (
            <a
              className="mt-6 block font-semibold text-navy-700 underline"
              href={o.website}
              target="_blank"
              rel="noreferrer"
            >
              Visit website
            </a>
          )}
        </Panel>
        <Panel title="Organization details">
          <p>{o.verified ? 'Verified organization' : 'Not yet verified'}</p>
          {o.founded_year && <p className="mt-3 text-sm text-muted">Founded {o.founded_year}</p>}
          <p className="mt-3 text-sm text-muted">{events.length} published opportunities</p>
        </Panel>
      </div>
      <Panel title="Opportunities">
        {events.length ? (
          <div className="divide-y divide-line">
            {events.map((e) => (
              <Link
                className="flex items-center justify-between gap-3 py-4"
                key={e.id}
                to={'/app/opportunities/' + e.id}
              >
                <span className="font-semibold">{e.title}</span>
                <span className="text-sm text-muted">{e.event_date}</span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No published opportunities yet.</Empty>
        )}
      </Panel>
    </Page>
  )
}
export function CreateOrganizationPage() {
  return <OrganizationForm />
}
export function OrganizationSettingsPage() {
  const context = useOrganization()
  return context.canManage ? (
    <div className="space-y-6">
      <OrganizationForm existing={context.organization} />
      {context.isOwner && <DeleteOrganizationPanel />}
    </div>
  ) : (
    <Empty>Only owners and admins can edit organization settings.</Empty>
  )
}
function DeleteOrganizationPanel() {
  const { organization } = useOrganization()
  const account = useAccount()
  const navigate = useNavigate()
  const action = useAction()
  const query = useResource(
    useCallback(
      () => organizations.listOrganizationMemberships(organization.id),
      [organization.id],
    ),
  )
  const [typed, setTyped] = useState('')
  const [accepted, setAccepted] = useState(false)
  const others =
    query.data?.filter((m) => m.status === 'active' && m.user_id !== account.data!.profile.id)
      .length || 0
  return (
    <Panel title="Delete organization">
      <p className="text-sm leading-relaxed text-muted">
        Permanently remove {organization.name}, its opportunities, registrations, posts,
        memberships, and images. Volunteer accounts remain. This cannot be undone.
      </p>
      {query.loading || query.error ? (
        <QueryState {...query} />
      ) : (
        <p className="mt-4 text-sm font-semibold">
          {others} other active members will lose this organization and its shared records.
        </p>
      )}
      <label className="my-4 flex gap-2 text-sm">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        I understand this permanently deletes the organization and its data.
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <TextInput
          label="Type the organization name to confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <Button
          variant="danger"
          disabled={
            action.busy ||
            query.loading ||
            !!query.error ||
            !accepted ||
            typed !== organization.name
          }
          onClick={async () => {
            const result = await action.run(
              () => organizations.deleteOrganization(organization.id),
              'Organization deleted.',
            )
            if (result.ok) {
              account.refresh()
              navigate('/app/organizations')
            }
          }}
        >
          Delete organization permanently
        </Button>
      </div>
    </Panel>
  )
}
function OrganizationForm({ existing }: { existing?: Organization }) {
  const account = useAccount()
  const action = useAction()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    mission: existing?.mission || '',
    type: existing?.type || 'Nonprofit',
    website: existing?.website || '',
    city: existing?.city || '',
    contact_email: existing?.contact_email || '',
    phone: existing?.phone || '',
    focus: existing?.focus.join(', ') || '',
    founded_year: existing?.founded_year ? String(existing.founded_year) : '',
    join_policy: existing?.join_policy || 'approval',
  })
  const set = (k: keyof typeof form, value: string) => setForm((f) => ({ ...f, [k]: value }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = await action.run(
      async () => {
        const input = {
          ...form,
          focus: splitList(form.focus),
          founded_year: form.founded_year ? Number(form.founded_year) : undefined,
        }
        return existing
          ? organizations.updateOrganization(existing.id, input)
          : organizations.createOrganization(input)
      },
      existing ? 'Organization saved.' : 'Organization created.',
    )
    if (result.ok) {
      account.refresh()
      navigate('/manage/' + result.value.id)
    }
  }
  async function upload(file: File | undefined, kind: 'logo' | 'cover') {
    if (!file || !existing) return
    await action.run(() => uploadOrganizationImage(existing.id, file, kind), 'Image saved.')
    account.refresh()
  }
  return (
    <Page
      title={existing ? 'Organization settings' : 'Create an organization'}
      subtitle="Build a team around a shared purpose."
    >
      <Panel>
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <TextInput
            label="Organization name"
            minLength={3}
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <SelectInput
            label="Organization type"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
          >
            {[...new Set([...ORG_TYPES, form.type])].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectInput>
          <TextArea
            label="Description"
            minLength={30}
            required
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            wrapperClassName="md:col-span-2"
          />
          <TextArea
            label="Mission"
            minLength={10}
            required
            value={form.mission}
            onChange={(e) => set('mission', e.target.value)}
            wrapperClassName="md:col-span-2"
          />
          <TextInput
            label="City"
            required
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
          />
          <TextInput
            label="Contact email"
            required
            type="email"
            value={form.contact_email}
            onChange={(e) => set('contact_email', e.target.value)}
          />
          <TextInput
            label="Website"
            type="url"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
          <TextInput
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <TextInput
            label="Focus areas"
            hint="Separate causes with commas."
            required
            value={form.focus}
            onChange={(e) => set('focus', e.target.value)}
          />
          <TextInput
            label="Founded year"
            type="number"
            min={1800}
            max={2200}
            value={form.founded_year}
            onChange={(e) => set('founded_year', e.target.value)}
          />
          <SelectInput
            label="Membership policy"
            value={form.join_policy}
            onChange={(e) => set('join_policy', e.target.value)}
          >
            <option value="approval">Anyone may request approval</option>
            <option value="invite_only">Invitation only</option>
          </SelectInput>
          <div className="md:col-span-2">
            <Button disabled={action.busy} type="submit">
              {action.busy ? 'Saving…' : existing ? 'Save changes' : 'Create organization'}
            </Button>
          </div>
        </form>
      </Panel>
      {existing && (
        <Panel title="Brand images">
          <div className="grid gap-6 sm:grid-cols-2">
            {(['logo', 'cover'] as const).map((kind) => (
              <div key={kind}>
                {existing[kind === 'logo' ? 'logo_path' : 'cover_path'] && (
                  <img
                    alt={kind}
                    src={imageUrl(
                      kind === 'logo' ? 'org-logos' : 'org-covers',
                      existing[kind === 'logo' ? 'logo_path' : 'cover_path'],
                    )}
                    className="mb-4 h-32 rounded-lg object-cover"
                  />
                )}
                <label className="text-sm font-semibold">
                  Upload {kind}
                  <input
                    type="file"
                    className="mt-2 block text-sm"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={action.busy}
                    onChange={(e) => {
                      void upload(e.target.files?.[0], kind)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Page>
  )
}
export function OrganizationWorkspace() {
  const { organizationId = '' } = useParams()
  const account = useAccount()
  const membership = account.data!.memberships.find(
    (m) => m.organization_id === organizationId && m.status === 'active',
  )
  const query = useResource(
    useCallback(async () => {
      if (!membership) return null
      const { data, error } = await db
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()
      if (error) throw error
      return data as Organization
    }, [organizationId, membership]),
  )
  if (!membership)
    return (
      <Empty>
        You need an active membership to access this organization.{' '}
        <Link className="underline" to={'/app/organizations/' + organizationId}>
          View organization
        </Link>
      </Empty>
    )
  if (query.loading || !query.data) return <QueryState {...query} />
  const canManage = ['owner', 'admin'].includes(membership.role)
  const base = '/manage/' + organizationId
  const tabs = [
    ['', 'Overview'],
    ['/opportunities', 'Opportunities'],
    ['/registrations', 'Registrations'],
    ['/volunteers', 'Volunteers'],
    ['/analytics', 'Analytics'],
    ['/members', 'Members'],
    ['/posts', 'Updates'],
    ...(canManage ? [['/settings', 'Settings']] : []),
  ]
  return (
    <OrganizationContext.Provider
      value={{
        organization: query.data,
        canManage,
        isOwner: membership.role === 'owner',
        refresh: query.refresh,
      }}
    >
      <div className="mb-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl">{query.data.name}</h1>
          <Pill>{membership.role}</Pill>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line pb-3">
          {tabs.map(([path, label]) => (
            <NavLink
              className={({ isActive }) =>
                'shrink-0 rounded-md px-3 py-2 text-sm font-semibold ' +
                (isActive ? 'bg-navy text-white' : 'text-muted hover:bg-white')
              }
              key={path}
              end={!path}
              to={base + path}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </OrganizationContext.Provider>
  )
}
export function OrganizationOverviewPage() {
  const { organization, canManage } = useOrganization()
  const query = useResource(
    useCallback(() => organizations.getOrganizationOverview(organization.id), [organization.id]),
  )
  if (query.loading || !query.data) return <QueryState {...query} />
  return (
    <Page title="Organization overview" subtitle="A live snapshot of your team’s activity.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['active_opportunities', 'Active opportunities'],
          ['registrations', 'All registrations'],
          ['verified_hours', 'Verified volunteer hours'],
          ['hours_to_verify', 'Attendance records awaiting verification'],
        ].map(([key, label]) => (
          <Stat key={key} label={label} value={Number(query.data![key] || 0)} />
        ))}
      </div>
      <Panel title="Keep your community moving">
        <div className="flex flex-wrap gap-3">
          {canManage && (
            <LinkButton to={'/manage/' + organization.id + '/opportunities/new'} variant="accent">
              Create opportunity
            </LinkButton>
          )}
          {canManage && (
            <LinkButton to={'/manage/' + organization.id + '/registrations'} variant="secondary">
              Review registrations
            </LinkButton>
          )}
          <LinkButton to={'/manage/' + organization.id + '/members'} variant="secondary">
            Manage members
          </LinkButton>
        </div>
      </Panel>
    </Page>
  )
}
export function OrganizationOpportunitiesPage() {
  const { organization, canManage } = useOrganization()
  const action = useAction()
  const query = useResource(
    useCallback(() => listOpportunitiesByOrganization(organization.id), [organization.id]),
  )
  return (
    <Page
      title="Opportunities"
      subtitle="Plan, publish, and manage your events."
      actions={
        canManage && (
          <LinkButton to={'/manage/' + organization.id + '/opportunities/new'} variant="accent">
            Create opportunity
          </LinkButton>
        )
      }
    >
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="space-y-4">
          {query.data.map((o) => (
            <Panel key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Pill>{o.status}</Pill>
                  <h2 className="mt-3 text-lg">{o.title}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {o.event_date} · {o.city} · {o.spots} places
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <LinkButton
                      variant="secondary"
                      size="sm"
                      to={'/manage/' + organization.id + '/opportunities/' + o.id + '/edit'}
                    >
                      Edit
                    </LinkButton>
                    {o.status === 'draft' && (
                      <Button
                        size="sm"
                        disabled={action.busy}
                        onClick={async () => {
                          await action.run(() => publishOpportunity(o.id), 'Published.')
                          query.refresh()
                        }}
                      >
                        Publish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="dangerOutline"
                      disabled={action.busy}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            'Delete this opportunity and its registrations? This cannot be undone.',
                          )
                        )
                          return
                        await action.run(() => deleteOpportunity(o.id), 'Opportunity deleted.')
                        query.refresh()
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty>Your organization hasn’t created an opportunity yet.</Empty>
      )}
    </Page>
  )
}
export function OrganizationRegistrationsPage() {
  const { organization, canManage } = useOrganization()
  const [status, setStatus] = useState('')
  const query = useResource(
    useCallback(
      () =>
        registrationAPI.listOrganizationRegistrations(
          organization.id,
          status ? (status as Registration['status']) : undefined,
        ),
      [organization.id, status],
    ),
  )
  return (
    <Page
      title="Registrations"
      subtitle="Review participation, mark attendance, and verify volunteer hours."
    >
      <SelectInput
        label="Filter by status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">All registrations</option>
        {['pending', 'approved', 'declined', 'cancelled', 'removed'].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </SelectInput>
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="space-y-4">
          {query.data.map((r) => (
            <RegistrationRow key={r.id} row={r} canManage={canManage} refresh={query.refresh} />
          ))}
        </div>
      ) : (
        <Empty>No registrations match this filter.</Empty>
      )}
    </Page>
  )
}
function RegistrationRow({
  row: r,
  canManage,
  refresh,
}: {
  row: Registration & { opportunity: Record<string, unknown> }
  canManage: boolean
  refresh: () => void
}) {
  const action = useAction()
  const [hours, setHours] = useState(String(r.hours ?? 1))
  async function mutate(task: () => Promise<unknown>, message: string) {
    await action.run(task, message)
    refresh()
  }
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Pill>{r.status}</Pill>
          <h2 className="mt-3 font-semibold">{String(r.opportunity.title || 'Opportunity')}</h2>
          <p className="mt-1 text-sm text-muted">{String(r.opportunity.event_date || '')}</p>
          <p className="mt-3 text-sm">
            Volunteer: <PersonLink id={r.user_id} />
          </p>
          {r.message && <p className="mt-2 text-sm text-muted">{r.message}</p>}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {['pending', 'declined'].includes(r.status) && (
              <Button
                size="sm"
                disabled={action.busy}
                onClick={() =>
                  void mutate(
                    () => registrationAPI.setRegistrationStatus(r.id, 'approved'),
                    'Registration approved.',
                  )
                }
              >
                Approve
              </Button>
            )}
            {r.status === 'pending' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={action.busy}
                onClick={() =>
                  void mutate(
                    () => registrationAPI.setRegistrationStatus(r.id, 'declined'),
                    'Registration declined.',
                  )
                }
              >
                Decline
              </Button>
            )}
            {['pending', 'approved'].includes(r.status) && (
              <Button
                variant="dangerOutline"
                size="sm"
                disabled={action.busy}
                onClick={() =>
                  void mutate(
                    () => registrationAPI.setRegistrationStatus(r.id, 'removed'),
                    'Registration removed.',
                  )
                }
              >
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      {r.status === 'approved' && (
        <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-line pt-4">
          <label className="flex gap-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={r.attended}
              disabled={!canManage || action.busy}
              onChange={(e) =>
                void mutate(
                  () => registrationAPI.setRegistrationAttended(r.id, e.target.checked),
                  'Attendance saved.',
                )
              }
            />
            Attended
          </label>
          {r.attended && (
            <>
              <TextInput
                label="Hours"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={hours}
                disabled={!canManage || r.hours_verified}
                onChange={(e) => setHours(e.target.value)}
              />
              {r.hours_verified ? (
                <>
                  <Pill>{r.hours} hours verified</Pill>
                  {canManage && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={action.busy}
                      onClick={() =>
                        void mutate(
                          () => registrationAPI.unverifyRegistrationHours(r.id),
                          'Verification removed.',
                        )
                      }
                    >
                      Undo verification
                    </Button>
                  )}
                </>
              ) : (
                canManage && (
                  <Button
                    disabled={action.busy}
                    onClick={() =>
                      void mutate(
                        () => registrationAPI.verifyRegistrationHours(r.id, Number(hours)),
                        'Hours verified.',
                      )
                    }
                  >
                    Verify hours
                  </Button>
                )
              )}
            </>
          )}
        </div>
      )}
    </Panel>
  )
}
export function OrganizationMembersPage() {
  const { organization, isOwner, canManage } = useOrganization()
  const account = useAccount()
  const action = useAction()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const query = useResource(
    useCallback(
      () => organizations.listOrganizationMemberships(organization.id),
      [organization.id],
    ),
  )
  async function mutate(task: () => Promise<unknown>, text: string) {
    const result = await action.run(task, text)
    if (result.ok) {
      query.refresh()
      account.refresh()
    }
    return result.ok
  }
  return (
    <Page title="Members" subtitle="Membership and permissions are specific to this organization.">
      {canManage && (
        <Panel title="Invite a person">
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const sent = await mutate(
                () => organizations.inviteUserToOrganization(organization.id, userId.trim(), role),
                'Invitation sent.',
              )
              if (sent) setUserId('')
            }}
          >
            <TextInput
              label="User ID"
              required
              placeholder="Auth user UUID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <SelectInput
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </SelectInput>
            <Button type="submit" disabled={action.busy}>
              Invite
            </Button>
          </form>
        </Panel>
      )}
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : (
        <div className="space-y-3">
          {query.data.map((m) => (
            <Panel key={m.user_id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="break-all font-mono text-xs">{m.user_id}</p>
                  <div className="mt-2 flex gap-2">
                    <Pill>{m.role}</Pill>
                    <Pill>{m.status}</Pill>
                    {m.user_id === account.data!.profile.id && <Pill>You</Pill>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && m.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        disabled={action.busy}
                        onClick={() =>
                          void mutate(
                            () =>
                              organizations.reviewMembershipRequest(
                                organization.id,
                                m.user_id,
                                true,
                              ),
                            'Member approved.',
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={action.busy}
                        onClick={() =>
                          void mutate(
                            () =>
                              organizations.reviewMembershipRequest(
                                organization.id,
                                m.user_id,
                                false,
                              ),
                            'Request declined.',
                          )
                        }
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {isOwner && m.status === 'active' && m.role !== 'owner' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={action.busy}
                        onClick={() =>
                          void mutate(
                            () =>
                              organizations.setOrganizationMemberRole(
                                organization.id,
                                m.user_id,
                                m.role === 'admin' ? 'member' : 'admin',
                              ),
                            'Role updated.',
                          )
                        }
                      >
                        {m.role === 'admin' ? 'Make member' : 'Make admin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={action.busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Transfer ownership to this member? You will become an admin.',
                            )
                          )
                            void mutate(
                              () =>
                                organizations.transferOrganizationOwnership(
                                  organization.id,
                                  m.user_id,
                                ),
                              'Ownership transferred.',
                            )
                        }}
                      >
                        Transfer ownership
                      </Button>
                    </>
                  )}
                  {(canManage || m.user_id === account.data!.profile.id) &&
                    ['active', 'invited', 'pending'].includes(m.status) && (
                      <Button
                        size="sm"
                        variant="dangerOutline"
                        disabled={action.busy}
                        onClick={() => {
                          if (window.confirm('Remove this membership?'))
                            void mutate(
                              () =>
                                organizations.removeOrganizationMember(organization.id, m.user_id),
                              'Membership removed.',
                            )
                        }}
                      >
                        {m.user_id === account.data!.profile.id ? 'Leave organization' : 'Remove'}
                      </Button>
                    )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </Page>
  )
}
export function OrganizationAnalyticsPage() {
  const { organization } = useOrganization()
  const query = useResource(useCallback(() => getOrgAnalytics(organization.id), [organization.id]))
  if (query.loading || !query.data) return <QueryState {...query} />
  const monthly = (query.data.monthly_verified_hours || []) as {
    month: string
    verified_hours: number
  }[]
  const causes = (query.data.registrations_by_category || []) as {
    category: string
    registrations: number
  }[]
  const max = Math.max(1, ...monthly.map((m) => Number(m.verified_hours)))
  return (
    <Page
      title="Analytics"
      subtitle="Measured from your organization’s real registrations and verified hours."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Verified hours by month">
          {monthly.map((m) => (
            <div key={m.month} className="mb-4">
              <div className="mb-2 flex justify-between text-sm">
                <span>{m.month.slice(0, 7)}</span>
                <strong>{m.verified_hours} hours</strong>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-navy-50">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: (Number(m.verified_hours) / max) * 100 + '%' }}
                />
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="Registrations by cause">
          {causes.length ? (
            causes.map((c) => (
              <div
                key={c.category}
                className="flex justify-between border-b border-line py-4 text-sm"
              >
                <span>{c.category}</span>
                <strong>{c.registrations}</strong>
              </div>
            ))
          ) : (
            <Empty>No registration data yet.</Empty>
          )}
        </Panel>
      </div>
    </Page>
  )
}
export function OrganizationVolunteersPage() {
  const { organization } = useOrganization()
  const [search, setSearch] = useState('')
  const query = useResource(
    useCallback(() => listOrgVolunteers(organization.id, search), [organization.id, search]),
  )
  return (
    <Page title="Volunteers" subtitle="People with approved attendance at your events.">
      <TextInput
        label="Search volunteers"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.map((v) => (
            <Panel key={String(v.user_id)}>
              <h2 className="text-lg">
                <PersonLink id={String(v.user_id)} name={String(v.full_name)} />
              </h2>
              <p className="mt-3 text-sm text-muted">
                {Number(v.verified_hours || 0)} verified hours · {Number(v.registration_count || 0)}{' '}
                events
              </p>
              <p className="mt-1 text-xs text-muted">
                Last event: {String(v.last_event_date || '—')}
              </p>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty>No attended volunteer records yet.</Empty>
      )}
    </Page>
  )
}
