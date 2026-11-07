import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/ui/Logo'

export function HomePage() {
  const { user, loading } = useAuth()

  return (
    <main className="home-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="IndyTeer home"><Logo /></Link>
        {!loading && (
          <Link className="text-button" to={user ? '/profile' : '/login'}>
            {user ? 'My profile' : 'Log in'}
          </Link>
        )}
      </header>
      <section className="home-hero">
        <p className="eyebrow">VolunteerConnect · Indianapolis</p>
        <h1>Find your way to <span>give back.</span></h1>
        <p className="muted">Connect with local causes and make a difference in your community.</p>
        <div className="hero-actions">
          <Link className="primary-button link-button" to={user ? '/profile' : '/signup'}>
            {user ? 'Go to your profile' : 'Get started'}
          </Link>
          {!user && <Link className="secondary-link" to="/login">I already have an account</Link>}
        </div>
      </section>
    </main>
  )
}
