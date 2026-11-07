import { beforeEach, describe, expect, it } from 'vitest'
import { getDB, resetDB } from './store'
import { chooseAccountType, completeVolunteerOnboarding, syncAuthUser } from './actions'
import { homePathFor, sessionUser } from './selectors'

const authUser = { id: 'auth-uuid-1', email: 'kai@example.org' }
const fresh = { full_name: 'Kai Volunteer Jr', avatar_url: null, onboarded: false }
const onboardedRow = { ...fresh, onboarded: true }
const onboardingInput = {
      firstName: 'Kai', lastName: 'V', avatar: null, city: 'Carmel', bio: 'A bio that is long enough to be valid.',
      interests: ['Education'], skills: ['Tutoring'], phone: '', availability: '',
    }

describe('syncAuthUser (Supabase session + public.users row -> local store)', () => {
  beforeEach(() => resetDB())

  it('creates the local user from the database row with no account type until one is chosen', () => {
    syncAuthUser(authUser, fresh)
    const user = sessionUser(getDB())
    expect(user).toMatchObject({ id: 'auth-uuid-1', email: 'kai@example.org', accountType: null, onboarded: false, firstName: 'Kai', lastName: 'Volunteer Jr' })
    expect(homePathFor(user)).toBe('/onboarding/account-type')
    expect(getDB().settings['auth-uuid-1']).toBeDefined()
  })

  it('routes to the onboarding for the chosen account type', () => {
    syncAuthUser(authUser, fresh)
    chooseAccountType('auth-uuid-1', 'organization')
    expect(homePathFor(sessionUser(getDB()))).toBe('/onboarding/organization')
  })

  it('does nothing when already in sync', () => {
    syncAuthUser(authUser, fresh)
    const before = getDB()
    syncAuthUser(authUser, fresh)
    expect(getDB()).toBe(before)
  })

  it('derives the type for an already-onboarded row with no local record', () => {
    syncAuthUser(authUser, onboardedRow, true)
    expect(sessionUser(getDB())?.accountType).toBe('organization')
    resetDB()
    syncAuthUser(authUser, onboardedRow, false)
    expect(sessionUser(getDB())?.accountType).toBe('volunteer')
  })

  it('keeps the chosen type and mirrors the avatar once onboarded', () => {
    syncAuthUser(authUser, fresh)
    chooseAccountType('auth-uuid-1', 'volunteer')
    completeVolunteerOnboarding('auth-uuid-1', onboardingInput)
    expect(sessionUser(getDB())?.onboarded).toBe(true)
    expect(homePathFor(sessionUser(getDB()))).toBe('/app')

    syncAuthUser(authUser, { ...onboardedRow, avatar_url: 'https://cdn.example.org/avatars/auth-uuid-1/avatar?v=1' }, true)
    expect(sessionUser(getDB())?.accountType).toBe('volunteer')
    const volunteer = getDB().volunteers.find((v) => v.userId === 'auth-uuid-1')
    expect(volunteer?.avatar).toBe('https://cdn.example.org/avatars/auth-uuid-1/avatar?v=1')
  })

  it('never treats a row the database says is not onboarded as onboarded locally', () => {
    syncAuthUser(authUser, fresh)
    chooseAccountType('auth-uuid-1', 'volunteer')
    completeVolunteerOnboarding('auth-uuid-1', onboardingInput)
    syncAuthUser(authUser, fresh)
    expect(sessionUser(getDB())?.onboarded).toBe(false)
  })

  it('cannot change the type after onboarding', () => {
    syncAuthUser(authUser, onboardedRow)
    completeVolunteerOnboarding('auth-uuid-1', onboardingInput)
    chooseAccountType('auth-uuid-1', 'organization')
    expect(sessionUser(getDB())?.accountType).toBe('volunteer')
  })

  it('clears the session when signed out or when no profile is available', () => {
    syncAuthUser(authUser, fresh)
    expect(getDB().sessionUserId).toBe('auth-uuid-1')
    syncAuthUser(null, null)
    expect(getDB().sessionUserId).toBeNull()
    syncAuthUser(authUser, null)
    expect(getDB().sessionUserId).toBeNull()
  })

  it('keeps separate local data for different Supabase users', () => {
    syncAuthUser(authUser, fresh)
    syncAuthUser({ id: 'auth-uuid-2', email: 'sam@example.org' }, { ...fresh, full_name: 'Sam Org' })
    expect(sessionUser(getDB())?.id).toBe('auth-uuid-2')
    expect(getDB().users.filter((u) => u.id.startsWith('auth-uuid')).length).toBe(2)
  })
})
