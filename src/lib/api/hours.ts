import { db } from './client'
import type { ManualHourEntry } from '../../types/models'

export async function listManualHours(): Promise<ManualHourEntry[]> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view your hours.')
  const { data, error } = await db.from('manual_hour_entries').select('*')
    .eq('user_id', user.id).order('entry_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ManualHourEntry[]
}

export async function listHours() {
  const { data, error } = await db.from('volunteer_hour_entries').select('*').order('entry_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function addManualHours(input: Pick<ManualHourEntry, 'org_name' | 'title' | 'entry_date' | 'hours' | 'notes'>): Promise<ManualHourEntry> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to add volunteer hours.')
  const { data, error } = await db.from('manual_hour_entries')
    .insert({ ...input, user_id: user.id }).select().single()
  if (error) throw new Error(error.message)
  return data as ManualHourEntry
}

export async function deleteManualHours(id: string): Promise<void> {
  const { error } = await db.from('manual_hour_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listVerifiedRegistrationHours() {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view your hours.')
  const { data, error } = await db.from('registrations')
    .select('id,hours,verified_at,opportunity:opportunities(title,event_date,organization:public_organizations(name))')
    .eq('user_id', user.id).eq('hours_verified', true).order('verified_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
