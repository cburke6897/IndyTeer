import { createContext, useContext } from 'react'
import type { User, OrganizationMembership, PublicOrganization } from '../types/models'
export type AccountData = {
  profile: User
  memberships: OrganizationMembership[]
  organizations: PublicOrganization[]
}
export type AccountState = {
  data: AccountData | null
  error: string | null
  loading: boolean
  refresh: () => void
}
export const AccountContext = createContext<AccountState | null>(null)
export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) throw new Error('AccountProvider is required.')
  return context
}
