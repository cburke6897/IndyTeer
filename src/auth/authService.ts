import { supabase } from '../lib/supabase'

/**
 * Signup metadata is input for the database trigger (public.handle_new_user), which creates the
 * public.users row from `full_name` / `avatar_url`. It must never carry an account type or any
 * other authorization data: Auth metadata is editable by the user, and account roles live in the
 * database (organization memberships), set only by supported RPCs.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  extraMetadata: Record<string, string> = {},
) {
  if (!displayName.trim()) throw new Error('Enter your full name.')
  const safeMetadata = Object.fromEntries(
    Object.entries(extraMetadata).filter(([key]) =>
      ['first_name', 'last_name', 'terms_accepted_at', 'avatar_url'].includes(key),
    ),
  )
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { ...safeMetadata, full_name: displayName.trim() },
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
