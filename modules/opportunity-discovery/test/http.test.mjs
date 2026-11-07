import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicAddress, validateTarget, PoliteHttp } from '../src/http.mjs'
const resolver = async () => [{ address: '93.184.215.14', family: 4 }]
test('Private IPv4, mapped IPv6, metadata and reserved addresses are blocked', () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.1.1',
    '0.0.0.0',
    '224.0.0.1',
    '198.18.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:a00:1::',
  ])
    assert.equal(publicAddress(ip), false, ip)
  assert.equal(publicAddress('93.184.215.14'), true)
})
test('DNS is resolved before each request and mixed public/private answers fail closed', async () => {
  await assert.rejects(
    validateTarget('https://example.org/x', 'https://example.org', async () => [
      { address: '127.0.0.1', family: 4 },
      { address: '93.184.215.14', family: 4 },
    ]),
    /Private/,
  )
  await assert.rejects(
    validateTarget('https://other.example.org', 'https://example.org', resolver),
    /approved/,
  )
  await assert.rejects(
    validateTarget('https://user:password@example.org', 'https://example.org', resolver),
    /approved/,
  )
  await assert.rejects(
    validateTarget('http://example.org', 'http://example.org', resolver),
    /HTTPS/,
  )
})
test('Redirects, including off-origin redirects, are never followed', async () => {
  let count = 0
  const http = new PoliteHttp({
    delay: 0,
    resolver,
    transport: async () => {
      count++
      return { status: 302, headers: { location: 'http://127.0.0.1/' }, body: '' }
    },
  })
  await assert.rejects(http.get('https://example.org/x'), /Redirect/)
  assert.equal(count, 1)
})
test('robots denial and unverifiable robots prevent content requests', async () => {
  for (const status of [200, 403]) {
    const paths = [],
      http = new PoliteHttp({
        delay: 0,
        resolver,
        transport: async (target) => {
          paths.push(target.url.pathname)
          return { status, headers: {}, body: 'User-agent: *\nDisallow: /private' }
        },
      })
    await assert.rejects(http.get('https://example.org/private', { robots: true }), /robots/)
    assert.deepEqual(paths, ['/robots.txt'])
  }
})
test('429 pauses the host without retrying and 404 robots permits approved pages', async () => {
  let count = 0
  const limited = new PoliteHttp({
    delay: 0,
    resolver,
    transport: async () => {
      count++
      return { status: 429, headers: { 'retry-after': '7200' }, body: '' }
    },
  })
  await assert.rejects(limited.get('https://example.org/x'), /rate limit/)
  await assert.rejects(limited.get('https://example.org/y'), /cooling/)
  assert.equal(count, 1)
  const paths = [],
    allowed = new PoliteHttp({
      delay: 0,
      resolver,
      transport: async (target) => {
        paths.push(target.url.pathname)
        return { status: target.url.pathname === '/robots.txt' ? 404 : 200, headers: {}, body: '' }
      },
    })
  await allowed.get('https://example.org/public', { robots: true })
  assert.deepEqual(paths, ['/robots.txt', '/public'])
})
