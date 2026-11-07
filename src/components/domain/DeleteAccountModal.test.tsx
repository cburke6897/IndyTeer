import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Org = {
  id: string; name: string; otherOwners: number; otherActiveMembers: number; transferAvailable: boolean
  eligible: { userId: string; name: string; role: 'admin' | 'member' }[]
}
const stub = vi.hoisted(() => ({
  impact: { owned: [] as unknown[], memberOfCount: 0 },
  loadError: null as string | null,
  deleteCalls: [] as unknown[],
  transferCalls: [] as unknown[],
  deleteImpl: (): Promise<void> => Promise.resolve(),
  transferImpl: (): Promise<void> => Promise.resolve(),
}))

vi.mock('../../account/deleteAccountService', async () => {
  class DeleteAccountError extends Error {
    kind: string
    code: string | null
    organizations: unknown[]
    constructor(message: string, kind: string, code: string | null = null, organizations: unknown[] = []) {
      super(message); this.kind = kind; this.code = code; this.organizations = organizations
    }
  }
  return {
    DeleteAccountError,
    getDeletionImpact: () => (stub.loadError ? Promise.reject(new Error(stub.loadError)) : Promise.resolve(stub.impact)),
    deleteAccount: (opts: unknown) => { stub.deleteCalls.push(opts); return stub.deleteImpl() },
    transferOwnership: (...args: unknown[]) => { stub.transferCalls.push(args); return stub.transferImpl() },
  }
})
const clearLocal = vi.hoisted(() => vi.fn())
vi.mock('../../store/actions', () => ({ deleteAccount: clearLocal }))
vi.mock('../../store/toast', () => ({ toast: vi.fn() }))

import { DeleteAccountModal } from './DeleteAccountModal'
import { DeleteAccountError } from '../../account/deleteAccountService'

const org = (over: Partial<Org> = {}): Org => ({
  id: 'o1', name: 'Solo Org', otherOwners: 0, otherActiveMembers: 0, transferAvailable: true, eligible: [], ...over,
})
const renderModal = () => render(<MemoryRouter><DeleteAccountModal userId="me" onClose={vi.fn()} /></MemoryRouter>)
const deleteButton = () => screen.getByRole('button', { name: /Permanently delete my account/ })
const typeDelete = () => fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } })

describe('delete account modal', () => {
  beforeEach(() => {
    stub.impact = { owned: [], memberOfCount: 0 }
    stub.loadError = null
    stub.deleteCalls.length = 0
    stub.transferCalls.length = 0
    stub.deleteImpl = () => Promise.resolve()
    stub.transferImpl = () => Promise.resolve()
    clearLocal.mockClear()
  })

  it('explains the consequences and needs the typed confirmation', async () => {
    renderModal()
    expect(await screen.findByText(/can’t be undone/)).toBeInTheDocument()
    expect(deleteButton()).toBeDisabled()
    typeDelete()
    expect(deleteButton()).toBeEnabled()
  })

  it('deletes a user with no organizations, sending no organization ids, then clears local data', async () => {
    renderModal()
    await screen.findByText(/can’t be undone/)
    typeDelete()
    fireEvent.click(deleteButton())
    await waitFor(() => expect(clearLocal).toHaveBeenCalledWith('me'))
    expect(stub.deleteCalls).toEqual([{ deleteOrganizationIds: [] }])
    expect(stub.transferCalls).toHaveLength(0)
  })

  it('requires an explicit choice for each organization the user solely owns', async () => {
    stub.impact = { owned: [org()], memberOfCount: 0 }
    renderModal()
    await screen.findByText('You own Solo Org')
    typeDelete()
    expect(deleteButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /Delete Solo Org/ }))
    expect(deleteButton()).toBeEnabled()
    fireEvent.click(deleteButton())
    await waitFor(() => expect(stub.deleteCalls).toEqual([{ deleteOrganizationIds: ['o1'] }]))
  })

  it('transfers ownership first, then deletes the account without deleting that organization', async () => {
    stub.impact = { owned: [org({ id: 'o2', name: 'Shared Org', otherActiveMembers: 2, eligible: [{ userId: 'z', name: 'Zed', role: 'admin' }, { userId: 'w', name: 'Wes', role: 'member' }] })], memberOfCount: 0 }
    renderModal()
    await screen.findByText('You own Shared Org')
    typeDelete()
    fireEvent.click(screen.getByRole('radio', { name: /Transfer ownership/ }))
    expect(deleteButton()).toBeDisabled() // a new owner must be chosen
    fireEvent.change(screen.getByLabelText('New owner of Shared Org'), { target: { value: 'z' } })
    expect(deleteButton()).toBeEnabled()
    fireEvent.click(deleteButton())
    await waitFor(() => expect(clearLocal).toHaveBeenCalledWith('me'))
    expect(stub.transferCalls).toEqual([['o2', 'z']])
    expect(stub.deleteCalls).toEqual([{ deleteOrganizationIds: [] }])
  })

  it('lets the user delete a shared organization too, naming how many people it affects', async () => {
    stub.impact = { owned: [org({ id: 'o2', name: 'Shared Org', otherActiveMembers: 3, eligible: [{ userId: 'z', name: 'Zed', role: 'admin' }] })], memberOfCount: 0 }
    renderModal()
    await screen.findByText('You own Shared Org')
    expect(screen.getByText(/for 3 other members too/)).toBeInTheDocument()
    typeDelete()
    fireEvent.click(screen.getByRole('radio', { name: /Delete Shared Org/ }))
    fireEvent.click(deleteButton())
    await waitFor(() => expect(stub.deleteCalls).toEqual([{ deleteOrganizationIds: ['o2'] }]))
    expect(stub.transferCalls).toHaveLength(0)
  })

  it('does not delete the account if the transfer fails', async () => {
    stub.transferImpl = () => Promise.reject(new Error('The new owner must be an active member of the organization.'))
    stub.impact = { owned: [org({ id: 'o2', name: 'Shared Org', otherActiveMembers: 1, eligible: [{ userId: 'z', name: 'Zed', role: 'member' }] })], memberOfCount: 0 }
    renderModal()
    await screen.findByText('You own Shared Org')
    typeDelete()
    fireEvent.click(screen.getByRole('radio', { name: /Transfer ownership/ }))
    fireEvent.change(screen.getByLabelText('New owner of Shared Org'), { target: { value: 'z' } })
    fireEvent.click(deleteButton())
    expect(await screen.findByText(/Could not transfer Shared Org/)).toBeInTheDocument()
    expect(stub.deleteCalls).toHaveLength(0)
    expect(clearLocal).not.toHaveBeenCalled()
  })

  it('offers only deletion when the server cannot transfer ownership yet', async () => {
    stub.impact = { owned: [org({ otherActiveMembers: 2, transferAvailable: false })], memberOfCount: 0 }
    renderModal()
    await screen.findByText('You own Solo Org')
    expect(screen.queryByRole('radio', { name: /Transfer ownership/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Ownership transfer isn’t available on this server yet/)).toBeInTheDocument()
  })

  it('needs no decision for an organization that has another owner', async () => {
    stub.impact = { owned: [org({ otherOwners: 1 })], memberOfCount: 0 }
    renderModal()
    await screen.findByText(/will keep going without you/)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    typeDelete()
    expect(deleteButton()).toBeEnabled()
  })

  it('pauses deletion when it cannot check what the account owns', async () => {
    stub.loadError = 'permission denied'
    renderModal()
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
    expect(deleteButton()).toBeDisabled()
  })

  it('shows an incomplete deletion as a failure and does not clear local data', async () => {
    stub.deleteImpl = () => Promise.reject(new DeleteAccountError('Your account deletion did not finish.', 'incomplete'))
    renderModal()
    await screen.findByText(/can’t be undone/)
    typeDelete()
    fireEvent.click(deleteButton())
    expect(await screen.findByText('Deletion did not finish')).toBeInTheDocument()
    expect(clearLocal).not.toHaveBeenCalled()
  })
})
