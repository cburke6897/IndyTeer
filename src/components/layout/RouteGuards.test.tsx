import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type SessionState = {
  user: null | { id: string; onboarded: boolean }
  activeOrg: null | { id: string }
  loading: boolean
  profileError: string | null
}
const { state, retry } = vi.hoisted(() => ({
  state: { user: null, activeOrg: null, loading: false, profileError: null } as SessionState,
  retry: vi.fn(),
}))

vi.mock('../../store/session', () => ({
  useSession: () => ({ ...state, retryProfile: retry }),
}))
vi.mock('../../auth/useLogout', () => ({ useLogout: () => vi.fn() }))

import { PublicOnly, RequireOnboarded, RequireOnboarding, RequireOrganization } from './RouteGuards'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicOnly />}><Route path="/login" element={<p>login page</p>} /></Route>
        <Route element={<RequireOnboarding />}><Route path="/onboarding" element={<p>onboarding</p>} /></Route>
        <Route element={<RequireOnboarded />}>
          <Route path="/app" element={<p>standard app</p>} />
          <Route path="/create-organization" element={<p>create organization</p>} />
        </Route>
        <Route element={<RequireOrganization />}><Route path="/org" element={<p>organization area</p>} /></Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('route guards follow the standard-user model', () => {
  beforeEach(() => {
    state.user = null
    state.activeOrg = null
    state.loading = false
    state.profileError = null
    retry.mockClear()
  })

  it('waits for the session instead of redirecting while loading', () => {
    state.loading = true
    renderAt('/app')
    expect(screen.getByRole('status')).toHaveTextContent('Loading your account')
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('sends signed-out visitors to /login', () => {
    renderAt('/app')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('shows a profile error (not the login page) for a signed-in user without a row', () => {
    state.profileError = 'JSON object requested, multiple (or no) rows returned'
    renderAt('/app')
    expect(screen.getByRole('alert')).toHaveTextContent('multiple (or no) rows')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('sends a signed-in user who has not finished onboarding to the single onboarding page', () => {
    state.user = { id: 'u1', onboarded: false }
    renderAt('/app')
    expect(screen.getByText('onboarding')).toBeInTheDocument()
  })

  it('puts an onboarded user with no organization in the standard app', () => {
    state.user = { id: 'u1', onboarded: true }
    renderAt('/app')
    expect(screen.getByText('standard app')).toBeInTheDocument()
  })

  it('lets an onboarded user open the create-organization page', () => {
    state.user = { id: 'u1', onboarded: true }
    renderAt('/create-organization')
    expect(screen.getByText('create organization')).toBeInTheDocument()
  })

  it('keeps users without a managed organization out of the organization area', () => {
    state.user = { id: 'u1', onboarded: true }
    renderAt('/org')
    expect(screen.getByText('standard app')).toBeInTheDocument()
  })

  it('opens the organization area only for a user with a managed organization', () => {
    state.user = { id: 'u1', onboarded: true }
    state.activeOrg = { id: 'o1' }
    renderAt('/org')
    expect(screen.getByText('organization area')).toBeInTheDocument()
  })

  it('does not let a not-yet-onboarded user create an organization', () => {
    state.user = { id: 'u1', onboarded: false }
    renderAt('/create-organization')
    expect(screen.getByText('onboarding')).toBeInTheDocument()
  })
})
