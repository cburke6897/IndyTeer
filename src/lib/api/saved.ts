import { db } from './client'

export async function saveOpportunity(opportunityId: string): Promise<void> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to save opportunities.')
  const { error } = await db.from('saved_opportunities').insert({ user_id: user.id, opportunity_id: opportunityId })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function unsaveOpportunity(opportunityId: string): Promise<void> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to manage saved opportunities.')
  const { error } = await db.from('saved_opportunities').delete()
    .eq('user_id', user.id).eq('opportunity_id', opportunityId)
  if (error) throw new Error(error.message)
}

export async function listSavedOpportunities() {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view saved opportunities.')
  const { data, error } = await db.from('saved_opportunities')
    .select('created_at, opportunity:opportunities(*, organization:public_organizations(id,name,logo_path,verified))')
    .eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
