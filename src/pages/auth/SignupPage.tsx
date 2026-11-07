import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { TextInput } from '../../components/ui/Field'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { signup } from '../../store/actions'
import { isEmail } from '../../lib/utils'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function submit(e: FormEvent) {
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
    const res = signup(form)
    if (!res.ok) return setErrors({ form: res.error })
    navigate('/onboarding/account-type', { replace: true })
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
        <Button type="submit" size="lg" className="w-full">Create account</Button>
      </form>
    </AuthLayout>
  )
}
