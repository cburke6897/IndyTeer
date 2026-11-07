import { supabase } from '../lib/supabase'
import { updateUser } from '../lib/api/users'

export const AVATAR_BUCKET = 'avatars'
// Matches the bucket's file_size_limit (2 MiB) in supabase/config.toml and the storage migration.
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export async function uploadAvatar(file: File, userId: string) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    throw new Error('Choose a JPEG, PNG, or WebP image.')
  }
  if (file.size === 0) throw new Error('The selected image is empty.')
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error('Choose an image smaller than 2 MB.')
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Sign in before uploading an avatar.')
  if (authData.user.id !== userId) {
    throw new Error('You can only upload an avatar for your own profile.')
  }

  // A stable per-user object path means replacing an avatar does not leave
  // another public copy behind. The Storage RLS policy limits writes to this
  // user's folder, and the bucket independently enforces size and MIME type.
  const path = `${userId}/avatar`
  const bucket = supabase.storage.from(AVATAR_BUCKET)
  const { error: uploadError } = await bucket.upload(path, file, {
    cacheControl: '0',
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data } = bucket.getPublicUrl(path)
  const publicUrl = new URL(data.publicUrl)
  publicUrl.searchParams.set('v', String(Date.now()))
  const avatarUrl = publicUrl.toString()

  // The backend trigger creates users.id = auth.users.id. This API scopes the update to the
  // current Auth user and reports a missing row as an error. avatar_path is the Storage key, so
  // the object can be located (and removed) without parsing the public URL.
  const profile = await updateUser({ avatar_url: avatarUrl, avatar_path: path })

  return { path, publicUrl: avatarUrl, profile }
}
