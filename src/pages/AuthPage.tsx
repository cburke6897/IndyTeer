import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/layout/AuthLayout'

type AuthPageProps = { mode: 'login' | 'signup' }

function getSafeReturnPath(state: unknown) {
  if (!state || typeof state !== 'object' || !('from' in state)) return '/profile'
  const from = (state as { from?: { pathname?: unknown } }).from
  const pathname = from?.pathname
  return typeof pathname === 'string' && pathname.startsWith('/') && !pathname.startsWith('//')
    ? pathname
    : '/profile'
}

export function AuthPage({ mode }: AuthPageProps) {
  const isSignup = mode === 'signup'
  const { signIn, signUp, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && user) navigate('/profile', { replace: true })
  }, [loading, navigate, user])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (isSignup) {
        const result = await signUp(email, password, displayName)
        if (result.needsEmailConfirmation) {
          setMessage('Check your email to confirm your account, then come back to log in.')
        } else {
          navigate('/profile', { replace: true })
        }
      } else {
        await signIn(email, password)
        navigate(getSafeReturnPath(location.state), { replace: true })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={isSignup ? 'Join the community' : 'Welcome back'}
      subtitle={isSignup
            ? 'Create an account to find volunteer opportunities around Indianapolis.'
            : 'Sign in to continue to your volunteer profile.'}
    >

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label>
              Name
              <input
                autoComplete="name"
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          )}
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {isSignup && <span className="field-hint">Use at least 8 characters.</span>}
          </label>

          {error && <p className="notice error" role="alert">{error}</p>}
          {message && <p className="notice success" role="status">{message}</p>}

          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="switch-auth">
          {isSignup ? 'Already have an account?' : 'New to IndyTeer?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>
    </AuthLayout>
  )
}
