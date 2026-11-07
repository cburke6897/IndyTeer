import { describe, expect, it } from 'vitest'
import { colorFor, ctxKey, deriveUser, mapNotification, mapOpportunity, mapSharedVolunteer, pickActiveOrg, staffOrgIdsOf } from './remote'
import { emptyDB } from '../store/store'
import { homePathFor, memberRole, sessionOrg, sessionVolunteer, staffOrgIds, staffOrgs } from '../store/selectors'
import type { OrganizationMembership, User as UserRow } from '../types/models'
import type { DB, OrgProfile, User, VolunteerProfile } from '../types'
import type { SnapshotCtx } from './remote'

const profile = (over: Partial<UserRow> = {}): UserRow => ({
  id: 'u1', first_name: 'Kai', last_name: 'Rivera', full_name: 'Kai Rivera', onboarded: false, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', interests: [], skills: [], availability: {}, state: 'IN', public_profile: false,
  show_hours: false, show_history: false, avatar_path: null, avatar_url: null, headline: null, bio: null, city: null, phone: null,
  ...over,
} as UserRow)
const member = (over: Partial<OrganizationMembership>): OrganizationMembership => ({
  organization_id: 'o1', user_id: 'u1', role: 'owner', status: 'active', invited_by: null, created_at: '', updated_at: '', ...over,
})
const ctx = (p: UserRow, memberships: OrganizationMembership[] = []): SnapshotCtx => ({ authUser: { id: 'u1', email: 'kai@example.org' }, profile: p, memberships })

describe('the store starts empty (no sample data)', () => {
  it('has no organizations, opportunities, volunteers, posts, memberships or users', () => {
    const db = emptyDB()
    expect([db.organizations, db.opportunities, db.volunteers, db.registrations, db.posts, db.users, db.notifications, db.memberships].every((x) => x.length === 0)).toBe(true)
    expect(db.ready).toBe(false)
    expect(db.activeOrgId).toBeNull()
  })
})

describe('every signed-in person is a standard user', () => {
  it('has no account type at all, only onboarding state', () => {
    const user = deriveUser(ctx(profile()))
    expect(user).toEqual({ id: 'u1', email: 'kai@example.org', firstName: 'Kai', lastName: 'Rivera', onboarded: false, createdAt: '2026-01-01T00:00:00Z' })
    expect('accountType' in user).toBe(false)
  })

  it('routes to the single onboarding page until onboarded, then to the standard app, with or without organizations', () => {
    expect(homePathFor(deriveUser(ctx(profile())))).toBe('/onboarding')
    expect(homePathFor(deriveUser(ctx(profile({ onboarded: true }))))).toBe('/app')
    expect(homePathFor(deriveUser(ctx(profile({ onboarded: true }), [member({})])))).toBe('/app')
    expect(homePathFor(null)).toBe('/login')
  })
})

describe('organization access comes from membership and role', () => {
  it('lets only active owners and admins manage an organization', () => {
    const rows = [
      member({ organization_id: 'a', role: 'owner' }), member({ organization_id: 'b', role: 'admin' }),
      member({ organization_id: 'c', role: 'member' }), member({ organization_id: 'd', status: 'pending' }),
      member({ organization_id: 'e', status: 'removed' }), member({ organization_id: 'f', status: 'invited', role: 'admin' }),
    ]
    expect(staffOrgIdsOf(rows)).toEqual(['a', 'b'])
  })

  it('picks the remembered organization if still valid, else the first, else none', () => {
    const rows = [member({ organization_id: 'a' }), member({ organization_id: 'b', role: 'admin' })]
    expect(pickActiveOrg(rows, 'b')).toBe('b')
    expect(pickActiveOrg(rows, 'gone')).toBe('a')
    expect(pickActiveOrg(rows, null)).toBe('a')
    expect(pickActiveOrg([member({ role: 'member' })], 'o1')).toBeNull()
    expect(pickActiveOrg([], null)).toBeNull()
  })

  const org = (id: string): OrgProfile => ({ id, name: id } as OrgProfile)
  const user = (onboarded: boolean): User => ({ id: 'u1', email: '', firstName: '', lastName: '', onboarded, createdAt: '' })
  const base = (): DB => ({
    ...emptyDB(), sessionUserId: 'u1', ready: true, users: [user(true)],
    volunteers: [{ id: 'u1' } as VolunteerProfile], organizations: [org('a'), org('b'), org('c')],
    memberships: [
      { orgId: 'a', role: 'owner', status: 'active' }, { orgId: 'b', role: 'admin', status: 'active' },
      { orgId: 'c', role: 'member', status: 'active' },
    ],
    activeOrgId: 'b',
  })

  it('gives a user with several organizations a list, an active one, and their roles', () => {
    const db = base()
    expect(staffOrgIds(db)).toEqual(['a', 'b'])
    expect(staffOrgs(db).map((o) => o.id)).toEqual(['a', 'b'])
    expect(sessionOrg(db)?.id).toBe('b')
    expect(memberRole(db, 'a')).toBe('owner')
    expect(memberRole(db, 'c')).toBe('member')
  })

  it('never manages an organization the user is only a member of, or has left', () => {
    const db = { ...base(), activeOrgId: 'c' }
    expect(sessionOrg(db)).toBeNull()
    expect(sessionOrg({ ...base(), memberships: [], activeOrgId: 'a' })).toBeNull()
  })

  it('keeps the standard volunteer profile for users with no organization, and only once onboarded', () => {
    expect(sessionVolunteer({ ...base(), memberships: [], activeOrgId: null })?.id).toBe('u1')
    expect(sessionVolunteer({ ...base(), users: [user(false)] })).toBeNull()
  })
})

describe('ctxKey', () => {
  it('changes when routing could change, not on ordinary profile edits', () => {
    const baseKey = ctxKey(ctx(profile()))
    expect(ctxKey(ctx(profile({ headline: 'new', updated_at: '2026-02-02T00:00:00Z' })))).toBe(baseKey)
    expect(ctxKey(ctx(profile({ onboarded: true })))).not.toBe(baseKey)
    expect(ctxKey(ctx(profile(), [member({})]))).not.toBe(baseKey)
    expect(ctxKey(ctx(profile(), [member({ role: 'admin' })]))).not.toBe(ctxKey(ctx(profile(), [member({})])))
  })
})

describe('row mapping', () => {
  it('maps an opportunity row to the page shape', () => {
    const o = mapOpportunity({
      id: 'p1', organization_id: 'o1', title: 'Park cleanup', description: 'd', category: 'Environment', city: 'Carmel', location: 'Central Park',
      address: null, virtual: false, min_age: null, skills: [], hours: null, registration_deadline: null, recurrence: 'none', instructions: null,
      event_date: '2026-12-01', start_time: '09:00:00', end_time: '12:00:00', timezone: 'America/Indiana/Indianapolis', spots: 10,
      image_url: null, image_path: null, status: 'published', created_at: '2026-01-01T00:00:00Z', starts_at: '', ends_at: null,
    } as never)
    expect(o).toMatchObject({ id: 'p1', orgId: 'o1', date: '2026-12-01', startTime: '09:00', endTime: '12:00', deadline: '2026-12-01', hours: 0, address: '', image: null })
  })

  it('maps what an organization is shown of a volunteer, keeping privacy flags', () => {
    const v = mapSharedVolunteer({
      id: 'v1', full_name: 'Sam Lee Jr', headline: null, bio: null, city: 'Carmel', state: 'IN', avatar_path: null, phone: null,
      availability: { summary: 'Weekends' }, show_hours: false, show_history: true, verified_hours: null,
      history: [{ opportunity_id: 'p1', status: 'approved', hours: 3 }],
    })
    expect(v).toMatchObject({ firstName: 'Sam', lastName: 'Lee Jr', availability: 'Weekends', privacy: { showHours: false, showHistory: true } })
    expect(v.shared?.history).toEqual([{ oppId: 'p1', status: 'approved', hours: 3 }])
  })

  it('links notifications by type', () => {
    const n = (type: string, data: object) => ({ id: 'n', user_id: 'u1', type, message: 'm', data, read_at: null, created_at: '' }) as never
    expect(mapNotification(n('registration', { registration_id: 'r' })).link).toBe('/org/registrations')
    expect(mapNotification(n('registration', { registration_id: 'r', status: 'approved' })).link).toBe('/app/events')
    expect(mapNotification(n('opportunity', { opportunity_id: 'p1' })).link).toBe('/app/opportunities/p1')
    expect(mapNotification(n('hours', {})).link).toBe('/app/hours')
  })

  it('gives each organization a stable colour', () => {
    expect(colorFor('abc')).toBe(colorFor('abc'))
  })
})
