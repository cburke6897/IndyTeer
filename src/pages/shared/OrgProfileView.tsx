import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Globe, Mail, MapPin, Pencil, Phone } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button, LinkButton } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { FollowButton } from '../../components/domain/OpportunityParts'
import { OpportunityCard } from '../../components/domain/OpportunityCards'
import { OrgProfileHeader } from '../../components/domain/ProfileHeader'
import { OrgProfileForm } from '../../components/domain/ProfileForms'
import { displayUrl, formatDate, formatHours, plural } from '../../lib/utils'
import { useSession } from '../../store/session'
import { followerCount, getOrg, isPast, orgOpps, orgStats, orgVolunteers } from '../../store/selectors'

/** Public organization page. Used by volunteers (/app/organizations/:id) and by the owning org (/org/profile). */
export default function OrgProfilePage({ own }: { own?: boolean }) {
  const params = useParams()
  const { db, org: myOrg } = useSession()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const org = own ? myOrg : getOrg(db, params.id)

  if (!org) return <EmptyState title="Organization not found" action={<LinkButton to="/app/organizations" variant="primary">Browse organizations</LinkButton>} />

  const isOwner = !!myOrg && myOrg.id === org.id
  const stats = orgStats(db, org.id)
  const all = orgOpps(db, org.id).filter((o) => o.status === 'published')
  const active = all.filter((o) => !isPast(o)).sort((a, b) => a.date.localeCompare(b.date))
  const past = all.filter(isPast).sort((a, b) => b.date.localeCompare(a.date))
  const base = isOwner ? '/org/opportunities' : '/app/opportunities'
  const volunteersCount = orgVolunteers(db, org.id).length

  return (
    <div className="space-y-6">
      {!own && <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:underline"><ArrowLeft size={15} /> Back</button>}
      <OrgProfileHeader
        org={org}
        meta={followerCount(db, org) !== null ? <span>{followerCount(db, org)?.toLocaleString()} followers</span> : undefined}
        actions={isOwner
          ? <Button variant="primary" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>Edit profile</Button>
          : <FollowButton orgId={org.id} size="md" />}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-base">About</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/90">{org.description}</p>
            <h2 className="mt-6 text-base">Our mission</h2>
            <blockquote className="mt-2 border-l-[3px] border-gold pl-4 text-[15px] leading-relaxed text-ink/90 italic">{org.mission}</blockquote>
            <div className="mt-6 flex flex-wrap gap-2">{org.focus.map((f) => <Badge key={f} tone="navy">{f}</Badge>)}</div>
          </Card>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg">Active volunteer opportunities <span className="text-muted">({active.length})</span></h2>
              {isOwner && <LinkButton to="/org/opportunities/new" size="sm" variant="accent">Create opportunity</LinkButton>}
            </div>
            {active.length === 0 ? (
              <EmptyState title="No open opportunities right now" message={isOwner ? 'Create an opportunity so volunteers can find you.' : 'Follow this organization to hear when new opportunities are posted.'} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">{active.map((o) => <OpportunityCard key={o.id} opp={o} base={base} />)}</div>
            )}
          </section>

          {past.length > 0 && (
            <Card>
              <CardHeader title="Past events" subtitle={`${past.length} completed`} />
              <ul className="divide-y divide-line">
                {past.slice(0, 6).map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">{o.title}</p>
                      <p className="text-xs text-muted">{formatDate(o.date)} · {o.city}</p>
                    </div>
                    <Badge>{o.category}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader title="Impact" />
            <dl className="grid grid-cols-2 gap-px bg-line">
              {[
                [formatHours(stats.hours), 'Hours contributed'], [stats.completedEvents, 'Events completed'],
                [volunteersCount, 'Volunteers'], [stats.activeOpps, 'Open opportunities'],
              ].map(([v, l]) => (
                <div key={l} className="bg-white p-4"><dd className="text-2xl font-bold text-navy">{v}</dd><dt className="text-xs text-muted">{l}</dt></div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Contact" />
            <ul className="space-y-3 p-5 text-sm">
              <li className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 shrink-0 text-navy-700" />{org.city}, {org.state}</li>
              {org.website && <li className="flex items-start gap-3"><Globe size={16} className="mt-0.5 shrink-0 text-navy-700" /><a href={org.website} target="_blank" rel="noreferrer" className="font-medium break-all text-navy-700 hover:underline">{displayUrl(org.website)}</a></li>}
              <li className="flex items-start gap-3"><Mail size={16} className="mt-0.5 shrink-0 text-navy-700" /><a href={`mailto:${org.email}`} className="font-medium break-all text-navy-700 hover:underline">{org.email}</a></li>
              {org.phone && <li className="flex items-start gap-3"><Phone size={16} className="mt-0.5 shrink-0 text-navy-700" />{org.phone}</li>}
            </ul>
          </Card>
          <p className="px-1 text-xs text-muted">{plural(stats.upcomingEvents.length, 'upcoming event')} · Member since {org.founded}</p>
        </aside>
      </div>

      {isOwner && (
        <Modal open={editing} onClose={() => setEditing(false)} size="lg" title="Edit organization profile"
          footer={<><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" form="org-profile-form">Save changes</Button></>}>
          <OrgProfileForm id="org-profile-form" org={org} onDone={() => setEditing(false)} />
        </Modal>
      )}
    </div>
  )
}
