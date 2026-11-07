import { useAuth } from '../auth/useAuth'
import { useProfileContext } from '../auth/useProfileContext'
import { uploadAvatar } from './avatarService'

/**
 * Returns an uploader for ImageUpload. uploadAvatar stores the file in Supabase Storage and saves
 * the URL to users.avatar_url; the returned row refreshes the cached profile and the URL is
 * handed back to the picker.
 */
export function useAvatarUpload() {
  const { user } = useAuth()
  const { setProfile } = useProfileContext()
  return async (file: File) => {
    if (!user) throw new Error('Sign in before uploading an avatar.')
    const { profile, publicUrl } = await uploadAvatar(file, user.id)
    setProfile(profile)
    return publicUrl
  }
}
