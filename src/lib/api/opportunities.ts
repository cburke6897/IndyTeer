import { db } from './client'
import type { Opportunity, OpportunityInsert, OpportunityStatus } from '../../types/models'
import type { Database } from '../../types/database'

const WITH_ORG = '*, organization:public_organizations!opportunities_organization_id_fkey(id, name, logo_path, verified, city, state)'

export type OpportunityFilters = {
  category?: string
  city?: string
  startDate?: string
  endDate?: string
  virtual?: boolean
  search?: string
  status?: OpportunityStatus
  page?: number
  pageSize?: number
  sort?: 'soonest' | 'newest'
}

export async function listOpportunities(filters: OpportunityFilters = {}) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30))
  let query = db.from('opportunities').select(WITH_ORG)
  if (filters.status) query = query.eq('status', filters.status)
  else query = query.eq('status', 'published')
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.city) query = query.eq('city', filters.city)
  if (filters.startDate) query = query.gte('event_date', filters.startDate)
  if (filters.endDate) query = query.lte('event_date', filters.endDate)
  if (filters.virtual !== undefined) query = query.eq('virtual', filters.virtual)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)
  query = filters.sort === 'newest'
    ? query.order('created_at', { ascending: false })
    : query.order('event_date', { ascending: true }).order('start_time', { ascending: true })
  const { data, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw new Error(error.message)
  return data as Array<Opportunity & { organization: Record<string, unknown> | null }>
}

export async function getOpportunity(id: string) {
  const { data, error } = await db.from('opportunities').select(WITH_ORG).eq('id', id).single()
  if (error) throw new Error('We could not find that opportunity.')
  return data as Opportunity & { organization: Record<string, unknown> | null }
}

export async function createOpportunity(input: OpportunityInsert): Promise<Opportunity> {
  // The before-insert database trigger derives these required columns from the local event fields.
  const row = input as Database['public']['Tables']['opportunities']['Insert']
  const { data, error } = await db.from('opportunities').insert(row).select().single()
  if (error) throw new Error(error.message)
  return data as Opportunity
}

export async function updateOpportunity(id: string, patch: Partial<OpportunityInsert>): Promise<Opportunity> {
  const { data, error } = await db.from('opportunities').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Opportunity
}

export async function publishOpportunity(id: string): Promise<Opportunity> {
  const { data, error } = await db.from('opportunities').update({ status: 'published' })
    .eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Opportunity
}

export async function deleteOpportunity(id: string): Promise<void> {
  const { error } = await db.from('opportunities').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listOpportunitiesByOrganization(organizationId: string): Promise<Opportunity[]> {
  const { data, error } = await db.from('opportunities').select('*')
    .eq('organization_id', organizationId).order('event_date', { ascending: true })
  if (error) throw new Error(error.message)
  return data as Opportunity[]
}

export async function getOpportunityAvailability(opportunityId: string): Promise<{ spots: number; spots_left: number }> {
  const { data, error } = await db.from('opportunity_availability')
    .select('spots,spots_left').eq('opportunity_id', opportunityId).single()
  if (error) throw new Error(error.message)
  return data as { spots: number; spots_left: number }
}
