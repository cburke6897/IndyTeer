import type { DB, HourEntry, Opportunity, OrgProfile, Registration, User, VolunteerProfile } from '../types'
import { todayISO } from '../lib/utils'

export const getOrg = (db: DB, id: string | null | undefined) => db.organizations.find((o) => o.id === id)
export const getVolunteer = (db: DB, id: string | null | undefined) => db.volunteers.find((v) => v.id === id)
export const getOpp = (db: DB, id: string | null | undefined) => db.opportunities.find((o) => o.id === id)
export const getUser = (db: DB, id: string | null | undefined) => db.users.find((u) => u.id === id)

export function sessionUser(db: DB): User | null {
  return db.users.find((u) => u.id === db.sessionUserId) ?? null
}
/** The standard user's own profile. Available to every user who has finished onboarding. */
export function sessionVolunteer(db: DB): VolunteerProfile | null {
  const u = sessionUser(db)
  return u?.onboarded ? getVolunteer(db, u.id) ?? null : null
}

/** Ids of the organizations the user may manage (active owner or admin membership). */
export function staffOrgIds(db: DB): string[] {
  return db.memberships.filter((m) => m.status === 'active' && (m.role === 'owner' || m.role === 'admin')).map((m) => m.orgId)
}
export function staffOrgs(db: DB): OrgProfile[] {
  return staffOrgIds(db).map((id) => getOrg(db, id)).filter((o): o is OrgProfile => !!o)
}
export function memberRole(db: DB, orgId: string) {
  return db.memberships.find((m) => m.orgId === orgId && m.status === 'active')?.role ?? null
}

/** The organization currently being managed, if the user manages any. */
export function sessionOrg(db: DB): OrgProfile | null {
  const id = db.activeOrgId
  return id && staffOrgIds(db).includes(id) ? getOrg(db, id) ?? null : null
}

export function homePathFor(user: User | null) {
  if (!user) return '/login'
  return user.onboarded ? '/app' : '/onboarding'
}

/* ------------------------------ Opportunities ------------------------------ */
export type OppBucket = 'draft' | 'active' | 'upcoming' | 'completed'

export function isPast(opp: Opportunity) {
  return opp.recurrence === 'none' && opp.date < todayISO()
}

export function oppBucket(opp: Opportunity): OppBucket {
  if (opp.status === 'draft') return 'draft'
  if (isPast(opp)) return 'completed'
  if (opp.recurrence !== 'none' || opp.date === todayISO()) return 'active'
  return 'upcoming'
}

export function oppRegs(db: DB, oppId: string) {
  return db.registrations.filter((r) => r.oppId === oppId)
}

/** Registrations that occupy a spot. */
export function takenSpots(db: DB, oppId: string) {
  return oppRegs(db, oppId).filter((r) => r.status === 'pending' || r.status === 'approved').length
}

/** Spots left, from the database's availability view (it counts every registration, not just yours). */
export function spotsLeft(db: DB, opp: Opportunity) {
  const known = db.availability[opp.id]
  return known ?? Math.max(0, opp.spots - takenSpots(db, opp.id))
}

export function registrationClosed(opp: Opportunity) {
  return isPast(opp) || opp.deadline < todayISO()
}

export function myRegistration(db: DB, volunteerId: string | undefined, oppId: string): Registration | undefined {
  if (!volunteerId) return undefined
  return db.registrations.find((r) => r.volunteerId === volunteerId && r.oppId === oppId)
}

export function oppTypes(opp: Opportunity): string[] {
  const t = [opp.recurrence === 'none' ? 'One-time' : 'Recurring']
  if (opp.virtual) t.push('Virtual')
  if (opp.skills.length) t.push('Skills-based')
  return t
}

export function recurrenceLabel(r: Opportunity['recurrence']) {
  return { none: 'One-time', weekly: 'Repeats weekly', biweekly: 'Repeats every 2 weeks', monthly: 'Repeats monthly' }[r]
}

export function openOpps(db: DB) {
  return db.opportunities.filter((o) => o.status === 'published' && !isPast(o))
}

export function orgOpps(db: DB, orgId: string) {
  return db.opportunities.filter((o) => o.orgId === orgId)
}

export function activeOppCount(db: DB, orgId: string) {
  return openOpps(db).filter((o) => o.orgId === orgId).length
}

/* --------------------------------- Follows --------------------------------- */
export function isFollowing(db: DB, volunteerId: string | undefined, orgId: string) {
  return !!volunteerId && db.follows.some((f) => f.volunteerId === volunteerId && f.orgId === orgId)
}
export function followedOrgs(db: DB, volunteerId: string) {
  return db.follows.filter((f) => f.volunteerId === volunteerId).map((f) => getOrg(db, f.orgId)).filter((o): o is OrgProfile => !!o)
}
/** Followers are only visible to the organization's own administrators (row-level security). */
export function followerCount(db: DB, org: OrgProfile): number | null {
  return staffOrgIds(db).includes(org.id) ? db.follows.filter((f) => f.orgId === org.id).length : null
}
export function isSaved(db: DB, volunteerId: string | undefined, oppId: string) {
  return !!volunteerId && db.saved.some((s) => s.volunteerId === volunteerId && s.oppId === oppId)
}

/* ---------------------------------- Hours ---------------------------------- */
export function hourEntries(db: DB, volunteerId: string): HourEntry[] {
  const fromEvents: HourEntry[] = db.registrations
    .filter((r) => r.volunteerId === volunteerId && r.status === 'approved' && r.attended)
    .flatMap((r): HourEntry[] => {
      const opp = getOpp(db, r.oppId)
      if (!opp) return []
      const org = getOrg(db, opp.orgId)
      return [{
        id: r.id, volunteerId, orgId: org?.id ?? null, orgName: org?.name ?? 'Unknown organization', title: opp.title,
        date: opp.date, hours: r.hours, status: r.hoursVerified ? 'verified' : 'pending', source: 'event',
      }]
    })
  const manual: HourEntry[] = db.manualHours
    .filter((m) => m.volunteerId === volunteerId)
    .map((m) => ({
      id: m.id, volunteerId, orgId: null, orgName: m.orgName, title: m.title, date: m.date, hours: m.hours,
      status: 'pending' as const, source: 'manual' as const, notes: m.notes,
    }))
  return [...fromEvents, ...manual].sort((a, b) => b.date.localeCompare(a.date))
}

/** What an organization is shown of another volunteer's history (the database decides what is shared). */
export function sharedEntries(db: DB, v: VolunteerProfile): HourEntry[] {
  return (v.shared?.history ?? []).flatMap((h): HourEntry[] => {
    const opp = getOpp(db, h.oppId)
    if (!opp || h.status !== 'approved') return []
    const org = getOrg(db, opp.orgId)
    return [{
      id: `${v.id}-${h.oppId}`, volunteerId: v.id, orgId: org?.id ?? null, orgName: org?.name ?? 'Organization', title: opp.title,
      date: opp.date, hours: h.hours ?? opp.hours, status: h.hours != null ? 'verified' : 'pending', source: 'event',
    }]
  }).sort((a, b) => b.date.localeCompare(a.date))
}

export function hourTotals(entries: HourEntry[]) {
  const verified = entries.filter((e) => e.status === 'verified').reduce((s, e) => s + e.hours, 0)
  const pending = entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.hours, 0)
  return { verified, pending, total: verified + pending, completed: entries.filter((e) => e.source === 'event').length }
}

export function volunteerRegistrations(db: DB, volunteerId: string) {
  return db.registrations.filter((r) => r.volunteerId === volunteerId)
}

/* ------------------------------- Organizations ------------------------------- */
export function orgRegistrations(db: DB, orgId: string) {
  const ids = new Set(orgOpps(db, orgId).map((o) => o.id))
  return db.registrations.filter((r) => ids.has(r.oppId))
}

export interface OrgVolunteerSummary {
  volunteer: VolunteerProfile
  hours: number
  events: number
  lastDate: string
}

export function orgVolunteers(db: DB, orgId: string): OrgVolunteerSummary[] {
  const map = new Map<string, OrgVolunteerSummary>()
  for (const r of orgRegistrations(db, orgId)) {
    if (!(r.status === 'approved' && r.attended)) continue
    const v = getVolunteer(db, r.volunteerId)
    const opp = getOpp(db, r.oppId)
    if (!v || !opp) continue
    const cur = map.get(v.id) ?? { volunteer: v, hours: 0, events: 0, lastDate: '' }
    cur.events += 1
    if (r.hoursVerified) cur.hours += r.hours
    if (opp.date > cur.lastDate) cur.lastDate = opp.date
    map.set(v.id, cur)
  }
  return [...map.values()].sort((a, b) => b.hours - a.hours)
}

export function orgStats(db: DB, orgId: string) {
  const opps = orgOpps(db, orgId).filter((o) => o.status === 'published')
  const regs = orgRegistrations(db, orgId)
  const live = regs.filter((r) => r.status === 'pending' || r.status === 'approved')
  const attended = regs.filter((r) => r.status === 'approved' && r.attended)
  const hours = attended.filter((r) => r.hoursVerified).reduce((s, r) => s + r.hours, 0)
  const pastApproved = regs.filter((r) => {
    const o = getOpp(db, r.oppId)
    return r.status === 'approved' && !!o && isPast(o)
  })
  const attendanceRate = pastApproved.length ? Math.round((pastApproved.filter((r) => r.attended).length / pastApproved.length) * 100) : 0
  const counts = new Map<string, number>()
  attended.forEach((r) => counts.set(r.volunteerId, (counts.get(r.volunteerId) ?? 0) + 1))
  const uniqueVolunteers = counts.size
  const returning = [...counts.values()].filter((c) => c > 1).length
  return {
    totalRegistrations: live.length,
    pending: regs.filter((r) => r.status === 'pending').length,
    hours,
    pendingHours: attended.filter((r) => !r.hoursVerified).reduce((s, r) => s + r.hours, 0),
    activeOpps: opps.filter((o) => !isPast(o)).length,
    upcomingEvents: opps.filter((o) => !isPast(o)).sort((a, b) => a.date.localeCompare(b.date)),
    completedEvents: opps.filter((o) => isPast(o)).length,
    attendanceRate,
    uniqueVolunteers,
    returning,
    returningRate: uniqueVolunteers ? Math.round((returning / uniqueVolunteers) * 100) : 0,
  }
}
