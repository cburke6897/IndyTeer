import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { Store } from '../src/store.mjs'
import { candidate } from '../src/model.mjs'
import { collect } from '../src/collector.mjs'
import { createApp } from '../src/server.mjs'
const source = {
  id: 'nps-events',
  name: 'NPS',
  enabled: true,
  adapter: 'nps',
  url: 'https://developer.nps.gov/api/v1/events',
  permission: {
    basis: 'official-api',
    evidenceUrl: 'https://www.nps.gov/subjects/developer/guides.htm',
    reviewedAt: new Date().toISOString().slice(0, 10),
  },
}
const settings = {
  port: 5199,
  sources: [source],
  states: ['IN'],
  horizon: 30,
  npsKey: 'test-key',
  publishableKey: '',
  supabaseUrl: '',
  importsEnabled: false,
}
const make = (id = 'one') =>
  candidate({
    sourceId: 'nps-events',
    externalId: id,
    title: 'Volunteer trail cleanup',
    organizer: 'Test-only organizer',
    volunteerEvidence: true,
    sourceUrl: 'https://example.org/event',
    date: '2099-12-01',
    state: 'IN',
  })
test('Duplicates are screened across sources; a changed rejected listing returns to review', () => {
  const store = new Store(':memory:')
  try {
    const a = make()
    store.upsert(a, 'a')
    const b = candidate({
      ...a,
      sourceId: 'second',
      externalId: 'two',
      date: a.date,
      volunteerEvidence: true,
    })
    store.upsert(b, 'a')
    assert.equal(store.get(b.id).status, 'duplicate')
    store.reject(a.id)
    store.upsert(a, 'b')
    assert.equal(store.get(a.id).status, 'rejected')
    store.upsert({ ...a, contentHash: 'updated', fingerprint: 'updated-fingerprint' }, 'c')
    assert.equal(store.get(a.id).status, 'pending')
  } finally {
    store.close()
  }
})
test('Collector interval, single-run lease and incomplete pagination preserve existing records', async () => {
  const store = new Store(':memory:')
  let calls = 0
  const http = {
    get: async () => {
      calls++
      return { status: 200, body: JSON.stringify({ data: [], total: 0 }) }
    },
  }
  try {
    assert.equal(store.acquire(), true)
    await assert.rejects(collect(settings, store, http), /already running/)
    store.release()
    const first = await collect(settings, store, http)
    assert.equal(first.sources, 1)
    const again = await collect(settings, store, http)
    assert.equal(again.skipped.length, 1)
    assert.equal(calls, 1)
  } finally {
    store.close()
  }
})
test('Missing records are withdrawn only in the completed scan scope', () => {
  const store = new Store(':memory:')
  try {
    const a = make()
    store.upsert(a, 'old')
    store.withdrawMissing(a.sourceId, 'new', ['OH'], '2099-01-01', '2099-12-31')
    assert.equal(store.get(a.id).status, 'pending')
    store.withdrawMissing(a.sourceId, 'new', ['IN'], '2099-01-01', '2099-12-31')
    assert.equal(store.get(a.id).status, 'withdrawn')
  } finally {
    store.close()
  }
})
test('Local service blocks cross-origin mutation, DNS rebinding hosts and missing CSRF tokens', async () => {
  const store = new Store(':memory:'),
    local = { ...settings, port: 0 },
    app = createApp(local, store, {
      get: async () => {
        throw new Error('No network expected')
      },
    })
  const server = createServer(app.handler)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  local.port = server.address().port
  const base = 'http://127.0.0.1:' + local.port
  try {
    const boot = await (await fetch(base + '/api/bootstrap')).json()
    assert.equal('npsKey' in boot, false)
    assert.equal(
      (await fetch(base + '/api/scheduler', { method: 'POST', body: '{"enabled":true}' })).status,
      403,
    )
    assert.equal(
      (
        await fetch(base + '/api/scheduler', {
          method: 'POST',
          headers: { Origin: 'https://attacker.example', 'x-discovery-token': boot.csrf },
          body: '{"enabled":true}',
        })
      ).status,
      403,
    )
    const hostileHost = await new Promise((resolve, reject) => {
      const req = request(
        base + '/api/bootstrap',
        { headers: { Host: 'attacker.example' } },
        (response) => {
          response.resume()
          resolve(response.statusCode)
        },
      )
      req.on('error', reject)
      req.end()
    })
    assert.equal(hostileHost, 403)
    const good = await fetch(base + '/api/scheduler', {
      method: 'POST',
      headers: { 'x-discovery-token': boot.csrf },
      body: '{"enabled":true}',
    })
    assert.equal(good.status, 200)
    assert.equal(store.preference('scheduler'), 'true')
    const page = await fetch(base + '/')
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/)
    assert.equal(
      (
        await fetch(base + '/api/session', {
          method: 'POST',
          headers: { 'x-discovery-token': boot.csrf },
          body: '{}',
        })
      ).status,
      400,
    )
  } finally {
    app.close()
    await new Promise((r) => server.close(r))
    store.close()
  }
})

test('Native public feed redacts import audits and native controls require a platform administrator', async () => {
  const store = new Store(':memory:'),
    local = { ...settings, port: 0 }
  const row = make()
  store.upsert(row, 'run')
  store.reserve(row.id, 'private-org-id', 'private-actor-id')
  store.imported(row.id, 'private-draft-id')
  const bridge = {
    operator: async () => {
      const e = new Error('Platform administrator required')
      e.status = 403
      throw e
    },
  }
  const app = createApp(local, store, {}, { bridge }),
    server = createServer(app.handler)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  local.port = server.address().port
  const base = 'http://127.0.0.1:' + local.port
  try {
    const feed = await (await fetch(base + '/api/integration/listings')).json()
    assert.equal(feed.items.length, 1)
    assert.equal(feed.items[0].status, 'listed')
    assert.equal('import' in feed.items[0], false)
    assert.equal(JSON.stringify(feed).includes('private-actor-id'), false)
    assert.equal(JSON.stringify(feed).includes('private-draft-id'), false)
    const boot = await (await fetch(base + '/api/integration/bootstrap')).json()
    const denied = await fetch(base + '/api/integration/scheduler', {
      method: 'POST',
      headers: { 'x-discovery-token': boot.csrf },
      body: '{"enabled":true}',
    })
    assert.equal(denied.status, 403)
    assert.equal(store.preference('scheduler'), 'false')
    const escaped = await fetch(base + '/api/integration/%2e%2e/scheduler', {
      method: 'POST',
      headers: { 'x-discovery-token': boot.csrf, 'x-indyteer-integration': '1' },
      body: '{"enabled":true}',
    })
    assert.equal(escaped.status, 400)
    assert.equal(store.preference('scheduler'), 'false')
  } finally {
    app.close()
    await new Promise((r) => server.close(r))
    store.close()
  }
})
