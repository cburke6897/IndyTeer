import { supabase } from '../lib/supabase'
import type { AccountType } from '../types'

/**
 * Account operations that sit next to authService.ts. The account type is kept in
 * Supabase Auth user_metadata until the profiles table gains account_type/onboarded
 * columns (see SUPABASE_CHANGES_NEEDED.txt). user_metadata is user-editable, so it is
 * only used for routing/UX here. Never use it to authorize anything.
 */

export async function saveAccountType(type: AccountType) {
  const { error } = await supabase.auth.updateUser({ data: { account_type: type } })
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/** Re-checks the current password before a sensitive change. */
export async function verifyPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Your current password is incorrect.')
}

export async function updateEmail(email: string) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: window.location.origin },
  )
  if (error) throw error
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}
