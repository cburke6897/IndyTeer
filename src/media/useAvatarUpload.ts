import { useAuth } from '../auth/useAuth'
import { uploadAvatar } from './avatarService'

/** Returns an uploader for ImageUpload: stores the file in Supabase Storage and resolves its public URL. */
export function useAvatarUpload() {
  const { user } = useAuth()
  return async (file: File) => {
    if (!user) throw new Error('Sign in before uploading an avatar.')
    const { publicUrl } = await uploadAvatar(file, user.id)
    return publicUrl
  }
}
