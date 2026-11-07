import { db as sb } from '../lib/api/client'
import { getPublicImageUrl } from '../lib/api/storage'
import { getUserProfileForOrganization } from '../lib/api/users'
import { ORG_COLORS } from '../lib/constants'
import type { Tables } from '../types/database'
import type { OrganizationMembership, User as UserRow } from '../types/models'
import type {
  AppNotification, DB, ManualHourLog, Membership, Opportunity, OrgProfile, Post, Registration, Settings, User,
  VolunteerProfile,
} from '../types'
import { defaultSettings } from './defaults'

/**
 * Maps database rows to the shapes the pages use, and loads everything the signed-in person is
 * allowed to see. Authorization is the database's job (RLS + RPCs): each query below simply asks
 * for the table and gets back only the rows the caller may read.
 */

export interface SnapshotCtx {
  authUser: { id: string; email?: string | null }
  profile: UserRow
  memberships: OrganizationMembership[]
}

export type Snapshot = Pick<DB,
  'volunteers' | 'organizations' | 'opportunities' | 'registrations' | 'manualHours' | 'follows' | 'saved' |
  'posts' | 'notifications' | 'settings' | 'availability' | 'memberships' | 'activeOrgId'> & { users: User[] }

const hhmm = (t: string) => t.slice(0, 5)
const imageUrl = (bucket: string, path: string | null | undefined, direct?: string | null) =>
  direct || (path ? (/^https?:/.test(path) ? path : getPublicImageUrl(bucket, path)) : null)

export function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ORG_COLORS[h % ORG_COLORS.length]
}

/* --------------------------------- Account --------------------------------- */

const ORG_STAFF = new Set(['owner', 'admin'])

/** Organizations the user may manage: an active membership with the owner or admin role. */
export function staffOrgIdsOf(memberships: OrganizationMembership[]): string[] {
  return memberships.filter((m) => m.status === 'active' && ORG_STAFF.has(m.role)).map((m) => m.organization_id)
}

/** The inputs that decide where a person is routed (so a stale cache is never trusted for routing). */
export function ctxKey(ctx: { profile: UserRow; memberships: OrganizationMembership[] }) {
  const m = ctx.memberships.map((x) => `${x.organization_id}:${x.role}:${x.status}`).sort().join(',')
  return `${ctx.profile.id}|${ctx.profile.onboarded}|${m}`
}

/**
 * Every signed-in person is a standard user. Whether they can manage an organization is a
 * separate question answered by their memberships, never by a global account type.
 */
export function deriveUser(ctx: SnapshotCtx): User {
  const { profile } = ctx
  return {
    id: profile.id,
    email: ctx.authUser.email ?? '',
    firstName: profile.first_name || profile.full_name.split(/\s+/)[0] || '',
    lastName: profile.last_name || profile.full_name.split(/\s+/).slice(1).join(' '),
    onboarded: profile.onboarded, createdAt: profile.created_at,
  }
}

/** Picks the organization being managed: the remembered one if still valid, else the first. */
export function pickActiveOrg(memberships: OrganizationMembership[], preferred: string | null): string | null {
  const ids = staffOrgIdsOf(memberships)
  return preferred && ids.includes(preferred) ? preferred : ids[0] ?? null
}

function availabilityText(value: unknown): string {
  if (value && typeof value === 'object' && 'summary' in value && typeof (value as { summary: unknown }).summary === 'string') {
    return (value as { summary: string }).summary
  }
  return ''
}

export function mapOwnVolunteer(p: UserRow): VolunteerProfile {
  return {
    id: p.id, userId: p.id,
    firstName: p.first_name || p.full_name.split(/\s+/)[0] || '',
    lastName: p.last_name || p.full_name.split(/\s+/).slice(1).join(' '),
    headline: p.headline ?? '', avatar: imageUrl('avatars', p.avatar_path, p.avatar_url),
    city: p.city ?? '', state: p.state, bio: p.bio ?? '', interests: p.interests, skills: p.skills,
    phone: p.phone ?? '', availability: availabilityText(p.availability), joinedAt: p.created_at,
    privacy: { showHours: true, showHistory: true }, shared: null,
  }
}

type SharedProfile = {
  id: string; full_name: string; headline: string | null; bio: string | null; city: string | null; state: string | null
  avatar_path: string | null; phone: string | null; availability: unknown; show_hours: boolean; show_history: boolean
  verified_hours: number | null
  history: { opportunity_id: string; status: string; hours: number | null }[] | null
}

/** What an organization may see of a volunteer, as decided by get_user_profile_for_organization. */
export function mapSharedVolunteer(p: SharedProfile): VolunteerProfile {
  const [first, ...rest] = (p.full_name || 'Volunteer').split(/\s+/)
  return {
    id: p.id, userId: p.id, firstName: first, lastName: rest.join(' '), headline: p.headline ?? '',
    avatar: imageUrl('avatars', p.avatar_path), city: p.city ?? '', state: p.state ?? 'IN', bio: p.bio ?? '',
    interests: [], skills: [], phone: p.phone ?? '', availability: availabilityText(p.availability), joinedAt: '',
    privacy: { showHours: p.show_hours, showHistory: p.show_history },
    shared: {
      verifiedHours: p.verified_hours,
      history: p.history?.map((h) => ({ oppId: h.opportunity_id, status: h.status, hours: h.hours })) ?? null,
    },
  }
}

const placeholderVolunteer = (id: string): VolunteerProfile => ({
  id, userId: id, firstName: 'Volunteer', lastName: '', headline: '', avatar: null, city: '', state: 'IN', bio: '',
  interests: [], skills: [], phone: '', availability: '', joinedAt: '',
  privacy: { showHours: false, showHistory: false }, shared: null,
})

/* ------------------------------ Row -> UI shape ----------------------------- */

type PublicOrgRow = Tables<'public_organizations'>
type OrgRow = Tables<'organizations'>

export function mapOrg(row: PublicOrgRow | OrgRow, full?: OrgRow): OrgProfile {
  const id = String(row.id)
  const createdAt = (row.created_at as string | null) ?? new Date().toISOString()
  return {
    id, userId: full?.created_by ?? null, name: row.name ?? '',
    logo: imageUrl('org-logos', row.logo_path), cover: imageUrl('org-covers', row.cover_path),
    type: row.type ?? '', description: row.description ?? '', mission: row.mission ?? '', website: row.website ?? '',
    city: row.city ?? '', state: row.state ?? 'IN', email: full?.contact_email ?? '', phone: full?.phone ?? '',
    focus: row.focus ?? [], verified: !!row.verified,
    founded: row.founded_year ?? new Date(createdAt).getFullYear(), color: colorFor(id),
  }
}

export function mapOpportunity(o: Tables<'opportunities'>): Opportunity {
  return {
    id: o.id, orgId: o.organization_id, title: o.title, description: o.description, category: o.category,
    image: imageUrl('opportunity-images', o.image_path, o.image_url), date: o.event_date,
    startTime: hhmm(o.start_time), endTime: hhmm(o.end_time), location: o.location, address: o.address ?? '',
    city: o.city ?? '', virtual: o.virtual, spots: o.spots, minAge: o.min_age, skills: o.skills, hours: o.hours ?? 0,
    deadline: o.registration_deadline ?? o.event_date, recurrence: o.recurrence, instructions: o.instructions ?? '',
    status: o.status, createdAt: o.created_at,
  }
}

export function mapRegistration(r: Tables<'registrations'>, opp?: Opportunity): Registration {
  return {
    id: r.id, oppId: r.opportunity_id, volunteerId: r.user_id, status: r.status, attended: r.attended,
    hoursVerified: r.hours_verified, hours: r.hours ?? opp?.hours ?? 0, createdAt: r.created_at,
  }
}

export function mapPost(p: Tables<'posts'>): Post {
  return {
    id: p.id, orgId: p.organization_id, kind: p.kind, title: p.title, body: p.body,
    image: imageUrl('post-images', p.image_path, p.image_url), createdAt: p.created_at,
  }
}

export function mapNotification(n: Tables<'notifications'>): AppNotification {
  const data = (n.data && typeof n.data === 'object' && !Array.isArray(n.data) ? n.data : {}) as Record<string, unknown>
  let link: string | null = null
  if (n.type === 'registration') link = data.status ? '/app/events' : '/org/registrations'
  else if (n.type === 'opportunity' && typeof data.opportunity_id === 'string') link = `/app/opportunities/${data.opportunity_id}`
  else if (n.type === 'follow') link = '/org/volunteers'
  else if (n.type === 'hours') link = '/app/hours'
  return { id: n.id, userId: n.user_id, text: n.message, link, read: !!n.read_at, createdAt: n.created_at }
}

export function mapManualHours(m: Tables<'manual_hour_entries'>): ManualHourLog {
  return {
    id: m.id, volunteerId: m.user_id, orgName: m.org_name, title: m.title, date: m.entry_date, hours: Number(m.hours),
    notes: m.notes ?? '', createdAt: m.created_at,
  }
}

export function mapSettings(row: Tables<'user_settings'> | null, profile: UserRow): Settings {
  const base = defaultSettings()
  return {
    notifications: {
      email: row?.email_notifications ?? base.notifications.email,
      newOpportunities: row?.new_opportunity_notifications ?? base.notifications.newOpportunities,
      confirmations: row?.registration_notifications ?? base.notifications.confirmations,
    },
    privacy: { publicProfile: profile.public_profile, showHours: profile.show_hours, showHistory: profile.show_history },
  }
}

/* --------------------------------- Loading --------------------------------- */

const volunteerCache = new Map<string, VolunteerProfile>()
export const clearVolunteerCache = () => volunteerCache.clear()

async function must<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(`Could not load ${what}: ${error.message}`)
  return (data ?? []) as T
}

/** Loads everything the current visitor may see. `ctx` is null when signed out (public data only). */
export async function fetchSnapshot(ctx: SnapshotCtx | null, preferredOrgId: string | null): Promise<Snapshot> {
  const memberOrgIds = ctx ? ctx.memberships.filter((m) => m.status === 'active').map((m) => m.organization_id) : []

  const [orgRows, ownOrgRows, oppRows, availRows, postRows] = await Promise.all([
    must(sb.from('public_organizations').select('*').order('name'), 'organizations'),
    memberOrgIds.length
      ? must(sb.from('organizations').select('*').in('id', memberOrgIds), 'your organizations')
      : Promise.resolve([] as OrgRow[]),
    must(sb.from('opportunities').select('*').order('event_date').range(0, 999), 'opportunities'),
    must(sb.from('opportunity_availability').select('*'), 'availability'),
    must(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 'posts'),
  ])

  const ownById = new Map(ownOrgRows.map((o) => [o.id, o]))
  const organizations = orgRows.map((o) => mapOrg(o, ownById.get(o.id as string)))
  // An organization the viewer belongs to is always shown, even if the public view lagged behind.
  for (const o of ownOrgRows) if (!organizations.some((x) => x.id === o.id)) organizations.push(mapOrg(o, o))

  const opportunities = oppRows.map(mapOpportunity)
  const oppById = new Map(opportunities.map((o) => [o.id, o]))
  const availability: Record<string, number> = {}
  for (const a of availRows) if (a.opportunity_id) availability[a.opportunity_id] = a.spots_left ?? 0

  const empty = {
    volunteers: [] as VolunteerProfile[], registrations: [] as Registration[], manualHours: [] as ManualHourLog[],
    follows: [] as DB['follows'], saved: [] as DB['saved'], notifications: [] as AppNotification[],
    settings: {} as Record<string, Settings>, users: [] as User[], memberships: [] as Membership[], activeOrgId: null as string | null,
  }
  if (!ctx) return { ...empty, organizations, opportunities, availability, posts: postRows.map(mapPost) }

  const [regRows, manualRows, followRows, savedRows, noteRows, settingsRow] = await Promise.all([
    must(sb.from('registrations').select('*').order('created_at', { ascending: false }), 'registrations'),
    must(sb.from('manual_hour_entries').select('*').order('entry_date', { ascending: false }), 'your hours'),
    must(sb.from('organization_follows').select('*'), 'follows'),
    must(sb.from('saved_opportunities').select('*'), 'saved opportunities'),
    must(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50), 'notifications'),
    sb.from('user_settings').select('*').eq('user_id', ctx.profile.id).maybeSingle().then((r) => r.data),
  ])

  const user = deriveUser(ctx)
  const memberships: Membership[] = ctx.memberships.map((m) => ({ orgId: m.organization_id, role: m.role, status: m.status }))
  const registrations = regRows.map((r) => mapRegistration(r, oppById.get(r.opportunity_id)))

  // Volunteers: yourself, plus (for organizations) whoever registered, as far as the database shares.
  const volunteers: VolunteerProfile[] = [mapOwnVolunteer(ctx.profile)]
  const others = [...new Set(registrations.map((r) => r.volunteerId))].filter((id) => id !== ctx.profile.id)
  if (others.length) {
    await Promise.all(others.map(async (id) => {
      let v = volunteerCache.get(id)
      if (!v) {
        try {
          v = mapSharedVolunteer(await getUserProfileForOrganization(id) as unknown as SharedProfile)
          volunteerCache.set(id, v)
        } catch {
          // Private profile (for example a declined or cancelled registration): keep the row usable.
          v = placeholderVolunteer(id)
        }
      }
      volunteers.push(v)
    }))
  }

  return {
    users: [user], memberships, activeOrgId: pickActiveOrg(ctx.memberships, preferredOrgId),
    volunteers, organizations, opportunities, registrations, availability,
    manualHours: manualRows.map(mapManualHours),
    follows: followRows.map((f) => ({ volunteerId: f.user_id, orgId: f.organization_id })),
    saved: savedRows.map((s) => ({ volunteerId: s.user_id, oppId: s.opportunity_id })),
    posts: postRows.map(mapPost),
    notifications: noteRows.map(mapNotification),
    settings: { [ctx.profile.id]: mapSettings(settingsRow, ctx.profile) },
  }
}

