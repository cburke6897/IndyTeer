import { createContext } from 'react'
import type { Profile } from '../types/models'

export type ProfileContextValue = {
  /** The signed-in user's row from public.profiles (id = auth user id). */
  profile: Profile | null
  loading: boolean
  /** Set when the row could not be loaded, e.g. the signup trigger/backfill has not created it. */
  error: string | null
  /** Updates the cached profile after a successful write (does not write to the database). */
  setProfile: (profile: Profile) => void
  retry: () => void
}

export const ProfileContext = createContext<ProfileContextValue | null>(null)
