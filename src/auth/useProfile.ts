import { useCallback, useEffect, useState } from 'react'
import { getUser } from '../lib/api/users'
import { listMyMemberships } from '../lib/api/organizations'
import type { OrganizationMembership, User } from '../types/models'

type ProfileResult = {
  userId: string
  profile: User | null
  memberships: OrganizationMembership[]
  error: string | null
}

/**
 * Loads the signed-in user's public.users row and organization memberships. Both are readable
 * only by the user (RLS). `reloadKey` lets callers re-run the load (Retry, after creating an
 * organization) without changing the user.
 */
export function useProfile(userId: string | undefined, reloadKey = 0) {
  const [result, setResult] = useState<ProfileResult | null>(null)

  useEffect(() => {
    if (!userId) return
    let active = true
    void Promise.all([getUser(userId), listMyMemberships()]).then(([profile, memberships]) => {
      if (active) setResult({ userId, profile, memberships, error: null })
    }).catch((cause: unknown) => {
      if (active) setResult({
        userId,
        profile: null,
        memberships: [],
        error: cause instanceof Error ? cause.message : 'Could not load your profile.',
      })
    })
    return () => { active = false }
  }, [userId, reloadKey])

  const setProfile = useCallback((profile: User) => {
    if (!userId || profile.id !== userId) return
    setResult((previous) => previous?.userId === userId
      ? { ...previous, profile, error: null }
      : previous)
  }, [userId])

  const current = result?.userId === userId ? result : null
  return {
    profile: current?.profile ?? null,
    memberships: current?.memberships ?? [],
    error: current?.error ?? null,
    loading: Boolean(userId) && !current,
    setProfile,
  }
}
