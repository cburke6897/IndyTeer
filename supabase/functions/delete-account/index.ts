import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // supabase-js adds x-client-info to every request; the browser preflight fails without it.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Admin = ReturnType<typeof createClient>

function makeClientKeys() {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const apiKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
  const url = Deno.env.get('SUPABASE_URL')
  const adminKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = apiKeys.default ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !adminKey || !publicKey) throw new Error('Supabase URL and server keys are not configured.')
  return { url, adminKey, publicKey }
}

async function listFiles(admin: Admin, bucket: string, folder: string): Promise<string[]> {
  const files: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset })
    if (error) throw new Error(`Could not list ${bucket}/${folder}: ${error.message}`)
    if (!data?.length) break
    for (const item of data) {
      const path = `${folder}/${item.name}`
      if (item.id) files.push(path)
      else files.push(...await listFiles(admin, bucket, path))
    }
    offset += data.length
    if (data.length < 100) break
  }
  return files
}

async function removeFolderTree(admin: Admin, bucket: string, folder: string) {
  const paths = await listFiles(admin, bucket, folder)
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
    if (error) throw new Error(`Could not remove files from ${bucket}/${folder}: ${error.message}`)
  }
}

// Auth refuses to delete a user who still owns Storage objects. For an organization that lives on
// (it has another owner), re-upload the departing user's files with the service role so they keep
// the same path and public URL (a logo or cover must not break) but no longer belong to the user.
async function handOverFolder(admin: Admin, bucket: string, folder: string) {
  for (const path of await listFiles(admin, bucket, folder)) {
    const { data: blob, error: downloadError } = await admin.storage.from(bucket).download(path)
    if (downloadError || !blob) throw new Error(`Could not read ${bucket}/${path}: ${downloadError?.message ?? 'missing'}`)
    const { error: removeError } = await admin.storage.from(bucket).remove([path])
    if (removeError) throw new Error(`Could not release ${bucket}/${path}: ${removeError.message}`)
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: true })
    if (uploadError) throw new Error(`Could not restore ${bucket}/${path}: ${uploadError.message}`)
  }
}

type Candidate = { id: string; name: string; otherActiveMembers: number }

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

    // The caller names, by id, each organization they chose to delete. Nothing else is deleted:
    // an organization with another owner is kept, and every other owned organization needs a decision
    // (transfer ownership first, or list it here).
    const body = await request.json().catch(() => ({})) as { deleteOrganizationIds?: unknown }
    const chosenToDelete = new Set(
      Array.isArray(body?.deleteOrganizationIds) ? body.deleteOrganizationIds.filter((id): id is string => typeof id === 'string') : [],
    )

    const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: memberships, error: membershipsError } = await admin
      .from('organization_memberships').select('organization_id,role,status').eq('user_id', user.id)
    if (membershipsError) throw membershipsError
    const { data: createdOrganizations, error: createdError } = await admin
      .from('organizations').select('id').eq('created_by', user.id)
    if (createdError) throw createdError

    const organizationIds = [...new Set([
      ...(memberships ?? []).map((row) => row.organization_id),
      ...(createdOrganizations ?? []).map((row) => row.id),
    ])]
    // Organizations this account is responsible for: created by it, or where it is an active owner.
    const responsibleIds = [...new Set([
      ...(createdOrganizations ?? []).map((row) => row.id),
      ...(memberships ?? []).filter((row) => row.role === 'owner' && row.status === 'active').map((row) => row.organization_id),
    ])]

    const keepIds: string[] = []
    const needDecision: Candidate[] = []
    const reassign = new Map<string, string>()
    if (responsibleIds.length) {
      const { data: organizations, error: organizationsError } = await admin
        .from('organizations').select('id,name,created_by').in('id', responsibleIds)
      if (organizationsError) throw organizationsError
      const { data: others, error: othersError } = await admin
        .from('organization_memberships').select('organization_id,user_id,role')
        .in('organization_id', responsibleIds).neq('user_id', user.id).eq('status', 'active')
      if (othersError) throw othersError
      for (const organization of organizations ?? []) {
        const active = (others ?? []).filter((row) => row.organization_id === organization.id)
        const otherOwner = active.find((row) => row.role === 'owner')
        if (otherOwner) {
          // Ownership was transferred (or shared): the organization lives on without this account.
          keepIds.push(organization.id)
          if (organization.created_by === user.id) reassign.set(organization.id, otherOwner.user_id)
        } else {
          needDecision.push({ id: organization.id, name: organization.name, otherActiveMembers: active.length })
        }
      }
    }

    const undecided = needDecision.filter((organization) => !chosenToDelete.has(organization.id))
    if (undecided.length) {
      return Response.json({
        code: 'ORGANIZATION_DECISION_REQUIRED',
        error: 'You own organizations that need a decision. Transfer ownership to another member or choose to delete each one. Your account was not deleted.',
        organizations: undecided,
      }, { status: 409, headers: corsHeaders })
    }
    const deleteIds = needDecision.map((organization) => organization.id)

    // Point the creator column at a remaining owner, so removing this user cannot cascade to a kept organization.
    for (const [organizationId, ownerId] of reassign) {
      const { error } = await admin.from('organizations').update({ created_by: ownerId }).eq('id', organizationId)
      if (error) throw error
    }

    // Remove objects through the Storage API before deleting Auth.
    await removeFolderTree(admin, 'avatars', user.id)
    const { data: opportunities, error: opportunitiesError } = organizationIds.length
      ? await admin.from('opportunities').select('id,organization_id').in('organization_id', organizationIds)
      : { data: [], error: null }
    if (opportunitiesError) throw opportunitiesError

    for (const organizationId of organizationIds) {
      const deleting = deleteIds.includes(organizationId)
      for (const bucket of ['org-logos', 'org-covers', 'post-images']) {
        if (deleting) await removeFolderTree(admin, bucket, organizationId)
        else await handOverFolder(admin, bucket, `${organizationId}/${user.id}`)
      }
    }
    for (const opportunity of opportunities ?? []) {
      if (deleteIds.includes(opportunity.organization_id)) await removeFolderTree(admin, 'opportunity-images', opportunity.id)
      else await handOverFolder(admin, 'opportunity-images', `${opportunity.id}/${user.id}`)
    }
    if (deleteIds.length) {
      const { error: organizationsDeleteError } = await admin.from('organizations').delete().in('id', deleteIds)
      if (organizationsDeleteError) throw organizationsDeleteError
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false)
    if (deleteError) throw deleteError
    return Response.json({ deleted: true, deletedOrganizations: deleteIds, keptOrganizations: keepIds }, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account deletion failed.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
})
