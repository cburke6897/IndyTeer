import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Search, UserPlus, X } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { SelectInput, TextInput } from '../../components/ui/Field'
import { roleLabel, useMembershipActions } from '../../components/domain/membershipHooks'
import { searchPublicPeople, type PublicPerson } from '../../lib/api/users'
import { plainError } from '../../lib/messages'
import { act } from '../../store/act'
import { changeMemberRole, inviteToOrganization, removeFromOrganization, reviewJoinRequest, transferOwnership } from '../../store/actions'
import { memberRole } from '../../store/selectors'
import { useSession } from '../../store/session'
import type { OrgPerson } from '../../types'

const asPerson = (p: OrgPerson) => {
  const [first, ...rest] = p.name.split(/\s+/)
  return { id: p.userId, firstName: first ?? '', lastName: rest.join(' '), avatar: p.avatar }
}

type Pending = { kind: 'remove' | 'cancel-invite' | 'leave'; person: OrgPerson } | null

/**
 * Who is in the organization and what they may do. Everything shown comes from the database
 * (list_organization_members); every button calls the matching RPC, which makes the real decision.
 */
export default function PeoplePage() {
  const { db, user, org } = useSession()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Pending>(null)
  const [transferTo, setTransferTo] = useState<OrgPerson | null>(null)
  const membership = useMembershipActions()
  if (!org || !user) return null

  const myRole = memberRole(db, org.id)
  const isOwner = myRole === 'owner'
  const people = db.orgPeople[org.id] ?? []
  const requests = people.filter((p) => p.status === 'pending')
  const invited = people.filter((p) => p.status === 'invited')
  const members = people.filter((p) => p.status === 'active')
    .sort((a, b) => ['owner', 'admin', 'member'].indexOf(a.role) - ['owner', 'admin', 'member'].indexOf(b.role) || a.name.localeCompare(b.name))

  async function run(task: () => Promise<unknown>, success: string) {
    if (busy) return false
    setBusy(true)
    try { return !!(await act(task().then(() => true), success)) } finally { setBusy(false) }
  }

  const canRemove = (p: OrgPerson) => p.userId !== user.id && p.role !== 'owner' && (isOwner || p.role === 'member')

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="People" description={`Everyone connected to ${org.name}. Approve requests, invite people, and manage who can help run the organization.`} />

      {/* Requests to join */}
      <section aria-labelledby="requests-title">
        <h2 id="requests-title" className="mb-3 text-xl">Requests to join {requests.length > 0 && <Badge tone="gold">{requests.length} waiting</Badge>}</h2>
        {requests.length === 0 ? (
          <Card className="p-5 text-base text-muted">No one is waiting. When someone asks to join, you will get a notification and they will appear here.</Card>
        ) : (
          <Card><ul className="divide-y divide-line">
            {requests.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4"><Avatar person={asPerson(p)} size="md" /><div><p className="text-base font-semibold text-navy">{p.name}</p><p className="text-sm text-muted">Wants to join as a member</p></div></div>
                <div className="flex flex-wrap gap-3">
                  <Button icon={<Check size={16} />} disabled={busy} onClick={() => void run(() => reviewJoinRequest(org.id, p.userId, true), `${p.name} was accepted.`)}>Accept</Button>
                  <Button variant="secondary" icon={<X size={16} />} disabled={busy} onClick={() => void run(() => reviewJoinRequest(org.id, p.userId, false), `${p.name}’s request was declined.`)}>Decline</Button>
                </div>
              </li>
            ))}
          </ul></Card>
        )}
      </section>

      <InvitePanel orgId={org.id} orgName={org.name} people={people} busy={busy} run={run} />

      {/* Invitations waiting */}
      {invited.length > 0 && (
        <section aria-labelledby="invited-title">
          <h2 id="invited-title" className="mb-3 text-xl">Invitations waiting for a reply</h2>
          <Card><ul className="divide-y divide-line">
            {invited.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4"><Avatar person={asPerson(p)} size="md" /><div><p className="text-base font-semibold text-navy">{p.name}</p><p className="text-sm text-muted">Invited as {roleLabel(p.role).toLowerCase()}. They can accept or decline.</p></div></div>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm({ kind: 'cancel-invite', person: p })}>Cancel invitation</Button>
              </li>
            ))}
          </ul></Card>
        </section>
      )}

      {/* Members */}
      <section aria-labelledby="members-title">
        <h2 id="members-title" className="mb-3 text-xl">Members <span className="text-muted">({members.length})</span></h2>
        {members.length === 0 ? (
          <EmptyState title="No members to show" message="If you expected people here, reload the page. This list needs the latest backend update." />
        ) : (
          <Card><ul className="divide-y divide-line">
            {members.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <Avatar person={asPerson(p)} size="md" />
                  <div>
                    <p className="text-base font-semibold text-navy">{p.name}{p.userId === user.id && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}</p>
                    <Badge tone={p.role === 'owner' ? 'gold' : p.role === 'admin' ? 'navy' : 'neutral'}>{roleLabel(p.role)}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {isOwner && p.userId !== user.id && p.role !== 'owner' && (
                    <>
                      <Button variant="secondary" disabled={busy} onClick={() => void run(() => changeMemberRole(org.id, p.userId, p.role === 'admin' ? 'member' : 'admin'), p.role === 'admin' ? `${p.name} is now a member.` : `${p.name} is now an administrator.`)}>
                        {p.role === 'admin' ? 'Make a regular member' : 'Make administrator'}
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setTransferTo(p)}>Make owner…</Button>
                    </>
                  )}
                  {canRemove(p) && <Button variant="dangerOutline" disabled={busy} onClick={() => setConfirm({ kind: 'remove', person: p })}>Remove</Button>}
                </div>
              </li>
            ))}
          </ul></Card>
        )}
      </section>

      {/* Leaving / ownership */}
      <Card>
        <CardHeader title="Your place in this organization" />
        <div className="space-y-4 p-5 text-base">
          <p>You are <strong>{myRole ? roleLabel(myRole).toLowerCase() : 'a member'}</strong> of {org.name}.</p>
          {isOwner ? (
            <>
              <p className="text-ink/90">Owners cannot leave while they are still the owner. To step away, choose <strong>Make owner…</strong> next to another member above, or delete the organization from <Link to="/org/settings" className="font-semibold text-navy-700 underline">Settings</Link>.</p>
              <Button size="lg" variant="secondary" disabled>Leave organization (owners cannot)</Button>
            </>
          ) : (
            <>
              <p className="text-ink/90">You can leave at any time. You will lose access to this organization’s management pages.</p>
              <Button size="lg" variant="dangerOutline" disabled={busy || membership.busy} onClick={() => setConfirm({ kind: 'leave', person: members.find((x) => x.userId === user.id) ?? { userId: user.id, name: 'You', avatar: null, role: myRole ?? 'member', status: 'active' } })}>Leave this organization</Button>
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        destructive
        title={confirm?.kind === 'leave' ? `Leave ${org.name}?` : confirm?.kind === 'cancel-invite' ? 'Cancel this invitation?' : `Remove ${confirm?.person.name ?? 'this person'}?`}
        message={confirm?.kind === 'leave'
          ? 'You will lose access to this organization’s management pages. You can ask to join again later if the organization allows requests.'
          : confirm?.kind === 'cancel-invite'
            ? `${confirm.person.name} will no longer be able to accept this invitation. You can invite them again later.`
            : `${confirm?.person.name} will lose access to ${org.name}. They stay on IndyTeer and can ask to join again if the organization allows requests.`}
        confirmLabel={confirm?.kind === 'leave' ? 'Yes, leave' : confirm?.kind === 'cancel-invite' ? 'Yes, cancel it' : 'Yes, remove'}
        cancelLabel="Go back"
        onConfirm={() => {
          if (!confirm) return
          const { kind, person } = confirm
          if (kind === 'leave') void membership.leave(org)
          else void run(() => removeFromOrganization(org.id, person.userId), kind === 'cancel-invite' ? 'Invitation cancelled.' : `${person.name} was removed.`)
        }}
      />

      <TransferModal
        person={transferTo}
        orgName={org.name}
        onClose={() => setTransferTo(null)}
        onConfirm={async (p) => {
          const ok = await run(() => transferOwnership(org.id, p.userId), `${p.name} is now the owner of ${org.name}. You are an administrator.`)
          if (ok) setTransferTo(null)
        }}
        busy={busy}
      />
    </div>
  )
}

function TransferModal({ person, orgName, onClose, onConfirm, busy }: { person: OrgPerson | null; orgName: string; onClose: () => void; onConfirm: (p: OrgPerson) => void; busy: boolean }) {
  return (
    <Modal
      open={!!person}
      onClose={busy ? () => undefined : onClose}
      size="md"
      title={person ? `Make ${person.name} the owner?` : 'Make owner'}
      footer={<><Button variant="secondary" size="lg" disabled={busy} onClick={onClose}>No, keep ownership</Button><Button variant="primary" size="lg" disabled={busy} onClick={() => person && onConfirm(person)}>{busy ? 'Transferring…' : 'Yes, transfer ownership'}</Button></>}
    >
      {person && (
        <div className="space-y-3 text-base leading-relaxed">
          <p><strong>{person.name}</strong> will become an owner of <strong>{orgName}</strong> and will be told by notification.</p>
          <p>You will become an <strong>administrator</strong>. You will no longer be able to delete the organization or change who owns it. You will still be able to manage opportunities, registrations and people.</p>
          <p className="text-muted">Only the new owner can undo this.</p>
        </div>
      )}
    </Modal>
  )
}

function InvitePanel({ orgId, orgName, people, busy, run }: { orgId: string; orgName: string; people: OrgPerson[]; busy: boolean; run: (task: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [results, setResults] = useState<PublicPerson[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [confirmPerson, setConfirmPerson] = useState<PublicPerson | null>(null)
  const latest = useRef(0)
  const inOrg = new Set(people.filter((p) => ['active', 'pending', 'invited'].includes(p.status)).map((p) => p.userId))

  useEffect(() => { latest.current += 1 }, [orgId])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) { setError('Type at least 2 letters of the person’s name.'); return }
    const mine = ++latest.current
    setError(''); setSearching(true)
    try {
      const found = await searchPublicPeople(query)
      if (mine === latest.current) setResults(found)
    } catch (cause) {
      if (mine === latest.current) setError(plainError(cause instanceof Error ? cause.message : null, 'The search did not work. Please try again.'))
    } finally {
      if (mine === latest.current) setSearching(false)
    }
  }

  return (
    <section aria-labelledby="invite-title">
      <h2 id="invite-title" className="mb-3 text-xl">Invite someone</h2>
      <Card className="space-y-5 p-5">
        <p className="text-base text-ink/90">Search for a person by name. They will get a notification and can <strong>accept or decline</strong>. People can also choose to block invitations in their own settings.</p>
        <form onSubmit={(e) => void search(e)} className="flex flex-wrap items-end gap-4" noValidate>
          <TextInput label="Person’s name" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example: Maria Lopez" wrapperClassName="min-w-[16rem] flex-1" error={error} />
          <SelectInput label="They would join as" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')} wrapperClassName="w-56">
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </SelectInput>
          <Button type="submit" size="lg" icon={<Search size={18} />} disabled={searching}>{searching ? 'Searching…' : 'Search'}</Button>
        </form>
        <p className="text-sm text-muted">You can only find people who chose to make their profile visible. If someone does not appear, ask them to turn on a visible profile in their Settings.</p>

        {results && (results.length === 0 ? (
          <p role="status" className="rounded-md bg-surface p-4 text-base">No visible profiles match “{query.trim()}”. Check the spelling, or ask the person to make their profile visible.</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line" aria-label="Search results">
            {results.map((p) => {
              const already = inOrg.has(p.id)
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-base font-semibold text-navy">{p.full_name}</p>
                    <p className="text-sm text-muted">{[p.headline, [p.city, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
                  </div>
                  {already
                    ? <Badge tone="neutral">Already connected</Badge>
                    : <Button icon={<UserPlus size={16} />} disabled={busy} onClick={() => setConfirmPerson(p)}>Invite</Button>}
                </li>
              )
            })}
          </ul>
        ))}
      </Card>
      <ConfirmDialog
        open={!!confirmPerson}
        onClose={() => setConfirmPerson(null)}
        title={`Invite ${confirmPerson?.full_name ?? 'this person'}?`}
        message={<>We will send <strong>{confirmPerson?.full_name}</strong> an invitation to join <strong>{orgName}</strong> as {role === 'admin' ? 'an administrator' : 'a member'}. They can accept or decline. Nothing changes for them until they answer.</>}
        confirmLabel="Send invitation"
        cancelLabel="Go back"
        onConfirm={() => {
          if (!confirmPerson) return
          const person = confirmPerson
          void run(() => inviteToOrganization(orgId, person.id, role), `Invitation sent to ${person.full_name}.`).then((ok) => {
            if (ok) { setQuery(''); setResults(null) }
          })
        }}
      />
    </section>
  )
}

