import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button, LinkButton } from '../../components/ui/Button'
import { SessionLoading } from '../../components/layout/SessionLoading'
import { useAuth } from '../../auth/useAuth'
import { updatePassword } from '../../auth/accountService'
import { homePathFor } from '../../store/selectors'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'

/** Landing page for the password-recovery email link (Supabase signs the user in via the link). */
export default function ResetPasswordPage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const { user } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  if (authLoading) return <SessionLoading />

  if (!authUser) {
    return (
      <AuthLayout title="This link has expired" subtitle="Password reset links work once and expire quickly.">
        <LinkButton to="/forgot-password" variant="primary" size="lg" className="w-full">Request a new link</LinkButton>
        <p className="mt-5 text-center text-sm"><Link to="/login" className="font-semibold text-navy-700 hover:underline">Back to log in</Link></p>
      </AuthLayout>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (password.length < 8) err.password = 'Use at least 8 characters.'
    if (confirm !== password) err.confirm = 'Passwords don’t match.'
    setErrors(err)
    if (Object.keys(err).length) return
    setBusy(true)
    try {
      await updatePassword(password)
      toast('Password updated.')
      navigate(homePathFor(user), { replace: true })
    } catch (cause) {
      setErrors({ form: cause instanceof Error ? cause.message : 'Could not update your password.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you haven’t used before.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors.form && <p role="alert" className="rounded-md border border-red-200 bg-danger-50 p-3 text-sm text-danger">{errors.form}</p>}
        <PasswordInput label="New password" autoComplete="new-password" hint="At least 8 characters." value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</Button>
      </form>
    </AuthLayout>
  )
}
