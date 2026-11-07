import { request } from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import robotsParser from 'robots-parser'

export function publicAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split('.').map(Number)
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    )
  }
  // IPv6 is deliberately narrow: global unicast only, no mapped/private/transition addresses.
  return (
    isIP(ip) === 6 && /^[23]/i.test(ip) && !/^2001:(?:0:|db8:)/i.test(ip) && !/^2002:/i.test(ip)
  )
}
export async function validateTarget(value, origin, resolver = lookup) {
  const u = new URL(value)
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    (u.port && u.port !== '443') ||
    u.origin !== origin ||
    isIP(u.hostname) ||
    !u.hostname.includes('.')
  )
    throw new Error('Only the approved HTTPS source origin may be fetched.')
  const addresses = await Promise.race([
    resolver(u.hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => {
      const timeout = setTimeout(() => reject(new Error('Source DNS resolution timed out.')), 4000)
      timeout.unref()
    }),
  ])
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error('Private, reserved and mixed DNS addresses are blocked.')
  return { url: u, address: addresses[0] }
}
export class PoliteHttp {
  constructor({ contact = '', delay = 2000, transport, resolver } = {}) {
    this.agent = `IndyTeerDiscovery/0.1${contact ? ` (+mailto:${contact.replace(/[^a-z0-9@._+-]/gi, '')})` : ''}`
    this.delay = delay
    this.transport = transport
    this.resolver = resolver
    this.last = new Map()
    this.robots = new Map()
    this.cooldowns = new Map()
  }
  async get(value, { origin = new URL(value).origin, headers = {}, robots = false } = {}) {
    if (this.runDeadline && Date.now() >= this.runDeadline)
      throw new Error('Collection time budget reached; remaining sources are deferred.')
    if (robots) await this.allow(value)
    const remaining = (this.cooldowns.get(origin) || 0) - Date.now()
    if (remaining > 0) throw new Error('Source is cooling down after a rate-limit response.')
    const wait = Math.max(0, (this.last.get(origin) || 0) + this.delay - Date.now())
    if (wait) await new Promise((r) => setTimeout(r, wait))
    if (this.runDeadline && Date.now() >= this.runDeadline)
      throw new Error('Collection time budget reached; source deferred.')
    this.last.set(origin, Date.now())
    const target = await validateTarget(value, origin, this.resolver)
    const result = this.transport
      ? await this.transport(target, headers)
      : await this.request(target, headers)
    if ([301, 302, 303, 307, 308].includes(result.status))
      throw new Error('Redirect needs source-owner review; no redirects are followed.')
    if (result.status === 429) {
      const raw = result.headers['retry-after']
      const waitMs = /^\d+$/.test(raw || '') ? Number(raw) * 1000 : Date.parse(raw) - Date.now()
      this.cooldowns.set(
        origin,
        Date.now() + Math.max(3600_000, Number.isFinite(waitMs) ? waitMs : 0),
      )
      throw new Error('Source rate limit reached. Collection paused; no retries were sent.')
    }
    if (result.status >= 500)
      throw new Error('Source temporarily unavailable. No immediate retries were sent.')
    return result
  }
  request({ url, address }, headers) {
    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'GET',
          headers: {
            'user-agent': this.agent,
            accept: 'application/json,application/rss+xml,application/atom+xml,text/html;q=0.7',
            'accept-encoding': 'identity',
            ...headers,
          },
          lookup: (_hostname, options, cb) =>
            options.all ? cb(null, [address]) : cb(null, address.address, address.family),
        },
        (res) => {
          const chunks = []
          let size = 0
          res.on('data', (chunk) => {
            size += chunk.length
            if (size > 2_000_000) {
              req.destroy(new Error('Source response exceeded the 2 MB limit.'))
              return
            }
            chunks.push(chunk)
          })
          res.on('end', () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            }),
          )
          res.on('error', reject)
        },
      )
      const timer = setTimeout(() => req.destroy(new Error('Source request timed out.')), 15000)
      req.on('close', () => clearTimeout(timer))
      req.on('error', reject)
      req.end()
    })
  }
  async allow(value) {
    const u = new URL(value)
    let policy = this.robots.get(u.origin)
    if (!policy || policy.expires < Date.now()) {
      const response = await this.get(u.origin + '/robots.txt', { origin: u.origin })
      if (response.status !== 200 && response.status !== 404)
        throw new Error('robots.txt could not be verified; source blocked.')
      const parser = robotsParser(
        u.origin + '/robots.txt',
        response.status === 404 ? '' : response.body,
      )
      policy = { parser, expires: Date.now() + 3600_000 }
      this.robots.set(u.origin, policy)
    }
    if (policy.parser.isDisallowed(value, 'IndyTeerDiscovery'))
      throw new Error('robots.txt disallows this page.')
    const delay = Number(policy.parser.getCrawlDelay('IndyTeerDiscovery') || 0)
    if (!Number.isFinite(delay) || delay < 0 || delay > 30)
      throw new Error('Source crawl delay exceeds the run budget; use an authorized feed instead.')
    this.delay = Math.max(this.delay, delay * 1000)
  }
}
