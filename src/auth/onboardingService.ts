import { completeUserOnboarding } from '../lib/api/users'
import { createOrganization } from '../lib/api/organizations'
import type { OrganizationMembership, User } from '../types/models'

/**
 * Onboarding goes through the database's supported operations only:
 *  - complete_user_onboarding (RPC) fills the profile, records the terms acceptance and sets
 *    users.onboarded. It refuses to run twice, so a row that is already onboarded is skipped.
 *  - create_organization (RPC) makes the caller the organization's owner. It requires an
 *    onboarded user, and is skipped when the caller already owns an active organization so a
 *    retry or a second browser can never create a duplicate.
 * Neither writes an account type: there is none in the schema.
 */

export interface VolunteerOnboardingData {
  firstName: string
  lastName: string
  city: string
  bio: string
  interests: string[]
  skills: string[]
  phone: string
  availability: string
}

export async function finishVolunteerOnboarding(
  profile: User,
  data: VolunteerOnboardingData,
  termsAccepted: boolean,
): Promise<User> {
  if (profile.onboarded) return profile
  if (!termsAccepted) throw new Error('Accept the terms to continue.')
  return completeUserOnboarding({
    first_name: data.firstName,
    last_name: data.lastName,
    bio: data.bio,
    city: data.city,
    state: 'IN',
    phone: data.phone || null,
    availability: data.availability ? { summary: data.availability } : {},
    interests: data.interests,
    skills: data.skills,
    terms_accepted: true,
  })
}

export interface OrganizationSetupData {
  name: string
  type: string
  description: string
  mission: string
  focus: string[]
  city: string
  website: string
  email: string
  phone: string
}

/**
 * Completes the user's onboarding if needed, then creates their organization if they do not
 * already own one. `onProfile` is called as soon as the first step succeeds, so a failure in the
 * second step leaves the cached profile correct and a retry skips the first step.
 */
export async function finishOrganizationSetup(
  profile: User,
  memberships: OrganizationMembership[],
  data: OrganizationSetupData,
  termsAccepted: boolean,
  onProfile: (profile: User) => void,
): Promise<{ organizationId: string; created: boolean }> {
  let current = profile
  if (!current.onboarded) {
    if (!termsAccepted) throw new Error('Accept the terms to continue.')
    current = await completeUserOnboarding({ city: data.city, state: 'IN', terms_accepted: true })
    onProfile(current)
  }

  const owned = memberships.find((m) => m.role === 'owner' && m.status === 'active')
  if (owned) return { organizationId: owned.organization_id, created: false }

  const organization = await createOrganization({
    name: data.name,
    type: data.type,
    description: data.description,
    mission: data.mission,
    website: data.website || undefined,
    city: data.city,
    state: 'IN',
    contact_email: data.email,
    phone: data.phone || undefined,
    focus: data.focus,
    join_policy: 'approval',
  })
  return { organizationId: organization.id, created: true }
}
