import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarDays, ClipboardList, Clock, Megaphone, PlusCircle, Users } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { StatCard } from '../../components/ui/StatCard'
import { Avatar } from '../../components/ui/Avatar'
import { Button, LinkButton } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TextArea, TextInput } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { RegStatusBadge } from '../../components/domain/OpportunityParts'
import { formatDate, formatHours, plural, timeAgo } from '../../lib/utils'
import { useSession } from '../../store/session'
import { getOpp, getVolunteer, orgRegistrations, orgStats, spotsLeft, takenSpots } from '../../store/selectors'
import { createPost, setRegistrationStatus } from '../../store/actions'
import { act } from '../../store/act'

export default function OverviewPage() {
  const { db, org } = useSession()
  const [posting, setPosting] = useState(false)
  const stats = orgStats(db, org!.id)
  const regs = orgRegistrations(db, org!.id)
  const pending = regs.filter((r) => r.status === 'pending')
  const recent = [...regs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${org!.name}`}
        description="Here’s what’s happening with your volunteers."
        actions={<>
          <Button variant="secondary" icon={<Megaphone size={16} />} onClick={() => setPosting(true)}>Post an update</Button>
          <LinkButton to="/org/opportunities/new" variant="accent" icon={<PlusCircle size={16} />}>Create opportunity</LinkButton>
        </>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key metrics">
        <StatCard label="Volunteer registrations" value={stats.totalRegistrations} icon={<Users size={16} />} hint={stats.pending ? `${stats.pending} awaiting approval` : 'All caught up'} accent />
        <StatCard label="Volunteer hours contributed" value={formatHours(stats.hours)} icon={<Clock size={16} />} hint={stats.pendingHours ? `${formatHours(stats.pendingHours)} hrs to verify` : 'All verified'} />
        <StatCard label="Active opportunities" value={stats.activeOpps} icon={<ClipboardList size={16} />} hint={<Link to="/org/opportunities" className="font-semibold text-navy-700 hover:underline">Manage</Link>} />
        <StatCard label="Upcoming events" value={stats.upcomingEvents.length} icon={<CalendarDays size={16} />} hint={stats.upcomingEvents[0] ? `Next: ${formatDate(stats.upcomingEvents[0].date, { month: 'short', day: 'numeric' })}` : 'None scheduled'} />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {pending.length > 0 && (
            <Card className="border-gold-100">
              <CardHeader title={`Needs your approval (${pending.length})`} action={<Link to="/org/registrations" className="text-xs font-semibold text-navy-700 hover:underline">Open registrations</Link>} />
              <ul className="divide-y divide-line">
                {pending.slice(0, 5).map((r) => {
                  const v = getVolunteer(db, r.volunteerId)
                  const o = getOpp(db, r.oppId)
                  if (!v || !o) return null
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar person={v} size="md" />
                        <div className="min-w-0">
                          <Link to={`/org/volunteers/${v.id}`} className="block truncate text-sm font-semibold text-navy hover:underline">{v.firstName} {v.lastName}</Link>
                          <p className="truncate text-xs text-muted">{o.title}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void act(setRegistrationStatus(r.id, 'approved'), `Approved ${v.firstName}.`)}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => void act(setRegistrationStatus(r.id, 'declined'), 'Registration declined.', 'info')}>Decline</Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Upcoming events" action={<Link to="/org/opportunities" className="text-xs font-semibold text-navy-700 hover:underline">All opportunities</Link>} />
            {stats.upcomingEvents.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No upcoming events. Create an opportunity to get started.</p>
            ) : (
              <ul className="divide-y divide-line">
                {stats.upcomingEvents.slice(0, 5).map((o) => {
                  const taken = takenSpots(db, o.id)
                  const pct = Math.min(100, Math.round((taken / o.spots) * 100))
                  return (
                    <li key={o.id}>
                      <Link to={`/org/opportunities/${o.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface/60">
                        <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-md bg-navy-50 text-navy">
                          <span className="text-[10px] leading-none font-bold uppercase">{formatDate(o.date, { month: 'short' })}</span>
                          <span className="text-lg leading-tight font-bold">{formatDate(o.date, { day: 'numeric' })}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy">{o.title}</span>
                          <span className="mt-1.5 flex items-center gap-3">
                            <span className="h-1.5 w-28 overflow-hidden rounded-sm bg-line"><span className="block h-full bg-navy" style={{ width: `${pct}%` }} /></span>
                            <span className="text-xs text-muted">{taken}/{o.spots} filled · {spotsLeft(db, o)} left</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Recent activity" />
          {recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No activity yet.</p> : (
            <ul className="divide-y divide-line">
              {recent.map((r) => {
                const v = getVolunteer(db, r.volunteerId)
                const o = getOpp(db, r.oppId)
                if (!v || !o) return null
                return (
                  <li key={r.id} className="flex gap-3 px-5 py-3">
                    <Avatar person={v} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-ink"><strong className="font-semibold">{v.firstName} {v.lastName}</strong> registered for <span className="font-medium">{o.title}</span></p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted">{timeAgo(r.createdAt)} <RegStatusBadge status={r.status} />{r.hoursVerified && <BadgeCheck size={13} className="text-success" />}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted">{plural(regs.length, 'registration')} across all of {org!.name}’s opportunities.</p>
      <PostUpdateModal open={posting} onClose={() => setPosting(false)} orgId={org!.id} />
    </div>
  )
}

function PostUpdateModal({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [err, setErr] = useState<Record<string, string>>({})
  async function submit() {
    const e: Record<string, string> = {}
    if (title.trim().length < 3) e.title = 'Add a headline.'
    if (body.trim().length < 10) e.body = 'Write a short update (10+ characters).'
    setErr(e)
    if (Object.keys(e).length) return
    const posted = await act(createPost(orgId, { title: title.trim(), body: body.trim() }).then(() => true), 'Update posted to your followers’ feeds.')
    if (posted) { setTitle(''); setBody(''); onClose() }
  }
  return (
    <Modal open={open} onClose={onClose} title="Post an update" description="Shared with everyone who follows your organization."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => void submit()}>Post update</Button></>}>
      <div className="space-y-4">
        <TextInput label="Headline" value={title} onChange={(e) => setTitle(e.target.value)} error={err.title} />
        <TextArea label="Update" value={body} onChange={(e) => setBody(e.target.value)} error={err.body} />
      </div>
    </Modal>
  )
}
