import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import {
  DeleteAccountError, deleteAccount, getDeletionImpact, transferOwnership,
  type DeletionImpact, type OwnedOrganization,
} from '../../account/deleteAccountService'
import { deleteAccount as clearLocalAccount } from '../../store/actions'
import { toast } from '../../store/toast'

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; impact: DeletionImpact }
type Choice = 'transfer' | 'delete'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Confirmation flow for permanently deleting the account. It explains the consequences and, for each
 * organization the person solely owns, makes them choose: transfer ownership to another member, or
 * delete the organization. Organizations that have another owner live on and need no decision. It
 * reports success only after the Edge Function confirms the deletion. Mount it only while open so its
 * state resets each time.
 */
export function DeleteAccountModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [typed, setTyped] = useState('')
  const [choice, setChoice] = useState<Record<string, Choice>>({})
  const [target, setTarget] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{ message: string; kind: 'blocked' | 'incomplete' } | null>(null)
  const [handedOver, setHandedOver] = useState<string[]>([])
  const transferred = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    getDeletionImpact(userId)
      .then((impact) => { if (active) setLoad({ state: 'ready', impact }) })
      .catch((cause: unknown) => {
        if (active) setLoad({ state: 'error', message: cause instanceof Error ? cause.message : 'Could not check your organizations.' })
      })
    return () => { active = false }
  }, [userId, attempt])

  const impact = load.state === 'ready' ? load.impact : null
  const needDecision: OwnedOrganization[] = impact?.owned.filter((o) => o.otherOwners === 0) ?? []
  const livesOn: OwnedOrganization[] = impact?.owned.filter((o) => o.otherOwners > 0) ?? []
  const decided = needDecision.every((o) => choice[o.id] === 'delete' || (choice[o.id] === 'transfer' && !!target[o.id]))
  const canDelete = !!impact && decided && typed === 'DELETE' && !busy

  async function confirm() {
    if (!canDelete) return
    setBusy(true)
    setFailure(null)
    try {
      // 1. Hand over the organizations the person chose to transfer (skipping any done on an earlier try).
      for (const org of needDecision.filter((o) => choice[o.id] === 'transfer' && !transferred.current.has(o.id))) {
        try {
          await transferOwnership(org.id, target[org.id])
        } catch (cause) {
          setFailure({ kind: 'blocked', message: `Could not transfer ${org.name}: ${cause instanceof Error ? cause.message : 'try again'}. Your account was not deleted.` })
          return
        }
        transferred.current.add(org.id)
        setHandedOver([...transferred.current])
      }
      // 2. Delete the account. Only the organizations explicitly chosen for deletion are listed.
      await deleteAccount({ deleteOrganizationIds: needDecision.filter((o) => choice[o.id] === 'delete').map((o) => o.id) })
      // Only now is the account really gone: clear the local copy and leave.
      clearLocalAccount(userId)
      onClose()
      navigate('/login', { replace: true })
      toast('Your account and data were permanently deleted.', 'info')
    } catch (cause) {
      const failed = cause instanceof DeleteAccountError ? cause : new DeleteAccountError('Your account deletion did not finish. Try again.', 'incomplete')
      setFailure({ kind: failed.kind, message: failed.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      size="md"
      title="Delete your account?"
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!canDelete} onClick={() => void confirm()}>
            {busy ? 'Deleting…' : 'Permanently delete my account'}
          </Button>
        </>
      )}
    >
      {load.state === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status"><Loader2 size={16} className="animate-spin" /> Checking what will be deleted…</p>
      )}

      {load.state === 'error' && (
        <div role="alert" className="space-y-3 text-sm">
          <p className="text-danger">{load.message}</p>
          <p className="text-muted">We can’t show what your account owns, so deletion is paused. Nothing was changed.</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoad({ state: 'loading' }); setAttempt((n) => n + 1) }}>Try again</Button>
        </div>
      )}

      {impact && (
        <div className="space-y-4 text-sm text-ink/90">
          <p>This permanently deletes your IndyTeer account. <strong>It can’t be undone.</strong></p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile, profile photo, registrations, saved opportunities, follows, notifications, and volunteer hours are deleted.</li>
            <li>Your sign-in is deleted. You won’t be able to log in with this email again.</li>
            {impact.memberOfCount > 0 && <li>You’ll be removed from {plural(impact.memberOfCount, 'organization', 'organizations')}. Their data stays.</li>}
          </ul>

          {livesOn.length > 0 && (
            <p className="rounded-md bg-navy-50 p-3 text-navy-800">
              {livesOn.map((o) => o.name).join(', ')} {livesOn.length === 1 ? 'has' : 'have'} another owner and will keep going without you.
            </p>
          )}

          {needDecision.map((org) => {
            const open = choice[org.id]
            return (
              <fieldset key={org.id} className="space-y-3 rounded-md border border-line p-3.5">
                <legend className="px-1 text-[13px] font-semibold text-ink">You own {org.name}</legend>
                <p className="text-muted">Choose what happens to it. {org.otherActiveMembers > 0 ? `${plural(org.otherActiveMembers, 'other person is', 'other people are')} in this organization.` : 'You’re its only member.'}</p>

                {org.eligible.length > 0 && org.transferAvailable && (
                  <div>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input type="radio" name={`org-${org.id}`} checked={open === 'transfer'} onChange={() => setChoice({ ...choice, [org.id]: 'transfer' })} className="mt-0.5 size-4 accent-navy" />
                      <span><strong>Transfer ownership</strong> to another member. The organization and its data stay.</span>
                    </label>
                    {open === 'transfer' && (
                      <select
                        aria-label={`New owner of ${org.name}`}
                        value={target[org.id] ?? ''}
                        onChange={(e) => setTarget({ ...target, [org.id]: e.target.value })}
                        className="mt-2 ml-6 h-10 w-[calc(100%-1.5rem)] rounded-md border border-line-strong bg-white px-3 text-sm"
                      >
                        <option value="">Choose the new owner</option>
                        {org.eligible.map((m) => <option key={m.userId} value={m.userId}>{m.name} ({m.role})</option>)}
                      </select>
                    )}
                  </div>
                )}
                {org.otherActiveMembers > 0 && org.eligible.length === 0 && org.transferAvailable && (
                  <p className="text-muted">There’s no other admin or member who can take over.</p>
                )}
                {org.otherActiveMembers > 0 && !org.transferAvailable && (
                  <p className="text-muted">Ownership transfer isn’t available on this server yet, so the only option is to delete it.</p>
                )}

                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="radio" name={`org-${org.id}`} checked={open === 'delete'} onChange={() => setChoice({ ...choice, [org.id]: 'delete' })} className="mt-0.5 size-4 accent-navy" />
                  <span><strong className="text-danger">Delete {org.name}</strong> with all of its opportunities, registrations, posts, and images{org.otherActiveMembers > 0 ? `, for ${plural(org.otherActiveMembers, 'other member', 'other members')} too` : ''}.</span>
                </label>
              </fieldset>
            )
          })}

          {handedOver.length > 0 && failure && (
            <p className="rounded-md bg-navy-50 p-3 text-navy-800">Ownership was already transferred for {handedOver.length === 1 ? 'one organization' : `${handedOver.length} organizations`}. Your account still exists.</p>
          )}

          {failure && (
            <div role="alert" className="rounded-md border border-red-200 bg-danger-50 p-3.5 text-danger">
              <p className="font-semibold">{failure.kind === 'incomplete' ? 'Deletion did not finish' : 'Your account was not deleted'}</p>
              <p className="mt-1">{failure.message}</p>
            </div>
          )}

          <TextInput label="Type DELETE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={busy} />
        </div>
      )}
    </Modal>
  )
}
