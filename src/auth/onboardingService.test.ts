import { beforeEach, describe, expect, it, vi } from 'vitest'

const { completeMock, createOrgMock } = vi.hoisted(() => ({ completeMock: vi.fn(), createOrgMock: vi.fn() }))
vi.mock('../lib/api/users', () => ({ completeUserOnboarding: completeMock }))
vi.mock('../lib/api/organizations', () => ({ createOrganization: createOrgMock }))

import { finishOrganizationSetup, finishVolunteerOnboarding } from './onboardingService'
import type { OrganizationMembership, User } from '../types/models'

const user = (onboarded: boolean) => ({ id: 'u1', onboarded, full_name: 'Kai R' }) as User
const owner: OrganizationMembership = {
  organization_id: 'org-1', user_id: 'u1', role: 'owner', status: 'active', invited_by: null, created_at: '', updated_at: '',
}
const volunteerData = {
  firstName: 'Kai', lastName: 'Rivera', city: 'Carmel', bio: 'Loves the outdoors and teaching.',
  interests: ['Education'], skills: ['Tutoring'], phone: '', availability: 'Weekends',
}
const orgData = {
  name: 'Hoosier Harvest', type: 'Nonprofit', description: 'Feeds neighbors.', mission: 'Food for all.',
  focus: ['Food & Hunger'], city: 'Indianapolis', website: 'https://hh.org', email: 'hi@hh.org', phone: '',
}

describe('volunteer onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    completeMock.mockImplementation(async () => user(true))
  })

  it('calls complete_user_onboarding with terms accepted and no account type', async () => {
    await finishVolunteerOnboarding(user(false), volunteerData, true)
    const payload = completeMock.mock.calls[0][0]
    expect(payload).toMatchObject({ first_name: 'Kai', last_name: 'Rivera', city: 'Carmel', state: 'IN', terms_accepted: true, phone: null, availability: { summary: 'Weekends' } })
    expect(JSON.stringify(payload)).not.toContain('account_type')
  })

  it('refuses without terms and never calls the database', async () => {
    await expect(finishVolunteerOnboarding(user(false), volunteerData, false)).rejects.toThrow('Accept the terms')
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('skips the RPC (which would error) when the row is already onboarded', async () => {
    const existing = user(true)
    await expect(finishVolunteerOnboarding(existing, volunteerData, true)).resolves.toBe(existing)
    expect(completeMock).not.toHaveBeenCalled()
  })
})

describe('organization setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    completeMock.mockImplementation(async () => user(true))
    createOrgMock.mockResolvedValue({ id: 'org-new' })
  })

  it('onboards the user, then creates the organization with the RPC', async () => {
    const onProfile = vi.fn()
    const result = await finishOrganizationSetup(user(false), [], orgData, true, onProfile)
    expect(result).toEqual({ organizationId: 'org-new', created: true })
    expect(onProfile).toHaveBeenCalledTimes(1)
    expect(completeMock.mock.invocationCallOrder[0]).toBeLessThan(createOrgMock.mock.invocationCallOrder[0])
    expect(createOrgMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hoosier Harvest', contact_email: 'hi@hh.org', join_policy: 'approval', phone: undefined,
    }))
  })

  it('does not create a duplicate when the user already owns an active organization', async () => {
    const result = await finishOrganizationSetup(user(true), [owner], orgData, true, vi.fn())
    expect(result).toEqual({ organizationId: 'org-1', created: false })
    expect(completeMock).not.toHaveBeenCalled()
    expect(createOrgMock).not.toHaveBeenCalled()
  })

  it('ignores memberships that are not an active ownership', async () => {
    const others = [{ ...owner, role: 'member' as const }, { ...owner, status: 'removed' as const }]
    await finishOrganizationSetup(user(true), others, orgData, true, vi.fn())
    expect(createOrgMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the onboarded profile when organization creation fails, so a retry skips step one', async () => {
    createOrgMock.mockRejectedValue(new Error('Complete your user profile first.'))
    const onProfile = vi.fn()
    await expect(finishOrganizationSetup(user(false), [], orgData, true, onProfile)).rejects.toThrow('Complete your user profile')
    expect(onProfile).toHaveBeenCalledTimes(1)
  })

  it('requires the terms before onboarding the user', async () => {
    await expect(finishOrganizationSetup(user(false), [], orgData, false, vi.fn())).rejects.toThrow('Accept the terms')
    expect(createOrgMock).not.toHaveBeenCalled()
  })
})
