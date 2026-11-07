import { createHash } from 'node:crypto'
import { load } from 'cheerio'

export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function text(value, limit = 1000) {
  const $ = load(String(value ?? '').slice(0, 100_000))
  $('script,style,noscript,iframe').remove()
  return $.text().replace(/\s+/g, ' ').trim().slice(0, limit)
}
export function safeLink(value) {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password) return ''
    u.hash = ''
    for (const k of [...u.searchParams.keys()])
      if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k)
    return u.href
  } catch {
    return ''
  }
}
export function time(value) {
  const m = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i)
  if (!m) return ''
  let hour = Number(m[1])
  const minute = Number(m[2])
  if (minute > 59 || (m[3] ? hour < 1 || hour > 12 : hour > 23)) return ''
  if (m[3]) hour = (hour % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)
  return `${String(hour).padStart(2, '0')}:${m[2]}`
}
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}
export function today(now = new Date(), timezone = 'America/Indiana/Indianapolis') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
export function ended(date, endTime, timezone, now = new Date()) {
  if (!timezone || !validDate(date) || !time(endTime)) return false
  const localDay = today(now, timezone)
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return date < localDay || (date === localDay && endTime <= localTime)
}
export function candidate(input, now = new Date()) {
  const title = text(input.title, 200),
    location = text(input.location, 600),
    organizer = text(input.organizer, 200)
  const sourceUrl = safeLink(input.sourceUrl),
    applicationUrl = safeLink(input.applicationUrl) || sourceUrl
  const day = input.date || '',
    startTime = time(input.startTime),
    endTime = time(input.endTime)
  const explicit = input.volunteerEvidence === true
  const reasons = []
  if (!explicit) reasons.push('No explicit volunteer recruitment evidence')
  if (!sourceUrl) reasons.push('Missing secure source link')
  if (!validDate(day)) reasons.push('Date needs confirmation')
  if (validDate(day) && day < today(now, input.timezone || undefined))
    reasons.push('Date has passed')
  if (input.cancelled) reasons.push('Source marks this occurrence cancelled')
  if (
    /weekends? only/i.test(location) &&
    validDate(day) &&
    ![0, 6].includes(new Date(day + 'T12:00:00Z').getUTCDay())
  )
    reasons.push('Source date conflicts with a weekend-only venue note; confirm with the organizer')
  if (ended(day, endTime, input.timezone, now)) reasons.push('Session has already ended')
  if (/\b(no|not|without)\s+(?:new\s+)?volunteers?\s+(?:needed|required|wanted)\b/i.test(title))
    reasons.push('Listing says volunteers are not needed')
  const rejected =
    !explicit ||
    !sourceUrl ||
    !!input.cancelled ||
    reasons.includes('Date has passed') ||
    reasons.includes('Session has already ended') ||
    reasons.some((r) => r.startsWith('Listing says'))
  if (!startTime || !endTime || (startTime && endTime && startTime >= endTime))
    reasons.push('Session times need confirmation')
  if (!input.timezone) reasons.push('Timezone needs confirmation')
  if (!input.city) reasons.push('City needs confirmation')
  reasons.push('Capacity and organizer authorization need confirmation')
  const identity = [input.sourceId, String(input.externalId), day, startTime]
  const id = digest(identity).slice(0, 32)
  const normalized = {
    id,
    sourceId: input.sourceId,
    externalId: String(input.externalId || sourceUrl),
    title,
    organizer,
    sourceUrl,
    applicationUrl,
    date: day,
    startTime,
    endTime,
    timezone: input.timezone || '',
    state: input.state || '',
    city: text(input.city, 100),
    location,
    category: /clean|trash|trail|garden|conservation/i.test(title)
      ? 'Environment'
      : 'Community Events',
    summary: `Volunteer opportunity listed by ${organizer || input.sourceName || 'the original organizer'}.${validDate(day) ? ` Scheduled for ${day}.` : ''}${location ? ` Venue: ${location}.` : ''} Check the original listing for availability, requirements and registration.`,
    volunteerEvidence: explicit,
    reasons,
    quality: Math.max(0, 100 - reasons.length * 12),
    cancelled: !!input.cancelled,
    sourceUpdatedAt: input.sourceUpdatedAt || null,
    observedAt: now.toISOString(),
    status: rejected ? 'excluded' : 'pending',
  }
  normalized.fingerprint = digest([
    title.toLowerCase().replace(/[^a-z0-9]/g, ''),
    organizer.toLowerCase(),
    day,
    startTime,
    normalized.state,
  ])
  normalized.contentHash = digest({
    ...normalized,
    observedAt: undefined,
    quality: undefined,
    reasons: undefined,
    status: undefined,
  })
  return normalized
}

export function validateReview(record, review, now = new Date()) {
  if (
    !['pending', 'imported'].includes(record.status) ||
    record.cancelled ||
    !record.volunteerEvidence
  )
    throw new Error('This listing is excluded from import.')
  if (now.getTime() - Date.parse(record.observedAt) > 48 * 3600_000)
    throw new Error('Refresh this source before importing a listing older than 48 hours.')
  const fields = Object.fromEntries(
    ['city', 'location', 'timezone', 'category', 'date', 'startTime', 'endTime'].map((k) => [
      k,
      String(review[k] ?? record[k] ?? '').trim(),
    ]),
  )
  if (!validDate(fields.date)) throw new Error('Confirm a real event date.')
  try {
    today(now, fields.timezone)
  } catch {
    throw new Error('Choose a valid timezone.')
  }
  if (!fields.timezone || fields.date < today(now, fields.timezone))
    throw new Error('Confirm a future event date and timezone.')
  if (!fields.city || !fields.location || !fields.category)
    throw new Error('Confirm the city, venue and category.')
  if (!time(fields.startTime) || !time(fields.endTime) || fields.startTime >= fields.endTime)
    throw new Error('Confirm start and end times on the same day.')
  if (ended(fields.date, fields.endTime, fields.timezone, now))
    throw new Error('This event has already ended.')
  const capacity = Number(review.capacity)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)
    throw new Error('Enter organizer-confirmed capacity (1–10,000).')
  if (review.authorizationConfirmed !== true || review.factsConfirmed !== true)
    throw new Error('Confirm organizer authorization and source facts before import.')
  if (!/^[0-9a-f-]{36}$/i.test(review.organizationId || ''))
    throw new Error('Select an organization you manage.')
  return { ...fields, capacity, organizationId: review.organizationId }
}
