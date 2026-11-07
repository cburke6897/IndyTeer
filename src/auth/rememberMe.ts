/**
 * "Remember me" for the shared Supabase session. Supabase persists sessions in
 * localStorage. When the user opts out we flag the session as temporary, and on the next
 * browser session (a fresh tab/window with no sessionStorage marker) it is signed out.
 */
const TEMP_KEY = 'indyteer.session.temporary'
const ALIVE_KEY = 'indyteer.session.alive'

export function setRememberMe(remember: boolean) {
  try {
    if (remember) localStorage.removeItem(TEMP_KEY)
    else localStorage.setItem(TEMP_KEY, '1')
    sessionStorage.setItem(ALIVE_KEY, '1')
  } catch {
    /* storage unavailable: behave as remembered */
  }
}

/** True when a non-remembered session has outlived its browser session. */
export function shouldDropTemporarySession() {
  try {
    const expired = localStorage.getItem(TEMP_KEY) === '1' && !sessionStorage.getItem(ALIVE_KEY)
    if (expired) localStorage.removeItem(TEMP_KEY)
    sessionStorage.setItem(ALIVE_KEY, '1')
    return expired
  } catch {
    return false
  }
}
