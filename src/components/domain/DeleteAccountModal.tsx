import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/Field'
import {
  DeleteAccountError,
  deleteAccount,
  getDeletionImpact,
  type DeletionImpact,
  type OwnedOrganization,
} from '../../account/deleteAccountService'
import { toast } from '../../store/toast'

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; impact: DeletionImpact }

/**
 * Confirmation flow for permanently deleting the account. It explains the consequences, makes the
 * user choose explicitly about organizations they own, and blocks the flow for organizations with
 * other active members (transfer ownership from the Members page first). It reports success only after the
 * Edge Function confirms the deletion. Mount it only while open so its state resets each time.
 */
export function DeleteAccountModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [typed, setTyped] = useState('')
  const [agreed, setAgreed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<DeleteAccountError | null>(null)

  useEffect(() => {
    let active = true
    getDeletionImpact(userId)
      .then((impact) => {
        if (active) setLoad({ state: 'ready', impact })
      })
      .catch((cause: unknown) => {
        if (active)
          setLoad({
            state: 'error',
            message: cause instanceof Error ? cause.message : 'Could not check your organizations.',
          })
      })
    return () => {
      active = false
    }
  }, [userId, attempt])

  const impact = load.state === 'ready' ? load.impact : null
  const serverBlocked = failure?.code === 'ORGANIZATION_HAS_MEMBERS' ? failure.organizations : []
  const shared: OwnedOrganization[] = [
    ...(impact?.owned.filter((o) => o.otherActiveMembers > 0) ?? []),
    ...serverBlocked.filter((o) => !impact?.owned.some((x) => x.id === o.id)),
  ]
  const solo = impact?.owned.filter((o) => o.otherActiveMembers === 0) ?? []
  const everySoloChosen = solo.every((o) => agreed[o.id])
  const canDelete =
    !!impact && shared.length === 0 && everySoloChosen && typed === 'DELETE' && !busy

  async function confirm() {
    if (!canDelete) return
    setBusy(true)
    setFailure(null)
    try {
      await deleteAccount({ deleteOwnedOrganizations: solo.length > 0 })
      // Auth deletion has succeeded; the service clears the local Auth session.
      onClose()
      navigate('/login', { replace: true })
      toast('Your account and data were permanently deleted.', 'info')
    } catch (cause) {
      setFailure(
        cause instanceof DeleteAccountError
          ? cause
          : new DeleteAccountError(
              'Your account deletion did not finish. Try again.',
              'incomplete',
            ),
      )
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
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!canDelete} onClick={() => void confirm()}>
            {busy ? 'Deleting…' : 'Permanently delete my account'}
          </Button>
        </>
      }
    >
      {load.state === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 size={16} className="animate-spin" /> Checking what will be deleted…
        </p>
      )}

      {load.state === 'error' && (
        <div role="alert" className="space-y-3 text-sm">
          <p className="text-danger">{load.message}</p>
          <p className="text-muted">
            We can’t show what your account owns, so deletion is paused. Nothing was changed.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoad({ state: 'loading' })
              setAttempt((n) => n + 1)
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {impact && (
        <div className="space-y-4 text-sm text-ink/90">
          <p>
            This permanently deletes your IndyTeer account. <strong>It can’t be undone.</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Your profile, profile photo, registrations, saved opportunities, follows,
              notifications, and volunteer hours are deleted.
            </li>
            <li>Your sign-in is deleted. You won’t be able to log in with this email again.</li>
            {impact.memberOfCount > 0 && (
              <li>
                You’ll be removed from {impact.memberOfCount} organization
                {impact.memberOfCount === 1 ? '' : 's'}. Their data stays.
              </li>
            )}
          </ul>

          {shared.length > 0 && (
            <div role="alert" className="rounded-md border border-red-200 bg-danger-50 p-3.5">
              <p className="flex items-center gap-2 font-semibold text-danger">
                <AlertTriangle size={16} /> Deletion is blocked
              </p>
              {shared.map((o) => (
                <p key={o.id} className="mt-2 text-ink/90">
                  <strong>{o.name}</strong> has {o.otherActiveMembers} other active member
                  {o.otherActiveMembers === 1 ? '' : 's'}. Ownership can’t be transferred yet, and
                  deleting your account would delete the organization for them too.
                </p>
              ))}
              <div className="mt-2 flex flex-wrap gap-3">
                {shared.map((o) => (
                  <Link
                    key={o.id}
                    className="font-semibold underline"
                    to={'/manage/' + o.id + '/members'}
                  >
                    Manage {o.name}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-muted">
                Transfer ownership from the organization’s Members page before deleting your
                account. Nothing has been deleted.
              </p>
            </div>
          )}

          {solo.length > 0 && shared.length === 0 && (
            <fieldset className="space-y-2 rounded-md border border-line p-3.5">
              <legend className="px-1 text-[13px] font-semibold text-ink">
                Organizations you own
              </legend>
              <p className="text-muted">
                You’re the only member, so these will be deleted along with your account. Confirm
                each one to continue, or cancel.
              </p>
              {solo.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!agreed[o.id]}
                    onChange={(e) => setAgreed({ ...agreed, [o.id]: e.target.checked })}
                    className="mt-0.5 size-4 rounded border-line-strong accent-navy"
                  />
                  <span>
                    Permanently delete <strong>{o.name}</strong> with all of its opportunities,
                    registrations, posts, and images.
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {failure && failure.code !== 'ORGANIZATION_HAS_MEMBERS' && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-danger-50 p-3.5 text-danger"
            >
              <p className="font-semibold">
                {failure.kind === 'incomplete'
                  ? 'Deletion did not finish'
                  : 'Your account was not deleted'}
              </p>
              <p className="mt-1">{failure.message}</p>
            </div>
          )}

          <TextInput
            label="Type DELETE to confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            disabled={busy || shared.length > 0}
          />
        </div>
      )}
    </Modal>
  )
}
