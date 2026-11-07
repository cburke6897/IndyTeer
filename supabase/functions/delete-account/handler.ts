import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { Database } from '../_shared/database.ts'
import { removeFolderTree } from '../_shared/storage.ts'

type AdminClient = ReturnType<typeof createClient<Database>>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function makeClientKeys() {
  let secretKeys: Record<string, string>, apiKeys: Record<string, string>
  try {
    secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    apiKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')
  } catch {
    throw new Error('Server key configuration is invalid.')
  }
  const url = Deno.env.get('SUPABASE_URL')
  const adminKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = apiKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !adminKey || !publicKey)
    throw new Error('Supabase URL and server keys are not configured.')
  return { url, adminKey, publicKey }
}

export async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders })
  }

  let preparedUserId: string | undefined
  let adminClient: AdminClient | undefined
  try {
    const body = await request.json().catch(() => null)
    if (body?.confirm !== true && typeof body?.deleteOwnedOrganizations !== 'boolean')
      return Response.json(
        { error: 'Explicit deletion confirmation is required.' },
        { status: 400, headers: corsHeaders },
      )
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Sign in to delete your account.' },
        { status: 401, headers: corsHeaders },
      )
    }
    const token = authorization.slice('Bearer '.length)
    const { url, adminKey, publicKey } = makeClientKeys()
    const caller = createClient<Database>(url, publicKey, {
      global: { headers: { Authorization: authorization } },
    })
    const {
      data: { user },
      error: authError,
    } = await caller.auth.getUser(token)
    if (authError || !user) {
      return Response.json(
        { error: 'Your session could not be verified.' },
        { status: 401, headers: corsHeaders },
      )
    }

    const admin = createClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    adminClient = admin
    const { data: preparation, error: preparationError } = await caller.rpc(
      'prepare_account_deletion',
    )
    if (preparationError)
      return Response.json(
        { error: preparationError.message },
        { status: 409, headers: corsHeaders },
      )
    preparedUserId = user.id
    if (
      !preparation ||
      typeof preparation !== 'object' ||
      Array.isArray(preparation) ||
      !Array.isArray(preparation.organization_ids)
    )
      throw new Error('Deletion preparation failed.')
    const { data: memberships, error: membershipsError } = await admin
      .from('organization_memberships')
      .select('organization_id,role,status')
      .eq('user_id', user.id)
    if (membershipsError) throw membershipsError
    const { data: ownedOrganizations, error: ownedOrganizationsError } = await admin
      .from('organizations')
      .select('id')
      .eq('created_by', user.id)
    if (ownedOrganizationsError) throw ownedOrganizationsError
    const organizationIds = [
      ...new Set([
        ...(memberships ?? []).map((row) => row.organization_id),
        ...(ownedOrganizations ?? []).map((row) => row.id),
      ]),
    ]
    const organizationsToDelete = preparation.organization_ids.filter(
      (id: unknown): id is string => typeof id === 'string',
    )

    const { data: ownedObjects, error: inventoryError } = await admin.rpc(
      'account_storage_objects',
      { p_user_id: user.id },
    )
    if (inventoryError) throw inventoryError
    for (const bucket of new Set((ownedObjects ?? []).map((object) => object.bucket_id))) {
      const paths = (ownedObjects ?? [])
        .filter((object) => object.bucket_id === bucket)
        .map((object) => object.name)
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100))
        if (error) throw error
      }
    }

    // Remove objects through the Storage API before deleting Auth. Supabase Auth
    // rejects deletion while the user still owns Storage objects.
    await removeFolderTree(admin, 'avatars', user.id)
    const { data: opportunities, error: opportunitiesError } = organizationIds.length
      ? await admin
          .from('opportunities')
          .select('id,organization_id')
          .in('organization_id', organizationIds)
      : { data: [], error: null }
    if (opportunitiesError) throw opportunitiesError

    for (const organizationId of organizationIds) {
      const folder = organizationsToDelete.includes(organizationId)
        ? organizationId
        : `${organizationId}/${user.id}`
      await removeFolderTree(admin, 'org-logos', folder)
      await removeFolderTree(admin, 'org-covers', folder)
      await removeFolderTree(admin, 'post-images', folder)
    }
    for (const opportunity of opportunities ?? []) {
      const folder = organizationsToDelete.includes(opportunity.organization_id)
        ? opportunity.id
        : `${opportunity.id}/${user.id}`
      await removeFolderTree(admin, 'opportunity-images', folder)
    }
    if (organizationsToDelete.length) {
      const { error: organizationsDeleteError } = await admin
        .from('organizations')
        .delete()
        .in('id', organizationsToDelete)
      if (organizationsDeleteError) throw organizationsDeleteError
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false)
    if (deleteError) throw deleteError
    return Response.json({ deleted: true }, { status: 200, headers: corsHeaders })
  } catch (error) {
    if (adminClient && preparedUserId) {
      await adminClient.rpc('cancel_account_deletion', { p_user_id: preparedUserId })
    }
    const message = error instanceof Error ? error.message : 'Account deletion failed.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
