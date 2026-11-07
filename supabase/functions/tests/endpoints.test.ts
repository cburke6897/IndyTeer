import { handler as removeAccount } from '../delete-account/handler.ts'
import { handler as runWorker } from '../background-worker/handler.ts'

for (const storageFails of [false, true]) {
  Deno.test(
    storageFails
      ? 'Deletion cleanup failure unlocks the account and never reports deletion'
      : 'Deletion targets the verified Auth user and cleans owned objects before deleting Auth',
    async () => {
      const previous = globalThis.fetch
      const id = '11111111-1111-4111-8111-111111111111'
      const paths: string[] = []
      Deno.env.set('SUPABASE_URL', 'https://project.test')
      Deno.env.set('SUPABASE_ANON_KEY', 'test-public-key')
      Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key')
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const path = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
          .pathname
        paths.push(path)
        if (path === '/auth/v1/user') return Response.json({ id, email: 'test@example.test' })
        if (path.endsWith('/prepare_account_deletion'))
          return Response.json({ organization_ids: [] })
        if (path.endsWith('/account_storage_objects'))
          return Response.json([{ bucket_id: 'avatars', name: id + '/orphan.png' }])
        if (path === '/storage/v1/object/avatars')
          return storageFails
            ? Response.json({ message: 'Storage unavailable', statusCode: '503' }, { status: 503 })
            : Response.json([])
        if (path === '/storage/v1/object/list/avatars') return Response.json([])
        if (path === '/rest/v1/organizations' || path === '/rest/v1/organization_memberships')
          return Response.json([])
        if (path === '/auth/v1/admin/users/' + id) return Response.json({ id })
        if (path.endsWith('/cancel_account_deletion')) return new Response(null, { status: 204 })
        throw new Error('Unexpected network access: ' + path)
      }) as typeof fetch
      try {
        const response = await removeAccount(
          post({ confirm: true, user_id: 'attacker-supplied-target' }, 'verified-user-token'),
        )
        equal(response.status, storageFails ? 500 : 200)
        if (storageFails) {
          equal(
            paths.some((p) => p.startsWith('/auth/v1/admin/users/')),
            false,
          )
          equal(paths.at(-1), '/rest/v1/rpc/cancel_account_deletion')
        } else {
          equal(await response.json(), { deleted: true })
          equal(paths.at(-1), '/auth/v1/admin/users/' + id)
          equal(
            paths.indexOf('/storage/v1/object/avatars') <
              paths.indexOf('/auth/v1/admin/users/' + id),
            true,
          )
        }
      } finally {
        globalThis.fetch = previous
      }
    },
  )
}

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const post = (body: unknown, bearer?: string) =>
  new Request('https://function.test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}),
    },
    body: JSON.stringify(body),
  })

Deno.test('Delete account rejects missing confirmation and missing authentication', async () => {
  const preflight = await removeAccount(new Request('https://function.test', { method: 'OPTIONS' }))
  equal(preflight.status, 200)
  equal(preflight.headers.get('Access-Control-Allow-Headers')?.includes('x-client-info'), true)
  equal((await removeAccount(new Request('https://function.test'))).status, 405)
  equal((await removeAccount(post({}))).status, 400)
  equal((await removeAccount(post({ confirm: true }))).status, 401)
})

Deno.test(
  'Delete account blocks shared ownership before touching Storage or Auth deletion',
  async () => {
    const previous = globalThis.fetch
    const paths: string[] = []
    Deno.env.set('SUPABASE_URL', 'https://project.test')
    Deno.env.set('SUPABASE_ANON_KEY', 'test-public-key')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key')
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const path = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
        .pathname
      paths.push(path)
      if (path === '/auth/v1/user')
        return Promise.resolve(
          Response.json({ id: '11111111-1111-4111-8111-111111111111', email: 'test@example.test' }),
        )
      if (path === '/rest/v1/rpc/prepare_account_deletion')
        return Promise.resolve(
          Response.json(
            {
              message: 'Transfer ownership of shared organizations before deleting your account.',
              code: 'P0001',
            },
            { status: 400 },
          ),
        )
      throw new Error('Unexpected network access: ' + path)
    }) as typeof fetch
    try {
      const response = await removeAccount(post({ confirm: true }, 'test-user-token'))
      equal(response.status, 409)
      equal(paths, ['/auth/v1/user', '/rest/v1/rpc/prepare_account_deletion'])
    } finally {
      globalThis.fetch = previous
    }
  },
)

Deno.test('Worker rejects browser tokens and missing cron secret', async () => {
  Deno.env.delete('CRON_SECRET')
  equal((await runWorker(post({}, 'user-token'))).status, 401)
  Deno.env.set('CRON_SECRET', 'test-cron-secret')
  equal((await runWorker(post({}, 'user-token'))).status, 401)
})

Deno.test(
  'Worker records a storage retry and skips unconfigured email without sending',
  async () => {
    const previous = globalThis.fetch
    const calls: { path: string; body: unknown }[] = []
    Deno.env.set('SUPABASE_URL', 'https://project.test')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-server-key')
    Deno.env.set('CRON_SECRET', 'test-cron-secret')
    Deno.env.delete('RESEND_API_KEY')
    Deno.env.delete('NOTIFICATION_FROM_EMAIL')
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
        .pathname
      calls.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null })
      if (path.endsWith('/enqueue_event_reminders')) return Response.json(2)
      if (path.endsWith('/claim_media_cleanup_jobs'))
        return Response.json([{ id: 'job-1', bucket: 'avatars', path: 'owner/old.png' }])
      if (path === '/storage/v1/object/avatars')
        return Response.json({ message: 'Storage unavailable', statusCode: '503' }, { status: 503 })
      if (path.endsWith('/finish_media_cleanup_job')) return new Response(null, { status: 204 })
      throw new Error('Unexpected network access: ' + path)
    }) as typeof fetch
    try {
      const response = await runWorker(post({}, 'test-cron-secret'))
      equal(response.status, 200)
      equal(await response.json(), { reminders: 2, cleaned: 0, emailed: 0, emailConfigured: false })
      const finish = calls.find((c) => c.path.endsWith('/finish_media_cleanup_job'))
      equal(finish?.body, { p_id: 'job-1', p_error: 'Storage unavailable' })
    } finally {
      globalThis.fetch = previous
    }
  },
)

Deno.test('Main per-organization choices reach the deletion preparation RPC', async()=>{
 const previous=globalThis.fetch
 const id='11111111-1111-4111-8111-111111111111'
 const org='22222222-2222-4222-8222-222222222222'
 let called=false
 Deno.env.set('SUPABASE_URL','https://project.test')
 Deno.env.set('SUPABASE_ANON_KEY','test-public-key')
 Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-server-key')
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=new URL(typeof input==='string'||input instanceof URL?input:input.url).pathname
  if(path==='/auth/v1/user') return Response.json({id})
  if(path.endsWith('/prepare_selected_account_deletion')) {
   const request=input instanceof Request?input:new Request(input,init)
   equal(await request.json(),{p_delete_organization_ids:[org]});called=true
   return Response.json({message:'An owned organization still needs a decision.'},{status:400})
  }
  throw new Error('Deletion must stop before touching data: '+path)
 }) as typeof fetch
 try {
  equal((await removeAccount(post({deleteOrganizationIds:[org]},'verified-user-token'))).status,409)
  equal(called,true)
 }finally{globalThis.fetch=previous}
})
