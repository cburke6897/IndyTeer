import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { Database } from '../_shared/database.ts'
import { removeFolderTree } from '../_shared/storage.ts'
import { handler as deleteOrganization } from '../delete-organization/handler.ts'

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
Deno.test('Storage cleanup inventories every page before removing nested folders', async () => {
  const previous = globalThis.fetch
  const operations: string[] = []
  const deleted: string[] = []
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'))
    if (init?.method === 'DELETE') {
      operations.push('remove')
      deleted.push(...body.prefixes)
      return Response.json([])
    }
    operations.push('list')
    if (body.prefix === 'org')
      return Response.json(
        Array.from({ length: body.offset === 0 ? 100 : 1 }, (_, i) => ({
          name: 'folder-' + (body.offset + i),
          id: null,
        })),
      )
    return Response.json([{ name: 'image.png', id: 'object-id' }])
  }) as typeof fetch
  try {
    const client = createClient<Database>('https://project.test', 'test-service-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await removeFolderTree(client, 'org-logos', 'org')
    assert(deleted.length === 101, 'Every nested object must be removed')
    assert(new Set(deleted).size === 101, 'No paths may be duplicated')
    assert(
      operations.indexOf('remove') > operations.lastIndexOf('list'),
      'Deleting during pagination can skip folders',
    )
  } finally {
    globalThis.fetch = previous
  }
})

Deno.test('Organization deletion rejects unauthenticated calls and bad identifiers', async () => {
  assert(
    (await deleteOrganization(new Request('https://function.test'))).status === 405,
    'GET must be rejected',
  )
  const preflight = await deleteOrganization(
    new Request('https://function.test', { method: 'OPTIONS' }),
  )
  assert(
    preflight.headers.get('Access-Control-Allow-Headers')?.includes('x-client-info'),
    'SDK preflight header is required',
  )
  assert(
    (await deleteOrganization(new Request('https://function.test', { method: 'POST' }))).status ===
      401,
    'Authentication is required',
  )
  assert(
    (
      await deleteOrganization(
        new Request('https://function.test', {
          method: 'POST',
          headers: { Authorization: 'Bearer fake' },
          body: JSON.stringify({ organizationId: 'invalid' }),
        }),
      )
    ).status === 400,
    'Identifiers must be validated',
  )
})

Deno.test(
  'Organization cleanup failure unlocks its deletion fence without reporting success',
  async () => {
    const previous = globalThis.fetch
    const paths: string[] = []
    const org = '22222222-2222-4222-8222-222222222222'
    Deno.env.set('SUPABASE_URL', 'https://project.test')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key')
    Deno.env.set('SUPABASE_ANON_KEY', 'test-public-key')
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const path = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
        .pathname
      paths.push(path)
      if (path === '/auth/v1/user')
        return Response.json({ id: '11111111-1111-4111-8111-111111111111' })
      if (path.endsWith('/prepare_organization_deletion'))
        return Response.json({ organization_id: org })
      if (path === '/rest/v1/opportunities') return Response.json([])
      if (path.startsWith('/storage/'))
        return Response.json({ message: 'Storage unavailable', statusCode: '503' }, { status: 503 })
      if (path.endsWith('/cancel_organization_deletion')) return new Response(null, { status: 204 })
      throw new Error('Unexpected external access')
    }) as typeof fetch
    try {
      const response = await deleteOrganization(
        new Request('https://function.test', {
          method: 'POST',
          headers: { Authorization: 'Bearer valid-user-token' },
          body: JSON.stringify({ organizationId: org, confirm: true }),
        }),
      )
      assert(response.status === 500, 'Partial cleanup is a failure')
      assert(
        paths.at(-1)?.endsWith('/cancel_organization_deletion'),
        'The organization must be unlocked on failure',
      )
      assert(
        !paths.includes('/rest/v1/organizations'),
        'Failed cleanup must not proceed to deleting rows',
      )
    } finally {
      globalThis.fetch = previous
    }
  },
)
