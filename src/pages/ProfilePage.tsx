import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AvatarUploader } from './AvatarUploader'
import { Logo } from '../components/ui/Logo'
import { useProfile } from '../auth/useProfile'

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { profile, loading, error, setProfile } = useProfile(user?.id)

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
        <h1>{profile ? `Hi, ${profile.full_name || 'there'}` : 'Your profile'}</h1>
        <p className="muted">{user?.email}</p>
        {loading && <p role="status">Loading your profile…</p>}
        {error && <p className="notice error" role="alert">Could not load your profile: {error}</p>}
        {profile && <AvatarUploader key={profile.id} profile={profile} onUploaded={setProfile} />}
        <p className="profile-note">Your account is ready. The opportunities and registrations pages can be connected here.</p>
      </section>
    </main>
  )
}
