import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Award, BadgeCheck, Lock, Mail, Pencil, Phone } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { OrgLogo } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { VolunteerProfileHeader } from '../../components/domain/ProfileHeader'
import { VolunteerProfileForm } from '../../components/domain/ProfileForms'
import { cn, formatDate, formatHours } from '../../lib/utils'
import { useSession } from '../../store/session'
import { followedOrgs, getOpp, getUser, getVolunteer, hourEntries, hourTotals, volunteerRegistrations } from '../../store/selectors'
import { defaultSettings } from '../../data/seed'

/** Volunteer profile. `own` = editable self view; otherwise read-only view for organizations (respects privacy settings). */
export default function VolunteerProfilePage({ own }: { own?: boolean }) {
  const params = useParams()
  const { db, volunteer: me } = useSession()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const volunteer = own ? me : getVolunteer(db, params.id)
  if (!volunteer) return <EmptyState title="Volunteer not found" action={<LinkButton to="/org/volunteers" variant="primary">Back to volunteers</LinkButton>} />

  const settings = (volunteer.userId && db.settings[volunteer.userId]) || defaultSettings()
  const hidden = !own
  const isPrivate = hidden && !settings.privacy.publicProfile
  const showHours = !hidden || settings.privacy.showHours
  const showHistory = !hidden || settings.privacy.showHistory

  const entries = hourEntries(db, volunteer.id)
  const totals = hourTotals(entries)
  const orgs = followedOrgs(db, volunteer.id)
  const user = getUser(db, volunteer.userId)
  const email = user?.email ?? `${volunteer.firstName.toLowerCase()}.${volunteer.lastName.toLowerCase()}@example.com`
  const categories = new Set(volunteerRegistrations(db, volunteer.id).filter((r) => r.attended).map((r) => getOpp(db, r.oppId)?.category))

  const badges = [
    { name: 'First Steps', desc: 'Attended your first event', on: totals.completed >= 1 },
    { name: 'Regular', desc: 'Attended 5 events', on: totals.completed >= 5 },
    { name: '10 Hour Club', desc: '10 verified hours', on: totals.verified >= 10 },
    { name: '25 Hour Club', desc: '25 verified hours', on: totals.verified >= 25 },
    { name: '100 Hour Club', desc: '100 verified hours', on: totals.verified >= 100 },
    { name: 'Well Rounded', desc: 'Volunteered in 3 cause areas', on: categories.size >= 3 },
    { name: 'Connector', desc: 'Following 3+ organizations', on: orgs.length >= 3 },
  ]
  const earned = badges.filter((b) => b.on).length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {!own && <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:underline"><ArrowLeft size={15} /> Back</button>}
      <VolunteerProfileHeader volunteer={volunteer} actions={own ? <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>Edit profile</Button> : undefined} />

      {isPrivate ? (
        <EmptyState icon={<Lock size={20} />} title="This profile is private" message={`${volunteer.firstName} has chosen to keep their volunteer details private.`} />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-base">About</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/90">{volunteer.bio}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">{volunteer.skills.length ? volunteer.skills.map((s) => <Badge key={s} tone="navy">{s}</Badge>) : <span className="text-sm text-muted">None listed</span>}</div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm">Interests</h3>
                  <div className="flex flex-wrap gap-1.5">{volunteer.interests.map((s) => <Badge key={s} tone="gold">{s}</Badge>)}</div>
                </div>
              </div>
              {volunteer.availability && <p className="mt-5 text-sm text-muted">Availability: <span className="font-semibold text-ink">{volunteer.availability}</span></p>}
            </Card>

            <Card>
              <CardHeader title="Volunteer history" subtitle={showHistory ? `${entries.length} entries` : undefined} />
              {!showHistory ? (
                <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted"><Lock size={15} /> This volunteer keeps their history private.</p>
              ) : entries.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">No volunteer activity yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {entries.slice(0, 8).map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{e.title}</p>
                        <p className="text-xs text-muted">{e.orgName} · {formatDate(e.date)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {showHours && <span className="text-sm font-bold text-navy">{formatHours(e.hours)} hrs</span>}
                        {e.status === 'verified' ? <Badge tone="success" icon={<BadgeCheck size={12} />}>Verified</Badge> : <Badge tone="gold">Pending</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader title="Impact" />
              <dl className="grid grid-cols-3 gap-px bg-line text-center">
                <div className="bg-white p-3"><dd className="text-xl font-bold text-navy">{showHours ? formatHours(totals.verified) : '—'}</dd><dt className="text-[11px] text-muted">Verified hrs</dt></div>
                <div className="bg-white p-3"><dd className="text-xl font-bold text-navy">{totals.completed}</dd><dt className="text-[11px] text-muted">Events</dt></div>
                <div className="bg-white p-3"><dd className="text-xl font-bold text-navy">{orgs.length}</dd><dt className="text-[11px] text-muted">Following</dt></div>
              </dl>
            </Card>

            <Card>
              <CardHeader title="Achievements" subtitle={`${earned} of ${badges.length} earned`} />
              <ul className="grid grid-cols-2 gap-2 p-4">
                {badges.map((b) => (
                  <li key={b.name} title={b.desc} className={cn('flex flex-col items-center rounded-md border p-3 text-center', b.on ? 'border-gold-100 bg-gold-50' : 'border-line bg-surface/60 opacity-55')}>
                    <span className={cn('flex size-9 items-center justify-center rounded-full', b.on ? 'bg-gold text-navy-950' : 'bg-line text-muted')}><Award size={18} /></span>
                    <span className="mt-1.5 text-xs font-bold text-navy">{b.name}</span>
                    <span className="text-[11px] leading-tight text-muted">{b.desc}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Organizations followed" />
              {orgs.length === 0 ? <p className="px-5 py-6 text-center text-sm text-muted">Not following anyone yet.</p> : (
                <ul className="divide-y divide-line">
                  {orgs.map((o) => (
                    <li key={o.id}>
                      <Link to={`/app/organizations/${o.id}`} className={cn('flex items-center gap-3 px-5 py-3', own ? 'hover:bg-surface/60' : 'pointer-events-none')}>
                        <OrgLogo org={o} size="sm" /><span className="truncate text-sm font-semibold text-navy">{o.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {!own && (
              <Card>
                <CardHeader title="Contact" />
                <ul className="space-y-3 p-5 text-sm">
                  <li className="flex items-center gap-3"><Mail size={16} className="text-navy-700" /><a href={`mailto:${email}`} className="font-medium break-all text-navy-700 hover:underline">{email}</a></li>
                  {volunteer.phone && <li className="flex items-center gap-3"><Phone size={16} className="text-navy-700" />{volunteer.phone}</li>}
                </ul>
              </Card>
            )}
          </aside>
        </div>
      )}

      {own && (
        <Modal open={editing} onClose={() => setEditing(false)} size="lg" title="Edit profile"
          footer={<><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" form="vol-profile-form">Save changes</Button></>}>
          <VolunteerProfileForm id="vol-profile-form" volunteer={volunteer} onDone={() => setEditing(false)} />
        </Modal>
      )}
    </div>
  )
}
