/**
 * Runs `task`, and if it throws tries again after each delay in `delaysMs` (so it runs at most
 * `delaysMs.length + 1` times). Used so a transient failure right after login (a request that
 * raced the session, a token refresh, a dropped connection) is retried quietly while the loading
 * screen is showing, instead of flashing an error. The last error is thrown if every try fails.
 * `shouldStop` lets a caller abandon the retries early (for example when a newer load started).
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: { delaysMs?: number[]; shouldStop?: () => boolean } = {},
): Promise<T> {
  const delays = options.delaysMs ?? [400, 1200]
  let attempt = 0
  while (true) {
    try {
      return await task()
    } catch (error) {
      if (attempt >= delays.length || options.shouldStop?.()) throw error
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
      attempt += 1
    }
  }
}
