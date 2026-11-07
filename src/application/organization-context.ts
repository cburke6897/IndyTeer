import { createContext, useContext } from 'react'
import type { Organization } from '../types/models'
export const OrganizationContext = createContext<{
  organization: Organization
  canManage: boolean
  isOwner: boolean
  refresh: () => void
} | null>(null)
export function useOrganization() {
  const value = useContext(OrganizationContext)
  if (!value) throw new Error('Organization workspace required.')
  return value
}
