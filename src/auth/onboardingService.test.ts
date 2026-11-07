import { beforeEach, describe, expect, it, vi } from 'vitest'

const { completeMock, createOrgMock } = vi.hoisted(() => ({ completeMock: vi.fn(), createOrgMock: vi.fn() }))
vi.mock('../lib/api/users', () => ({ completeUserOnboarding: completeMock }))
vi.mock('../lib/api/organizations', () => ({ createOrganization: createOrgMock }))

import { createOrganizationForUser, finishVolunteerOnboarding } from './onboardingService'
import type { User } from '../types/models'

const user = (onboarded: boolean) => ({ id: 'u1', onboarded, full_name: 'Kai R' }) as User
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

describe('creating an organization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createOrgMock.mockResolvedValue({ id: 'org-new' })
  })

  it('creates the organization through the create_organization RPC and returns its id', async () => {
    await expect(createOrganizationForUser(user(true), orgData)).resolves.toEqual({ organizationId: 'org-new' })
    expect(createOrgMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hoosier Harvest', contact_email: 'hi@hh.org', join_policy: 'approval', phone: undefined, state: 'IN',
    }))
    // Ownership is the database job: the client sends no role, owner, or membership fields.
    expect(JSON.stringify(createOrgMock.mock.calls[0][0])).not.toMatch(/owner|role|created_by|membership/)
  })

  it('does not touch onboarding: it is a separate step done before this', async () => {
    await createOrganizationForUser(user(true), orgData)
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('refuses before the profile is onboarded and never calls the database', async () => {
    await expect(createOrganizationForUser(user(false), orgData)).rejects.toThrow('Finish setting up your profile')
    expect(createOrgMock).not.toHaveBeenCalled()
  })

  it('can be used again for a further organization', async () => {
    await createOrganizationForUser(user(true), orgData)
    await createOrganizationForUser(user(true), { ...orgData, name: 'Second Org' })
    expect(createOrgMock).toHaveBeenCalledTimes(2)
  })

  it('shows the database error when creation is refused', async () => {
    createOrgMock.mockRejectedValue(new Error('Complete your user profile first.'))
    await expect(createOrganizationForUser(user(true), orgData)).rejects.toThrow('Complete your user profile')
  })
})
