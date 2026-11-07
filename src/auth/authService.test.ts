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

  it.each(['volunteer', 'organization'] as const)('sends the required %s account type and full name to the trigger', async (accountType) => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })

    const result = await signUpWithEmail(' volunteer@example.org ', 'good-password', ' Kai ', accountType)

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'volunteer@example.org',
      password: 'good-password',
      options: {
        data: { full_name: 'Kai', account_type: accountType },
        emailRedirectTo: window.location.origin,
      },
    })
    expect(result.needsEmailConfirmation).toBe(true)
  })

  it('reports an immediate signup session when email confirmation is disabled', async () => {
    signUpMock.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    await expect(signUpWithEmail('kai@example.org', 'good-password', 'Kai', 'volunteer'))
      .resolves.toEqual({ needsEmailConfirmation: false })
  })

  it.each([undefined, '', 'admin'])('rejects an invalid account type (%s) before calling Supabase', async (value) => {
    await expect(signUpWithEmail('kai@example.org', 'good-password', 'Kai', value as 'volunteer'))
      .rejects.toThrow('Choose volunteer or organization')
    expect(signUpMock).not.toHaveBeenCalled()
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
