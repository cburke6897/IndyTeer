import { act, render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionMock, onAuthStateChangeMock, unsubscribeMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}))

import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function Probe() {
  const { user, loading } = useAuth()
  return <p>{loading ? 'loading' : user?.email ?? 'signed out'}</p>
}

describe('AuthProvider session state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates a saved session and follows auth state events', async () => {
    const savedSession = {
      user: { email: 'kai@example.org' },
    } as unknown as Session
    let notifyAuthChange: ((_event: string, session: Session | null) => void) | undefined
    getSessionMock.mockResolvedValue({ data: { session: savedSession } })
    onAuthStateChangeMock.mockImplementation((callback) => {
      notifyAuthChange = callback
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    })

    render(<AuthProvider><Probe /></AuthProvider>)

    expect(await screen.findByText('kai@example.org')).toBeInTheDocument()
    act(() => notifyAuthChange?.('SIGNED_OUT', null))
    expect(screen.getByText('signed out')).toBeInTheDocument()
  })

  it('does not let a late initial read overwrite a newer sign-out event', async () => {
    let resolveSession: ((value: { data: { session: Session } }) => void) | undefined
    let notifyAuthChange: ((_event: string, session: Session | null) => void) | undefined
    const staleSession = { user: { email: 'stale@example.org' } } as unknown as Session
    getSessionMock.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))
    onAuthStateChangeMock.mockImplementation((callback) => {
      notifyAuthChange = callback
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    })

    render(<AuthProvider><Probe /></AuthProvider>)
    act(() => notifyAuthChange?.('SIGNED_OUT', null))
    await act(async () => resolveSession?.({ data: { session: staleSession } }))

    expect(screen.getByText('signed out')).toBeInTheDocument()
    expect(screen.queryByText('stale@example.org')).not.toBeInTheDocument()
  })
})
