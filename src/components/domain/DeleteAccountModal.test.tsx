import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stub = vi.hoisted(() => ({
  impact: {
    owned: [] as { id: string; name: string; otherActiveMembers: number }[],
    memberOfCount: 0,
  },
  loadError: null as string | null,
  deleteCalls: [] as unknown[],
  deleteImpl: (): Promise<void> => Promise.resolve(),
}))

vi.mock('../../account/deleteAccountService', async () => {
  class DeleteAccountError extends Error {
    kind: string
    code: string | null
    organizations: unknown[]
    constructor(
      message: string,
      kind: string,
      code: string | null = null,
      organizations: unknown[] = [],
    ) {
      super(message)
      this.kind = kind
      this.code = code
      this.organizations = organizations
    }
  }
  return {
    DeleteAccountError,
    getDeletionImpact: () =>
      stub.loadError ? Promise.reject(new Error(stub.loadError)) : Promise.resolve(stub.impact),
    deleteAccount: (opts: unknown) => {
      stub.deleteCalls.push(opts)
      return stub.deleteImpl()
    },
  }
})
vi.mock('../../store/toast', () => ({ toast: vi.fn() }))

import { DeleteAccountModal } from './DeleteAccountModal'
import { DeleteAccountError } from '../../account/deleteAccountService'

const renderModal = () =>
  render(
    <MemoryRouter>
      <DeleteAccountModal userId="me" onClose={vi.fn()} />
    </MemoryRouter>,
  )
const deleteButton = () => screen.getByRole('button', { name: /Permanently delete my account/ })
const typeDelete = () =>
  fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } })

describe('delete account modal', () => {
  beforeEach(() => {
    stub.impact = { owned: [], memberOfCount: 0 }
    stub.loadError = null
    stub.deleteCalls.length = 0
    stub.deleteImpl = () => Promise.resolve()
  })

  it('explains the consequences and needs the typed confirmation', async () => {
    renderModal()
    expect(await screen.findByText(/can’t be undone/)).toBeInTheDocument()
    expect(deleteButton()).toBeDisabled()
    typeDelete()
    expect(deleteButton()).toBeEnabled()
  })

  it('deletes a plain account without organization deletion, then clears local data', async () => {
    renderModal()
    await screen.findByText(/can’t be undone/)
    typeDelete()
    fireEvent.click(deleteButton())
    await waitFor(() => expect(stub.deleteCalls).toEqual([{ deleteOwnedOrganizations: false }]))
    expect(stub.deleteCalls).toEqual([{ deleteOwnedOrganizations: false }])
  })

  it('requires an explicit choice for each sole-owned organization', async () => {
    stub.impact = {
      owned: [{ id: 'o1', name: 'Solo Org', otherActiveMembers: 0 }],
      memberOfCount: 0,
    }
    renderModal()
    await screen.findByText('Organizations you own')
    typeDelete()
    expect(deleteButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(deleteButton()).toBeEnabled()
    fireEvent.click(deleteButton())
    await waitFor(() => expect(stub.deleteCalls).toEqual([{ deleteOwnedOrganizations: true }]))
  })

  it('blocks the whole flow when an owned organization has other active members', async () => {
    stub.impact = {
      owned: [{ id: 'o2', name: 'Shared Org', otherActiveMembers: 3 }],
      memberOfCount: 0,
    }
    renderModal()
    expect(await screen.findByText('Deletion is blocked')).toBeInTheDocument()
    expect(screen.getByText(/3 other active members/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(deleteButton()).toBeDisabled()
    expect(stub.deleteCalls).toHaveLength(0)
  })

  it('pauses deletion when it cannot check what the account owns', async () => {
    stub.loadError = 'permission denied'
    renderModal()
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
    expect(deleteButton()).toBeDisabled()
  })

  it('shows an incomplete deletion as a failure and does not clear local data or navigate away', async () => {
    stub.deleteImpl = () =>
      Promise.reject(new DeleteAccountError('Your account deletion did not finish.', 'incomplete'))
    renderModal()
    await screen.findByText(/can’t be undone/)
    typeDelete()
    fireEvent.click(deleteButton())
    expect(await screen.findByText('Deletion did not finish')).toBeInTheDocument()
  })

  it('switches to the blocked state if the server reports members the preview missed', async () => {
    stub.deleteImpl = () =>
      Promise.reject(
        new DeleteAccountError('blocked', 'blocked', 'ORGANIZATION_HAS_MEMBERS', [
          { id: 'o9', name: 'Hidden Org', otherActiveMembers: 1 },
        ]),
      )
    renderModal()
    await screen.findByText(/can’t be undone/)
    typeDelete()
    fireEvent.click(deleteButton())
    expect(await screen.findByText('Deletion is blocked')).toBeInTheDocument()
    expect(screen.getByText('Hidden Org')).toBeInTheDocument()
  })
})
