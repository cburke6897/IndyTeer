import { clearVolunteerCache, ctxKey, fetchSnapshot, pickActiveOrg, type SnapshotCtx } from '../data/remote'
import { getDB, setDB } from './store'
import { withRetry } from '../lib/retry'

/**
 * Loads the cache from Supabase. Called by SessionBridge whenever the session, the user row, or the
 * memberships change, and by every action after it writes (`refresh`). A newer call always wins:
 * a slow earlier response is discarded.
 */

let current: SnapshotCtx | null = null
let ticket = 0

const ORG_KEY = (userId: string) => `indyteer.activeOrg.${userId}`

/** Which organization the person last managed on this browser. A UI preference only. */
function getActiveOrgPreference(userId: string): string | null {
  try { return localStorage.getItem(ORG_KEY(userId)) } catch { return null }
}

export async function hydrate(ctx: SnapshotCtx | null): Promise<void> {
  if ((current?.authUser.id ?? null) !== (ctx?.authUser.id ?? null)) clearVolunteerCache()
  current = ctx
  const mine = ++ticket
  // A new load starts: forget any earlier failure so it cannot flash while this one is in flight.
  setDB((d) => (d.loadError ? { ...d, loadError: null } : d))
  try {
    // Retried quietly (see withRetry); the loading screen stays up and an error only shows if every try fails.
    const snapshot = await withRetry(
      () => fetchSnapshot(ctx, ctx ? getActiveOrgPreference(ctx.authUser.id) : null),
      { shouldStop: () => mine !== ticket },
    )
    if (mine !== ticket) return
    setDB((d) => ({
      ...d, ...snapshot,
      sessionUserId: ctx?.authUser.id ?? null, key: ctx ? ctxKey(ctx) : '', ready: true, loadError: null,
    }))
  } catch (cause) {
    if (mine !== ticket) return
    setDB((d) => ({
      ...d, ready: false,
      loadError: cause instanceof Error ? cause.message : 'Could not load your data.',
    }))
  }
}

/** Reloads everything for the current session (after a write, or from a Retry button). */
export function refresh(): Promise<void> {
  return hydrate(current)
}

/** Switches which of the user's organizations is being managed. Only a valid, active owner/admin org is accepted. */
export function setActiveOrg(orgId: string) {
  const userId = getDB().sessionUserId
  if (!userId || !current) return
  const valid = pickActiveOrg(current.memberships, orgId) === orgId
  if (!valid) return
  try { localStorage.setItem(ORG_KEY(userId), orgId) } catch { /* storage unavailable */ }
  setDB((d) => ({ ...d, activeOrgId: orgId }))
}

/** Remembers a just-created organization as the one to manage, before the memberships reload. */
export function rememberActiveOrg(userId: string, orgId: string) {
  try { localStorage.setItem(ORG_KEY(userId), orgId) } catch { /* storage unavailable */ }
}
