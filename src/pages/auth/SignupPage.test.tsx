import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A plain stub (not vi.fn) so a rejected promise is not tracked as an unhandled rejection by the spy.
const stub = vi.hoisted(() => ({
  calls: [] as unknown[][],
  impl: (): Promise<{ needsEmailConfirmation: boolean }> => Promise.resolve({ needsEmailConfirmation: false }),
}))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    signUp: (...args: unknown[]) => {
      stub.calls.push(args)
      return stub.impl()
    },
  }),
}))
vi.mock('../../auth/accountService', () => ({ resendConfirmation: vi.fn() }))

import SignupPage from './SignupPage'

function fillForm() {
  const type = (label: string, value: string, exact = false) =>
    fireEvent.change(screen.getByLabelText(label, { exact }), { target: { value } })
  type('First name', 'Kai')
  type('Last name', 'Rivera')
  type('Email', 'kai@example.org')
  type('Password', 'good-password', true)
  type('Confirm password', 'good-password')
  fireEvent.click(screen.getByRole('checkbox'))
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
const renderPage = () => render(<MemoryRouter><SignupPage /></MemoryRouter>)

describe('signup page', () => {
  beforeEach(() => {
    stub.calls.length = 0
    stub.impl = () => Promise.resolve({ needsEmailConfirmation: false })
  })

  it('requires an explicit account type before calling Supabase', async () => {
    renderPage()
    fillForm()
    submit()
    expect(await screen.findByText('Choose how you will use IndyTeer.')).toBeInTheDocument()
    expect(stub.calls).toHaveLength(0)
  })

  it('sends the chosen account type and full name to signUp', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: /An organization/ }))
    fillForm()
    submit()
    await waitFor(() => expect(stub.calls).toHaveLength(1))
    expect(stub.calls[0].slice(0, 4)).toEqual(['kai@example.org', 'good-password', 'Kai Rivera', 'organization'])
  })

  it('shows the check-your-email screen when confirmation is required', async () => {
    stub.impl = () => Promise.resolve({ needsEmailConfirmation: true })
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: /A volunteer/ }))
    fillForm()
    submit()
    expect(await screen.findByText(/We sent a confirmation link to kai@example.org/)).toBeInTheDocument()
  })

  it('shows a friendly message when the email is already registered', async () => {
    stub.impl = () => Promise.reject(new Error('User already registered'))
    renderPage()
    fireEvent.click(screen.getByRole('radio', { name: /A volunteer/ }))
    fillForm()
    submit()
    expect(await screen.findByText(/already exists/)).toBeInTheDocument()
  })
})
