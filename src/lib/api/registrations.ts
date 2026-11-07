import { db } from './client'
import type { Registration, RegistrationStatus } from '../../types/models'

export async function registerForOpportunity(opportunityId: string, message?: string | null): Promise<Registration> {
  const { data, error } = await db.rpc('register_for_opportunity', {
    p_opportunity_id: opportunityId, ...(message == null ? {} : { p_message: message }),
  })
  if (error) throw new Error(error.code === 'P0001' && error.message === 'SPOTS_FULL'
    ? 'Sorry, every spot is taken.' : error.message)
  return data as Registration
}

export async function cancelRegistration(registrationId: string): Promise<Registration> {
  const { data, error } = await db.rpc('cancel_registration', { p_registration_id: registrationId })
  if (error) throw new Error(error.message)
  return data as Registration
}

export async function listMyRegistrations() {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view your registrations.')
  const { data, error } = await db.from('registrations')
    .select('*, opportunity:opportunities(*, organization:public_organizations(id, name, logo_path, city, state))')
    .eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Array<Registration & { opportunity: Record<string, unknown> | null }>
}

export async function listOrganizationRegistrations(organizationId: string, status?: RegistrationStatus) {
  let query = db.from('registrations')
    .select('*, opportunity:opportunities!inner(id, organization_id, title, event_date, start_time, city)')
    .eq('opportunity.organization_id', organizationId)
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Array<Registration & { opportunity: Record<string, unknown> }>
}

export async function listApplicants(opportunityId: string) {
  const { data, error } = await db.from('registrations')
    .select('*, user:public_users!registrations_user_id_fkey(id, full_name, avatar_path, headline)')
    .eq('opportunity_id', opportunityId).order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data as Array<Registration & { user: Record<string, unknown> | null }>
}

export async function setRegistrationStatus(registrationId: string, status: 'approved' | 'declined' | 'removed') {
  const { data, error } = await db.rpc('set_registration_status', {
    p_registration_id: registrationId, p_status: status,
  })
  if (error) throw new Error(error.code === 'P0001' && error.message === 'SPOTS_FULL'
    ? 'Sorry, every spot is taken.' : error.message)
  return data as Registration
}

export async function setRegistrationAttended(registrationId: string, attended: boolean) {
  const { data, error } = await db.rpc('set_attended', {
    p_registration_id: registrationId, p_attended: attended,
  })
  if (error) throw new Error(error.message)
  return data as Registration
}

export async function verifyRegistrationHours(registrationId: string, hours: number) {
  const { data, error } = await db.rpc('verify_hours', { p_registration_id: registrationId, p_hours: hours })
  if (error) throw new Error(error.message)
  return data as Registration
}

export async function unverifyRegistrationHours(registrationId: string) {
  const { data, error } = await db.rpc('unverify_hours', { p_registration_id: registrationId })
  if (error) throw new Error(error.message)
  return data as Registration
}
