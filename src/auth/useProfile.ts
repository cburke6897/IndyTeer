import { useCallback, useEffect, useState } from 'react'
import { getProfile } from '../lib/api/profiles'
import type { Profile } from '../types/models'

type ProfileResult = { userId: string; profile: Profile | null; error: string | null }

export function useProfile(userId: string | undefined) {
  const [result, setResult] = useState<ProfileResult | null>(null)

  useEffect(() => {
    if (!userId) return
    let active = true
    void getProfile(userId).then((profile) => {
      if (active) setResult({ userId, profile, error: null })
    }).catch((cause: unknown) => {
      if (active) setResult({
        userId,
        profile: null,
        error: cause instanceof Error ? cause.message : 'Could not load your profile.',
      })
    })
    return () => { active = false }
  }, [userId])

  const setProfile = useCallback((profile: Profile) => {
    if (profile.id !== userId) return
    setResult((previous) => previous?.userId === userId
      ? { userId, profile, error: null }
      : previous)
  }, [userId])

  const current = result?.userId === userId ? result : null
  return {
    profile: current?.profile ?? null,
    error: current?.error ?? null,
    loading: Boolean(userId) && !current,
    setProfile,
  }
}
