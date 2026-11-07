import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js adds x-client-info to every request; the browser preflight fails without it.
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
      return Response.json({ error: 'Sign in to delete your account.' }, { status: 401, headers: corsHeaders })
    }
    const token = authorization.slice('Bearer '.length)
    const { url, adminKey, publicKey } = makeClientKeys()
    const caller = createClient(url, publicKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await caller.auth.getUser(token)
    if (authError || !user) {
      return Response.json({ error: 'Your session could not be verified.' }, { status: 401, headers: corsHeaders })
    }

    // Transferred organizations are no longer owned by the caller. Any remaining owned
    // organizations are deleted only after the caller explicitly chooses that outcome.
    const body = await request.json().catch(() => ({})) as { deleteOwnedOrganizations?: unknown }
    const confirmedOrganizationDeletion = body?.deleteOwnedOrganizations === true

    const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: memberships, error: membershipsError } = await admin
      .from('organization_memberships').select('organization_id,role,status').eq('user_id', user.id)
    if (membershipsError) throw membershipsError
    const { data: ownedOrganizations, error: ownedOrganizationsError } = await admin
      .from('organizations').select('id').eq('created_by', user.id)
    if (ownedOrganizationsError) throw ownedOrganizationsError
    const organizationIds = [...new Set([
      ...(memberships ?? []).map((row) => row.organization_id),
      ...(ownedOrganizations ?? []).map((row) => row.id),
    ])]
    const organizationsToDelete = [...new Set([
      ...(ownedOrganizations ?? []).map((row) => row.id),
      ...(memberships ?? []).filter((row) => row.role === 'owner' && row.status === 'active')
        .map((row) => row.organization_id),
    ])]

    // Safety checks run before anything is removed. If the UI has transferred ownership first,
    // the organization no longer appears here. Otherwise, explicit confirmation means deleting the
    // whole organization, including its active members' shared data.
    if (organizationsToDelete.length) {
      const { data: organizations, error: organizationsError } = await admin
        .from('organizations').select('id,name').in('id', organizationsToDelete)
      if (organizationsError) throw organizationsError
      const { data: others, error: othersError } = await admin
        .from('organization_memberships').select('organization_id')
        .in('organization_id', organizationsToDelete).neq('user_id', user.id).eq('status', 'active')
      if (othersError) throw othersError
      const memberCounts = new Map<string, number>()
      for (const row of others ?? []) {
        memberCounts.set(row.organization_id, (memberCounts.get(row.organization_id) ?? 0) + 1)
      }
      const summary = (organizations ?? []).map((row) => ({
        id: row.id, name: row.name, otherActiveMembers: memberCounts.get(row.id) ?? 0,
      }))
      if (!confirmedOrganizationDeletion) {
        return Response.json({
          code: 'ORGANIZATION_DELETION_NOT_CONFIRMED',
          error: 'Choose a successor for each organization you want to keep, or confirm that the remaining organizations should be permanently deleted.',
          organizations: summary,
        }, { status: 409, headers: corsHeaders })
      }
    }

    // Remove objects through the Storage API before deleting Auth. Supabase Auth
    // rejects deletion while the user still owns Storage objects.
    await removeFolderTree(admin, 'avatars', user.id)
    const { data: opportunities, error: opportunitiesError } = organizationIds.length
      ? await admin.from('opportunities').select('id,organization_id').in('organization_id', organizationIds)
      : { data: [], error: null }
    if (opportunitiesError) throw opportunitiesError

    for (const organizationId of organizationIds) {
      const folder = organizationsToDelete.includes(organizationId) ? organizationId : `${organizationId}/${user.id}`
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
      const { error: organizationsDeleteError } = await admin.from('organizations')
        .delete().in('id', organizationsToDelete)
      if (organizationsDeleteError) throw organizationsDeleteError
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false)
    if (deleteError) throw deleteError
    return Response.json({ deleted: true }, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account deletion failed.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
})
