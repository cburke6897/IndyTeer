import { test } from 'node:test'
import assert from 'node:assert/strict'
import { candidate, validDate, time, safeLink, text, validateReview, ended } from '../src/model.mjs'
import { npsRecords, webRecords, assertPermission, collectSource } from '../src/adapters.mjs'
import { publicConfig } from '../src/config.mjs'

const now = new Date('2026-11-07T12:00:00Z')
const source = {
  id: 'nps-events',
  name: 'National Park Service',
  adapter: 'nps',
  url: 'https://developer.nps.gov/api/v1/events',
  permission: {
    basis: 'official-api',
    evidenceUrl: 'https://www.nps.gov/subjects/developer/guides.htm',
    reviewedAt: '2026-11-07',
  },
}
const event = {
  id: 'real-shaped-fixture',
  title: 'Volunteer beach cleanup',
  types: ['Volunteer Event'],
  parkfullname: 'Example National Park',
  sitecode: 'indu',
  infourl: 'https://www.nps.gov/indu/getinvolved/volunteer.htm',
  location: 'Example beach',
  dates: ['2026-11-08', '2026-11-09', '2026-11-10'],
  cancelleddatelist: ['2026-11-09'],
  times: [{ timestart: '09:00 AM', timeend: '12:00 PM' }],
}
const review = {
  city: 'Gary',
  capacity: 12,
  organizationId: '11111111-1111-4111-8111-111111111111',
  factsConfirmed: true,
  authorizationConfirmed: true,
}
test('NPS occurrence dates are explicit, stable, timezone-correct and cancellation-aware', () => {
  const rows = npsRecords([event], source, { now })
  assert.equal(rows.length, 3)
  assert.equal(rows[0].timezone, 'America/Chicago')
  assert.equal(rows[0].city, '')
  assert.equal(rows[0].startTime, '09:00')
  assert.equal(rows[0].endTime, '12:00')
  assert.equal(rows[1].status, 'excluded')
  assert.equal(rows[1].cancelled, true)
  assert.equal(npsRecords([event], source, { now })[0].id, rows[0].id)
  assert.notEqual(rows[0].id, rows[2].id)
  assert.equal('capacity' in rows[0], false)
  assert.equal('contactemailaddress' in rows[0], false)
})
test('General park events and misleading volunteer text are not treated as recruitment', () => {
  assert.equal(npsRecords([{ ...event, types: ['Talk'] }], source, { now }).length, 0)
  assert.equal(
    candidate(
      {
        sourceId: 'a',
        externalId: 'b',
        title: 'No volunteers needed',
        volunteerEvidence: true,
        sourceUrl: 'https://example.org',
        date: '2026-11-08',
      },
      now,
    ).status,
    'excluded',
  )
})
test('Past and invalid dates, missing times and unknown timezone are not invented', () => {
  assert.equal(validDate('2026-02-30'), false)
  assert.equal(time('25:20'), '')
  assert.equal(time('12:00 AM'), '00:00')
  const rows = npsRecords(
    [{ ...event, sitecode: 'unknown', times: [], dates: ['2026-11-01', '2026-11-08'] }],
    source,
    { now },
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].timezone, '')
  assert.equal(rows[0].startTime, '')
  assert.throws(() => validateReview(rows[0], review, now), /timezone|times/)
  assert.equal(ended('2026-11-07', '05:00', 'America/Chicago', now), true)
})
test('Review requires actual facts, capacity and organizer authorization', () => {
  const row = npsRecords([event], source, { now })[0]
  assert.equal(validateReview(row, review, now).capacity, 12)
  assert.throws(() => validateReview(row, { ...review, capacity: 0 }, now), /capacity/)
  assert.throws(
    () => validateReview(row, { ...review, authorizationConfirmed: false }, now),
    /authorization/,
  )
  assert.throws(() => validateReview({ ...row, status: 'duplicate' }, review, now), /excluded/)
  assert.throws(() => validateReview(row, review, new Date('2026-11-10T12:00:00Z')), /48 hours/)
})
test('Source content cannot inject scripts or credential-bearing links', () => {
  assert.equal(text('<p>Help <b>neighbors</b></p><script>alert(1)</script>'), 'Help neighbors')
  assert.equal(safeLink('javascript:alert(1)'), '')
  assert.equal(safeLink('https://user:secret@example.org/x'), '')
  assert.equal(
    safeLink('https://example.org/x?utm_source=a&id=1#section'),
    'https://example.org/x?id=1',
  )
})
test('Permission evidence, correct API endpoint and recent review are mandatory', () => {
  assertPermission(source, now)
  assert.throws(
    () =>
      assertPermission(
        { ...source, permission: { ...source.permission, reviewedAt: '2025-01-01' } },
        now,
      ),
    /180 days/,
  )
  assert.throws(
    () => assertPermission({ ...source, url: 'https://arbitrary.example.org' }, now),
    /official endpoint/,
  )
  assert.throws(() => assertPermission({ ...source, adapter: 'jsonld' }, now), /reuse license/)
})
test('Licensed JSON-LD facts parse without using publication dates as event dates', () => {
  const web = {
    ...source,
    id: 'partner',
    adapter: 'jsonld',
    url: 'https://partner.example.org/events',
    state: 'IN',
    timezone: 'America/Indiana/Indianapolis',
  }
  const rows = webRecords(
    '<script type="application/ld+json">' +
      JSON.stringify({
        '@graph': [
          {
            '@type': 'Event',
            name: 'Volunteer trail cleanup',
            startDate: '2026-11-08T09:00:00',
            endDate: '2026-11-08T12:00:00',
            url: '/cleanup',
            location: { name: 'Park', address: { addressLocality: 'Carmel', addressRegion: 'IN' } },
          },
        ],
      }) +
      '</script>',
    web,
    now,
  )
  assert.equal(rows[0].date, '2026-11-08')
  assert.equal(rows[0].city, 'Carmel')
  assert.equal(rows[0].sourceUrl, 'https://partner.example.org/cleanup')
  const feed = webRecords(
    '<rss><channel><item><title>Volunteer at the pantry</title><link>https://partner.example.org/help</link><pubDate>2026-11-08</pubDate></item></channel></rss>',
    { ...web, adapter: 'feed' },
    now,
  )
  assert.equal(feed[0].date, '')
  assert.match(feed[0].reasons.join(), /Date needs/)
})
test('NPS collection uses documented page parameters, caps pages, and never exposes a key in the URL', async () => {
  const calls = [],
    http = {
      get: async (url, options) => {
        calls.push({ url, options })
        return { status: 200, body: JSON.stringify({ data: [event], total: 200 }) }
      },
    }
  const result = await collectSource(
    { ...source, pageSize: 1, maxPages: 2 },
    { states: ['IN'], horizon: 30, npsKey: 'private-nps-key' },
    http,
    now,
  )
  assert.equal(calls.length, 2)
  assert.equal(result.complete, false)
  assert.equal(new URL(calls[1].url).searchParams.get('pageNumber'), '2')
  assert.equal(calls[0].url.includes('private-nps-key'), false)
  assert.equal(calls[0].options.headers['X-Api-Key'], 'private-nps-key')
})
test('Public configuration refuses service credentials and non-project URLs', () => {
  assert.throws(
    () => publicConfig({ SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_print' }),
    /server credential/,
  )
  assert.throws(
    () =>
      publicConfig({
        SUPABASE_PUBLISHABLE_KEY:
          'x.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.y',
      }),
    /server credential/,
  )
  assert.throws(() => publicConfig({ SUPABASE_URL: 'https://metadata.example/' }), /project URL/)
})
