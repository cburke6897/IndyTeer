import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ auth: {} })),
}))

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

describe('Supabase browser client configuration', () => {
  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockClear()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project-ref.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('persists sessions and refreshes access tokens in the browser', async () => {
    await import('./supabase')

    expect(createClientMock).toHaveBeenCalledWith(
      'https://project-ref.supabase.co',
      'sb_publishable_test',
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          persistSession: true,
        },
      },
    )
  })

  it('reports missing configuration instead of creating an unusable client', async () => {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    await expect(import('./supabase')).rejects.toThrow('VITE_SUPABASE_PUBLISHABLE_KEY')
    expect(createClientMock).not.toHaveBeenCalled()
  })
})
