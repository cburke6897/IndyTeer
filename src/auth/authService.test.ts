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

  it('sends only the full name (and extras) to the trigger, never an account type', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })

    const result = await signUpWithEmail(' volunteer@example.org ', 'good-password', ' Kai ', {
      terms_accepted_at: 'now',
    })

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'volunteer@example.org',
      password: 'good-password',
      options: {
        data: { terms_accepted_at: 'now', full_name: 'Kai' },
        emailRedirectTo: window.location.origin,
      },
    })
    expect(JSON.stringify(signUpMock.mock.calls[0][0])).not.toContain('account_type')
    expect(result.needsEmailConfirmation).toBe(true)
  })

  it('does not let extra metadata override the name', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    await signUpWithEmail('kai@example.org', 'good-password', 'Kai', { full_name: 'Someone Else' })
    expect(signUpMock.mock.calls[0][0].options.data.full_name).toBe('Kai')
  })

  it('strips retired account types and authorization fields from signup metadata', async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null })
    await signUpWithEmail('kai@example.org', 'good-password', 'Kai', {
      account_type: 'organization',
      role: 'admin',
      is_platform_admin: 'true',
    })
    expect(signUpMock.mock.calls[0][0].options.data).toEqual({ full_name: 'Kai' })
  })

  it('reports an immediate signup session when email confirmation is disabled', async () => {
    signUpMock.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    await expect(signUpWithEmail('kai@example.org', 'good-password', 'Kai')).resolves.toEqual({
      needsEmailConfirmation: false,
    })
  })

  it('requires a name before calling Supabase', async () => {
    await expect(signUpWithEmail('kai@example.org', 'good-password', '  ')).rejects.toThrow(
      'Enter your full name',
    )
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
