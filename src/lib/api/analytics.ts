import { db } from './client'

export async function getOrgAnalytics(organizationId: string) {
  const { data, error } = await db.rpc('org_analytics', { p_organization_id: organizationId })
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

export async function listOrgVolunteers(organizationId: string, q?: string, sort: 'recent' | 'hours' | 'name' = 'recent') {
  const { data, error } = await db.rpc('org_volunteers', {
    p_organization_id: organizationId, ...(q ? { p_q: q } : {}), p_sort: sort,
  })
  if (error) throw new Error(error.message)
  return data as Array<Record<string, unknown>>
}
