import { supabase } from '../supabase'
import type { Profile, ProfileUpdate } from '../../types/models'

export async function getProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateProfile(patch: ProfileUpdate): Promise<Profile> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to update your profile.')

  const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select().single()
  if (error) throw new Error(error.message)
  return data
}
