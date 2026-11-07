import { supabase } from '../supabase'
import type { Opportunity, OpportunityInsert, OpportunityWithOrg } from '../../types/models'

const WITH_ORG = '*, org:profiles!opportunities_org_id_fkey(id, full_name, avatar_url, headline)'

export type OpportunityFilters = { cause?: string; neighborhood?: string; search?: string }

export async function listOpportunities(filters: OpportunityFilters = {}): Promise<OpportunityWithOrg[]> {
  let query = supabase.from('opportunities').select(WITH_ORG)
    .eq('status', 'open')
    .order('starts_at', { ascending: true })
  if (filters.cause) query = query.eq('cause', filters.cause)
  if (filters.neighborhood) query = query.eq('neighborhood', filters.neighborhood)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as unknown as OpportunityWithOrg[]
}

export async function getOpportunity(id: string): Promise<OpportunityWithOrg> {
  const { data, error } = await supabase.from('opportunities').select(WITH_ORG).eq('id', id).single()
  if (error) throw new Error('We could not find that opportunity.')
  return data as unknown as OpportunityWithOrg
}

export async function createOpportunity(input: Omit<OpportunityInsert, 'org_id'>): Promise<Opportunity> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to post an opportunity.')

  const { data, error } = await supabase.from('opportunities')
    .insert({ ...input, org_id: user.id }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function listOpportunitiesByOrg(orgId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase.from('opportunities').select('*')
    .eq('org_id', orgId).order('starts_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}
