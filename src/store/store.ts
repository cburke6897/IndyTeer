import { useSyncExternalStore } from 'react'
import type { DB } from '../types'

/**
 * Client-side cache of what the signed-in person is allowed to see. The database is the only source
 * of truth: nothing here is persisted, and it starts empty. `hydrate` (./sync) fills it from
 * Supabase, and every action in ./actions writes to Supabase and then refreshes it.
 */
export function emptyDB(): DB {
  return {
    users: [], volunteers: [], organizations: [], opportunities: [], registrations: [], manualHours: [],
    follows: [], saved: [], posts: [], notifications: [], settings: {}, availability: {},
    memberships: [], activeOrgId: null, sessionUserId: null, ready: false, key: '', loadError: null,
  }
}

// An earlier prototype stored sample data in localStorage. Remove it so it can never resurface.
try { localStorage.removeItem('indyteer.db.v1') } catch { /* storage unavailable */ }

let state: DB = emptyDB()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getDB() {
  return state
}

export function setDB(updater: (db: DB) => DB) {
  state = updater(state)
  emit()
}

export function resetDB() {
  state = emptyDB()
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDB() {
  return useSyncExternalStore(subscribe, getDB)
}
