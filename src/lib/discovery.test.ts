import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicOpportunities, publicSourceLink } from './discovery'
afterEach(() => vi.unstubAllGlobals())
describe('anonymous public discovery', () => {
  it('uses the same-origin feed without Auth headers, cookies or stored sessions', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ items: [] }))
    vi.stubGlobal('fetch', request)
    await expect(getPublicOpportunities()).resolves.toEqual([])
    expect(request).toHaveBeenCalledWith(
      '/api/discovery/listings',
      expect.objectContaining({ credentials: 'omit' }),
    )
    expect(request.mock.calls[0][1]).not.toHaveProperty('headers')
  })
  it('rejects unsafe source links and filters malformed listings', async () => {
    expect(publicSourceLink('javascript:alert(1)')).toBeUndefined()
    expect(publicSourceLink('https://user:password@example.org')).toBeUndefined()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            items: [{ id: 'a', title: 'Unsafe', sourceUrl: 'javascript:alert(1)' }],
          }),
        ),
    )
    await expect(getPublicOpportunities()).resolves.toEqual([])
  })
  it('reports a service outage as a recoverable discovery error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(getPublicOpportunities()).rejects.toThrow('temporarily unavailable')
  })
})
