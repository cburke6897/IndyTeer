import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, MailWarning } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { TextInput } from '../../components/ui/Field'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../auth/useAuth'
import { resendConfirmation } from '../../auth/accountService'
import { setRememberMe } from '../../auth/rememberMe'
import { toast } from '../../store/toast'
import { isEmail } from '../../lib/utils'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [unconfirmed, setUnconfirmed] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!isEmail(email.trim())) next.email = 'That doesn’t look like a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    setUnconfirmed(false)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      setRememberMe(remember)
      await signIn(email, password)
      // On success the shared session updates and the route guard sends the user to the standard app (or to onboarding if not finished).
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Login failed. Please try again.'
      if (/email not confirmed/i.test(message)) {
        setUnconfirmed(true)
        setErrors({ form: 'Confirm your email address before logging in. Check your inbox for the link.' })
      } else if (/invalid login credentials/i.test(message)) {
        setErrors({ form: 'That email and password don’t match. Check them and try again.' })
      } else {
        setErrors({ form: message })
      }
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    try {
      await resendConfirmation(email)
      toast('Confirmation email sent.')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not resend the email.', 'error')
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to find opportunities or manage your volunteers."
      footer={<>New to IndyTeer? <Link to="/signup" className="font-semibold text-navy-700 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors.form && (
          <div role="alert" className="flex gap-2.5 rounded-md border border-red-200 bg-danger-50 p-3 text-sm text-danger">
            {unconfirmed ? <MailWarning size={17} className="mt-0.5 shrink-0" /> : <AlertCircle size={17} className="mt-0.5 shrink-0" />}
            <span>
              {errors.form}
              {unconfirmed && <> <button type="button" onClick={resend} className="font-semibold underline">Resend email</button></>}
            </span>
          </div>
        )}
        <TextInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordInput label="Password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 rounded border-line-strong accent-navy" />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold text-navy-700 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
      </form>
    </AuthLayout>
  )
}
