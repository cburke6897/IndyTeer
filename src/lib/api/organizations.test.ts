import { beforeEach, describe, expect, it, vi } from 'vitest'
const { db, rpc } = vi.hoisted(() => {
  const rpc = vi.fn()
  return { rpc, db: { rpc,functions:{invoke:vi.fn()} } }
})
vi.mock('./client', () => ({ db }))
import { deleteOrganization, transferOrganizationOwnership } from './organizations'

describe('ownership transfer', () => {
  beforeEach(() => vi.resetAllMocks())
  it('requires server acknowledgement before reporting organization deletion',async()=>{
    db.functions.invoke.mockResolvedValueOnce({data:{},error:null})
    await expect(deleteOrganization('org')).rejects.toThrow('did not confirm')
    db.functions.invoke.mockResolvedValueOnce({data:{deleted:true},error:null})
    await expect(deleteOrganization('org')).resolves.toBeUndefined()
    expect(db.functions.invoke).toHaveBeenLastCalledWith('delete-organization',{method:'POST',body:{organizationId:'org',confirm:true}})
  })
  it('preserves the Supabase client receiver and returns the membership contract', async () => {
    const membership = {
      organization_id: 'org',
      user_id: 'successor',
      role: 'owner',
      status: 'active',
    }
    rpc.mockImplementation(function (this: unknown) {
      if (this !== db) throw new Error('Lost client receiver')
      return Promise.resolve({ data: membership, error: null })
    })
    await expect(transferOrganizationOwnership('org', 'successor')).resolves.toEqual(membership)
    expect(rpc).toHaveBeenCalledWith('transfer_organization_ownership', {
      p_organization_id: 'org',
      p_new_owner_id: 'successor',
    })
  })
  it('surfaces permission failures', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Only an owner can transfer ownership.' },
    })
    await expect(transferOrganizationOwnership('org', 'other')).rejects.toThrow('Only an owner')
  })
})
