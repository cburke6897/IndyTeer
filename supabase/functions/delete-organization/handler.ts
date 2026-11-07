import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { Database } from '../_shared/database.ts'
import { removeFolderTree } from '../_shared/storage.ts'
import { serverEnvironment } from '../_shared/environment.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST')
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: cors })
  let prepared: string | undefined
  let admin: ReturnType<typeof createClient<Database>> | undefined
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer '))
      return Response.json(
        { error: 'Sign in to delete an organization.' },
        { status: 401, headers: cors },
      )
    const body = await request.json().catch(() => null)
    const organizationId = body?.organizationId
    if (
      typeof organizationId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        organizationId,
      )
    )
      return Response.json(
        { error: 'A valid organization ID is required.' },
        { status: 400, headers: cors },
      )
    const { url, adminKey, publicKey } = serverEnvironment()
    const caller = createClient<Database>(url, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const identity = await caller.auth.getUser(authorization.slice(7))
    if (identity.error || !identity.data.user)
      return Response.json(
        { error: 'Your session could not be verified.' },
        { status: 401, headers: cors },
      )
    const plan = await caller.rpc('prepare_organization_deletion', {
      p_organization_id: organizationId,
    })
    if (plan.error)
      return Response.json({ error: plan.error.message }, { status: 409, headers: cors })
    prepared = organizationId
    admin = createClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const opportunities = await admin
      .from('opportunities')
      .select('id')
      .eq('organization_id', organizationId)
    if (opportunities.error) throw opportunities.error
    for (const bucket of ['org-logos', 'org-covers', 'post-images'])
      await removeFolderTree(admin, bucket, organizationId)
    for (const opportunity of opportunities.data || [])
      await removeFolderTree(admin, 'opportunity-images', opportunity.id)
    const deleted = await admin
      .from('organizations')
      .delete()
      .eq('id', organizationId)
      .select('id')
      .maybeSingle()
    if (deleted.error) throw deleted.error
    if (!deleted.data)
      return Response.json(
        { error: 'Organization was already deleted.' },
        { status: 404, headers: cors },
      )
    return Response.json({ deleted: true, organizationId }, { headers: cors })
  } catch {
    if (prepared && admin)
      await admin.rpc('cancel_organization_deletion', { p_organization_id: prepared })
    return Response.json(
      {
        error:
          'Organization deletion did not finish. Some files may already have been removed. Retry or contact the team.',
      },
      { status: 500, headers: cors },
    )
  }
}
