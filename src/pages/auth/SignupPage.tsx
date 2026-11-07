import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, MailCheck } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { TextInput } from '../../components/ui/Field'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../auth/useAuth'
import { resendConfirmation } from '../../auth/accountService'
import { setRememberMe } from '../../auth/rememberMe'
import { toast } from '../../store/toast'
import { isEmail } from '../../lib/utils'

export default function SignupPage() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (!form.firstName.trim()) err.firstName = 'Required'
    if (!form.lastName.trim()) err.lastName = 'Required'
    if (!form.email.trim()) err.email = 'Enter your email address.'
    else if (!isEmail(form.email.trim())) err.email = 'That doesn’t look like a valid email address.'
    if (form.password.length < 8) err.password = 'Use at least 8 characters.'
    if (form.confirm !== form.password) err.confirm = 'Passwords don’t match.'
    if (!terms) err.terms = 'You need to accept the terms to continue.'
    setErrors(err)
    if (Object.keys(err).length) return

    setBusy(true)
    try {
      setRememberMe(true)
      const first = form.firstName.trim()
      const last = form.lastName.trim()
      const result = await signUp(form.email, form.password, `${first} ${last}`, {
        first_name: first,
        last_name: last,
        terms_accepted_at: new Date().toISOString(),
      })
      // With email confirmation off, a session exists and the route guard moves on to onboarding,
      // where the person chooses volunteer or organization (no account type is sent at signup).
      if (result.needsEmailConfirmation) setSentTo(form.email.trim())
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not create your account. Please try again.'
      setErrors({ form: /already registered|already been registered/i.test(message) ? 'An account with that email already exists. Try logging in instead.' : message })
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    if (!sentTo) return
    try {
      await resendConfirmation(sentTo)
      toast('Confirmation email sent again.')
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : 'Could not resend the email.', 'error')
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle="One more step before you set up your account.">
        <div className="rounded-lg border border-green-200 bg-success-50 p-5">
          <MailCheck className="text-success" size={24} />
          <p className="mt-3 text-sm font-semibold text-ink">We sent a confirmation link to {sentTo}</p>
          <p className="mt-1 text-sm text-muted">Open the link to confirm your address. You’ll be signed in and taken straight to account setup.</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={resend}>Resend email</Button>
          <Link to="/login" className="text-sm font-semibold text-navy-700 hover:underline">Back to log in</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join thousands of Hoosiers making their communities stronger."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-navy-700 hover:underline">Log in</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {errors.form && (
          <div role="alert" className="flex gap-2.5 rounded-md border border-red-200 bg-danger-50 p-3 text-sm text-danger">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
          <TextInput label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        </div>
        <TextInput label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} />
        <PasswordInput label="Password" autoComplete="new-password" hint="At least 8 characters." value={form.password} onChange={set('password')} error={errors.password} />
        <PasswordInput label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-4 rounded border-line-strong accent-navy" />
            <span>I agree to the <a href="#terms" onClick={(e) => e.preventDefault()} className="font-semibold text-navy-700 hover:underline">Terms of Service</a> and <a href="#privacy" onClick={(e) => e.preventDefault()} className="font-semibold text-navy-700 hover:underline">Privacy Policy</a>.</span>
          </label>
          {errors.terms && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{errors.terms}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
      </form>
    </AuthLayout>
  )
}
