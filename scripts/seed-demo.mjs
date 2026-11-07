// Explicit local-only demo setup. Never runs during build or migrations.
import { createClient } from '@supabase/supabase-js'
try {
  process.loadEnvFile('.env.server.local')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const url = process.env.SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
const password = process.env.DEMO_PASSWORD
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error(
    'Demo seed is restricted to local Supabase. Set SUPABASE_URL=http://127.0.0.1:54321 in .env.server.local.',
  )
if (!secret || !publishable || !password || password.length < 8)
  throw new Error(
    'Set server key, publishable key, and DEMO_PASSWORD (8+ characters) in .env.server.local. See docs/DEPLOYMENT.md.',
  )
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secret, options)
function checked(result) {
  if (result.error) throw result.error
  return result.data
}
async function identity(email, full_name, isAdmin = false) {
  let found
  for (let page = 1; !found; page++) {
    const { users } = checked(await admin.auth.admin.listUsers({ page, perPage: 100 }))
    found = users.find((u) => u.email === email)
    if (users.length < 100) break
  }
  if (!found)
    found = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      }),
    ).user
  const client = createClient(url, publishable, options)
  checked(await client.auth.signInWithPassword({ email, password }))
  const profile = checked(await client.from('users').select('*').eq('id', found.id).single())
  if (!profile.onboarded)
    checked(
      await client.rpc('complete_user_onboarding', {
        p_data: {
          first_name: full_name.split(' ')[0],
          last_name: full_name.split(' ').slice(1).join(' '),
          bio: 'I enjoy working with neighbors to improve our community.',
          city: 'Indianapolis',
          interests: ['Environment', 'Education'],
          skills: ['Event Planning'],
          date_of_birth: '1995-01-01',
          terms_accepted: true,
        },
      }),
    )
  if (isAdmin)
    checked(await admin.from('users').update({ is_platform_admin: true }).eq('id', found.id))
  return { id: found.id, client, email }
}
const owner = await identity('owner@indyteer.test', 'Jordan Organizer')
const volunteer = await identity('volunteer@indyteer.test', 'Kai Volunteer')
const member = await identity('member@indyteer.test', 'Alex Member')
await identity('admin@indyteer.test', 'Sam Administrator', true)
let organization = checked(
  await admin
    .from('organizations')
    .select('*')
    .eq('created_by', owner.id)
    .eq('name', 'Indy Community Team')
    .maybeSingle(),
)
if (!organization)
  organization = checked(
    await owner.client.rpc('create_organization', {
      p_data: {
        name: 'Indy Community Team',
        type: 'Nonprofit',
        description: 'A local organization connecting Indianapolis neighbors through volunteering.',
        mission: 'Help local people make a lasting difference.',
        city: 'Indianapolis',
        contact_email: owner.email,
        focus: ['Environment', 'Education'],
        join_policy: 'approval',
      },
    }),
  )
const membership = checked(
  await admin
    .from('organization_memberships')
    .select('*')
    .eq('organization_id', organization.id)
    .eq('user_id', member.id)
    .maybeSingle(),
)
if (!membership || membership.status !== 'active') {
  checked(
    await owner.client.rpc('invite_user_to_organization', {
      p_organization_id: organization.id,
      p_user_id: member.id,
      p_role: 'member',
    }),
  )
  checked(
    await member.client.rpc('accept_organization_invite', { p_organization_id: organization.id }),
  )
}
const future = new Date()
future.setUTCDate(future.getUTCDate() + 7)
const past = new Date()
past.setUTCDate(past.getUTCDate() - 7)
for (const [title, historical] of [
  ['Community Park Cleanup', false],
  ['Neighborhood Food Drive', true],
]) {
  let opportunity = checked(
    await admin
      .from('opportunities')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('title', title)
      .maybeSingle(),
  )
  if (!opportunity) {
    opportunity = checked(
      await admin
        .from('opportunities')
        .insert({
          organization_id: organization.id,
          title,
          description: 'Work with our friendly neighborhood team to support the local community.',
          category: 'Environment',
          city: 'Indianapolis',
          location: 'Community Park',
          event_date: future.toISOString().slice(0, 10),
          start_time: '09:00',
          end_time: '12:00',
          timezone: 'America/Indiana/Indianapolis',
          spots: 12,
          hours: 3,
          status: 'published',
        })
        .select()
        .single(),
    )
    const registration = checked(
      await volunteer.client.rpc('register_for_opportunity', { p_opportunity_id: opportunity.id }),
    )
    checked(
      await owner.client.rpc('set_registration_status', {
        p_registration_id: registration.id,
        p_status: 'approved',
      }),
    )
    if (historical) {
      checked(
        await admin
          .from('opportunities')
          .update({ event_date: past.toISOString().slice(0, 10) })
          .eq('id', opportunity.id),
      )
      checked(
        await owner.client.rpc('set_attended', {
          p_registration_id: registration.id,
          p_attended: true,
        }),
      )
      checked(
        await owner.client.rpc('verify_hours', { p_registration_id: registration.id, p_hours: 3 }),
      )
    }
  }
}
const existingPosts = checked(
  await admin.from('posts').select('id').eq('organization_id', organization.id).limit(1),
)
if (!existingPosts.length)
  checked(
    await owner.client
      .from('posts')
      .insert({
        organization_id: organization.id,
        author_user_id: owner.id,
        title: 'Welcome to our community',
        body: 'Join us for a local cleanup and meet your neighbors.',
        kind: 'update',
      }),
  )
checked(
  await volunteer.client
    .from('organization_follows')
    .upsert(
      { user_id: volunteer.id, organization_id: organization.id },
      { onConflict: 'user_id,organization_id', ignoreDuplicates: true },
    ),
)
console.log(
  'Local demo ready. Use DEMO_PASSWORD with owner@indyteer.test, volunteer@indyteer.test, member@indyteer.test, or admin@indyteer.test.',
)
