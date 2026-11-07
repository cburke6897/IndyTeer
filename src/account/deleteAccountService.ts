import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  listMyMemberships, listOrganizationMembers, listOrganizationMemberships, transferOrganizationOwnership,
} from '../lib/api/organizations'

/**
 * Permanent account deletion, done by the `delete-account` Edge Function (service role): it removes
 * the user's Storage objects, deletes the organizations the user chose to delete, then deletes the
 * Auth user (which cascades to public.users and everything keyed to it).
 *
 * A person who solely owns an organization must decide what happens to it first:
 *  - transfer ownership to another active member (transfer_organization_ownership RPC), or
 *  - delete the organization and its data.
 * The function refuses to delete the account until every such organization has been decided, and it
 * only deletes organizations whose ids the caller lists explicitly.
 */

export interface OrgMemberOption {
  userId: string
  name: string
  role: 'admin' | 'member'
}

export interface OwnedOrganization {
  id: string
  name: string
  /** Other active owners. When there are any, the organization lives on and needs no decision. */
  otherOwners: number
  /** Active admins and members who could take over (names come from list_organization_members). */
  eligible: OrgMemberOption[]
  /** Active people other than the user. Deleting the organization affects all of them. */
  otherActiveMembers: number
  /** False when the server does not have the ownership-transfer functions yet. */
  transferAvailable: boolean
}

export interface DeletionImpact {
  owned: OwnedOrganization[]
  /** Organizations the user belongs to without owning them; they only lose this member. */
  memberOfCount: number
}

/** The error PostgREST returns when an RPC does not exist (the migration has not been applied). */
const isMissingFunction = (e: unknown) => {
  const code = (e as { code?: string })?.code
  return code === 'PGRST202' || code === '42883' || /could not find the function|schema cache/i.test((e as Error)?.message ?? '')
}

/** What deleting this account would affect. A preview only: the Edge Function re-checks everything. */
export async function getDeletionImpact(userId: string): Promise<DeletionImpact> {
  const memberships = (await listMyMemberships()).filter((m) => m.status === 'active')
  const ownedMemberships = memberships.filter((m) => m.role === 'owner')

  const owned: OwnedOrganization[] = []
  if (ownedMemberships.length) {
    const ids = ownedMemberships.map((m) => m.organization_id)
    const { data: organizations, error } = await supabase.from('organizations').select('id,name').in('id', ids)
    if (error) throw new Error(error.message)
    const names = new Map((organizations ?? []).map((o) => [o.id, o.name]))
    for (const id of ids) {
      let eligible: OrgMemberOption[] = []
      let transferAvailable = true
      let others: { userId: string; role: string }[]
      try {
        const people = (await listOrganizationMembers(id)).filter((m) => m.user_id !== userId && m.status === 'active')
        others = people.map((m) => ({ userId: m.user_id, role: m.role }))
        eligible = people.filter((m) => m.role !== 'owner').map((m) => ({ userId: m.user_id, name: m.full_name || 'Member', role: m.role as 'admin' | 'member' }))
      } catch (e) {
        if (!isMissingFunction(e)) throw e
        // Older server: ids and roles only, and no way to transfer.
        transferAvailable = false
        others = (await listOrganizationMemberships(id)).filter((m) => m.user_id !== userId && m.status === 'active').map((m) => ({ userId: m.user_id, role: m.role }))
      }
      owned.push({
        id, name: names.get(id) ?? 'Your organization',
        otherOwners: others.filter((m) => m.role === 'owner').length,
        eligible, otherActiveMembers: others.length, transferAvailable,
      })
    }
  }
  return { owned, memberOfCount: memberships.length - ownedMemberships.length }
}

/** Hands an organization to another active member. The previous owner becomes an admin. */
export async function transferOwnership(organizationId: string, newOwnerId: string): Promise<void> {
  try {
    await transferOrganizationOwnership(organizationId, newOwnerId)
  } catch (e) {
    if (isMissingFunction(e)) throw new Error('Ownership transfer is not available on this server yet. Delete the organization instead, or ask the IndyTeer team to enable it.', { cause: e })
    throw e
  }
}

export type DeleteFailureKind =
  /** Refused up front, nothing was removed (an organization still needs a decision). */
  | 'blocked'
  /** The request failed part-way or its outcome is unknown: some data may already be gone. */
  | 'incomplete'

export class DeleteAccountError extends Error {
  kind: DeleteFailureKind
  code: string | null
  organizations: { id: string; name: string; otherActiveMembers: number }[]
  constructor(message: string, kind: DeleteFailureKind, code: string | null = null, organizations: { id: string; name: string; otherActiveMembers: number }[] = []) {
    super(message)
    this.name = 'DeleteAccountError'
    this.kind = kind
    this.code = code
    this.organizations = organizations
  }
}

type ErrorBody = {
  code?: string
  error?: string
  organizations?: { id: string; name: string; otherActiveMembers: number }[]
}

const INCOMPLETE_MESSAGE =
  'Your account deletion did not finish. Some of your files or organizations may already have been removed, and your account may still exist. Try again; if it keeps failing, contact the IndyTeer team.'

/**
 * Calls the Edge Function with the user's own session. `deleteOrganizationIds` lists the organizations
 * the user explicitly chose to delete. Resolves only when the function reports `{ deleted: true }`;
 * any other outcome throws a DeleteAccountError. On success the local session is cleared (the Auth
 * user no longer exists, so a global sign-out would be rejected).
 */
export async function deleteAccount(options: { deleteOrganizationIds: string[] }): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: { deleteOrganizationIds: options.deleteOrganizationIds },
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context instanceof Response ? error.context.status : 0
      const body = (await (error.context as Response).json().catch(() => null)) as ErrorBody | null
      if (status === 409) {
        throw new DeleteAccountError(body?.error ?? 'Your account cannot be deleted yet.', 'blocked', body?.code ?? null, body?.organizations ?? [])
      }
      if (status === 401) {
        throw new DeleteAccountError('Your session could not be verified. Log in again, then retry. Nothing was deleted.', 'blocked', 'UNAUTHENTICATED')
      }
    }
    // 5xx, network failure, or relay error: the function may have gotten part-way.
    throw new DeleteAccountError(INCOMPLETE_MESSAGE, 'incomplete')
  }

  if ((data as { deleted?: unknown } | null)?.deleted !== true) {
    throw new DeleteAccountError(INCOMPLETE_MESSAGE, 'incomplete')
  }

  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
}
