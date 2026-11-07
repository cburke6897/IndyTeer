import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Membership, OrgProfile } from '../../types'

const state = vi.hoisted(() => ({ memberships: [] as Membership[] }))
const calls = vi.hoisted(() => ({
  requestToJoin: vi.fn(), leaveOrCancelRequest: vi.fn(), respondToInvitation: vi.fn(), setActiveOrg: vi.fn(),
}))

vi.mock('../../store/session', () => ({
  useSession: () => ({ db: { memberships: state.memberships, organizations: [org()] }, user: { id: 'me' } }),
}))
vi.mock('../../store/actions', () => calls)
vi.mock('../../store/toast', () => ({ toast: vi.fn() }))

import { MembershipPanel, MyOrganizationsPanel } from './membership'

function org(over: Partial<OrgProfile> = {}): OrgProfile {
  return { id: 'o1', name: 'Helpers', logo: null, color: '#123', joinPolicy: 'approval', ...over } as OrgProfile
}
const m = (status: Membership['status'], role: Membership['role'] = 'member'): Membership[] => [{ orgId: 'o1', role, status }]
const renderPanel = (o = org()) => render(<MemoryRouter><MembershipPanel org={o} /></MemoryRouter>)

describe('MembershipPanel shows exactly what the backend says', () => {
  beforeEach(() => {
    Object.values(calls).forEach((f) => f.mockReset().mockResolvedValue(undefined))
    state.memberships = []
  })

  it('offers "Ask to join" to someone with no membership, and sends the request', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }))
    await waitFor(() => expect(calls.requestToJoin).toHaveBeenCalledWith('o1'))
  })

  it('explains an invitation-only organization instead of offering a request', () => {
    renderPanel(org({ joinPolicy: 'invite_only' }))
    expect(screen.getByText(/invitation only/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ask to join/ })).not.toBeInTheDocument()
  })

  it('shows a waiting request and lets the person cancel it', async () => {
    state.memberships = m('pending')
    renderPanel()
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel my request' }))
    await waitFor(() => expect(calls.leaveOrCancelRequest).toHaveBeenCalledWith('o1'))
  })

  it('shows a denied request and lets the person ask again', () => {
    state.memberships = m('rejected')
    renderPanel()
    expect(screen.getByText('Request not accepted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask to join again' })).toBeInTheDocument()
  })

  it('lets an invited person accept or decline', async () => {
    state.memberships = m('invited', 'admin')
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Decline invitation' }))
    await waitFor(() => expect(calls.respondToInvitation).toHaveBeenCalledWith('o1', false))
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))
    await waitFor(() => expect(calls.respondToInvitation).toHaveBeenCalledWith('o1', true))
  })

  it('makes a member confirm before leaving, and does nothing if they stay', async () => {
    state.memberships = m('active')
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Leave this organization' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('You will lose access')
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(calls.leaveOrCancelRequest).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Leave this organization' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }))
    await waitFor(() => expect(calls.leaveOrCancelRequest).toHaveBeenCalledWith('o1'))
  })

  it('never offers an owner a way to leave', () => {
    state.memberships = m('active', 'owner')
    renderPanel()
    expect(screen.getByText(/cannot leave while they are still the owner/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Leave/ })).not.toBeInTheDocument()
  })

  it('does not double-submit while a request is in flight', async () => {
    let release: () => void = () => undefined
    calls.requestToJoin.mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    renderPanel()
    const button = screen.getByRole('button', { name: 'Ask to join' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(calls.requestToJoin).toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(calls.requestToJoin).toHaveBeenCalledTimes(1))
  })
})

describe('MyOrganizationsPanel', () => {
  it('lists each relationship with its status and the right action', () => {
    state.memberships = [{ orgId: 'o1', role: 'member', status: 'invited' }]
    render(<MemoryRouter><MyOrganizationsPanel /></MemoryRouter>)
    expect(screen.getByText('Your organizations and requests')).toBeInTheDocument()
    expect(screen.getByText('Invitation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
  })

  it('renders nothing when the person has no connections', () => {
    state.memberships = []
    const { container } = render(<MemoryRouter><MyOrganizationsPanel /></MemoryRouter>)
    expect(container).toBeEmptyDOMElement()
  })
})
