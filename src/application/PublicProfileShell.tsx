import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/ui/Logo'
import { LinkButton } from '../components/ui/Button'

export function PublicProfileShell({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-line bg-white px-6 py-5">
        <Link to="/">
          <Logo />
        </Link>
        <LinkButton to={user ? '/app' : '/login'} variant="secondary">
          {user ? 'My workspace' : 'Log in'}
        </LinkButton>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10">{children}</main>
    </div>
  )
}
