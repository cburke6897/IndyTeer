import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/Modal'
import { TextInput } from '../ui/Field'
import { useMembershipActions } from './membershipHooks'
import { act } from '../../store/act'
import { deleteOrganization } from '../../store/actions'
import { memberRole } from '../../store/selectors'
import { useSession } from '../../store/session'
import { plural } from '../../lib/utils'
import type { OrgProfile } from '../../types'

/**
 * Leaving and deleting an organization, in plain language. Only an owner can delete (the server checks
 * this again); everyone else can only leave. Success is shown only after the server confirms.
 */
export function OrganizationDangerZone({ org }: { org: OrgProfile }) {
  const { db, user } = useSession()
  const navigate = useNavigate()
  const actions = useMembershipActions()
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const role = memberRole(db, org.id)
  const isOwner = role === 'owner'

  const oppIds = new Set(db.opportunities.filter((o) => o.orgId === org.id).map((o) => o.id))
  const registrations = db.registrations.filter((r) => oppIds.has(r.oppId)).length
  const posts = db.posts.filter((p) => p.orgId === org.id).length
  const others = (db.orgPeople[org.id] ?? []).filter((p) => p.userId !== user?.id && p.status === 'active').length
  const matches = typed.trim() === org.name

  async function remove() {
    if (deleting || !matches) return
    setDeleting(true)
    try {
      const done = await act(deleteOrganization(org.id), `${org.name} was permanently deleted.`)
      if (done) navigate('/app', { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Leave or delete this organization" subtitle="These choices affect other people, so please read them first" />
      <div className="space-y-8 p-5 text-base">
        {isOwner ? (
          <p>Owners <strong>cannot leave</strong> while they are the owner. You can <Link to="/org/people" className="font-semibold text-navy-700 underline">give ownership to another member</Link> first, and then leave. Or you can delete the organization below.</p>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg">Leave this organization</h3>
            <p className="text-ink/90">You will lose access to {org.name}’s management pages. Your own volunteer profile, hours and registrations stay as they are.</p>
            <Button size="lg" variant="dangerOutline" disabled={actions.busy} onClick={() => setConfirmLeave(true)}>Leave {org.name}</Button>
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-red-200 bg-danger-50 p-5">
          <h3 className="text-lg text-danger">Delete this organization</h3>
          {isOwner ? (
            <>
              <p>Deleting <strong>{org.name}</strong> <strong>cannot be undone</strong>. This is what will happen:</p>
              <ul className="list-disc space-y-1.5 pl-6">
                <li><strong>{plural(others, 'other person')}</strong> will lose their place in the organization{others === 0 ? ' (you are the only member)' : ''}.</li>
                <li><strong>{plural(oppIds.size, 'volunteer opportunity', 'volunteer opportunities')}</strong> will be removed.</li>
                <li><strong>{plural(registrations, 'volunteer registration')}</strong> for those opportunities will be removed. Hours already verified for volunteers by this organization will be removed with them.</li>
                <li><strong>{plural(posts, 'update')}</strong> you posted, and the organization’s logo and images, will be removed.</li>
              </ul>
              <p>If you only want to step away, <Link to="/org/people" className="font-semibold text-navy-700 underline">transfer ownership</Link> instead. The organization and its volunteers will stay.</p>
              <TextInput label={`To confirm, type the organization’s name: ${org.name}`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={deleting} />
              <Button size="lg" variant="danger" icon={<Trash2 size={18} />} disabled={!matches || deleting} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Permanently delete this organization'}</Button>
            </>
          ) : (
            <p>Only an <strong>owner</strong> can delete an organization. Ask an owner if you think it should be deleted.</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        destructive
        title={`Leave ${org.name}?`}
        message="You will lose access to this organization’s management pages. You can ask to join again later if the organization allows requests."
        confirmLabel="Yes, leave"
        cancelLabel="Stay"
        onConfirm={() => void actions.leave(org).then(() => navigate('/app', { replace: true }))}
      />
    </Card>
  )
}
