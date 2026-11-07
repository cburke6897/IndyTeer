import { useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { uploadAvatar } from '../media/avatarService'

export function AvatarUploader() {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const savedAvatar = typeof user?.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : null
  const displayName = typeof user?.user_metadata?.display_name === 'string'
    ? user.user_metadata.display_name
    : user?.email ?? 'Volunteer'

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setBusy(true)
    setError('')
    try {
      const result = await uploadAvatar(file, user.id)
      setPreview(result.publicUrl)
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
        {preview || savedAvatar ? (
          <img className="avatar-image" src={preview ?? savedAvatar ?? undefined} alt={`${displayName}'s avatar`} />
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
            disabled={busy}
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
