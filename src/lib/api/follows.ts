import { db } from './client'

export async function followOrganization(organizationId: string): Promise<void> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to follow an organization.')
  const { error } = await db.from('organization_follows').insert({ user_id: user.id, organization_id: organizationId })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function unfollowOrganization(organizationId: string): Promise<void> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to follow organizations.')
  const { error } = await db.from('organization_follows').delete()
    .eq('user_id', user.id).eq('organization_id', organizationId)
  if (error) throw new Error(error.message)
}

export async function listFollowedOrganizations() {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view followed organizations.')
  const { data, error } = await db.from('organization_follows')
    .select('created_at, organization:public_organizations(id,name,logo_path,verified,city,state)')
    .eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
