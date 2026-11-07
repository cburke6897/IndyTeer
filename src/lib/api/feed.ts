import { db } from './client'

export type FeedFilters = {
  category?: string
  city?: string
  search?: string
  scope?: 'all' | 'organizations'
}

export async function getFeed(filters: FeedFilters = {}, limit = 30) {
  let opportunities = db
    .from('opportunities')
    .select(
      'id,title,description,category,city,event_date,start_time,timezone,created_at,image_path,image_url,organization_id,organization:public_organizations(id,name,logo_path,verified)',
    )
    .eq('status', 'published')
  let posts = db
    .from('posts')
    .select(
      'id,title,kind,body,created_at,image_path,image_url,organization_id,organization:public_organizations(id,name,logo_path,verified)',
    )
  if (filters.category) {
    opportunities = opportunities.eq('category', filters.category)
    posts = posts.eq('kind', 'update')
  }
  if (filters.city) opportunities = opportunities.eq('city', filters.city)
  if (filters.search) {
    opportunities = opportunities.ilike('title', `%${filters.search}%`)
    posts = posts.ilike('title', `%${filters.search}%`)
  }
  const [opportunityResult, postResult] = await Promise.all([
    opportunities.order('created_at', { ascending: false }).limit(limit),
    posts.order('created_at', { ascending: false }).limit(limit),
  ])
  if (opportunityResult.error) throw new Error(opportunityResult.error.message)
  if (postResult.error) throw new Error(postResult.error.message)
  const entries = [
    ...(opportunityResult.data ?? []).map((item) => ({
      ...item,
      feed_type: 'opportunity' as const,
    })),
    ...(postResult.data ?? []).map((item) => ({ ...item, feed_type: 'post' as const })),
  ]
  return entries.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit)
}
