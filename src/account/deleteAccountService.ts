import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { listMyMemberships, listOrganizationMemberships } from '../lib/api/organizations'

/**
 * Permanent account deletion, done by the `delete-account` Edge Function (service role): it removes
 * the user's Storage objects, deletes organizations they own, then deletes the Auth user (which
 * cascades to public.users and everything keyed to it).
 *
 * Ownership transfer is available from the organization Members page. Shared ownership blocks
 * account deletion until transfer, while a separate organization deletion flow requires explicit consent.
 */

export interface OwnedOrganization {
  id: string
  name: string
  /** Active members other than the user. Greater than zero blocks deletion. */
  otherActiveMembers: number
}

export interface DeletionImpact {
  owned: OwnedOrganization[]
  /** Organizations the user belongs to without owning them; they only lose this member. */
  memberOfCount: number
}

/** What deleting this account would affect. A preview only: the Edge Function re-checks everything. */
export async function getDeletionImpact(userId: string): Promise<DeletionImpact> {
  const memberships = (await listMyMemberships()).filter((m) => m.status === 'active')
  const ownedMemberships = memberships.filter((m) => m.role === 'owner')

  const owned: OwnedOrganization[] = []
  if (ownedMemberships.length) {
    const ids = ownedMemberships.map((m) => m.organization_id)
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id,name')
      .in('id', ids)
    if (error) throw new Error(error.message)
    const names = new Map((organizations ?? []).map((o) => [o.id, o.name]))
    for (const id of ids) {
      // Owners are admins, so RLS lets them read every membership of their organization.
      const everyone = await listOrganizationMemberships(id)
      owned.push({
        id,
        name: names.get(id) ?? 'Your organization',
        otherActiveMembers: everyone.filter((m) => m.user_id !== userId && m.status === 'active')
          .length,
      })
    }
  }
  return { owned, memberOfCount: memberships.length - ownedMemberships.length }
}

export type DeleteFailureKind =
  /** Refused up front, nothing was removed (shared organization, unconfirmed organization deletion). */
  | 'blocked'
  /** The request failed part-way or its outcome is unknown: some data may already be gone. */
  | 'incomplete'

export class DeleteAccountError extends Error {
  kind: DeleteFailureKind
  code: string | null
  organizations: OwnedOrganization[]
  constructor(
    message: string,
    kind: DeleteFailureKind,
    code: string | null = null,
    organizations: OwnedOrganization[] = [],
  ) {
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
 * Calls the Edge Function with the user's own session. Resolves only when the function reports
 * `{ deleted: true }`; any other outcome throws a DeleteAccountError. On success the local session
 * is cleared (the Auth user no longer exists, so a global sign-out would be rejected).
 */
export async function deleteAccount(options: { deleteOwnedOrganizations: boolean }): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
    body: { deleteOwnedOrganizations: options.deleteOwnedOrganizations },
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context instanceof Response ? error.context.status : 0
      const body = (await (error.context as Response).json().catch(() => null)) as ErrorBody | null
      if (status === 409) {
        throw new DeleteAccountError(
          body?.error ?? 'Your account cannot be deleted yet.',
          'blocked',
          body?.code ?? null,
          body?.organizations ?? [],
        )
      }
      if (status === 401) {
        throw new DeleteAccountError(
          'Your session could not be verified. Log in again, then retry. Nothing was deleted.',
          'blocked',
          'UNAUTHENTICATED',
        )
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
