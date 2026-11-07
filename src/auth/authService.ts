import { supabase } from '../lib/supabase'
import type { AccountType } from '../types/models'

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  accountType: AccountType,
) {
  if (accountType !== 'volunteer' && accountType !== 'organization') {
    throw new Error('Choose volunteer or organization as your account type.')
  }
  if (!displayName.trim()) throw new Error('Enter your full name.')
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: displayName.trim(), account_type: accountType },
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) throw error
  return { needsEmailConfirmation: !data.session }
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
