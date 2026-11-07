import { db } from './client'
import type { UserSettings } from '../../types/models'

export async function getSettings(): Promise<UserSettings> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view your settings.')
  const { data, error } = await db.from('user_settings').select('*').eq('user_id', user.id).single()
  if (error) throw new Error(error.message)
  return data as UserSettings
}

export async function updateSettings(patch: Partial<Pick<UserSettings,
  'new_opportunity_notifications' | 'registration_notifications' | 'email_notifications' | 'opt_out_organization_invites'>>): Promise<UserSettings> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to update your settings.')
  const { data, error } = await db.from('user_settings').update(patch).eq('user_id', user.id).select().single()
  if (error) throw new Error(error.message)
  return data as UserSettings
}
