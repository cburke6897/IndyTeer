import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/Field'
import { PasswordInput } from '../components/ui/PasswordInput'
import { supabase } from '../lib/supabase'
import { useAction } from './hooks'

export function AuthPage({ mode }: { mode: 'login' | 'signup' | 'forgot' | 'reset' }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const action = useAction()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [sent, setSent] = useState(false)
  const titles = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }
  if (auth.user && mode !== 'reset' && !sent) return <Navigate to="/app" replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = await action.run(async () => {
      if (mode === 'signup') {
        if (password !== confirmation) throw new Error('Passwords do not match.')
        const result = await auth.signUp(email, password, name)
        if (result.needsEmailConfirmation) setSent(true)
        else navigate('/app', { replace: true })
      } else if (mode === 'login') {
        await auth.signIn(email, password)
        const from = (location.state as { from?: unknown } | null)?.from
        const pathname = typeof from === 'string' ? from : '/app'
        navigate(pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/app', {
          replace: true,
        })
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/reset-password',
        })
        if (error) throw error
        setSent(true)
      } else {
        if (password !== confirmation) throw new Error('Passwords do not match.')
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        navigate('/app', { replace: true })
      }
    })
    return result
  }
  async function resend() {
    await action.run(async () => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
    }, 'Confirmation email requested. Check your inbox and spam folder.')
  }
  const callbackError = new URLSearchParams(location.search).get('error_description')
  return (
    <AuthLayout
      title={sent ? 'Check your email' : titles[mode]}
      subtitle={
        mode === 'signup'
          ? 'Start as yourself. Create or join organizations after signing in.'
          : 'Your community is waiting.'
      }
      footer={
        <>
          <Link to="/login" className="font-semibold text-navy-700">
            Log in
          </Link>
          <span className="px-2">·</span>
          <Link to="/signup" className="font-semibold text-navy-700">
            Create an account
          </Link>
          <span className="px-2">·</span>
          <Link to="/">Home</Link>
        </>
      }
    >
      {callbackError && (
        <p role="alert" className="mb-4 text-danger">
          {callbackError}
        </p>
      )}
      {sent ? (
        <div className="space-y-4">
          <p role="status" className="rounded-lg bg-gold-50 p-4 text-navy">
            {mode === 'signup'
              ? 'Check your email to confirm your account. Open the link in the same browser where you registered.'
              : 'If an account exists, a password reset email will arrive shortly.'}
          </p>
          {mode === 'signup' && (
            <Button disabled={action.busy} onClick={resend}>
              Resend confirmation
            </Button>
          )}
        </div>
      ) : mode === 'reset' && !auth.user && !auth.loading ? (
        <p>
          This link is unavailable or expired.{' '}
          <Link to="/forgot-password" className="underline">
            Request a new reset link.
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <TextInput
              label="Full name"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          {mode !== 'reset' && (
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          {mode !== 'forgot' && (
            <PasswordInput
              label="Password"
              minLength={mode === 'login' ? undefined : 8}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {(mode === 'signup' || mode === 'reset') && (
            <PasswordInput
              label="Confirm password"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
            />
          )}
          {mode === 'login' && (
            <Link className="block text-sm text-navy-700 underline" to="/forgot-password">
              Forgot password?
            </Link>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={action.busy || auth.loading}>
            {action.busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log in'
                : mode === 'signup'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Update password'}
          </Button>
        </form>
      )}
      {action.error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {action.error}
        </p>
      )}
    </AuthLayout>
  )
}
