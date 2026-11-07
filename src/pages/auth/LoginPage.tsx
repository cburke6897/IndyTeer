import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, HeartHandshake } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { TextInput } from '../../components/ui/Field'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Button } from '../../components/ui/Button'
import { login, loginDemo } from '../../store/actions'
import { homePathFor } from '../../store/selectors'
import { DEMO_ORG_EMAIL, DEMO_PASSWORD, DEMO_VOLUNTEER_EMAIL } from '../../data/seed'
import { isEmail } from '../../lib/utils'
import type { AccountType } from '../../types'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Enter your email address.'
    else if (!isEmail(email.trim())) next.email = 'That doesn’t look like a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (Object.keys(next).length) return
    const res = login(email, password)
    if (!res.ok) return setErrors({ form: res.error })
    navigate(homePathFor(res.user), { replace: true })
  }

  function demo(type: AccountType) {
    const res = loginDemo(type)
    if (res.ok) navigate(homePathFor(res.user), { replace: true })
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
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{errors.form}</span>
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
        <Button type="submit" size="lg" className="w-full">Log in</Button>
      </form>

      <div className="mt-8 rounded-lg border border-gold-100 bg-gold-50/70 p-4">
        <p className="text-[13px] font-bold text-navy">Explore the demo</p>
        <p className="mt-0.5 text-xs text-muted">One click signs you in with seeded data. No backend required.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button onClick={() => demo('volunteer')} className="flex items-center gap-2.5 rounded-md border border-line-strong bg-white p-2.5 text-left transition-colors hover:border-navy-700">
            <span className="flex size-8 items-center justify-center rounded bg-navy-50 text-navy-700"><HeartHandshake size={17} /></span>
            <span><span className="block text-[13px] font-semibold text-navy">Volunteer</span><span className="block text-xs text-muted">Maya Thompson</span></span>
          </button>
          <button onClick={() => demo('organization')} className="flex items-center gap-2.5 rounded-md border border-line-strong bg-white p-2.5 text-left transition-colors hover:border-navy-700">
            <span className="flex size-8 items-center justify-center rounded bg-navy-50 text-navy-700"><Building2 size={17} /></span>
            <span><span className="block text-[13px] font-semibold text-navy">Organization</span><span className="block text-xs text-muted">Hoosier Harvest</span></span>
          </button>
        </div>
        <button
          className="mt-3 w-full text-left text-xs text-muted"
          onClick={() => { setEmail(DEMO_VOLUNTEER_EMAIL); setPassword(DEMO_PASSWORD); setErrors({}) }}
          title="Fill in the volunteer demo credentials"
        >
          <span className="font-semibold text-ink">Credentials:</span> {DEMO_VOLUNTEER_EMAIL} or {DEMO_ORG_EMAIL} · password <code className="rounded bg-white px-1 py-0.5 text-[11px]">{DEMO_PASSWORD}</code>
          <span className="ml-1 font-semibold text-navy-700">Fill in</span>
        </button>
      </div>
    </AuthLayout>
  )
}
