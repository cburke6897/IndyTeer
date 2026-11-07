import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { invokeMock, signOutMock, selectIn, memberships, orgMemberships, members, transferRpc } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  signOutMock: vi.fn(),
  selectIn: vi.fn(),
  memberships: vi.fn(),
  orgMemberships: vi.fn(),
  members: vi.fn(),
  transferRpc: vi.fn(),
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
  listOrganizationMembers: members,
  transferOrganizationOwnership: transferRpc,
}))

import { DeleteAccountError, deleteAccount, getDeletionImpact, transferOwnership } from './deleteAccountService'

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(JSON.stringify(body), { status }))

const m = (organization_id: string, role: string, status = 'active') => ({ organization_id, user_id: 'me', role, status })
const person = (user_id: string, role: string, full_name = user_id, status = 'active') => ({ user_id, role, full_name, status, avatar_path: null })

describe('getDeletionImpact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports nothing for a user with no organizations', async () => {
    memberships.mockResolvedValue([])
    await expect(getDeletionImpact('me')).resolves.toEqual({ owned: [], memberOfCount: 0 })
    expect(members).not.toHaveBeenCalled()
  })

  it('lists eligible new owners by name, and counts memberships held without owning', async () => {
    memberships.mockResolvedValue([m('o1', 'owner'), m('o2', 'owner'), m('o3', 'member'), m('o4', 'member', 'pending')])
    selectIn.mockResolvedValue({ data: [{ id: 'o1', name: 'Solo Org' }, { id: 'o2', name: 'Shared Org' }], error: null })
    members.mockImplementation(async (id: string) => id === 'o1'
      ? [person('me', 'owner'), person('x', 'member', 'Xia', 'pending'), person('y', 'member', 'Yan', 'removed')]
      : [person('me', 'owner'), person('z', 'admin', 'Zed'), person('w', 'member', 'Wes')])
    const impact = await getDeletionImpact('me')
    expect(impact.memberOfCount).toBe(1)
    expect(impact.owned[0]).toMatchObject({ id: 'o1', name: 'Solo Org', otherOwners: 0, otherActiveMembers: 0, eligible: [], transferAvailable: true })
    expect(impact.owned[1]).toMatchObject({
      id: 'o2', otherOwners: 0, otherActiveMembers: 2, transferAvailable: true,
      eligible: [{ userId: 'z', name: 'Zed', role: 'admin' }, { userId: 'w', name: 'Wes', role: 'member' }],
    })
  })

  it('treats an organization with another active owner as one that lives on', async () => {
    memberships.mockResolvedValue([m('o1', 'owner')])
    selectIn.mockResolvedValue({ data: [{ id: 'o1', name: 'Co-owned' }], error: null })
    members.mockResolvedValue([person('me', 'owner'), person('b', 'owner', 'Bea')])
    const [org] = (await getDeletionImpact('me')).owned
    expect(org.otherOwners).toBe(1)
    expect(org.eligible).toEqual([])
  })

  it('falls back to ids only, with transfer unavailable, when the server lacks the member functions', async () => {
    memberships.mockResolvedValue([m('o1', 'owner')])
    selectIn.mockResolvedValue({ data: [{ id: 'o1', name: 'Old Server Org' }], error: null })
    members.mockRejectedValue(Object.assign(new Error('Could not find the function public.list_organization_members'), { code: 'PGRST202' }))
    orgMemberships.mockResolvedValue([{ user_id: 'me', role: 'owner', status: 'active' }, { user_id: 'k', role: 'member', status: 'active' }])
    const [org] = (await getDeletionImpact('me')).owned
    expect(org).toMatchObject({ transferAvailable: false, otherActiveMembers: 1, eligible: [] })
  })

  it('surfaces any other error instead of guessing', async () => {
    memberships.mockResolvedValue([m('o1', 'owner')])
    selectIn.mockResolvedValue({ data: [{ id: 'o1', name: 'X' }], error: null })
    members.mockRejectedValue(Object.assign(new Error('permission denied'), { code: '42501' }))
    await expect(getDeletionImpact('me')).rejects.toThrow('permission denied')
  })
})

describe('transferOwnership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the transfer RPC', async () => {
    transferRpc.mockResolvedValue({})
    await transferOwnership('o1', 'u2')
    expect(transferRpc).toHaveBeenCalledWith('o1', 'u2')
  })

  it('explains clearly when the server does not have the function yet', async () => {
    transferRpc.mockRejectedValue(Object.assign(new Error('x'), { code: 'PGRST202' }))
    await expect(transferOwnership('o1', 'u2')).rejects.toThrow('not available on this server yet')
  })

  it('passes through the database refusal otherwise', async () => {
    transferRpc.mockRejectedValue(Object.assign(new Error('The new owner must be an active member of the organization.'), { code: 'P0001' }))
    await expect(transferOwnership('o1', 'u2')).rejects.toThrow('must be an active member')
  })
})

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOutMock.mockResolvedValue({ error: null })
  })

  it('sends only the organizations explicitly chosen for deletion, and clears the local session after success', async () => {
    invokeMock.mockResolvedValue({ data: { deleted: true }, error: null })
    await deleteAccount({ deleteOrganizationIds: ['o1'] })
    expect(invokeMock).toHaveBeenCalledWith('delete-account', { method: 'POST', body: { deleteOrganizationIds: ['o1'] } })
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('treats a 409 as a refusal that removed nothing, and carries the organizations', async () => {
    const organizations = [{ id: 'o2', name: 'Shared Org', otherActiveMembers: 2 }]
    invokeMock.mockResolvedValue({ data: null, error: httpError(409, { code: 'ORGANIZATION_DECISION_REQUIRED', error: 'decide', organizations }) })
    const failure = await deleteAccount({ deleteOrganizationIds: [] }).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(DeleteAccountError)
    expect(failure).toMatchObject({ kind: 'blocked', code: 'ORGANIZATION_DECISION_REQUIRED', message: 'decide', organizations })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it.each([500, 502])('reports a %i as an incomplete deletion and keeps the session', async (status) => {
    invokeMock.mockResolvedValue({ data: null, error: httpError(status, { error: 'boom' }) })
    const failure = await deleteAccount({ deleteOrganizationIds: [] }).catch((e: unknown) => e)
    expect(failure).toMatchObject({ kind: 'incomplete' })
    expect((failure as Error).message).toMatch(/may already have been removed/)
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('reports a network failure as incomplete rather than success', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('Failed to send a request') })
    await expect(deleteAccount({ deleteOrganizationIds: [] })).rejects.toMatchObject({ kind: 'incomplete' })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('never reports success unless the function confirms { deleted: true }', async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null })
    await expect(deleteAccount({ deleteOrganizationIds: [] })).rejects.toMatchObject({ kind: 'incomplete' })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('still succeeds if clearing the local session throws', async () => {
    invokeMock.mockResolvedValue({ data: { deleted: true }, error: null })
    signOutMock.mockRejectedValue(new Error('session already gone'))
    await expect(deleteAccount({ deleteOrganizationIds: [] })).resolves.toBeUndefined()
  })
})
