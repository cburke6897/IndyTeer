import { useDB } from './store'
import { sessionOrg, sessionUser, sessionVolunteer } from './selectors'

/** Current simulated session: user + the matching volunteer/organization profile. */
export function useSession() {
  const db = useDB()
  const user = sessionUser(db)
  const volunteer = sessionVolunteer(db)
  const org = sessionOrg(db)
  return { db, user, volunteer, org }
}
