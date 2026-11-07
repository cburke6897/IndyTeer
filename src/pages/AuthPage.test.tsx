import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock('../auth/useAuth', () => ({ useAuth: useAuthMock }))

import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  const signIn = vi.fn()
  const signUp = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ loading: false, user: null, signIn, signUp })
  })

  it('logs in and returns a volunteer to the protected page they requested', async () => {
    signIn.mockResolvedValue(undefined)
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/opportunities' } } }]}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/opportunities" element={<p>opportunities page</p>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kai@example.org' } })
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('kai@example.org', 'test-password'))
    expect(await screen.findByText('opportunities page')).toBeInTheDocument()
  })

  it.each(['volunteer', 'organization'])('submits the selected %s account type and waits for confirmation', async (accountType) => {
    signUp.mockResolvedValue({ needsEmailConfirmation: true })
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Routes><Route path="/signup" element={<AuthPage mode="signup" />} /></Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kai Volunteer' } })
    fireEvent.change(screen.getByLabelText('Account type'), { target: { value: accountType } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'kai@example.org' } })
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith('kai@example.org', 'test-password', 'Kai Volunteer', accountType))
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email to confirm your account')
  })
})
