import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { invokeMock, signOutMock, selectIn, memberships, orgMemberships } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  signOutMock: vi.fn(),
  selectIn: vi.fn(),
  memberships: vi.fn(),
  orgMemberships: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    auth: { signOut: signOutMock },
    from: () => ({ select: () => ({ in: selectIn }) }),
  },
}))
vi.mock('../lib/api/organizations', () => ({
  listMyMemberships: memberships,
  listOrganizationMemberships: orgMemberships,
}))

import { DeleteAccountError, deleteAccount, getDeletionImpact } from './deleteAccountService'

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(JSON.stringify(body), { status }))

const m = (organization_id: string, role: string, status = 'active') => ({ organization_id, user_id: 'me', role, status })

describe('getDeletionImpact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports nothing for a plain volunteer', async () => {
    memberships.mockResolvedValue([])
    await expect(getDeletionImpact('me')).resolves.toEqual({ owned: [], memberOfCount: 0 })
    expect(orgMemberships).not.toHaveBeenCalled()
  })

  it('counts only OTHER ACTIVE members of owned organizations, and organizations joined without owning', async () => {
    memberships.mockResolvedValue([m('o1', 'owner'), m('o2', 'owner'), m('o3', 'member'), m('o4', 'member', 'pending')])
    selectIn.mockResolvedValue({ data: [{ id: 'o1', name: 'Solo Org' }, { id: 'o2', name: 'Shared Org' }], error: null })
    orgMemberships.mockImplementation(async (id: string) => id === 'o1'
      ? [{ user_id: 'me', status: 'active' }, { user_id: 'x', status: 'pending' }, { user_id: 'y', status: 'removed' }]
      : [{ user_id: 'me', status: 'active' }, { user_id: 'z', status: 'active' }])
    await expect(getDeletionImpact('me')).resolves.toEqual({
      owned: [
        { id: 'o1', name: 'Solo Org', otherActiveMembers: 0 },
        { id: 'o2', name: 'Shared Org', otherActiveMembers: 1 },
      ],
      memberOfCount: 1,
    })
  })
})

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOutMock.mockResolvedValue({ error: null })
  })

  it('sends the explicit organization choice and clears the local session only after success', async () => {
    invokeMock.mockResolvedValue({ data: { deleted: true }, error: null })
    await deleteAccount({ deleteOwnedOrganizations: true })
    expect(invokeMock).toHaveBeenCalledWith('delete-account', { method: 'POST', body: { deleteOwnedOrganizations: true } })
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('treats a 409 as a refusal that removed nothing, and carries the organizations', async () => {
    const organizations = [{ id: 'o2', name: 'Shared Org', otherActiveMembers: 2 }]
    invokeMock.mockResolvedValue({ data: null, error: httpError(409, { code: 'ORGANIZATION_HAS_MEMBERS', error: 'blocked', organizations }) })
    const failure = await deleteAccount({ deleteOwnedOrganizations: false }).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(DeleteAccountError)
    expect(failure).toMatchObject({ kind: 'blocked', code: 'ORGANIZATION_HAS_MEMBERS', message: 'blocked', organizations })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it.each([500, 502])('reports a %i as an incomplete deletion and keeps the session', async (status) => {
    invokeMock.mockResolvedValue({ data: null, error: httpError(status, { error: 'boom' }) })
    const failure = await deleteAccount({ deleteOwnedOrganizations: false }).catch((e: unknown) => e)
    expect(failure).toMatchObject({ kind: 'incomplete' })
    expect((failure as Error).message).toMatch(/may already have been removed/)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('reports a network failure as incomplete rather than success', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('Failed to send a request') })
    await expect(deleteAccount({ deleteOwnedOrganizations: false })).rejects.toMatchObject({ kind: 'incomplete' })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('never reports success unless the function confirms { deleted: true }', async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null })
    await expect(deleteAccount({ deleteOwnedOrganizations: false })).rejects.toMatchObject({ kind: 'incomplete' })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('still succeeds if clearing the local session throws', async () => {
    invokeMock.mockResolvedValue({ data: { deleted: true }, error: null })
    signOutMock.mockRejectedValue(new Error('session already gone'))
    await expect(deleteAccount({ deleteOwnedOrganizations: false })).resolves.toBeUndefined()
  })
})
