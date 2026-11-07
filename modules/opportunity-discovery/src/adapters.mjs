import { load } from 'cheerio'
import { candidate, safeLink, text, today, validDate } from './model.mjs'

export function assertPermission(source, now = new Date()) {
  const p = source.permission,
    age = now - Date.parse(p?.reviewedAt)
  if (
    !p ||
    !['official-api', 'open-license', 'written-permission'].includes(p.basis) ||
    !safeLink(p.evidenceUrl) ||
    !Number.isFinite(age) ||
    age < -86400_000 ||
    age > 180 * 86400_000
  )
    throw new Error('Source permission evidence must be reviewed within 180 days.')
  if (source.adapter !== 'nps' && p.basis === 'official-api')
    throw new Error('Generic web sources need a reuse license or written permission.')
  if (source.adapter === 'nps' && source.url !== 'https://developer.nps.gov/api/v1/events')
    throw new Error('The NPS adapter only supports its official endpoint.')
}
const ZONES = {
  indu: 'America/Chicago',
}
export function npsRecords(data, source, { now = new Date(), states = ['IN'], horizon = 30 } = {}) {
  const from = today(now),
    through = new Date(now.getTime() + horizon * 86400_000).toISOString().slice(0, 10),
    out = []
  for (const event of data) {
    const volunteer = (event.types || []).some((t) => /^volunteer event$/i.test(t))
    if (!volunteer) continue
    const days = [
      ...new Set(Array.isArray(event.dates) && event.dates.length ? event.dates : [event.date]),
    ]
      .filter((d) => validDate(d) && d >= from && d <= through)
      .sort()
    const slots = event.times?.length ? event.times : [{}]
    const address = String(event.location || '').match(
      /,\s*([A-Za-z][A-Za-z .'-]{1,59}),\s*([A-Z]{2})\s+\d{5}\b/,
    )
    for (const date of days.slice(0, 60))
      for (const slot of slots.slice(0, 6)) {
        out.push(
          candidate(
            {
              sourceId: source.id,
              sourceName: source.name,
              externalId: event.id || event.eventid,
              title: event.title,
              organizer: event.parkfullname || event.organizationname || 'National Park Service',
              sourceUrl: event.id
                ? `https://www.nps.gov/planyourvisit/event-details.htm?id=${encodeURIComponent(event.id)}`
                : event.infourl,
              applicationUrl: event.regresurl || event.infourl,
              date,
              startTime: slot.timestart,
              endTime: slot.timeend,
              timezone: ZONES[event.sitecode] || '',
              state: address?.[2] || (states.length === 1 ? states[0] : ''),
              city: address?.[1]?.trim() || '',
              location: event.location,
              volunteerEvidence: volunteer,
              cancelled: (event.cancelleddatelist || []).includes(date),
              sourceUpdatedAt: event.datetimeupdated,
            },
            now,
          ),
        )
      }
  }
  return out
}
function jsonLdObjects($) {
  const out = []
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if ([].concat(node['@type'] || []).some((t) => t === 'Event' || t === 'VolunteerEvent'))
      out.push(node)
    if (node['@graph']) walk(node['@graph'])
    if (node.itemListElement) walk(node.itemListElement)
    if (node.item) walk(node.item)
  }
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      walk(JSON.parse($(el).text()))
    } catch {
      /* malformed source metadata is skipped */
    }
  })
  return out.slice(0, 200)
}
export function webRecords(body, source, now = new Date()) {
  const xml = source.adapter === 'feed',
    $ = load(body, { xmlMode: xml }),
    rows = []
  if (xml)
    $('item,entry')
      .slice(0, 100)
      .each((_i, el) => {
        const item = $(el),
          title = text(item.find('title').first().text(), 200),
          link =
            item.find('link[rel="alternate"]').attr('href') ||
            item.find('link').first().attr('href') ||
            item.find('link').first().text()
        rows.push({
          name: title,
          url: link,
          identifier: item.find('guid,id').first().text(),
          keywords: item
            .find('category')
            .map((_j, e) => $(e).text())
            .get()
            .join(' '),
          startDate: item.find('startDate').text(),
          endDate: item.find('endDate').text(),
        })
      })
  else rows.push(...jsonLdObjects($))
  return rows.map((row) => {
    const location = row.location || {},
      address = location.address || {},
      start = String(row.startDate || ''),
      end = String(row.endDate || '')
    const title = text(row.name, 200),
      evidence =
        /\bvolunteer(?:s|ing)?\b/i.test(title + ' ' + String(row.keywords || '')) ||
        [].concat(row['@type'] || []).includes('VolunteerEvent')
    return candidate(
      {
        sourceId: source.id,
        sourceName: source.name,
        externalId: row.identifier || row['@id'] || row.url || title,
        title,
        organizer: row.organizer?.name || source.name,
        sourceUrl: safeLink(new URL(row.url || source.url, source.url).href),
        date: start.slice(0, 10),
        startTime: start.slice(11, 16),
        endTime: end.slice(11, 16),
        timezone: source.timezone,
        location: location.name || address.streetAddress || '',
        city: address.addressLocality || '',
        state: address.addressRegion || source.state || '',
        volunteerEvidence: evidence,
        cancelled: String(row.eventStatus || '').includes('EventCancelled'),
      },
      now,
    )
  })
}
export async function collectSource(source, config, http, now = new Date()) {
  assertPermission(source, now)
  const records = []
  let pages = 0,
    complete = true
  if (source.adapter === 'nps') {
    const max = Math.min(8, Math.max(1, source.maxPages || 4)),
      size = Math.min(50, Math.max(1, source.pageSize || 50))
    for (let page = 1; page <= max; page++) {
      const u = new URL(source.url)
      u.search = new URLSearchParams({
        stateCode: config.states.join(','),
        eventType: 'Volunteer Event',
        dateStart: today(now),
        dateEnd: new Date(now.getTime() + config.horizon * 86400_000).toISOString().slice(0, 10),
        pageSize: String(size),
        pageNumber: String(page),
        expandRecurring: 'false',
      })
      if (!config.states.length) u.searchParams.delete('stateCode')
      const response = await http.get(u.href, { headers: { 'X-Api-Key': config.npsKey } })
      if (response.status !== 200) throw new Error(`NPS API returned ${response.status}.`)
      const body = JSON.parse(response.body)
      if (!Array.isArray(body.data) || body.errors?.length)
        throw new Error('NPS returned invalid event data.')
      records.push(
        ...npsRecords(body.data, source, { now, states: config.states, horizon: config.horizon }),
      )
      pages++
      if (page * size >= Number(body.total) || body.data.length < size) break
      if (page === max) complete = false
    }
  } else if (['feed', 'jsonld'].includes(source.adapter)) {
    const urls = [source.url, ...(source.pages || [])].slice(0, Math.min(source.maxPages || 5, 10)),
      origin = new URL(source.url).origin
    for (const url of urls) {
      const response = await http.get(url, { origin, robots: true })
      if (response.status !== 200) throw new Error(`Approved source returned ${response.status}.`)
      records.push(...webRecords(response.body, { ...source, url }, now))
      pages++
    }
  } else throw new Error('Unsupported source adapter.')
  return { records: records.slice(0, 1000), pages, complete: complete && records.length <= 1000 }
}
