import { completeUserOnboarding } from '../lib/api/users'
import { createOrganization } from '../lib/api/organizations'
import type { User } from '../types/models'

/**
 * Onboarding goes through the database's supported operations only:
 *  - complete_user_onboarding (RPC) fills the profile, records the terms acceptance and sets
 *    users.onboarded. It refuses to run twice, so a row that is already onboarded is skipped.
 *  - create_organization (RPC) makes the caller the organization's owner. It requires an
 *    onboarded user and can be used again later for further organizations.
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
  /** Required YYYY-MM-DD. Used to check age requirements for opportunities. */
  dateOfBirth: string
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
    date_of_birth: data.dateOfBirth,
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
 * Creates an organization for the signed-in user through create_organization (RPC). The database
 * makes the caller its owner (an active `owner` membership); the client never writes membership or
 * ownership fields. Any standard user who has finished onboarding may call it, any number of times.
 */
export async function createOrganizationForUser(profile: User, data: OrganizationSetupData): Promise<{ organizationId: string }> {
  if (!profile.onboarded) throw new Error('Finish setting up your profile before creating an organization.')
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
  return { organizationId: organization.id }
}
