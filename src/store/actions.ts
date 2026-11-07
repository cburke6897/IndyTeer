import type { Opportunity, OrgProfile, RegStatus, Settings } from '../types'
import type { User as UserRow } from '../types/models'
import { db as sb } from '../lib/api/client'
import { followOrganization, unfollowOrganization } from '../lib/api/follows'
import { saveOpportunity, unsaveOpportunity } from '../lib/api/saved'
import { addManualHours as apiAddManualHours, deleteManualHours as apiDeleteManualHours } from '../lib/api/hours'
import { markAllNotificationsRead, markNotificationRead as apiMarkRead } from '../lib/api/notifications'
import { updateSettings as apiUpdateSettings } from '../lib/api/settings'
import { createOrganizationPost, deletePost as apiDeletePost } from '../lib/api/posts'
import { updateUser } from '../lib/api/users'
import * as orgApi from '../lib/api/organizations'
import {
  cancelRegistration as apiCancel, registerForOpportunity as apiRegister, setRegistrationAttended,
  setRegistrationStatus as apiSetStatus, unverifyRegistrationHours, verifyRegistrationHours,
} from '../lib/api/registrations'
import {
  createOpportunity as apiCreateOpp, deleteOpportunity as apiDeleteOpp, publishOpportunity, updateOpportunity as apiUpdateOpp,
} from '../lib/api/opportunities'
import { uploadOpportunityImage, uploadOrganizationImage } from '../lib/api/storage'
import { resetDB, getDB, setDB } from './store'
import { refresh, reloadAccount } from './sync'
import { getOpp, isPast, registrationClosed, spotsLeft } from './selectors'

export { setActiveOrg } from './sync'

/*
 * Every function here is a write to Supabase followed by a refresh of the client cache. The database
 * (RLS + RPCs) decides what is allowed; errors are thrown as readable messages for the caller to show.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const messageOf = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

/* ----------------------------------- Account ---------------------------------- */

/** Clears the in-memory cache after the account was deleted on the server. */
export function deleteAccount(_userId: string) {
  void _userId
  resetDB()
}

export interface VolunteerProfileInput {
  firstName: string; lastName: string; headline: string; avatar: string | null; city: string; bio: string
  interests: string[]; skills: string[]; phone: string; availability: string
}

/** Saves the volunteer's own profile to public.users. Returns the row so callers can refresh the session. */
export function saveVolunteerProfile(input: VolunteerProfileInput): Promise<UserRow> {
  const first = input.firstName.trim()
  const last = input.lastName.trim()
  return updateUser({
    first_name: first, last_name: last, full_name: `${first} ${last}`.trim(), headline: input.headline.trim() || null,
    bio: input.bio.trim(), city: input.city, phone: input.phone.trim() || null,
    availability: input.availability ? { summary: input.availability } : {},
    interests: input.interests, skills: input.skills,
    avatar_url: input.avatar,
    ...(input.avatar ? {} : { avatar_path: null }),
  })
}

/** Removes the profile picture (uploads are saved by the uploader itself). */
export function removeAvatar(): Promise<UserRow> {
  return updateUser({ avatar_url: null, avatar_path: null })
}

/** Notification toggles go to user_settings; privacy toggles go to the user's row. */
export async function saveSettings(next: Settings): Promise<UserRow> {
  const uid = getDB().sessionUserId
  // Show the new value immediately; a failed write is undone by the refresh below.
  if (uid) setDB((d) => ({ ...d, settings: { ...d.settings, [uid]: next } }))
  try {
    return await writeSettings(next)
  } catch (e) {
    await refresh()
    throw e
  }
}

async function writeSettings(next: Settings): Promise<UserRow> {
  await apiUpdateSettings({
    email_notifications: next.notifications.email,
    new_opportunity_notifications: next.notifications.newOpportunities,
    registration_notifications: next.notifications.confirmations,
  })
  return updateUser({
    public_profile: next.privacy.publicProfile, show_hours: next.privacy.showHours, show_history: next.privacy.showHistory,
  })
}

/* --------------------------------- Volunteers --------------------------------- */

export async function toggleFollow(orgId: string): Promise<boolean> {
  const following = getDB().follows.some((f) => f.orgId === orgId && f.volunteerId === getDB().sessionUserId)
  if (following) await unfollowOrganization(orgId)
  else await followOrganization(orgId)
  await refresh()
  return !following
}

export async function toggleSave(oppId: string): Promise<boolean> {
  const saved = getDB().saved.some((s) => s.oppId === oppId && s.volunteerId === getDB().sessionUserId)
  if (saved) await unsaveOpportunity(oppId)
  else await saveOpportunity(oppId)
  await refresh()
  return !saved
}

export async function registerForOpportunity(volunteerId: string, oppId: string): Promise<Result> {
  const db = getDB()
  const opp = getOpp(db, oppId)
  if (!opp || opp.status !== 'published') return { ok: false, error: 'This opportunity is no longer available.' }
  if (isPast(opp) || registrationClosed(opp)) return { ok: false, error: 'Registration for this opportunity has closed.' }
  const existing = db.registrations.find((r) => r.volunteerId === volunteerId && r.oppId === oppId)
  if (existing && (existing.status === 'pending' || existing.status === 'approved')) return { ok: false, error: 'You’re already registered for this opportunity.' }
  if (existing && (existing.status === 'declined' || existing.status === 'removed')) return { ok: false, error: 'The organization has closed your registration for this event.' }
  if (spotsLeft(db, opp) <= 0) return { ok: false, error: 'Sorry, every spot is taken.' }
  try {
    await apiRegister(oppId)
    await refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: messageOf(e, 'Could not register. Try again.') }
  }
}

export async function cancelRegistration(regId: string) {
  await apiCancel(regId)
  await refresh()
}

export async function addManualHours(input: { orgName: string; title: string; date: string; hours: number; notes: string }) {
  await apiAddManualHours({ org_name: input.orgName, title: input.title, entry_date: input.date, hours: input.hours, notes: input.notes || null })
  await refresh()
}

export async function deleteManualHours(id: string) {
  await apiDeleteManualHours(id)
  await refresh()
}

/* ------------------------------ Notifications ------------------------------ */

export async function markNotificationsRead() {
  await markAllNotificationsRead()
  await refresh()
}

export async function markNotificationRead(id: string) {
  await apiMarkRead(id)
  await refresh()
}

/* ------------------------------- Organizations ------------------------------- */

export type OrgProfileInput = Pick<OrgProfile, 'name' | 'type' | 'description' | 'mission' | 'website' | 'city' | 'email' | 'phone' | 'focus'>
  & { logo?: string | null; cover?: string | null }

/** Updates an organization the caller administers. Images are uploaded separately; `null` removes one. */
export async function updateOrgProfile(id: string, input: OrgProfileInput) {
  const { error } = await sb.from('organizations').update({
    name: input.name, type: input.type, description: input.description, mission: input.mission,
    website: input.website || null, city: input.city, contact_email: input.email, phone: input.phone || null, focus: input.focus,
    ...(input.logo === null ? { logo_path: null } : {}),
    ...(input.cover === null ? { cover_path: null } : {}),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  await refresh()
}

/** Uploads a logo or cover to Storage (saved on the organization) and returns its public URL. */
export async function uploadOrgImage(orgId: string, kind: 'logo' | 'cover', file: File): Promise<string> {
  const image = await uploadOrganizationImage(orgId, file, kind)
  await refresh()
  return image.url
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'orgId' | 'createdAt'>

function toRow(i: OpportunityInput) {
  return {
    title: i.title.trim(), description: i.description.trim(), category: i.category, city: i.city,
    location: i.location.trim() || (i.virtual ? 'Online' : ''), address: i.address.trim() || null, virtual: i.virtual,
    min_age: i.minAge, skills: i.skills, hours: i.hours, registration_deadline: i.deadline || null, recurrence: i.recurrence,
    instructions: i.instructions.trim() || null, event_date: i.date, start_time: i.startTime, end_time: i.endTime, spots: i.spots,
  }
}

function dataUrlToFile(dataUrl: string): File {
  const [head, body] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return new File([bytes], 'image', { type: mime })
}

/** A picked image arrives as a data URL; upload it to Storage. An http URL is unchanged. null removes it. */
async function saveOpportunityImage(oppId: string, image: string | null, hadImage: boolean) {
  if (image?.startsWith('data:')) await uploadOpportunityImage(oppId, dataUrlToFile(image))
  else if (image === null && hadImage) await apiUpdateOpp(oppId, { image_path: null, image_url: null })
}

export async function createOpportunity(orgId: string, input: OpportunityInput): Promise<string> {
  // New opportunities start as drafts (status is not insertable); publishing is a separate update.
  const created = await apiCreateOpp({ ...toRow(input), organization_id: orgId })
  try {
    await saveOpportunityImage(created.id, input.image, false)
    if (input.status === 'published') await publishOpportunity(created.id)
  } finally {
    await refresh()
  }
  return created.id
}

export async function updateOpportunity(id: string, input: OpportunityInput) {
  const existing = getOpp(getDB(), id)
  try {
    await apiUpdateOpp(id, { ...toRow(input), status: input.status })
    await saveOpportunityImage(id, input.image, !!existing?.image)
  } finally {
    await refresh()
  }
}

export async function deleteOpportunity(id: string) {
  await apiDeleteOpp(id)
  await refresh()
  return true
}

export async function setRegistrationStatus(regId: string, status: Extract<RegStatus, 'approved' | 'declined' | 'removed'>) {
  await apiSetStatus(regId, status)
  await refresh()
}

export async function markAttended(regId: string, attended: boolean) {
  await setRegistrationAttended(regId, attended)
  await refresh()
}

export async function verifyHours(regId: string, hours: number) {
  await verifyRegistrationHours(regId, hours)
  await refresh()
}

export async function unverifyHours(regId: string) {
  await unverifyRegistrationHours(regId)
  await refresh()
}

export async function createPost(orgId: string, input: { title: string; body: string }) {
  await createOrganizationPost(orgId, input.title, input.body)
  await refresh()
}

export async function deletePost(id: string) {
  await apiDeletePost(id)
  await refresh()
}

/* ------------------------------- Membership -------------------------------- */
// Joining, leaving and ownership are decided by the database (RPCs). Changes to the person's own
// memberships reload the account so routing and organization access follow the backend's answer.

const me = () => {
  const id = getDB().sessionUserId
  if (!id) throw new Error('Sign in first.')
  return id
}

/** Ask to join an organization. Allowed only when its join policy accepts requests. */
export async function requestToJoin(orgId: string) {
  await orgApi.requestToJoinOrganization(orgId)
  await reloadAccount()
}

/** Withdraw your own pending request, or leave an organization you belong to. */
export async function leaveOrCancelRequest(orgId: string) {
  await orgApi.removeOrganizationMember(orgId, me())
  await reloadAccount()
}

export async function respondToInvitation(orgId: string, accept: boolean) {
  if (accept) await orgApi.acceptOrganizationInvite(orgId)
  else await orgApi.declineOrganizationInvite(orgId)
  await reloadAccount()
}

/** Owners and admins: approve or decline a request to join. */
export async function reviewJoinRequest(orgId: string, userId: string, approve: boolean) {
  await orgApi.reviewMembershipRequest(orgId, userId, approve)
  await refresh()
}

export async function inviteToOrganization(orgId: string, userId: string, role: 'admin' | 'member') {
  await orgApi.inviteUserToOrganization(orgId, userId, role)
  await refresh()
}

export async function changeMemberRole(orgId: string, userId: string, role: 'admin' | 'member') {
  await orgApi.setOrganizationMemberRole(orgId, userId, role)
  await refresh()
}

/** Remove someone else, or cancel an invitation. */
export async function removeFromOrganization(orgId: string, userId: string) {
  await orgApi.removeOrganizationMember(orgId, userId)
  await refresh()
}

/** Hand ownership to an active member. The caller becomes an admin. */
export async function transferOwnership(orgId: string, newOwnerId: string) {
  await orgApi.transferOrganizationOwnership(orgId, newOwnerId)
  await reloadAccount()
}

/** Permanently delete an organization (Edge Function; resolves only when the server confirms). */
export async function deleteOrganization(orgId: string) {
  await orgApi.deleteOrganization(orgId)
  await reloadAccount()
  return true
}
