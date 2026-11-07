import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { TextInput } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { isEmail } from '../../lib/utils'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(email.trim())) return setError('Enter a valid email address.')
    setError('')
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send reset instructions."
      footer={<Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-navy-700 hover:underline"><ArrowLeft size={14} /> Back to log in</Link>}
    >
      {sent ? (
        <div className="rounded-lg border border-green-200 bg-success-50 p-5">
          <MailCheck className="text-success" size={22} />
          <p className="mt-2 text-sm font-semibold text-ink">Check your inbox</p>
          <p className="mt-1 text-sm text-muted">If an account exists for <strong>{email}</strong>, you’ll receive a reset link shortly. (Prototype: no email is actually sent.)</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <TextInput label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" size="lg" className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  )
}
