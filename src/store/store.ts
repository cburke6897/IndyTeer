import { useSyncExternalStore } from 'react'
import type { DB } from '../types'
import { buildSeed } from '../data/seed'

/**
 * Centralized frontend state. A tiny external store (no backend):
 *  - persisted to localStorage so a refresh keeps the demo intact
 *  - read through `useDB()`; mutated only through the functions in ./actions
 * Swap `load`/`persist` (and the actions) for API calls when the backend lands.
 */
const KEY = 'indyteer.db.v1'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.opportunities)) return parsed
    }
  } catch {
    /* fall through to seed */
  }
  return buildSeed()
}

function persist(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* storage full or unavailable – state still lives in memory */
  }
}

let state: DB = load()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function getDB() {
  return state
}

export function setDB(updater: (db: DB) => DB) {
  state = updater(state)
  persist(state)
  emit()
}

export function resetDB() {
  state = buildSeed()
  persist(state)
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  // keep multiple tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load()
      emit()
    }
  })
}

export function useDB() {
  return useSyncExternalStore(subscribe, getDB)
}
