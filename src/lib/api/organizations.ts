import { db } from './client'
import type { Organization, OrganizationMembership, OrganizationRole, PublicOrganization } from '../../types/models'

export type OrganizationFilters = { q?: string; city?: string; focus?: string }
export type NewOrganization = {
  name: string
  type?: string
  description: string
  mission?: string
  website?: string
  city?: string
  state?: string
  contact_email?: string
  phone?: string
  focus?: string[]
  founded_year?: number
  join_policy?: 'approval' | 'invite_only'
}

export async function listOrganizations(filters: OrganizationFilters = {}): Promise<PublicOrganization[]> {
  let query = db.from('public_organizations').select('*').order('name')
  if (filters.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters.city) query = query.eq('city', filters.city)
  if (filters.focus) query = query.contains('focus', [filters.focus])
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as PublicOrganization[]
}

export async function getOrganization(id: string): Promise<PublicOrganization> {
  const { data, error } = await db.from('public_organizations').select('*').eq('id', id).single()
  if (error) throw new Error('We could not find that organization.')
  return data as PublicOrganization
}

export async function createOrganization(input: NewOrganization): Promise<Organization> {
  const { data, error } = await db.rpc('create_organization', { p_data: input })
  if (error) throw new Error(error.message)
  return data as Organization
}

export async function updateOrganization(id: string, patch: Partial<NewOrganization>): Promise<Organization> {
  const { data, error } = await db.from('organizations').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Organization
}

export async function listMyMemberships(): Promise<OrganizationMembership[]> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view your organizations.')
  const { data, error } = await db.from('organization_memberships').select('*').eq('user_id', user.id)
  if (error) throw new Error(error.message)
  return data as OrganizationMembership[]
}

export async function listOrganizationMemberships(organizationId: string): Promise<OrganizationMembership[]> {
  const { data, error } = await db.from('organization_memberships').select('*').eq('organization_id', organizationId)
  if (error) throw new Error(error.message)
  return data as OrganizationMembership[]
}

export async function requestToJoinOrganization(organizationId: string): Promise<OrganizationMembership> {
  const { data, error } = await db.rpc('request_to_join_organization', { p_organization_id: organizationId })
  if (error) throw new Error(error.message)
  return data as OrganizationMembership
}

export async function inviteUserToOrganization(
  organizationId: string,
  userId: string,
  role: Exclude<OrganizationRole, 'owner'> = 'member',
): Promise<OrganizationMembership> {
  const { data, error } = await db.rpc('invite_user_to_organization', {
    p_organization_id: organizationId, p_user_id: userId, p_role: role,
  })
  if (error) throw new Error(error.message)
  return data as OrganizationMembership
}

export async function acceptOrganizationInvite(organizationId: string): Promise<OrganizationMembership> {
  const { data, error } = await db.rpc('accept_organization_invite', { p_organization_id: organizationId })
  if (error) throw new Error(error.message)
  return data as OrganizationMembership
}

export async function reviewMembershipRequest(organizationId: string, userId: string, approve: boolean) {
  const { data, error } = await db.rpc('review_membership_request', {
    p_organization_id: organizationId, p_user_id: userId, p_approve: approve,
  })
  if (error) throw new Error(error.message)
  return data as OrganizationMembership
}

export async function removeOrganizationMember(organizationId: string, userId: string): Promise<void> {
  const { error } = await db.rpc('remove_organization_member', {
    p_organization_id: organizationId, p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function setOrganizationMemberRole(organizationId: string, userId: string, role: 'admin' | 'member') {
  const { data, error } = await db.rpc('set_organization_member_role', {
    p_organization_id: organizationId, p_user_id: userId, p_role: role,
  })
  if (error) throw new Error(error.message)
  return data as OrganizationMembership
}

export async function setOrganizationVerified(organizationId: string, verified: boolean) {
  const { data, error } = await db.rpc('set_organization_verified', {
    p_organization_id: organizationId, p_verified: verified,
  })
  if (error) throw new Error(error.message)
  return data as Organization
}

export async function getOrganizationOverview(organizationId: string) {
  const { data, error } = await db.rpc('org_overview', { p_organization_id: organizationId })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}
