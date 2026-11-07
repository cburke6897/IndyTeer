import { randomUUID } from 'node:crypto'
import { collectSource } from './adapters.mjs'
import { today } from './model.mjs'

export async function collect(config, store, http, { now = new Date() } = {}) {
  if (!store.acquire()) throw new Error('A collection is already running. Try again later.')
  const id = randomUUID(),
    result = { id, seen: 0, pages: 0, sources: 0, skipped: [], errors: [] }
  http.runDeadline = Date.now() + 120000
  store.startRun(id)
  try {
    for (const source of config.sources.filter((s) => s.enabled).slice(0, 10)) {
      const previous = store.source(source.id)
      const interval = Math.max(15, source.minIntervalMinutes || 360) * 60_000
      if (previous?.last_attempt && now - Date.parse(previous.last_attempt) < interval) {
        result.skipped.push({ source: source.id, reason: 'Collection interval has not elapsed' })
        continue
      }
      store.sourceStatus(source.id, 'running')
      try {
        const data = await collectSource(source, config, http, now)
        for (const row of data.records) store.upsert(row, id)
        if (data.complete)
          store.withdrawMissing(
            source.id,
            id,
            config.states,
            today(now),
            new Date(now.getTime() + config.horizon * 86400_000).toISOString().slice(0, 10),
          )
        store.sourceStatus(source.id, 'success')
        result.seen += data.records.length
        result.pages += data.pages
        result.sources++
        if (!data.complete)
          result.skipped.push({
            source: source.id,
            reason: 'Page cap reached; missing records were not withdrawn',
          })
      } catch (error) {
        // Do not log URLs, response bodies or credentials from external clients.
        const message = String(error.message).replaceAll(config.npsKey, '[redacted]').slice(0, 240)
        store.sourceStatus(source.id, 'error', message)
        result.errors.push({ source: source.id, message })
      }
    }
    return result
  } finally {
    try {
      store.finishRun(id, result)
    } finally {
      store.release()
    }
  }
}
