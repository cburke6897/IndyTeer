import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Store } from '../src/store.mjs'
import { candidate } from '../src/model.mjs'
import { Bridge } from '../src/bridge.mjs'

const org = '11111111-1111-4111-8111-111111111111'
export function record() {
  return candidate({
    sourceId: 'test',
    externalId: 'fixture',
    title: 'Volunteer park cleanup',
    organizer: 'Test-only organizer',
    sourceUrl: 'https://example.org/event',
    date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '12:00',
    city: 'Gary',
    state: 'IN',
    location: 'Park',
    timezone: 'America/Chicago',
    volunteerEvidence: true,
  })
}
const config = {
  importsEnabled: true,
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test',
}
const review = {
  capacity: 10,
  organizationId: org,
  authorizationConfirmed: true,
  factsConfirmed: true,
}
function fixture({ staff = true, mode = 'success' } = {}) {
  const store = new Store(':memory:'),
    item = record()
  store.upsert(item, 'run')
  const calls = []
  let remote = []
  const bridge = new Bridge(config, store, async (url, options) => {
    calls.push({ url, options })
    const u = new URL(url)
    if (u.pathname === '/auth/v1/user') return Response.json({ id: 'actor' })
    if (u.pathname.endsWith('/organization_memberships'))
      return Response.json(staff ? [{ organization_id: org, role: 'admin', status: 'active' }] : [])
    if (u.pathname.endsWith('/organizations'))
      return Response.json([{ id: org, name: 'Test organization' }])
    if (u.pathname.endsWith('/opportunities') && options.method !== 'POST')
      return Response.json(remote)
    if (u.pathname.endsWith('/opportunities')) {
      if (mode === 'timeout') throw new Error('Network timeout')
      if (mode === 'forbidden') return Response.json({ message: 'denied' }, { status: 403 })
      const payload = JSON.parse(options.body)
      remote = [{ ...payload, id: 'created-draft', status: 'draft' }]
      return Response.json(remote, { status: 201 })
    }
    throw new Error('Unexpected test request')
  })
  return { store, item, calls, bridge }
}
test('Import creates only a draft under a verified managed organization and is idempotent', async () => {
  const f = fixture()
  try {
    const result = await f.bridge.import(f.item.id, review, 'user-token')
    assert.equal(result.status, 'draft')
    const writes = f.calls.filter((c) => c.options.method === 'POST')
    assert.equal(writes.length, 1)
    const payload = JSON.parse(writes[0].options.body)
    assert.equal('status' in payload, false)
    assert.equal('id' in payload, false)
    assert.equal(payload.hours, null)
    assert.equal(payload.spots, 10)
    assert.match(payload.instructions, /Original listing: https:\/\/example.org/)
    assert.equal(writes[0].options.headers.Authorization, 'Bearer user-token')
    assert.equal(f.store.get(f.item.id).status, 'imported')
    const second = await f.bridge.import(f.item.id, review, 'user-token')
    assert.equal(second.alreadyImported, true)
    assert.equal(f.calls.filter((c) => c.options.method === 'POST').length, 1)
  } finally {
    f.store.close()
  }
})
test('Ordinary members cannot import, and missing organizer authorization blocks every remote request', async () => {
  const f = fixture({ staff: false })
  try {
    await assert.rejects(
      f.bridge.import(f.item.id, { ...review, authorizationConfirmed: false }, 'token'),
      /authorization/,
    )
    assert.equal(f.calls.length, 0)
    await assert.rejects(f.bridge.import(f.item.id, review, 'token'), /owner or admin/)
    assert.equal(f.calls.filter((c) => c.options.method === 'POST').length, 0)
  } finally {
    f.store.close()
  }
})
test('Ambiguous remote writes stay locked; automatic retry cannot duplicate an event', async () => {
  const f = fixture({ mode: 'timeout' })
  try {
    await assert.rejects(f.bridge.import(f.item.id, review, 'token'), /timeout/)
    assert.equal(f.store.import(f.item.id).status, 'uncertain')
    await assert.rejects(f.bridge.import(f.item.id, review, 'token'), /unresolved/)
    await assert.rejects(f.bridge.reconcile(f.item.id, 'token'), /No unique/)
    assert.equal(f.calls.filter((c) => c.options.method === 'POST').length, 1)
  } finally {
    f.store.close()
  }
})
test('A definite permission failure reports failure and does not mark the listing imported', async () => {
  const f = fixture({ mode: 'forbidden' })
  try {
    await assert.rejects(f.bridge.import(f.item.id, review, 'token'), /403/)
    assert.equal(f.store.get(f.item.id).status, 'pending')
    assert.equal(f.store.import(f.item.id), undefined)
  } finally {
    f.store.close()
  }
})
test('Import reservations serialize callers; source refresh never overwrites an imported draft', () => {
  const store = new Store(':memory:'),
    r = record()
  try {
    store.upsert(r, 'run')
    store.reserve(r.id, org, 'actor')
    assert.throws(() => store.reserve(r.id, org, 'actor'))
    store.imported(r.id, 'created-draft')
    store.upsert({ ...r, title: 'Changed external listing', contentHash: 'changed' }, 'new-run')
    assert.equal(store.get(r.id).status, 'imported')
    assert.equal(store.get(r.id).sourceChanged, true)
  } finally {
    store.close()
  }
})

test('Integration operator privileges come from the verified database user, not editable Auth metadata', async () => {
  const store = new Store(':memory:')
  try {
    for (const allowed of [false, true]) {
      const bridge = new Bridge(config, store, async (url) => {
        const u = new URL(url)
        if (u.pathname === '/auth/v1/user')
          return Response.json({ id: 'verified-user', user_metadata: { is_platform_admin: true } })
        assert.equal(u.searchParams.get('id'), 'eq.verified-user')
        return Response.json([{ id: 'verified-user', is_platform_admin: allowed }])
      })
      if (allowed) assert.equal((await bridge.operator('valid-session')).id, 'verified-user')
      else await assert.rejects(bridge.operator('valid-session'), (e) => e.status === 403)
      await assert.rejects(bridge.operator(''), (e) => e.status === 401)
    }
  } finally {
    store.close()
  }
})
