import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'

/**
 * The signup form already requires the terms checkbox and records `terms_accepted_at` in the Auth
 * metadata. Accounts created another way (or before that) have no such record, so onboarding asks
 * once. The database still records the acceptance itself (complete_user_onboarding requires it).
 */
export function useTermsConsent() {
  const { user } = useAuth()
  const agreedAtSignup = typeof user?.user_metadata?.terms_accepted_at === 'string'
  const [checked, setChecked] = useState(false)
  return { needed: !agreedAtSignup, checked, setChecked, accepted: agreedAtSignup || checked }
}
