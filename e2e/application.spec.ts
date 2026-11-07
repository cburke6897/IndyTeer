import { test, expect, type Page } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const organizationId = '22222222-2222-4222-8222-222222222222'
const opportunityId = '33333333-3333-4333-8333-333333333333'
const now = new Date().toISOString()
const authUser = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'volunteer@example.test',
  email_confirmed_at: now,
  created_at: now,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Kai Volunteer' },
}

async function api(page: Page) {
  let profile: Record<string, unknown> = {
    id: userId,
    first_name: 'Kai',
    last_name: 'Volunteer',
    full_name: 'Kai Volunteer',
    headline: '',
    bio: 'Helping my community through local volunteering.',
    city: 'Indianapolis',
    state: 'IN',
    timezone: 'America/Indiana/Indianapolis',
    phone: '',
    interests: ['Environment'],
    skills: [],
    availability: {},
    avatar_url: null,
    avatar_path: null,
    onboarded: true,
    date_of_birth: '1995-01-01',
    public_profile: false,
    show_hours: false,
    show_history: false,
    is_platform_admin: false,
  }
  let organizations: Record<string, unknown>[] = []
  let memberships: Record<string, unknown>[] = []
  let opportunities: Record<string, unknown>[] = []
  let registrations: Record<string, unknown>[] = []
  let saved: Record<string, unknown>[] = []
  const manualHours: Record<string, unknown>[] = []
  const writes: { path: string; body: Record<string, unknown> }[] = []
  const unexpected: string[] = []
  page.on('pageerror', (error) => unexpected.push(error.message))
  await page.route('https://indyteer-test.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname
    const body = request.headers()['content-type']?.includes('application/json')
      ? (request.postDataJSON() as Record<string, unknown>)
      : null
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        json: data,
        status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      })
    if (request.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        },
      })
    if (body) writes.push({ path, body })
    if (path === '/auth/v1/signup') return json({ user: authUser, session: null })
    if (path === '/auth/v1/token')
      return json({
        access_token: 'test.access.token',
        token_type: 'bearer',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        user: authUser,
      })
    if (path === '/auth/v1/user') return json(authUser)
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 })
    if (path === '/rest/v1/users') {
      if (request.method() === 'PATCH') profile = { ...profile, ...body }
      return json(profile)
    }
    if (path === '/rest/v1/organization_memberships')
      return json(
        url.searchParams.has('user_id')
          ? memberships.filter((m) => m.user_id === userId)
          : memberships,
      )
    if (path === '/rest/v1/user_settings')
      return json({
        user_id: userId,
        new_opportunity_notifications: true,
        registration_notifications: true,
        email_notifications: false,
      })
    if (path === '/rest/v1/manual_hour_entries' && request.method() === 'GET') return json(manualHours)
    if (path === '/functions/v1/delete-account') return json({deleted:true})
    if (['/rest/v1/posts','/rest/v1/notifications'].includes(path)) return json([])
    if (path === '/rest/v1/organization_follows') return json([])
    if (path === '/rest/v1/rpc/get_user_profile_for_organization') {
      if (
        profile.profile_visibility !== 'everyone' &&
        !request.headers().authorization?.includes('test.access.token')
      )
        return json({ message: 'This profile is private.' }, 403)
      return json({
        id: userId,
        full_name: profile.full_name,
        bio: profile.bio,
        city: profile.city,
        profile_visibility: profile.profile_visibility,
        show_hours: false,
        show_history: false,
        phone: null,
        availability: null,
      })
    }
    if (path.startsWith('/storage/v1/object/public/avatars/'))
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX7cAAAAASUVORK5CYII=',
          'base64',
        ),
      })
    if (path.startsWith('/storage/v1/object/avatars'))
      return json(
        request.method() === 'DELETE' ? [] : { Key: path.slice('/storage/v1/object/'.length) },
      )
    if (path === '/rest/v1/rpc/review_membership_request') {
      memberships = memberships.map((m) =>
        m.user_id === body?.p_user_id
          ? { ...m, status: body?.p_approve ? 'active' : 'rejected' }
          : m,
      )
      return json(memberships.find((m) => m.user_id === body?.p_user_id))
    }
    if (path === '/rest/v1/rpc/set_organization_member_role') {
      memberships = memberships.map((m) =>
        m.user_id === body?.p_user_id ? { ...m, role: body?.p_role } : m,
      )
      return json(memberships.find((m) => m.user_id === body?.p_user_id))
    }
    if (path === '/rest/v1/rpc/transfer_organization_ownership') {
      memberships = memberships.map((m) => ({
        ...m,
        role: m.user_id === body?.p_new_owner_id ? 'owner' : 'admin',
      }))
      organizations = organizations.map((o) => ({ ...o, created_by: body?.p_new_owner_id }))
      return json(memberships.find((m) => m.user_id === body?.p_new_owner_id))
    }
    if (path === '/functions/v1/delete-organization') {
      organizations = []
      memberships = []
      opportunities = []
      return json({ deleted: true, organizationId })
    }
    if (path === '/rest/v1/public_organizations') return json(organizations)
    if (path === '/rest/v1/organizations') return json(request.headers()['accept']?.includes('vnd.pgrst.object') ? organizations[0] : organizations)
    if (path === '/rest/v1/rpc/create_organization') {
      organizations = [
        {
          id: organizationId,
          created_by: userId,
          verified: false,
          focus: ['Environment'],
          state: 'IN',
          created_at: now,
          updated_at: now,
          ...(body?.p_data as object),
        },
      ]
      memberships = [
        {
          id: 'membership',
          organization_id: organizationId,
          user_id: userId,
          role: 'owner',
          status: 'active',
        },
      ]
      return json(organizations[0])
    }
    if (path === '/rest/v1/rpc/volunteer_dashboard')
      return json({
        verified_hours: 0,
        upcoming_count: 0,
        pending_registrations: 0,
        completed_count: 0,
      })
    if (path === '/rest/v1/rpc/org_overview')
      return json({
        active_opportunities: opportunities.length,
        registrations: 0,
        verified_hours: 0,
        hours_to_verify: 0,
      })
    if (path === '/rest/v1/rpc/list_organization_members')
      return json(
        memberships
          .filter((m) => m.organization_id === body?.p_organization_id)
          .map((m) => ({
            user_id: m.user_id,
            full_name: m.user_id === userId ? profile.full_name : 'Pending volunteer',
            avatar_path: null,
            role: m.role,
            status: m.status,
          })),
      )
    if (path === '/rest/v1/registrations')
      return json(registrations.map((r) => ({ ...r, opportunity: opportunities[0] })))
    if (path === '/rest/v1/opportunity_availability')
      return json([{
        opportunity_id: opportunityId, spots: 10,
        spots_left: registrations.some((r) => ['pending', 'approved'].includes(String(r.status)))
          ? 9
          : 10,
      }])
    if (path === '/rest/v1/rpc/register_for_opportunity') {
      registrations = [
        {
          id: 'registration-1',
          opportunity_id: opportunityId,
          user_id: userId,
          status: 'pending',
          attended: false,
          hours_verified: false,
          hours: 3,
          message: body?.p_message,
          created_at: now,
        },
      ]
      return json(registrations[0])
    }
    if (path === '/rest/v1/rpc/cancel_registration') {
      registrations = registrations.map((r) => ({ ...r, status: 'cancelled' }))
      return json(registrations[0])
    }
    if (path === '/rest/v1/saved_opportunities') {
      if (request.method() === 'POST') saved = [{ ...body, opportunity: opportunities[0] }]
      if (request.method() === 'DELETE') saved = []
      return json(saved)
    }
    if (path === '/rest/v1/volunteer_hour_entries')
      return json(
        manualHours.map((h) => ({
          ...h,
          source: 'manual',
          organization_name: h.org_name,
          verified: false,
        })),
      )
    if (path === '/rest/v1/manual_hour_entries' && request.method() === 'POST') {
      const row = { id: 'manual-1', ...body }
      manualHours.push(row)
      return json(row)
    }
    if (path === '/rest/v1/opportunities') {
      if (request.method() === 'POST') {
        const o = { id: opportunityId, status: 'draft', created_at: now, updated_at: now, ...body }
        opportunities.push(o)
        return json(o)
      }
      if (request.method() === 'PATCH') {
        opportunities = opportunities.map((o) => ({ ...o, ...body }))
        return json(opportunities[0])
      }
      if (request.headers()['accept']?.includes('vnd.pgrst.object')) return json(opportunities[0])
      return json(opportunities)
    }
    unexpected.push(request.method() + ' ' + path)
    return json({ message: 'Unexpected API request' }, 500)
  })
  return {
    writes,
    unexpected,
    makeProfilePublic: () => {
      profile = { ...profile, profile_visibility: 'everyone', public_profile: true }
    },
    seedOrganization: () => {
      organizations = [
        {
          id: organizationId,
          created_by: userId,
          name: 'Indy Community Team',
          type: 'Nonprofit',
          description: 'A local organization connecting neighbors through service.',
          mission: 'Connect local people to useful volunteering.',
          city: 'Indianapolis',
          state: 'IN',
          focus: ['Environment'],
          join_policy: 'approval',
          verified: false,
        },
      ]
      memberships = [
        { organization_id: organizationId, user_id: userId, role: 'owner', status: 'active' },
        {
          organization_id: organizationId,
          user_id: '44444444-4444-4444-8444-444444444444',
          role: 'member',
          status: 'pending',
        },
      ]
    },
    seedOpportunity: () => {
      opportunities = [
        {
          id: opportunityId,
          organization_id: organizationId,
          title: 'Community Park Cleanup',
          description: 'Work together to clean our community park.',
          status: 'published',
          category: 'Environment',
          city: 'Indianapolis',
          location: 'Central Park',
          event_date: '2030-12-01',
          start_time: '09:00',
          end_time: '12:00',
          starts_at: '2030-12-01T14:00:00Z',
          timezone: 'America/Indiana/Indianapolis',
          spots: 10,
          hours: 3,
          skills: [],
          created_at: now,
          organization: { id: organizationId, name: 'Community Team' },
        },
      ]
    },
  }
}


async function login(page: Page) {
 await page.goto('/login')
 await page.getByLabel('Email',{exact:true}).fill('volunteer@example.test')
 await page.getByLabel('Password',{exact:true}).fill('demo-password8')
 await page.getByRole('button',{name:'Log in',exact:true}).click()
 await expect(page).toHaveURL(/\/app$/)
 await expect(page.getByRole('heading',{name:/Good (morning|afternoon|evening), Kai/})).toBeVisible()
}

test('main signup sends full_name without an account type',async({page})=>{
 const backend=await api(page)
 await page.goto('/signup')
 await page.getByLabel('First name',{exact:true}).fill('Kai')
 await page.getByLabel('Last name',{exact:true}).fill('Volunteer')
 await page.getByLabel('Email',{exact:true}).fill('volunteer@example.test')
 await page.getByLabel('Password',{exact:true}).fill('demo-password8')
 await page.getByLabel('Confirm password',{exact:true}).fill('demo-password8')
 await page.getByRole('checkbox').check()
 await page.getByRole('button',{name:'Create account',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Check your email'})).toBeVisible()
 expect(backend.writes.find(w=>w.path==='/auth/v1/signup')?.body.data).toEqual(expect.objectContaining({full_name:'Kai Volunteer'}))
 expect(backend.writes.find(w=>w.path==='/auth/v1/signup')?.body.data).not.toHaveProperty('account_type')
 expect(backend.unexpected).toEqual([])
})

test('main login and database-backed name survive a reload',async({page})=>{
 const backend=await api(page)
 await login(page)
 await page.goto('/app/settings')
 await page.getByLabel('First name',{exact:true}).fill('River')
 await page.getByRole('button',{name:'Save account',exact:true}).click()
 await expect.poll(()=>backend.writes.some(w=>w.path==='/rest/v1/users'&&w.body.full_name==='River Volunteer')).toBe(true)
 await page.reload()
 await expect(page.getByLabel('First name',{exact:true})).toHaveValue('River')
 expect(backend.unexpected).toEqual([])
})

test('main protects private routes and mobile signup fits',async({page})=>{
 const backend=await api(page)
 await page.goto('/org/opportunities')
 await expect(page).toHaveURL(/\/login/)
 await page.setViewportSize({width:390,height:844})
 await page.goto('/signup')
 await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 expect(backend.unexpected).toEqual([])
})

test('main organization route retains the current workspace',async({page})=>{
 const backend=await api(page);backend.seedOrganization();backend.seedOpportunity()
 await login(page)
 await page.goto('/org/opportunities')
 await expect(page.getByRole('heading',{name:'My opportunities',exact:true})).toBeVisible()
 await expect(page.getByText('Community Park Cleanup',{exact:true})).toBeVisible()
 await expect(page).toHaveURL(/\/org\/opportunities$/)
 expect(backend.unexpected).toEqual([])
})
