import { beforeEach, describe, expect, it } from 'vitest'
import { getDB, resetDB } from './store'
import { completeVolunteerOnboarding, syncAuthUser } from './actions'
import { homePathFor, sessionUser } from './selectors'

const authUser = { id: 'auth-uuid-1', email: 'kai@example.org' }
const volunteerProfile = { account_type: 'volunteer' as const, full_name: 'Kai Volunteer Jr', avatar_url: null }

describe('syncAuthUser (Supabase session + database profile -> local store)', () => {
  beforeEach(() => resetDB())

  it('creates the local user from the database profile, with its account type', () => {
    syncAuthUser(authUser, { ...volunteerProfile, account_type: 'organization' })
    const user = sessionUser(getDB())
    expect(user).toMatchObject({ id: 'auth-uuid-1', email: 'kai@example.org', accountType: 'organization', onboarded: false, firstName: 'Kai', lastName: 'Volunteer Jr' })
    expect(homePathFor(user)).toBe('/onboarding/organization')
    expect(getDB().settings['auth-uuid-1']).toBeDefined()
  })

  it('does nothing when already in sync', () => {
    syncAuthUser(authUser, volunteerProfile)
    const before = getDB()
    syncAuthUser(authUser, volunteerProfile)
    expect(getDB()).toBe(before)
  })

  it('treats the database profile as authoritative for account type and avatar', () => {
    syncAuthUser(authUser, volunteerProfile)
    completeVolunteerOnboarding('auth-uuid-1', {
      firstName: 'Kai', lastName: 'Volunteer', avatar: null, city: 'Carmel', bio: 'A bio that is long enough to be valid.',
      interests: ['Education'], skills: ['Tutoring'], phone: '', availability: '',
    })
    expect(sessionUser(getDB())?.onboarded).toBe(true)
    expect(homePathFor(sessionUser(getDB()))).toBe('/app')

    syncAuthUser(authUser, { ...volunteerProfile, avatar_url: 'https://cdn.example.org/avatars/auth-uuid-1/avatar?v=1' })
    const volunteer = getDB().volunteers.find((v) => v.userId === 'auth-uuid-1')
    expect(volunteer?.avatar).toBe('https://cdn.example.org/avatars/auth-uuid-1/avatar?v=1')
  })

  it('clears the session when signed out or when no profile is available', () => {
    syncAuthUser(authUser, volunteerProfile)
    expect(getDB().sessionUserId).toBe('auth-uuid-1')
    syncAuthUser(null, null)
    expect(getDB().sessionUserId).toBeNull()
    syncAuthUser(authUser, null)
    expect(getDB().sessionUserId).toBeNull()
  })

  it('keeps separate local data for different Supabase users', () => {
    syncAuthUser(authUser, volunteerProfile)
    syncAuthUser({ id: 'auth-uuid-2', email: 'sam@example.org' }, { ...volunteerProfile, full_name: 'Sam Org', account_type: 'organization' })
    expect(sessionUser(getDB())?.id).toBe('auth-uuid-2')
    expect(getDB().users.filter((u) => u.id.startsWith('auth-uuid')).length).toBe(2)
  })
})
