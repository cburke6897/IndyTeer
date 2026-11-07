import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signUpMock, signInMock, signOutMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInMock,
      signOut: signOutMock,
    },
  },
}))

import { signInWithEmail, signOut, signUpWithEmail } from './authService'

describe('email auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs up with normalized email, display name, and app redirect', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })

    const result = await signUpWithEmail(' volunteer@example.org ', 'good-password', ' Kai ')

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'volunteer@example.org',
      password: 'good-password',
      options: {
        data: { display_name: 'Kai' },
        emailRedirectTo: window.location.origin,
      },
    })
    expect(result.needsEmailConfirmation).toBe(true)
  })

  it('reports an immediate signup session when email confirmation is disabled', async () => {
    signUpMock.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    await expect(signUpWithEmail('kai@example.org', 'good-password', 'Kai'))
      .resolves.toEqual({ needsEmailConfirmation: false })
  })

  it('signs in and trims the email', async () => {
    signInMock.mockResolvedValue({ error: null })
    await signInWithEmail(' kai@example.org ', 'good-password')
    expect(signInMock).toHaveBeenCalledWith({ email: 'kai@example.org', password: 'good-password' })
  })

  it('returns Supabase auth errors to the form', async () => {
    const failure = new Error('Invalid login credentials')
    signInMock.mockResolvedValue({ error: failure })
    await expect(signInWithEmail('kai@example.org', 'wrong')).rejects.toBe(failure)
  })

  it('signs out the current user', async () => {
    signOutMock.mockResolvedValue({ error: null })
    await signOut()
    expect(signOutMock).toHaveBeenCalledOnce()
  })
})
