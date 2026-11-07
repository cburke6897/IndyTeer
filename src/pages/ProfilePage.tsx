import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AvatarUploader } from './AvatarUploader'
import { Logo } from '../components/ui/Logo'

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const name = typeof user?.user_metadata?.display_name === 'string'
    ? user.user_metadata.display_name
    : 'Volunteer'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="profile-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="IndyTeer home"><Logo /></Link>
        <button className="text-button" onClick={handleSignOut} type="button">Log out</button>
      </header>
      <section className="profile-card">
        <p className="eyebrow">Your account</p>
        <h1>Hi, {name}</h1>
        <p className="muted">{user?.email}</p>
        <AvatarUploader />
        <p className="profile-note">Your account is ready. The opportunities and registrations pages can be connected here.</p>
      </section>
    </main>
  )
}
