import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, LinkButton } from '../components/ui/Button'
import { TextInput, TextArea } from '../components/ui/Field'
import { useAccount } from './context'
import { useOrganization } from './organization-context'
import { Page, Panel, Stat, Empty, Pill, QueryState } from './ui'
import { imageUrl } from './format'
import { useResource, useAction } from './hooks'
import { getVolunteerDashboard, getUserProfileForOrganization } from '../lib/api/users'
import { listMyRegistrations } from '../lib/api/registrations'
import * as hours from '../lib/api/hours'
import * as posts from '../lib/api/posts'
import { getFeed } from '../lib/api/feed'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../lib/api/notifications'
import { listOrganizations, setOrganizationVerified } from '../lib/api/organizations'
import { uploadOrganizationPostImage, discardUploadedImage } from '../lib/api/storage'

export function DashboardPage() {
  const account = useAccount()
  const query = useResource(
    useCallback(async () => {
      const [stats, registrations] = await Promise.all([
        getVolunteerDashboard(),
        listMyRegistrations(),
      ])
      return { stats, registrations }
    }, []),
  )
  if (query.loading || !query.data) return <QueryState {...query} />
  const upcoming = query.data.registrations
    .filter(
      (r) =>
        ['pending', 'approved'].includes(r.status) &&
        r.opportunity &&
        String(r.opportunity.starts_at) > new Date().toISOString(),
    )
    .slice(0, 5)
  return (
    <Page
      title={'Welcome, ' + (account.data!.profile.first_name || account.data!.profile.full_name)}
      subtitle="A little time can make a lasting difference."
      actions={
        <LinkButton to="/app/explore" variant="accent">
          Find an opportunity
        </LinkButton>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['upcoming_count', 'Upcoming approved events'],
          ['pending_registrations', 'Pending registrations'],
          ['verified_hours', 'Verified hours'],
          ['completed_count', 'Events attended'],
        ].map(([key, label]) => (
          <Stat key={key} label={label} value={Number(query.data!.stats[key] || 0)} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Your next commitments">
          {upcoming.length ? (
            <div className="divide-y divide-line">
              {upcoming.map((r) => (
                <Link
                  key={r.id}
                  to={'/app/opportunities/' + r.opportunity_id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <h3>{String(r.opportunity?.title)}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {String(r.opportunity?.event_date)} · {String(r.opportunity?.city)}
                    </p>
                  </div>
                  <Pill>{r.status}</Pill>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>No upcoming commitments. Explore an opportunity that fits your interests.</Empty>
          )}
        </Panel>
        <Panel title="Keep building your impact">
          <p className="leading-relaxed text-muted">
            Join a local organization or bring your own team together. Your personal volunteer
            account works alongside every organization you join.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton to="/app/organizations" variant="secondary">
              Meet organizations
            </LinkButton>
            <LinkButton to="/app/hours" variant="secondary">
              Track your hours
            </LinkButton>
          </div>
        </Panel>
      </div>
    </Page>
  )
}

export function HoursPage() {
  const action = useAction()
  const query = useResource(useCallback(() => hours.listHours(), []))
  const [form, setForm] = useState({
    org_name: '',
    title: '',
    entry_date: new Date().toISOString().slice(0, 10),
    hours: '1',
    notes: '',
  })
  const set = (k: keyof typeof form, value: string) => setForm((f) => ({ ...f, [k]: value }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = await action.run(
      () => hours.addManualHours({ ...form, hours: Number(form.hours) }),
      'Manual hours added. These hours are unverified.',
    )
    if (result.ok) {
      setForm({ ...form, title: '', notes: '' })
      query.refresh()
    }
  }
  const verified = (query.data || [])
    .filter((h) => h.verified)
    .reduce((sum, h) => sum + Number(h.hours || 0), 0)
  const pending = (query.data || [])
    .filter((h) => !h.verified)
    .reduce((sum, h) => sum + Number(h.hours || 0), 0)
  return (
    <Page
      title="My volunteer hours"
      subtitle="Organization-verified attendance and your own activity log."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Verified hours" value={verified} />
        <Stat label="Unverified hours" value={pending} />
        <Stat label="Total hours" value={verified + pending} />
      </div>
      <Panel title="Log another activity">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Organization"
            required
            value={form.org_name}
            onChange={(e) => set('org_name', e.target.value)}
          />
          <TextInput
            label="Activity title"
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
          <TextInput
            label="Activity date"
            type="date"
            required
            value={form.entry_date}
            onChange={(e) => set('entry_date', e.target.value)}
          />
          <TextInput
            label="Hours"
            required
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            value={form.hours}
            onChange={(e) => set('hours', e.target.value)}
          />
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            wrapperClassName="md:col-span-2"
          />
          <div>
            <Button type="submit" disabled={action.busy}>
              Add unverified hours
            </Button>
          </div>
        </form>
      </Panel>
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="space-y-3">
          {query.data.map((h) => (
            <Panel key={String(h.id)}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2>{h.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {h.organization_name} · {h.entry_date}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Pill>{h.hours || 0} hours</Pill>
                    <Pill>{h.verified ? 'Verified' : 'Unverified'}</Pill>
                  </div>
                </div>
                {h.source === 'manual' && (
                  <Button
                    variant="dangerOutline"
                    size="sm"
                    disabled={action.busy}
                    onClick={async () => {
                      if (window.confirm('Delete this manual hour entry?')) {
                        await action.run(
                          () => hours.deleteManualHours(String(h.id)),
                          'Entry deleted.',
                        )
                        query.refresh()
                      }
                    }}
                  >
                    Delete entry
                  </Button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty>No hours recorded yet.</Empty>
      )}
    </Page>
  )
}
export function FeedPage() {
  const [search, setSearch] = useState('')
  const query = useResource(useCallback(() => getFeed({ search }, 60), [search]))
  return (
    <Page
      title="Community"
      subtitle="The latest opportunities and updates from Indiana organizations."
    >
      <TextInput
        label="Search community"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="mx-auto max-w-3xl space-y-5">
          {query.data.map((item) => (
            <Panel key={item.feed_type + item.id}>
              <div className="flex items-center justify-between">
                <Pill>{item.feed_type === 'opportunity' ? 'Opportunity' : 'Community update'}</Pill>
                <span className="text-xs text-muted">{item.created_at.slice(0, 10)}</span>
              </div>
              <h2 className="mt-4 text-xl">{item.title}</h2>
              <p className="mt-2 text-sm text-navy-700">{item.organization?.name}</p>
              {(item.image_url || item.image_path) && (
                <img
                  alt=""
                  className="mt-4 max-h-80 w-full rounded-lg object-cover"
                  loading="lazy"
                  src={
                    item.image_url ||
                    imageUrl(
                      item.feed_type === 'post' ? 'post-images' : 'opportunity-images',
                      item.image_path,
                    )
                  }
                />
              )}
              <p className="mt-4 whitespace-pre-wrap leading-relaxed text-muted">
                {'body' in item ? item.body : item.description}
              </p>
              {item.feed_type === 'opportunity' && (
                <Link
                  className="mt-5 block font-semibold text-navy-700 underline"
                  to={'/app/opportunities/' + item.id}
                >
                  See opportunity
                </Link>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Empty>No community updates yet.</Empty>
      )}
    </Page>
  )
}
export function OrganizationPostsPage() {
  const { organization, canManage } = useOrganization()
  const action = useAction()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | undefined>()
  const query = useResource(
    useCallback(() => posts.listPostsByOrganization(organization.id), [organization.id]),
  )
  const account = useAccount()
  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = await action.run(async () => {
      const picture = image ? await uploadOrganizationPostImage(organization.id, image) : undefined
      try {
        return await posts.createOrganizationPost(
          organization.id,
          title,
          body,
          picture?.url,
          'update',
          picture?.path,
        )
      } catch (error) {
        if (picture) await discardUploadedImage('post-images', picture.path)
        throw error
      }
    }, 'Update published.')
    if (result.ok) {
      setTitle('')
      setBody('')
      setImage(undefined)
      query.refresh()
    }
  }
  return (
    <Page title="Organization updates" subtitle="Share what your team is working on.">
      <Panel title="Write an update">
        <form onSubmit={submit} className="space-y-4">
          <TextInput
            label="Title"
            minLength={3}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="Update"
            minLength={10}
            maxLength={2000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <label className="block text-sm font-semibold">
            Image (optional)
            <input
              className="mt-2 block"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImage(e.target.files?.[0])}
            />
          </label>
          <Button type="submit" disabled={action.busy}>
            Publish update
          </Button>
        </form>
      </Panel>
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="space-y-4">
          {query.data.map((p) => (
            <Panel key={p.id}>
              <h2 className="text-lg">{p.title}</h2>
              <p className="mt-1 text-xs text-muted">{p.created_at.slice(0, 10)}</p>
              {p.image_path && (
                <img
                  className="mt-4 max-h-70 rounded-lg object-cover"
                  alt=""
                  src={imageUrl('post-images', p.image_path)}
                />
              )}
              <p className="mt-4 whitespace-pre-wrap text-muted">{p.body}</p>
              {(canManage || p.author_user_id === account.data!.profile.id) && (
                <Button
                  variant="dangerOutline"
                  size="sm"
                  className="mt-4"
                  disabled={action.busy}
                  onClick={async () => {
                    if (window.confirm('Delete this update?')) {
                      await action.run(() => posts.deletePost(p.id), 'Update deleted.')
                      query.refresh()
                    }
                  }}
                >
                  Delete update
                </Button>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Empty>No updates published yet.</Empty>
      )}
    </Page>
  )
}
export function NotificationsPage() {
  const action = useAction()
  const query = useResource(useCallback(() => listNotifications(100), []))
  useEffect(() => {
    const interval = setInterval(query.refresh, 30000)
    return () => clearInterval(interval)
  }, [query.refresh])
  return (
    <Page
      title="Notifications"
      subtitle="Updates about your events, memberships, and community."
      actions={
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={async () => {
            await action.run(markAllNotificationsRead, 'All notifications marked as read.')
            query.refresh()
          }}
        >
          Mark all read
        </Button>
      }
    >
      {query.loading || !query.data ? (
        <QueryState {...query} />
      ) : query.data.length ? (
        <div className="space-y-3">
          {query.data.map((n) => {
            const data = n.data as Record<string, unknown>
            const link =
              typeof data.opportunity_id === 'string'
                ? '/app/opportunities/' + data.opportunity_id
                : typeof data.organization_id === 'string'
                  ? '/app/organizations/' + data.organization_id
                  : '/app/events'
            return (
              <Panel key={n.id} className={n.read_at ? '' : 'border-l-4 border-l-gold'}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className={n.read_at ? 'text-muted' : 'font-semibold'}>{n.message}</p>
                    <p className="mt-2 text-xs text-muted">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                    <Link
                      className="mt-3 inline-block text-sm font-semibold text-navy-700 underline"
                      to={link}
                    >
                      View details
                    </Link>
                  </div>
                  {!n.read_at && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={action.busy}
                      onClick={async () => {
                        await action.run(() => markNotificationRead(n.id))
                        query.refresh()
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </Panel>
            )
          })}
        </div>
      ) : (
        <Empty>You’re all caught up.</Empty>
      )}
    </Page>
  )
}
export function PersonPage() {
  const { userId = '' } = useParams()
  const query = useResource(useCallback(() => getUserProfileForOrganization(userId), [userId]))
  if (query.loading || !query.data) return <QueryState {...query} />
  const p = query.data
  const history = Array.isArray(p.history)
    ? (p.history as {
        opportunity_id: string
        title?: string
        event_date?: string
        status: string
        hours: number | null
      }[])
    : []
  return (
    <Page title={String(p.full_name || 'Volunteer profile')} subtitle={String(p.headline || '')}>
      <Panel>
        {(typeof p.avatar_url === 'string' || typeof p.avatar_path === 'string') && (
          <img
            alt=""
            src={
              typeof p.avatar_url === 'string'
                ? p.avatar_url
                : imageUrl('avatars', String(p.avatar_path))
            }
            className="mb-5 size-24 rounded-full object-cover"
          />
        )}
        <p className="text-sm text-muted">
          {String(p.city || '')} {String(p.state || '')}
        </p>
        <p className="mt-5 whitespace-pre-wrap leading-relaxed">{String(p.bio || '')}</p>
        {Boolean(p.phone) && <p className="mt-4 text-sm">Phone: {String(p.phone)}</p>}
        {Boolean(p.availability) && (
          <p className="mt-3 text-sm text-muted">
            Availability:{' '}
            {typeof p.availability === 'object'
              ? JSON.stringify(p.availability)
              : String(p.availability)}
          </p>
        )}
      </Panel>
      {p.show_hours === true && (
        <Stat label="Verified hours" value={Number(p.verified_hours || 0)} />
      )}
      {p.show_history === true && (
        <Panel title="Shared event history">
          {history.length ? (
            history.map((h, i) => (
              <div key={i} className="flex justify-between border-b border-line py-3 text-sm">
                <Link to={'/app/opportunities/' + h.opportunity_id} className="underline">
                  {h.title || h.opportunity_id.slice(0, 8)}
                  {h.event_date && ' · ' + h.event_date}
                </Link>
                <span>
                  {h.status} · {h.hours ?? 0} hours
                </span>
              </div>
            ))
          ) : (
            <Empty>No shared history.</Empty>
          )}
        </Panel>
      )}
    </Page>
  )
}
export function AdminPage() {
  const account = useAccount()
  const action = useAction()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const query = useResource(useCallback(() => listOrganizations(), []))
  if (!account.data!.profile.is_platform_admin)
    return <Empty>Platform administrator access is required.</Empty>
  return (
    <Page title="Platform administration" subtitle="Verification and community announcements.">
      <Panel title="Publish an announcement">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const result = await action.run(
              () => posts.createAnnouncement(title, body),
              'Announcement published.',
            )
            if (result.ok) {
              setTitle('')
              setBody('')
            }
          }}
        >
          <TextInput
            label="Announcement title"
            minLength={3}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            label="Message"
            minLength={10}
            maxLength={2000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" disabled={action.busy}>
            Publish announcement
          </Button>
        </form>
      </Panel>
      <Panel title="Organization verification">
        {query.loading || !query.data ? (
          <QueryState {...query} />
        ) : (
          query.data.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4"
            >
              <div>
                <h3>{o.name}</h3>
                <p className="text-sm text-muted">
                  {o.city} · {o.verified ? 'Verified' : 'Not verified'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={action.busy}
                onClick={async () => {
                  await action.run(
                    () => setOrganizationVerified(o.id, !o.verified),
                    'Verification updated.',
                  )
                  query.refresh()
                }}
              >
                {o.verified ? 'Revoke verification' : 'Verify organization'}
              </Button>
            </div>
          ))
        )}
      </Panel>
    </Page>
  )
}
