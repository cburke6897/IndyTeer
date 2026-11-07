import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { uploadAvatar } from '../media/avatarService'
import type { Profile } from '../types/models'

export function AvatarUploader({ profile, onUploaded }: {
  profile: Profile
  onUploaded: (profile: Profile) => void
}) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const savedAvatar = profile.avatar_url
  const displayName = profile.full_name || 'Your profile'

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setBusy(true)
    setError('')
    try {
      const result = await uploadAvatar(file, user.id)
      onUploaded(result.profile)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Avatar upload failed.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  return (
    <section className="avatar-panel" aria-labelledby="avatar-heading">
      <h2 id="avatar-heading">Profile photo</h2>
      <div className="avatar-row">
        {savedAvatar ? (
          <img className="avatar-image" src={savedAvatar} alt={`${displayName}'s avatar`} />
        ) : (
          <div className="avatar-placeholder" aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="muted">JPEG, PNG, or WebP. Maximum 5 MB.</p>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            onChange={handleChange}
            ref={inputRef}
            type="file"
          />
          <button
            className="secondary-button"
            disabled={busy || !user || profile.id !== user.id}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {busy ? 'Uploading…' : 'Upload photo'}
          </button>
        </div>
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
    </section>
  )
}
