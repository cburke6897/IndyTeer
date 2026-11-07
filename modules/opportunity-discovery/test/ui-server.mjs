import { createServer } from 'node:http'
import { Store } from '../src/store.mjs'
import { candidate } from '../src/model.mjs'
import { Bridge } from '../src/bridge.mjs'
import { createApp } from '../src/server.mjs'
const org = '11111111-1111-4111-8111-111111111111',
  store = new Store(':memory:')
for (let i = 1; i <= 2; i++)
  store.upsert(
    candidate({
      sourceId: 'test',
      externalId: String(i),
      title: `Test-only volunteer cleanup ${i}`,
      organizer: 'Test-only park',
      sourceUrl: 'https://example.org/' + i,
      date: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
      startTime: '09:00',
      endTime: '12:00',
      timezone: 'America/Chicago',
      state: 'IN',
      location: 'Test venue',
      volunteerEvidence: true,
    }),
    'test',
  )
const settings = {
  port: 5192,
  sources: [
    {
      id: 'test',
      name: 'Test-only source',
      enabled: false,
      adapter: 'feed',
      permission: { evidenceUrl: 'https://example.org/permission' },
    },
  ],
  states: ['IN'],
  horizon: 30,
  npsKey: 'test',
  supabaseUrl: 'https://testtesttesttesttest.supabase.co',
  publishableKey: 'sb_publishable_test',
  importsEnabled: true,
}
let remote = []
const bridge = new Bridge(settings, store, async (url, options) => {
  const path = new URL(url).pathname
  if (path === '/auth/v1/user') return Response.json({ id: 'test-actor' })
  if (path.endsWith('/organization_memberships'))
    return Response.json([{ organization_id: org, role: 'owner', status: 'active' }])
  if (path.endsWith('/organizations'))
    return Response.json([{ id: org, name: 'Test organization' }])
  if (path.endsWith('/opportunities')) {
    if (options.method === 'POST') {
      const payload = JSON.parse(options.body)
      remote = [{ ...payload, id: 'test-draft', status: 'draft' }]
    }
    return Response.json(remote)
  }
  throw new Error('No real API calls are allowed in browser tests')
})
const app = createApp(settings, store, {}, { bridge })
createServer(app.handler).listen(settings.port, '127.0.0.1')
