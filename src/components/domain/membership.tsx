import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, Mail, UserCheck, UserX } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button, LinkButton } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { ConfirmDialog } from '../ui/Modal'
import { OrgLogo } from '../ui/Avatar'
import { setActiveOrg } from '../../store/actions'
import { roleLabel, useMembershipActions } from './membershipHooks'
import { getOrg } from '../../store/selectors'
import { useSession } from '../../store/session'
import type { Membership, OrgProfile } from '../../types'

function StatusBadge({ m }: { m: Membership }) {
  if (m.status === 'active') return <Badge tone="success" icon={<UserCheck size={13} />}>{roleLabel(m.role)}</Badge>
  if (m.status === 'pending') return <Badge tone="gold" icon={<Clock size={13} />}>Waiting for approval</Badge>
  if (m.status === 'invited') return <Badge tone="navy" icon={<Mail size={13} />}>Invitation</Badge>
  if (m.status === 'rejected') return <Badge tone="danger" icon={<UserX size={13} />}>Request not accepted</Badge>
  return <Badge>Removed</Badge>
}

/**
 * The person's own relationship to one organization, with the actions the backend allows for it.
 * The membership row from the database is the only source of truth for what is shown.
 */
export function MembershipPanel({ org }: { org: OrgProfile }) {
  const { db } = useSession()
  const actions = useMembershipActions()
  const [confirmLeave, setConfirmLeave] = useState(false)
  const m = db.memberships.find((x) => x.orgId === org.id)
  const status = m?.status

  return (
    <Card>
      <CardHeader title="Your membership" subtitle={`Your connection to ${org.name}`} />
      <div className="space-y-4 p-5 text-base">
        {status === 'active' && m && (
          <>
            <p className="flex flex-wrap items-center gap-2">You are in this organization as <StatusBadge m={m} /></p>
            {m.role === 'owner' ? (
              <>
                <p className="text-ink/90">Owners cannot leave while they are still the owner. To step away, give ownership to another member, or delete the organization.</p>
                <LinkButton to="/org/people" size="lg" variant="secondary" onClick={() => setActiveOrg(org.id)}>Manage people and ownership</LinkButton>
              </>
            ) : (
              <>
                <p className="text-ink/90">You can leave at any time. You will lose access to this organization’s management pages.</p>
                <Button size="lg" variant="dangerOutline" disabled={actions.busy} onClick={() => setConfirmLeave(true)}>Leave this organization</Button>
              </>
            )}
          </>
        )}

        {status === 'pending' && (
          <>
            <p className="flex flex-wrap items-center gap-2"><StatusBadge m={m!} /></p>
            <p className="text-ink/90">Your request was sent. An administrator will review it, and you will get a notification with their answer.</p>
            <Button size="lg" variant="secondary" disabled={actions.busy} onClick={() => void actions.cancelRequest(org)}>{actions.busy ? 'Working…' : 'Cancel my request'}</Button>
          </>
        )}

        {status === 'invited' && m && (
          <>
            <p className="text-ink/90">You were invited to join as <strong>{roleLabel(m.role)}</strong>.</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="primary" icon={<Check size={18} />} disabled={actions.busy} onClick={() => void actions.accept(org)}>Accept invitation</Button>
              <Button size="lg" variant="secondary" disabled={actions.busy} onClick={() => void actions.decline(org)}>Decline invitation</Button>
            </div>
          </>
        )}

        {(!status || status === 'rejected' || status === 'removed') && (
          <>
            {status === 'rejected' && <p className="flex flex-wrap items-center gap-2"><StatusBadge m={m!} /></p>}
            {status === 'rejected' && <p className="text-ink/90">The organization did not accept your last request.</p>}
            {status === 'removed' && <p className="text-ink/90">You are no longer a member of this organization.</p>}
            {org.joinPolicy === 'invite_only' ? (
              <p className="text-ink/90">This organization is <strong>invitation only</strong>. An administrator has to invite you, and you can then accept the invitation here or in Settings.</p>
            ) : (
              <>
                <p className="text-ink/90">Ask to join if you want to help run this organization. An administrator reviews every request, and you will see the answer here.</p>
                <Button size="lg" variant="accent" disabled={actions.busy} onClick={() => void actions.join(org)}>{actions.busy ? 'Sending…' : status ? 'Ask to join again' : 'Ask to join'}</Button>
              </>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        destructive
        title={`Leave ${org.name}?`}
        message={<>You will lose access to this organization’s management pages. Your own volunteer profile, hours and registrations stay as they are. You can ask to join again later if the organization allows requests.</>}
        confirmLabel="Yes, leave"
        cancelLabel="Stay"
        onConfirm={() => void actions.leave(org)}
      />
    </Card>
  )
}

/** Every organization the person has a connection to: members, pending requests, invitations, declined requests. */
export function MyOrganizationsPanel() {
  const { db } = useSession()
  const actions = useMembershipActions()
  const [leaving, setLeaving] = useState<OrgProfile | null>(null)
  const rows = db.memberships
    .filter((m) => m.status !== 'removed')
    .map((m) => ({ m, org: getOrg(db, m.orgId) }))
    .filter((r): r is { m: Membership; org: OrgProfile } => !!r.org)
    .sort((a, b) => ['invited', 'pending', 'active', 'rejected'].indexOf(a.m.status) - ['invited', 'pending', 'active', 'rejected'].indexOf(b.m.status))
  if (!rows.length) return null

  return (
    <section aria-labelledby="my-orgs-title" className="mb-8">
      <h2 id="my-orgs-title" className="mb-3 text-xl">Your organizations and requests</h2>
      <Card>
        <ul className="divide-y divide-line">
          {rows.map(({ m, org }) => (
            <li key={org.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-4">
                <OrgLogo org={org} size="md" />
                <div className="min-w-0">
                  <Link to={`/app/organizations/${org.id}`} className="block truncate text-base font-semibold text-navy hover:underline">{org.name}</Link>
                  <div className="mt-1"><StatusBadge m={m} /></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {m.status === 'invited' && (
                  <>
                    <Button variant="primary" icon={<Check size={16} />} disabled={actions.busy} onClick={() => void actions.accept(org)}>Accept</Button>
                    <Button variant="secondary" disabled={actions.busy} onClick={() => void actions.decline(org)}>Decline</Button>
                  </>
                )}
                {m.status === 'pending' && <Button variant="secondary" disabled={actions.busy} onClick={() => void actions.cancelRequest(org)}>Cancel request</Button>}
                {m.status === 'active' && m.role === 'owner' && <LinkButton to="/org/people" variant="secondary" onClick={() => setActiveOrg(org.id)}>Manage</LinkButton>}
                {m.status === 'active' && m.role !== 'owner' && <Button variant="dangerOutline" disabled={actions.busy} onClick={() => setLeaving(org)}>Leave</Button>}
                {m.status === 'rejected' && org.joinPolicy === 'approval' && <Button variant="secondary" disabled={actions.busy} onClick={() => void actions.join(org)}>Ask again</Button>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog
        open={!!leaving}
        onClose={() => setLeaving(null)}
        destructive
        title={`Leave ${leaving?.name ?? 'this organization'}?`}
        message="You will lose access to this organization’s management pages. You can ask to join again later if the organization allows requests."
        confirmLabel="Yes, leave"
        cancelLabel="Stay"
        onConfirm={() => { if (leaving) void actions.leave(leaving) }}
      />
    </section>
  )
}
