import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { config, root } from './config.mjs'
import { Store } from './store.mjs'
import { PoliteHttp } from './http.mjs'
import { collect } from './collector.mjs'
import { Bridge } from './bridge.mjs'
import { ended, today, validDate } from './model.mjs'

export function createApp(settings, store, http, { bridge = new Bridge(settings, store) } = {}) {
  const csrf = randomBytes(32).toString('hex')
  let running = false
  const scan = async () => {
    if (running) throw new Error('A scan is already running.')
    running = true
    try {
      return await collect(settings, store, http)
    } finally {
      running = false
    }
  }
  const handler = async (req, res) => {
    const host = req.headers.host
    const allowed = [`127.0.0.1:${settings.port}`, `localhost:${settings.port}`]
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    }
    const send = (status, data, type) => {
      res.writeHead(status, { ...headers, ...(type ? { 'Content-Type': type } : {}) })
      res.end(typeof data === 'string' ? data : JSON.stringify(data))
    }
    if (!allowed.includes(host))
      return send(403, { error: 'This service is restricted to its local origin.' })
    if (req.headers.origin && !allowed.map((h) => 'http://' + h).includes(req.headers.origin))
      return send(403, { error: 'Cross-origin access is blocked.' })
    const u = new URL(req.url, 'http://' + host)
    const integration =
      req.headers['x-indyteer-integration'] === '1' || u.pathname.startsWith('/api/integration/')
    if (integration && !u.pathname.startsWith('/api/integration/'))
      return send(400, { error: 'Invalid integration route.' })
    const path = integration ? u.pathname.replace(/^\/api\/integration\//, '/api/') : u.pathname
    try {
      if (req.method === 'GET' && path === '/api/bootstrap')
        return send(200, {
          csrf,
          project: {
            supabaseUrl: settings.supabaseUrl,
            publishableKey: settings.publishableKey,
            importsEnabled: settings.importsEnabled,
          },
          states: settings.states,
          horizon: settings.horizon,
        })
      if (req.method === 'GET' && path === '/api/listings')
        return send(200, {
          items: store
            .list({
              status: u.searchParams.get('status') || '',
              q: u.searchParams.get('q') || '',
              state: u.searchParams.get('state') || '',
            })
            .filter(
              (row) =>
                !integration ||
                (['pending', 'imported'].includes(row.status) &&
                  !row.cancelled &&
                  !row.sourceMissing &&
                  validDate(row.date) &&
                  row.date >= today(new Date(), row.timezone || undefined) &&
                  !ended(row.date, row.endTime, row.timezone)),
            )
            .map((row) => {
              if (!integration) return row
              const { import: audit, duplicateOf, firstSeen, lastSeen, ...facts } = row
              void audit
              void duplicateOf
              void firstSeen
              void lastSeen
              return { ...facts, status: 'listed' }
            }),
        })
      if (req.method === 'GET' && path === '/api/status')
        return send(200, {
          running,
          scheduler: store.preference('scheduler') === 'true',
          runs: store.runs(),
          sources: settings.sources.map((s) => ({
            id: s.id,
            name: s.name,
            enabled: s.enabled,
            adapter: s.adapter,
            url: s.url,
            permission: s.permission,
            run: store.source(s.id) || null,
          })),
        })
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(path)) {
        const name = path === '/' ? 'index.html' : path.slice(1)
        return send(
          200,
          await readFile(resolve(root, 'public', name), 'utf8'),
          name.endsWith('.html')
            ? 'text/html; charset=utf-8'
            : name.endsWith('.css')
              ? 'text/css; charset=utf-8'
              : 'text/javascript; charset=utf-8',
        )
      }
      if (req.method !== 'POST') return send(404, { error: 'Not found.' })
      if (req.headers['x-discovery-token'] !== csrf)
        return send(403, { error: 'Refresh the page before making changes.' })
      let length = 0,
        chunks = []
      for await (const chunk of req) {
        length += chunk.length
        if (length > 16000) return send(413, { error: 'Request too large.' })
        chunks.push(chunk)
      }
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
      } catch {
        return send(400, { error: 'Invalid JSON request.' })
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '') || ''
      if (integration && ['/api/collect', '/api/scheduler'].includes(path))
        await bridge.operator(token)
      if (path === '/api/collect') {
        if (running) return send(409, { error: 'A scan is already running.' })
        void scan().catch(() => {
          /* The source errors and run state are recorded locally. */
        })
        return send(202, { started: true })
      }
      if (path === '/api/scheduler') {
        if (typeof body.enabled !== 'boolean')
          return send(400, { error: 'Choose enabled or disabled.' })
        store.preference('scheduler', String(body.enabled))
        return send(200, { enabled: body.enabled })
      }
      if (path === '/api/session') return send(200, await bridge.session(token))
      const match = path.match(/^\/api\/listings\/([a-f0-9]{32})\/(reject|import|reconcile)$/)
      if (match) {
        const [, id, action] = match
        if (!store.get(id)) return send(404, { error: 'Listing not found.' })
        if (action === 'reject') {
          if (integration) await bridge.operator(token)
          store.reject(id)
          return send(200, { rejected: true })
        }
        return send(
          200,
          action === 'import'
            ? await bridge.import(id, body, token)
            : await bridge.reconcile(id, token),
        )
      }
      send(404, { error: 'Not found.' })
    } catch (error) {
      send([401, 403].includes(error.status) ? error.status : 400, {
        error: String(error.message).replaceAll(settings.npsKey, '[redacted]').slice(0, 300),
        ...(error.code === 'IMPORT_UNCERTAIN' ? { code: error.code } : {}),
      })
    }
  }
  const scheduler = setInterval(() => {
    const due = settings.sources.some(
      (source) =>
        source.enabled &&
        (!store.source(source.id)?.last_attempt ||
          Date.now() - Date.parse(store.source(source.id).last_attempt) >=
            Math.max(15, source.minIntervalMinutes || 360) * 60_000),
    )
    if (store.preference('scheduler') === 'true' && !running && due) void scan().catch(() => {})
  }, 60_000)
  scheduler.unref()
  return { handler, close: () => clearInterval(scheduler), scan }
}
export function start(settings = config()) {
  const store = new Store(settings.dbPath),
    http = new PoliteHttp({ contact: settings.contact }),
    app = createApp(settings, store, http)
  const server = createServer(app.handler)
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  server.listen(settings.port, '127.0.0.1', () =>
    console.log(
      `IndyTeer Discovery: http://127.0.0.1:${settings.port} (local only; main is unchanged)`,
    ),
  )
  const close = () => {
    app.close()
    server.close(() => {
      store.close()
      process.exit(0)
    })
  }
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
  return { server, store, app }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start()
