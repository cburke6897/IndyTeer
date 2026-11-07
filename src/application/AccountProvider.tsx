import { useCallback, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { getUser } from '../lib/api/users'
import { listMyMemberships } from '../lib/api/organizations'
import { db } from '../lib/api/client'
import { useResource } from './hooks'
import { AccountContext, type AccountData } from './context'
import type { PublicOrganization } from '../types/models'

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const query = useResource(
    useCallback(async (): Promise<AccountData> => {
      if (!user) throw new Error('Sign in to continue.')
      const [profile, memberships] = await Promise.all([getUser(user.id), listMyMemberships()])
      const ids = memberships.map((m) => m.organization_id)
      const organizations: PublicOrganization[] = []
      if (ids.length) {
        const { data, error } = await db.from('public_organizations').select('*').in('id', ids)
        if (error) throw new Error(error.message)
        organizations.push(...(data as PublicOrganization[]))
      }
      return { profile, memberships, organizations }
    }, [user]),
  )
  return <AccountContext.Provider value={query}>{children}</AccountContext.Provider>
}
