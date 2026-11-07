import { db } from './client'
import type { User, UserUpdate } from '../../types/models'
import type { Json } from '../../types/database'

export async function getUser(id: string): Promise<User> {
  const { data, error } = await db.from('users').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as User
}

export async function updateUser(patch: UserUpdate): Promise<User> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to update your profile.')
  const { data, error } = await db.from('users').update(patch).eq('id', user.id).select().single()
  if (error) throw new Error(error.message)
  return data as User
}

export async function completeUserOnboarding(data: Record<string, unknown>): Promise<User> {
  const { data: result, error } = await db.rpc('complete_user_onboarding', { p_data: data as Json })
  if (error) throw new Error(error.message)
  return result as User
}

export async function getUserProfileForOrganization(userId: string) {
  const { data, error } = await db.rpc('get_user_profile_for_organization', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

export async function getVolunteerDashboard() {
  const { data, error } = await db.rpc('volunteer_dashboard')
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

export type PublicPerson = { id: string; full_name: string; city: string | null; state: string | null; avatar_path: string | null; headline: string | null }

/**
 * Finds people by name among profiles their owners have made visible (public_users). Private
 * profiles cannot be searched: the database offers no lookup by email or ID to organizations.
 */
export async function searchPublicPeople(query: string): Promise<PublicPerson[]> {
  const term = query.trim().replace(/[%_,()]/g, ' ').trim()
  if (term.length < 2) return []
  const { data, error } = await db.from('public_users').select('id,full_name,city,state,avatar_path,headline')
    .ilike('full_name', `%${term}%`).order('full_name').limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []).filter((p): p is PublicPerson => !!p.id && !!p.full_name)
}
