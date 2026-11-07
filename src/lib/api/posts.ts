import { db } from './client'
import type { Post, PostKind } from '../../types/models'

export async function listPosts(limit = 30) {
  const { data, error } = await db.from('posts')
    .select('*, organization:public_organizations(id, name, logo_path, verified)')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data as Array<Post & { organization: Record<string, unknown> | null }>
}

export async function listPostsByOrganization(organizationId: string, limit = 30): Promise<Post[]> {
  const { data, error } = await db.from('posts').select('*').eq('organization_id', organizationId)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data as Post[]
}

export async function createOrganizationPost(
  organizationId: string,
  title: string,
  body: string,
  imageUrl?: string | null,
  kind: PostKind = 'update',
  imagePath?: string | null,
): Promise<Post> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to post an organization update.')
  const { data, error } = await db.from('posts').insert({
    author_user_id: user.id, organization_id: organizationId, title, body,
    image_url: imageUrl ?? null, image_path: imagePath ?? null, kind,
  }).select().single()
  if (error) throw new Error(error.message)
  return data as Post
}

export async function createAnnouncement(title: string, body: string): Promise<Post> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to post an announcement.')
  const { data, error } = await db.from('posts').insert({
    author_user_id: user.id, organization_id: null, title, body, kind: 'announcement',
  }).select().single()
  if (error) throw new Error(error.message)
  return data as Post
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await db.from('posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
