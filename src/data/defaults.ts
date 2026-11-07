import type { Settings } from '../types'

/** Settings used until the user's row has loaded (matches the database column defaults). */
export function defaultSettings(): Settings {
  return {
    notifications: { email: false, newOpportunities: true, confirmations: true },
    privacy: { publicProfile: false, showHours: false, showHistory: false },
  }
}
