import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function makeClientKeys() {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const apiKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
  const url = Deno.env.get('SUPABASE_URL')
  const adminKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = apiKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !adminKey || !publicKey) throw new Error('Supabase URL and server keys are not configured.')
  return { url, adminKey, publicKey }
}

async function removeFolderTree(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  folder: string,
) {
  const paths: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset })
    if (error) throw new Error(`Could not list ${bucket}/${folder}: ${error.message}`)
    if (!data?.length) break
    for (const item of data) {
      const path = `${folder}/${item.name}`
      if (item.id) paths.push(path)
      else await removeFolderTree(admin, bucket, path)
    }
    offset += data.length
    if (data.length < 100) break
  }
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
    if (error) throw new Error(`Could not remove files from ${bucket}/${folder}: ${error.message}`)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders })
  }

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return Response.json({ error: 'Sign in to delete an organization.' }, { status: 401, headers: corsHeaders })
    }
    const organizationId = (await request.json().catch(() => ({})) as { organizationId?: unknown }).organizationId
    if (typeof organizationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
      return Response.json({ error: 'A valid organization ID is required.' }, { status: 400, headers: corsHeaders })
    }

    const token = authorization.slice('Bearer '.length)
    const { url, adminKey, publicKey } = makeClientKeys()
    const caller = createClient(url, publicKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await caller.auth.getUser(token)
    if (authError || !user) {
      return Response.json({ error: 'Your session could not be verified.' }, { status: 401, headers: corsHeaders })
    }

    const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: membership, error: membershipError } = await admin.from('organization_memberships')
      .select('organization_id').eq('organization_id', organizationId).eq('user_id', user.id)
      .eq('role', 'owner').eq('status', 'active').maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) {
      return Response.json({ error: 'Only an active organization owner can delete this organization.' }, { status: 403, headers: corsHeaders })
    }

    const { data: organization, error: organizationError } = await admin.from('organizations')
      .select('id').eq('id', organizationId).maybeSingle()
    if (organizationError) throw organizationError
    if (!organization) return Response.json({ error: 'Organization not found.' }, { status: 404, headers: corsHeaders })

    const { data: opportunities, error: opportunitiesError } = await admin.from('opportunities')
      .select('id').eq('organization_id', organizationId)
    if (opportunitiesError) throw opportunitiesError

    // Remove every member's organization assets before deleting the rows they belong to.
    await removeFolderTree(admin, 'org-logos', organizationId)
    await removeFolderTree(admin, 'org-covers', organizationId)
    await removeFolderTree(admin, 'post-images', organizationId)
    for (const opportunity of opportunities ?? []) {
      await removeFolderTree(admin, 'opportunity-images', opportunity.id)
    }

    const { data: deleted, error: deleteError } = await admin.from('organizations')
      .delete().eq('id', organizationId).select('id').maybeSingle()
    if (deleteError) throw deleteError
    if (!deleted) return Response.json({ error: 'Organization was already deleted.' }, { status: 404, headers: corsHeaders })

    return Response.json({ deleted: true, organizationId }, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Organization deletion failed.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
})
