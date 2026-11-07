import { supabase } from '../supabase'
import type {
  Application,
  ApplicationStatus,
  ApplicationWithOpportunity,
  ApplicationWithVolunteer,
} from '../../types/models'

export async function applyToOpportunity(oppId: string, message?: string | null): Promise<Application> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to apply for an opportunity.')

  const { data, error } = await supabase.from('applications')
    .insert({ opportunity_id: oppId, volunteer_id: user.id, message: message ?? null })
    .select().single()
  if (error?.code === '23505') throw new Error('You already applied.')
  if (error) throw new Error(error.message)
  return data
}

export async function listMyApplications(): Promise<ApplicationWithOpportunity[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view your applications.')

  const { data, error } = await supabase.from('applications')
    .select('*, opportunity:opportunities(id, title, starts_at, neighborhood, org:profiles!opportunities_org_id_fkey(id, full_name))')
    .eq('volunteer_id', user.id)
  if (error) throw new Error(error.message)
  return data as unknown as ApplicationWithOpportunity[]
}

export async function listApplicants(oppId: string): Promise<ApplicationWithVolunteer[]> {
  const { data, error } = await supabase.from('applications')
    .select('*, volunteer:profiles!applications_volunteer_id_fkey(id, full_name, avatar_url, headline)')
    .eq('opportunity_id', oppId)
  if (error) throw new Error(error.message)
  return data as unknown as ApplicationWithVolunteer[]
}

export async function setApplicationStatus(id: string, status: ApplicationStatus): Promise<Application> {
  const { data, error } = await supabase.from('applications').update({ status }).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function withdrawApplication(id: string): Promise<void> {
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
