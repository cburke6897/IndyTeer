import { db } from './client'

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut(): Promise<void> {
  const { error } = await db.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getSession() {
  const { data, error } = await db.auth.getSession()
  if (error) throw new Error(error.message)
  return data.session
}

export function onAuthStateChange(callback: Parameters<typeof db.auth.onAuthStateChange>[0]) {
  return db.auth.onAuthStateChange(callback)
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await db.auth.resetPasswordForEmail(email)
  if (error) throw new Error(error.message)
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await db.auth.updateUser({ password })
  if (error) throw new Error(error.message)
}

export async function updateEmail(email: string): Promise<void> {
  const { error } = await db.auth.updateUser({ email })
  if (error) throw new Error(error.message)
}

export async function deleteAccount(): Promise<void> {
  const { error } = await db.functions.invoke('delete-account', { method: 'POST' })
  if (error) throw new Error(error.message)
}
