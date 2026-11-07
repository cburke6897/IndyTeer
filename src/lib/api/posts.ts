import { supabase } from '../supabase'
import type { Post, PostWithAuthor } from '../../types/models'

const WITH_AUTHOR = '*, author:profiles!posts_author_id_fkey(id, full_name, avatar_url, headline)'

export async function listPosts(limit = 30): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase.from('posts').select(WITH_AUTHOR)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data as unknown as PostWithAuthor[]
}

export async function listPostsByAuthor(authorId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase.from('posts').select(WITH_AUTHOR)
    .order('created_at', { ascending: false }).eq('author_id', authorId)
  if (error) throw new Error(error.message)
  return data as unknown as PostWithAuthor[]
}

export async function createPost(body: string, imageUrl?: string | null): Promise<Post> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to create a post.')

  const { data, error } = await supabase.from('posts')
    .insert({ author_id: user.id, body, image_url: imageUrl ?? null }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
