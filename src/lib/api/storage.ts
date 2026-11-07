import { db } from './client'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

function validateImage(file: File): string {
  const extension = EXTENSIONS[file.type]
  if (!extension) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 2 MB or smaller.')
  return extension
}

async function upload(bucket: string, path: string, file: File): Promise<string> {
  validateImage(file)
  const { error } = await db.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  return path
}

export function getPublicImageUrl(bucket: string, path: string): string {
  const { data } = db.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to upload an avatar.')
  const path = `${user.id}/${crypto.randomUUID()}.${validateImage(file)}`
  await upload('avatars', path, file)
  const { error } = await db.from('users').update({ avatar_path: path }).eq('id', user.id)
  if (error) throw new Error(error.message)
  return path
}

export async function uploadOrganizationImage(
  organizationId: string,
  file: File,
  kind: 'logo' | 'cover',
): Promise<string> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to upload an organization image.')
  const path = `${organizationId}/${user.id}/${crypto.randomUUID()}.${validateImage(file)}`
  const bucket = kind === 'logo' ? 'org-logos' : 'org-covers'
  await upload(bucket, path, file)
  const patch = kind === 'logo' ? { logo_path: path } : { cover_path: path }
  const { error } = await db.from('organizations').update(patch).eq('id', organizationId)
  if (error) throw new Error(error.message)
  return path
}

export async function uploadOpportunityImage(opportunityId: string, file: File): Promise<string> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to upload an opportunity image.')
  const path = `${opportunityId}/${user.id}/${crypto.randomUUID()}.${validateImage(file)}`
  await upload('opportunity-images', path, file)
  const { error } = await db.from('opportunities').update({ image_path: path }).eq('id', opportunityId)
  if (error) throw new Error(error.message)
  return path
}

export async function uploadOrganizationPostImage(organizationId: string, file: File): Promise<string> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to upload a post image.')
  const path = `${organizationId}/${user.id}/${crypto.randomUUID()}.${validateImage(file)}`
  await upload('post-images', path, file)
  return path
}
