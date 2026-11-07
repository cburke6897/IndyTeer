import type {
  AccountType, AppNotification, DB, Opportunity, OrgProfile, Registration, RegStatus, Settings, User, VolunteerProfile,
} from '../types'
import { defaultSettings } from '../data/seed'
import { ORG_COLORS } from '../lib/constants'
import { nowISO, todayISO, uid } from '../lib/utils'
import { getDB, resetDB, setDB } from './store'
import { getOpp, getOrg, getVolunteer, isPast, spotsLeft } from './selectors'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/* Every function here is a stand-in for a future API call. */

function notify(db: DB, userId: string | null | undefined, text: string, link: string | null): DB {
  if (!userId) return db
  const n: AppNotification = { id: uid('n'), userId, text, link, read: false, createdAt: nowISO() }
  return { ...db, notifications: [n, ...db.notifications] }
}

const volunteerName = (v?: VolunteerProfile) => (v ? `${v.firstName} ${v.lastName}` : 'A volunteer')

/* ------------------------------------ Auth ----------------------------------- */
// Authentication itself (signup, login, logout, password reset) is handled by Supabase Auth
// (see src/auth). The local store only mirrors the signed-in user so the rest of the
// prototype data can be keyed to the real Supabase user id.

export interface AuthUserLike {
  id: string
  email?: string | null
}

export type ProfileLike = { account_type: AccountType; full_name: string; avatar_url: string | null }

function splitName(full: string, email: string) {
  const parts = (full.trim() || email.split('@')[0]).split(/\s+/)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

/**
 * Mirrors the signed-in Supabase user and their database profile into the local store.
 * The profile is authoritative for account type and avatar. Names are copied when the local user
 * is created; later edits are written to both places by the Settings/profile forms.
 * Idempotent: does nothing when the store is already in sync.
 */
export function syncAuthUser(authUser: AuthUserLike | null, profile: ProfileLike | null) {
  const db = getDB()
  if (!authUser || !profile) {
    if (db.sessionUserId !== null) setDB((d) => ({ ...d, sessionUserId: null }))
    return
  }
  const email = authUser.email ?? ''
  const existing = db.users.find((u) => u.id === authUser.id)

  if (!existing) {
    const { first, last } = splitName(profile.full_name, email)
    const user: User = {
      id: authUser.id, email, firstName: first, lastName: last, accountType: profile.account_type,
      onboarded: false, profileId: null, createdAt: nowISO(),
    }
    setDB((d) => ({
      ...d,
      users: [...d.users, user],
      settings: { ...d.settings, [user.id]: defaultSettings() },
      sessionUserId: user.id,
    }))
    return
  }

  const typeChanged = existing.accountType !== profile.account_type
  const emailChanged = !!email && existing.email !== email
  const localVolunteer = existing.accountType === 'volunteer' && existing.profileId
    ? db.volunteers.find((v) => v.id === existing.profileId)
    : undefined
  const avatarChanged = !!localVolunteer && localVolunteer.avatar !== profile.avatar_url
  if (typeChanged || emailChanged || avatarChanged || db.sessionUserId !== existing.id) {
    setDB((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === existing.id
        ? { ...u, email: emailChanged ? email : u.email, accountType: profile.account_type }
        : u)),
      volunteers: avatarChanged
        ? d.volunteers.map((v) => (v.id === localVolunteer!.id ? { ...v, avatar: profile.avatar_url } : v))
        : d.volunteers,
      sessionUserId: existing.id,
    }))
  }
}

export interface VolunteerOnboardingInput {
  firstName: string; lastName: string; avatar: string | null; city: string; bio: string
  interests: string[]; skills: string[]; phone: string; availability: string
}

export function completeVolunteerOnboarding(userId: string, input: VolunteerOnboardingInput) {
  const id = uid('vol')
  const profile: VolunteerProfile = {
    id, userId, firstName: input.firstName, lastName: input.lastName, headline: 'New IndyTeer volunteer', avatar: input.avatar,
    city: input.city, state: 'IN', bio: input.bio, interests: input.interests, skills: input.skills,
    phone: input.phone, availability: input.availability, joinedAt: todayISO(),
  }
  setDB((d) => notify({
    ...d,
    volunteers: [...d.volunteers, profile],
    users: d.users.map((u) => (u.id === userId ? { ...u, firstName: input.firstName, lastName: input.lastName, accountType: 'volunteer', onboarded: true, profileId: id } : u)),
  }, userId, 'Welcome to IndyTeer! Browse opportunities to register for your first event.', '/app/explore'))
}

export interface OrgOnboardingInput {
  name: string; logo: string | null; type: string; description: string; mission: string; website: string
  city: string; email: string; phone: string; focus: string[]
}

export function completeOrgOnboarding(userId: string, input: OrgOnboardingInput) {
  const id = uid('org')
  const org: OrgProfile = {
    id, userId, name: input.name, logo: input.logo, cover: null, type: input.type, description: input.description,
    mission: input.mission, website: input.website, city: input.city, state: 'IN', email: input.email, phone: input.phone,
    focus: input.focus, verified: false, founded: new Date().getFullYear(), followerBoost: 0,
    color: ORG_COLORS[getDB().organizations.length % ORG_COLORS.length],
  }
  setDB((d) => notify({
    ...d,
    organizations: [...d.organizations, org],
    users: d.users.map((u) => (u.id === userId ? { ...u, accountType: 'organization', onboarded: true, profileId: id } : u)),
  }, userId, 'Your organization is live. Create your first volunteer opportunity.', '/org/opportunities/new'))
}

export function updateUser(userId: string, patch: Partial<Pick<User, 'firstName' | 'lastName' | 'email'>>) {
  setDB((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)) }))
}

export function deleteAccount(userId: string) {
  setDB((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user) return { ...d, sessionUserId: null }
    let next: DB = { ...d, users: d.users.filter((u) => u.id !== userId), sessionUserId: null }
    const { [userId]: _removed, ...settings } = next.settings
    void _removed
    next = { ...next, settings, notifications: next.notifications.filter((n) => n.userId !== userId) }
    if (user.accountType === 'volunteer' && user.profileId) {
      const vid = user.profileId
      next = {
        ...next,
        volunteers: next.volunteers.filter((v) => v.id !== vid),
        registrations: next.registrations.filter((r) => r.volunteerId !== vid),
        manualHours: next.manualHours.filter((m) => m.volunteerId !== vid),
        follows: next.follows.filter((f) => f.volunteerId !== vid),
        saved: next.saved.filter((s) => s.volunteerId !== vid),
      }
    }
    if (user.accountType === 'organization' && user.profileId) {
      const oid = user.profileId
      const oppIds = new Set(next.opportunities.filter((o) => o.orgId === oid).map((o) => o.id))
      next = {
        ...next,
        organizations: next.organizations.filter((o) => o.id !== oid),
        opportunities: next.opportunities.filter((o) => o.orgId !== oid),
        registrations: next.registrations.filter((r) => !oppIds.has(r.oppId)),
        follows: next.follows.filter((f) => f.orgId !== oid),
        saved: next.saved.filter((s) => !oppIds.has(s.oppId)),
        posts: next.posts.filter((p) => p.orgId !== oid),
      }
    }
    return next
  })
}

export function resetDemoData() {
  resetDB()
}

/* ---------------------------------- Settings --------------------------------- */
export function updateSettings(userId: string, fn: (s: Settings) => Settings) {
  setDB((d) => ({ ...d, settings: { ...d.settings, [userId]: fn(d.settings[userId] ?? defaultSettings()) } }))
}

export function markNotificationsRead(userId: string) {
  setDB((d) => ({ ...d, notifications: d.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)) }))
}

export function markNotificationRead(id: string) {
  setDB((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }))
}

/* --------------------------------- Volunteers -------------------------------- */
export function updateVolunteerProfile(id: string, patch: Partial<VolunteerProfile>) {
  setDB((d) => {
    const v = getVolunteer(d, id)
    const users = d.users.map((u) => (u.profileId === id && u.accountType === 'volunteer' && v
      ? { ...u, firstName: patch.firstName ?? u.firstName, lastName: patch.lastName ?? u.lastName } : u))
    return { ...d, users, volunteers: d.volunteers.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
  })
}

export function toggleFollow(volunteerId: string, orgId: string): boolean {
  const following = getDB().follows.some((f) => f.volunteerId === volunteerId && f.orgId === orgId)
  setDB((d) => {
    if (following) return { ...d, follows: d.follows.filter((f) => !(f.volunteerId === volunteerId && f.orgId === orgId)) }
    const org = getOrg(d, orgId)
    const next = { ...d, follows: [...d.follows, { volunteerId, orgId }] }
    return notify(next, org?.userId, `${volunteerName(getVolunteer(d, volunteerId))} started following ${org?.name ?? 'your organization'}.`, '/org/volunteers')
  })
  return !following
}

export function toggleSave(volunteerId: string, oppId: string): boolean {
  const saved = getDB().saved.some((s) => s.volunteerId === volunteerId && s.oppId === oppId)
  setDB((d) => ({
    ...d,
    saved: saved ? d.saved.filter((s) => !(s.volunteerId === volunteerId && s.oppId === oppId)) : [...d.saved, { volunteerId, oppId }],
  }))
  return !saved
}

export function registerForOpportunity(volunteerId: string, oppId: string): Result {
  const db = getDB()
  const opp = getOpp(db, oppId)
  if (!opp || opp.status !== 'published') return { ok: false, error: 'This opportunity is no longer available.' }
  if (isPast(opp) || opp.deadline < todayISO()) return { ok: false, error: 'Registration for this opportunity has closed.' }
  const existing = db.registrations.find((r) => r.volunteerId === volunteerId && r.oppId === oppId)
  if (existing && (existing.status === 'pending' || existing.status === 'approved')) return { ok: false, error: 'You’re already registered for this opportunity.' }
  if (existing && (existing.status === 'declined' || existing.status === 'removed')) return { ok: false, error: 'The organization has closed your registration for this event.' }
  if (spotsLeft(db, opp) <= 0) return { ok: false, error: 'Sorry, every spot is taken.' }
  const reg: Registration = { id: uid('reg'), oppId, volunteerId, status: 'pending', attended: false, hoursVerified: false, hours: opp.hours, createdAt: nowISO() }
  setDB((d) => {
    const next: DB = {
      ...d,
      registrations: existing
        ? d.registrations.map((r) => (r.id === existing.id ? { ...r, status: 'pending', createdAt: nowISO() } : r))
        : [...d.registrations, reg],
    }
    const org = getOrg(d, opp.orgId)
    return notify(next, org?.userId, `${volunteerName(getVolunteer(d, volunteerId))} registered for ${opp.title}.`, '/org/registrations')
  })
  return { ok: true }
}

export function cancelRegistration(regId: string) {
  setDB((d) => {
    const reg = d.registrations.find((r) => r.id === regId)
    if (!reg) return d
    const opp = getOpp(d, reg.oppId)
    const org = getOrg(d, opp?.orgId)
    const next = { ...d, registrations: d.registrations.map((r) => (r.id === regId ? { ...r, status: 'cancelled' as const, attended: false, hoursVerified: false } : r)) }
    return notify(next, org?.userId, `${volunteerName(getVolunteer(d, reg.volunteerId))} canceled their registration for ${opp?.title ?? 'an event'}.`, '/org/registrations')
  })
}

export function addManualHours(volunteerId: string, input: { orgName: string; title: string; date: string; hours: number; notes: string }) {
  setDB((d) => ({ ...d, manualHours: [{ id: uid('mh'), volunteerId, createdAt: nowISO(), ...input }, ...d.manualHours] }))
}

export function deleteManualHours(id: string) {
  setDB((d) => ({ ...d, manualHours: d.manualHours.filter((m) => m.id !== id) }))
}

/* ------------------------------- Organizations ------------------------------- */
export function updateOrgProfile(id: string, patch: Partial<OrgProfile>) {
  setDB((d) => ({ ...d, organizations: d.organizations.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'orgId' | 'createdAt'>

export function createOpportunity(orgId: string, input: OpportunityInput): string {
  const id = uid('opp')
  setDB((d) => {
    let next: DB = { ...d, opportunities: [{ ...input, id, orgId, createdAt: nowISO() }, ...d.opportunities] }
    if (input.status === 'published') {
      const org = getOrg(d, orgId)
      const followers = d.follows.filter((f) => f.orgId === orgId).map((f) => getVolunteer(d, f.volunteerId)?.userId)
      for (const uidv of followers) {
        if (uidv && d.settings[uidv]?.notifications.newOpportunities !== false) {
          next = notify(next, uidv, `${org?.name ?? 'An organization you follow'} posted a new opportunity: ${input.title}.`, `/app/opportunities/${id}`)
        }
      }
    }
    return next
  })
  return id
}

export function updateOpportunity(id: string, patch: Partial<Opportunity>) {
  setDB((d) => ({ ...d, opportunities: d.opportunities.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
}

export function deleteOpportunity(id: string) {
  setDB((d) => ({
    ...d,
    opportunities: d.opportunities.filter((o) => o.id !== id),
    registrations: d.registrations.filter((r) => r.oppId !== id),
    saved: d.saved.filter((s) => s.oppId !== id),
  }))
}

function updateReg(regId: string, fn: (r: Registration, d: DB) => Registration, message?: (r: Registration, d: DB) => string) {
  setDB((d) => {
    const existing = d.registrations.find((r) => r.id === regId)
    if (!existing) return d
    const updated = fn(existing, d)
    let next: DB = { ...d, registrations: d.registrations.map((r) => (r.id === regId ? updated : r)) }
    if (message) {
      const v = getVolunteer(d, updated.volunteerId)
      next = notify(next, v?.userId, message(updated, d), '/app/events')
    }
    return next
  })
}

const oppTitle = (r: Registration, d: DB) => getOpp(d, r.oppId)?.title ?? 'an event'

export function setRegistrationStatus(regId: string, status: Extract<RegStatus, 'approved' | 'declined' | 'removed'>) {
  const text = { approved: 'You’re approved for', declined: 'Your registration was declined for', removed: 'You were removed from' }[status]
  updateReg(
    regId,
    (r) => ({ ...r, status, attended: status === 'approved' ? r.attended : false, hoursVerified: status === 'approved' ? r.hoursVerified : false }),
    (r, d) => `${text} ${oppTitle(r, d)}.`,
  )
}

export function markAttended(regId: string, attended: boolean) {
  updateReg(regId, (r) => ({ ...r, status: 'approved', attended, hoursVerified: attended ? r.hoursVerified : false }))
}

export function verifyHours(regId: string, hours: number) {
  updateReg(
    regId,
    (r) => ({ ...r, status: 'approved', attended: true, hoursVerified: true, hours }),
    (r, d) => `${getOrg(d, getOpp(d, r.oppId)?.orgId)?.name ?? 'An organization'} verified ${hours} hour${hours === 1 ? '' : 's'} for ${oppTitle(r, d)}.`,
  )
}

export function unverifyHours(regId: string) {
  updateReg(regId, (r) => ({ ...r, hoursVerified: false }))
}

export function createPost(orgId: string, input: { title: string; body: string; image: string | null }) {
  setDB((d) => ({ ...d, posts: [{ id: uid('post'), orgId, kind: 'update', createdAt: nowISO(), ...input }, ...d.posts] }))
}
