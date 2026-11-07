import { beforeEach, describe, expect, it, vi } from 'vitest'
const { db, rpc } = vi.hoisted(() => {
  const rpc = vi.fn()
  return { rpc, db: { rpc } }
})
vi.mock('./client', () => ({ db }))
import { transferOrganizationOwnership } from './organizations'

describe('ownership transfer', () => {
  beforeEach(() => vi.resetAllMocks())
  it('preserves the Supabase client receiver and returns the membership contract', async () => {
    const membership = { organization_id: 'org', user_id: 'successor', role: 'owner', status: 'active' }
    rpc.mockImplementation(function (this: unknown) {
      if (this !== db) throw new Error('Lost client receiver')
      return Promise.resolve({ data: membership, error: null })
    })
    await expect(transferOrganizationOwnership('org', 'successor')).resolves.toEqual(membership)
    expect(rpc).toHaveBeenCalledWith('transfer_organization_ownership', { p_organization_id: 'org', p_new_owner_id: 'successor' })
  })
  it('surfaces permission failures', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Only an owner can transfer ownership.' } })
    await expect(transferOrganizationOwnership('org','other')).rejects.toThrow('Only an owner')
  })
})
