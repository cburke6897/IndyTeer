import { supabase } from '../lib/supabase'
import { updateUser } from '../lib/api/users'
import type { User } from '../types/models'

/**
 * Account operations that sit next to authService.ts. Account roles are never edited from here:
 * a user becomes an organization owner only through the create_organization RPC.
 */

/** Saves the display name to public.users and returns the updated row. */
export function saveFullName(first: string, last: string): Promise<User> {
  const firstName = first.trim()
  const lastName = last.trim()
  return updateUser({ first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() })
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
