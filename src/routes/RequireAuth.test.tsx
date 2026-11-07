import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: useAuthMock }))

import { RequireAuth } from './RequireAuth'

function LoginDestination() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
  return <p>login requested for {from}</p>
}

function renderPrivateRoute() {
  return render(
    <MemoryRouter initialEntries={['/private'] }>
      <Routes>
        <Route path="/login" element={<LoginDestination />} />
        <Route element={<RequireAuth />}>
          <Route path="/private" element={<p>private content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state until the saved session is checked', () => {
    useAuthMock.mockReturnValue({ loading: true, user: null })
    renderPrivateRoute()
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(screen.queryByText('private content')).not.toBeInTheDocument()
  })

  it('redirects signed-out visitors to login and remembers their route', () => {
    useAuthMock.mockReturnValue({ loading: false, user: null })
    renderPrivateRoute()
    expect(screen.getByText('login requested for /private')).toBeInTheDocument()
  })

  it('renders the protected route for signed-in users', () => {
    useAuthMock.mockReturnValue({ loading: false, user: { id: 'user-1' } })
    renderPrivateRoute()
    expect(screen.getByText('private content')).toBeInTheDocument()
  })
})
