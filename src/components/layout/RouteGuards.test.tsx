import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type SessionState = {
  user: null | { id: string; accountType: 'volunteer' | 'organization' | null; onboarded: boolean }
  loading: boolean
  profileError: string | null
}
const { state, retry } = vi.hoisted(() => ({
  state: { user: null, loading: false, profileError: null } as SessionState,
  retry: vi.fn(),
}))

vi.mock('../../store/session', () => ({
  useSession: () => ({ ...state, retryProfile: retry }),
}))
vi.mock('../../auth/useLogout', () => ({ useLogout: () => vi.fn() }))

import { PublicOnly, RequireOnboarding, RequireRole } from './RouteGuards'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicOnly />}><Route path="/login" element={<p>login page</p>} /></Route>
        <Route element={<RequireOnboarding />}><Route path="/onboarding/volunteer" element={<p>volunteer onboarding</p>} /></Route>
        <Route element={<RequireRole role="volunteer" />}><Route path="/app" element={<p>volunteer app</p>} /></Route>
        <Route element={<RequireRole role="organization" />}><Route path="/org" element={<p>org app</p>} /></Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('route guards use the real session', () => {
  beforeEach(() => {
    state.user = null
    state.loading = false
    state.profileError = null
    retry.mockClear()
  })

  it('waits for the session instead of redirecting while loading', () => {
    state.loading = true
    renderAt('/app')
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('sends signed-out visitors to /login', () => {
    renderAt('/app')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('shows a profile error (not the login page) for a signed-in user without a profile', () => {
    state.profileError = 'JSON object requested, multiple (or no) rows returned'
    renderAt('/app')
    expect(screen.getByRole('alert')).toHaveTextContent('multiple (or no) rows')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('routes a signed-in, not-yet-onboarded user to onboarding for their account type', () => {
    state.user = { id: 'u1', accountType: 'volunteer', onboarded: false }
    renderAt('/app')
    expect(screen.getByText('volunteer onboarding')).toBeInTheDocument()
  })

  it('keeps volunteers out of the organization area and bounces signed-in users off /login', () => {
    state.user = { id: 'u1', accountType: 'volunteer', onboarded: true }
    renderAt('/org')
    expect(screen.getByText('volunteer app')).toBeInTheDocument()
  })

  it('lets an onboarded user of the matching type through', () => {
    state.user = { id: 'u2', accountType: 'organization', onboarded: true }
    renderAt('/org')
    expect(screen.getByText('org app')).toBeInTheDocument()
  })
})
