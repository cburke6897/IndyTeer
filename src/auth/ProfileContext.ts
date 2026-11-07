import { createContext } from 'react'
import type { OrganizationMembership, User } from '../types/models'

export type ProfileContextValue = {
  /** The signed-in user's row from public.users (id = auth user id). */
  profile: User | null
  /** The user's own organization memberships (any status). Empty for a plain volunteer. */
  memberships: OrganizationMembership[]
  loading: boolean
  /** Set when the row could not be loaded, e.g. the signup trigger/backfill has not created it. */
  error: string | null
  /** Updates the cached profile after a successful write (does not write to the database). */
  setProfile: (profile: User) => void
  /** Reloads the profile and memberships (also used by the error screen's retry button). */
  retry: () => void
}

export const ProfileContext = createContext<ProfileContextValue | null>(null)
