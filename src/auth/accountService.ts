import { supabase } from '../lib/supabase'
import { updateProfile } from '../lib/api/profiles'
import type { Profile } from '../types/models'

/**
 * Account operations that sit next to authService.ts. Account type is chosen at signup and lives
 * in public.profiles (see the signup trigger); it is never changed from the client.
 */

/** Saves the display name to public.profiles.full_name and returns the updated row. */
export function saveFullName(first: string, last: string): Promise<Profile> {
  return updateProfile({ full_name: `${first.trim()} ${last.trim()}`.trim() })
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
