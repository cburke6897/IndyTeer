import { db } from './client'
import type { User } from '../../types/models'

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
export type UploadedImage = { path: string; url: string }

export function validateImage(file: File): string {
  const extension = EXTENSIONS[file.type]
  if (!extension) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (file.size === 0) throw new Error('The selected image is empty.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 2 MB or smaller.')
  return extension
}


export function getPublicImageUrl(bucket: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
async function currentUser() {
  const {
    data: { user },
    error,
  } = await db.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Sign in before uploading an image.')
  return user
}
async function store(bucket: string, prefix: string, file: File): Promise<UploadedImage> {
  const path = prefix + '/' + crypto.randomUUID() + '.' + validateImage(file)
  const { error } = await db.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })
  if (error) throw error
  return { path, url: getPublicImageUrl(bucket, path) }
}
export async function discardUploadedImage(bucket: string, path: string) {
  const { error } = await db.storage.from(bucket).remove([path])
  if (error) console.warn('Image cleanup did not finish:', error.message)
}
const discard = discardUploadedImage
export async function uploadAvatar(file: File): Promise<UploadedImage> {
  validateImage(file)
  const user = await currentUser()
  const old = await db.from('users').select('avatar_path').eq('id', user.id).single()
  if (old.error) throw old.error
  const image = await store('avatars', user.id, file)
  const { error } = await db
    .from('users')
    .update({ avatar_path: image.path, avatar_url: image.url })
    .eq('id', user.id)
    .select('id')
    .single()
  if (error) {
    await discard('avatars', image.path)
    throw error
  }
  if (old.data.avatar_path?.startsWith(user.id + '/'))
    await discard('avatars', old.data.avatar_path)
  return image
}
export async function removeAvatar(): Promise<User> {
  const user = await currentUser()
  const old = await db.from('users').select('avatar_path').eq('id', user.id).single()
  if (old.error) throw old.error
  const { data, error } = await db
    .from('users')
    .update({ avatar_path: null, avatar_url: null })
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  if (old.data.avatar_path?.startsWith(user.id + '/'))
    await discard('avatars', old.data.avatar_path)
  return { ...data, availability: data.availability ?? {} }
}
export async function uploadOrganizationImage(
  organizationId: string,
  file: File,
  kind: 'logo' | 'cover',
): Promise<UploadedImage> {
  validateImage(file)
  const user = await currentUser()
  const bucket = kind === 'logo' ? 'org-logos' : 'org-covers'
  const column = kind === 'logo' ? 'logo_path' : 'cover_path'
  const old = await db
    .from('organizations')
    .select('logo_path,cover_path')
    .eq('id', organizationId)
    .single()
  if (old.error) throw old.error
  const image = await store(bucket, organizationId + '/' + user.id, file)
  const patch = kind === 'logo' ? { logo_path: image.path } : { cover_path: image.path }
  const { error } = await db
    .from('organizations')
    .update(patch)
    .eq('id', organizationId)
    .select('id')
    .single()
  if (error) {
    await discard(bucket, image.path)
    throw error
  }
  const previous = old.data[column]
  if (previous?.startsWith(organizationId + '/' + user.id + '/')) await discard(bucket, previous)
  return image
}
export async function uploadOpportunityImage(
  opportunityId: string,
  file: File,
): Promise<UploadedImage> {
  validateImage(file)
  const user = await currentUser()
  const old = await db.from('opportunities').select('image_path').eq('id', opportunityId).single()
  if (old.error) throw old.error
  const image = await store('opportunity-images', opportunityId + '/' + user.id, file)
  const { error } = await db
    .from('opportunities')
    .update({ image_path: image.path, image_url: image.url })
    .eq('id', opportunityId)
    .select('id')
    .single()
  if (error) {
    await discard('opportunity-images', image.path)
    throw error
  }
  if (old.data.image_path?.startsWith(opportunityId + '/' + user.id + '/'))
    await discard('opportunity-images', old.data.image_path)
  return image
}
export async function uploadOrganizationPostImage(
  organizationId: string,
  file: File,
): Promise<UploadedImage> {
  const user = await currentUser()
  return store('post-images', organizationId + '/' + user.id, file)
}
