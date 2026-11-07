import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabase } from './database-harness.mjs'

let pg
before(async () => {
  pg = await createDatabase()
})
after(async () => {
  await pg?.close()
})
async function asUser(id, sql, params = []) {
  await pg.exec('begin; set local role authenticated;')
  try {
    await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [id])
    const result = await pg.query(sql, params)
    await pg.exec('commit')
    return result.rows
  } catch (error) {
    await pg.exec('rollback')
    throw error
  }
}
async function asAnon(sql) {
  await pg.exec('begin; set local role anon;')
  try {
    const result = await pg.query(sql)
    await pg.exec('commit')
    return result.rows
  } catch (error) {
    await pg.exec('rollback')
    throw error
  }
}
async function user(name = 'Test Volunteer') {
  const id = randomUUID()
  await pg.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    id,
    id + '@example.test',
    JSON.stringify({ full_name: name }),
  ])
  await asUser(id, 'select public.complete_user_onboarding($1)', [
    JSON.stringify({
      first_name: name.split(' ')[0],
      last_name: 'Volunteer',
      bio: 'I am here to help my local community.',
      city: 'Indianapolis',
      interests: ['Environment'],
      skills: [],
      terms_accepted: true,
      date_of_birth: '1995-01-01',
    }),
  ])
  return id
}
async function organization(owner, joinPolicy = 'approval') {
  return (
    await asUser(owner, 'select * from public.create_organization($1)', [
      JSON.stringify({
        name: 'Test Community Organization',
        description: 'A community organization helping local neighbors.',
        mission: 'Bring our neighbors together.',
        city: 'Indianapolis',
        focus: ['Environment'],
        join_policy: joinPolicy,
      }),
    ])
  )[0]
}
async function event(owner, org, spots = 2) {
  const row = (
    await asUser(
      owner,
      "insert into public.opportunities(organization_id,title,description,category,city,location,event_date,start_time,end_time,spots,hours) values($1,'Community Cleanup','Help clean a local community park.','Environment','Indianapolis','Central Park',current_date+7,'09:00','12:00',$2,3) returning *",
      [org, spots],
    )
  )[0]
  await asUser(owner, "update public.opportunities set status='published' where id=$1", [row.id])
  return row
}

test('Auth signup creates users and settings without account_type metadata', async () => {
  const id = randomUUID()
  await pg.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
    id,
    JSON.stringify({ full_name: 'Kai Volunteer' }),
  ])
  const { rows } = await pg.query('select * from public.users where id=$1', [id])
  assert.equal(rows[0].full_name, 'Kai Volunteer')
  assert.equal(rows[0].id, id)
  assert.equal(rows[0].is_platform_admin, false)
  assert.equal(
    (await pg.query('select count(*)::int n from public.user_settings where user_id=$1', [id]))
      .rows[0].n,
    1,
  )
})
test('Private user rows and privileged profile fields are protected', async () => {
  const a = await user('Alice One'),
    b = await user('Bob Two')
  assert.equal((await asUser(a, 'select id from public.users where id=$1', [b])).length, 0)
  assert.equal(
    (await asAnon('select id from public.public_users')).some((r) => r.id === a),
    false,
  )
  await assert.rejects(
    () => asUser(a, 'update public.users set is_platform_admin=true where id=$1', [a]),
    /permission denied/,
  )
  await asUser(a, 'update public.users set full_name=$2,public_profile=true where id=$1', [
    a,
    'Alice Updated',
  ])
  const own = (await asUser(a, 'select first_name,last_name from public.users where id=$1', [a]))[0]
  assert.deepEqual(own, { first_name: 'Alice', last_name: 'Updated' })
  assert.equal(
    (await asAnon('select id from public.public_users')).some((r) => r.id === a),
    true,
  )
})
test('Onboarding rejects invalid data and cannot be repeated', async () => {
  const id = randomUUID()
  await pg.query('insert into auth.users(id) values($1)', [id])
  await assert.rejects(
    () =>
      asUser(id, 'select public.complete_user_onboarding($1)', [
        JSON.stringify({ terms_accepted: true, first_name: 'A', bio: 'tiny' }),
      ]),
    /Biography/,
  )
  const ready = await user()
  await assert.rejects(
    () =>
      asUser(ready, 'select public.complete_user_onboarding($1)', [
        JSON.stringify({
          first_name: 'A',
          bio: 'A sufficiently long biography.',
          city: 'Indy',
          interests: ['Environment'],
          terms_accepted: true,
        }),
      ]),
    /already complete/,
  )
})
test('Organization creation gives only the creator an active owner membership', async () => {
  const owner = await user()
  const org = await organization(owner)
  const row = (
    await asUser(
      owner,
      'select role,status from public.organization_memberships where organization_id=$1',
      [org.id],
    )
  )[0]
  assert.deepEqual(row, { role: 'owner', status: 'active' })
  await assert.rejects(
    () => asUser(owner, 'update public.organizations set verified=true where id=$1', [org.id]),
    /permission denied/,
  )
})
test('Join, approve, invite, accept, and remove workflows enforce organization permissions', async () => {
  const owner = await user(),
    member = await user(),
    stranger = await user()
  const org = await organization(owner)
  await asUser(member, 'select public.request_to_join_organization($1)', [org.id])
  await assert.rejects(
    () => asUser(stranger, 'select public.review_membership_request($1,$2,true)', [org.id, member]),
    /admin required/,
  )
  await asUser(owner, 'select public.review_membership_request($1,$2,true)', [org.id, member])
  await asUser(owner, "select public.invite_user_to_organization($1,$2,'member')", [
    org.id,
    stranger,
  ])
  await asUser(stranger, 'select public.accept_organization_invite($1)', [org.id])
  await asUser(owner, 'select public.remove_organization_member($1,$2)', [org.id, stranger])
  assert.equal(
    (
      await asUser(
        owner,
        'select status from public.organization_memberships where organization_id=$1 and user_id=$2',
        [org.id, stranger],
      )
    )[0].status,
    'removed',
  )
  await assert.rejects(
    () => asUser(owner, 'select public.remove_organization_member($1,$2)', [org.id, owner]),
    /last owner/,
  )
})
test('Invitation-only organizations reject public join requests', async () => {
  const owner = await user(),
    visitor = await user()
  const org = await organization(owner, 'invite_only')
  await assert.rejects(
    () => asUser(visitor, 'select public.request_to_join_organization($1)', [org.id]),
    /invitation/,
  )
})
test('Capacity is enforced for pending and approved registrations, including re-registration', async () => {
  const owner = await user(),
    a = await user(),
    b = await user()
  const org = await organization(owner),
    opp = await event(owner, org.id, 1)
  const first = (await asUser(a, 'select * from public.register_for_opportunity($1)', [opp.id]))[0]
  assert.equal(Number(first.hours), 3)
  await assert.rejects(
    () => asUser(b, 'select public.register_for_opportunity($1)', [opp.id]),
    /SPOTS_FULL/,
  )
  await asUser(a, 'select public.cancel_registration($1)', [first.id])
  const second = (await asUser(b, 'select * from public.register_for_opportunity($1)', [opp.id]))[0]
  await asUser(owner, "select public.set_registration_status($1,'approved')", [second.id])
  await assert.rejects(
    () => asUser(a, 'select public.register_for_opportunity($1)', [opp.id]),
    /SPOTS_FULL/,
  )
  await assert.rejects(
    () => asUser(a, 'select public.cancel_registration($1)', [second.id]),
    /not found/,
  )
})
test('Attendance and hour verification require an org admin and valid event timing', async () => {
  const owner = await user(),
    volunteer = await user(),
    stranger = await user()
  const org = await organization(owner),
    opp = await event(owner, org.id)
  const r = (
    await asUser(volunteer, 'select * from public.register_for_opportunity($1)', [opp.id])
  )[0]
  await asUser(owner, "select public.set_registration_status($1,'approved')", [r.id])
  await assert.rejects(
    () => asUser(owner, 'select public.set_attended($1,true)', [r.id]),
    /event date/,
  )
  await pg.query('update public.opportunities set event_date=current_date-1 where id=$1', [opp.id])
  await asUser(owner, 'select public.set_attended($1,true)', [r.id])
  await assert.rejects(
    () => asUser(stranger, 'select public.verify_hours($1,3)', [r.id]),
    /admin required/,
  )
  await asUser(owner, 'select public.verify_hours($1,3.5)', [r.id])
  const result = (
    await asUser(volunteer, 'select * from public.volunteer_hour_entries where user_id=$1', [
      volunteer,
    ])
  )[0]
  assert.equal(Number(result.hours), 3.5)
  assert.equal(result.verified, true)
})
test('Anonymous users see published events and cannot execute private mutations', async () => {
  const owner = await user(),
    org = await organization(owner)
  const opp = await event(owner, org.id)
  assert.ok((await asAnon('select id from public.opportunities')).some((o) => o.id === opp.id))
  await assert.rejects(
    () => asAnon("select public.create_organization('{}'::jsonb)"),
    /permission denied/,
  )
})
test('Manual hours enforce ownership, range, and non-future dates', async () => {
  const owner = await user(),
    other = await user()
  await assert.rejects(
    () =>
      asUser(
        owner,
        "insert into public.manual_hour_entries(user_id,org_name,title,entry_date,hours) values($1,'Org','Activity',current_date+1,2)",
        [owner],
      ),
    /row-level security/,
  )
  await assert.rejects(
    () =>
      asUser(
        owner,
        "insert into public.manual_hour_entries(user_id,org_name,title,entry_date,hours) values($1,'Org','Activity',current_date,25)",
        [owner],
      ),
    /check constraint/,
  )
  const row = (
    await asUser(
      owner,
      "insert into public.manual_hour_entries(user_id,org_name,title,entry_date,hours) values($1,'Org','Activity',current_date,2) returning id",
      [owner],
    )
  )[0]
  assert.equal(
    (
      await asUser(other, 'delete from public.manual_hour_entries where id=$1 returning id', [
        row.id,
      ])
    ).length,
    0,
  )
})
test('Storage policies reject writes to another user folder', async () => {
  const owner = await user(),
    other = await user()
  await asUser(owner, "insert into storage.objects(bucket_id,name) values('avatars',$1)", [
    owner + '/image.png',
  ])
  await assert.rejects(
    () =>
      asUser(other, "insert into storage.objects(bucket_id,name) values('avatars',$1)", [
        owner + '/stolen.png',
      ]),
    /row-level security/,
  )
})
test('Platform verification is admin-only', async () => {
  const owner = await user(),
    admin = await user()
  const org = await organization(owner)
  await assert.rejects(
    () => asUser(owner, 'select public.set_organization_verified($1,true)', [org.id]),
    /administrator/,
  )
  await pg.query('update public.users set is_platform_admin=true where id=$1', [admin])
  await asUser(admin, 'select public.set_organization_verified($1,true)', [org.id])
  assert.equal(
    (await pg.query('select verified from public.organizations where id=$1', [org.id])).rows[0]
      .verified,
    true,
  )
})
test('Ownership transfer updates creator and blocks deletion of shared organizations', async () => {
  const owner = await user(),
    member = await user()
  const org = await organization(owner)
  await asUser(owner, "select public.invite_user_to_organization($1,$2,'member')", [org.id, member])
  await asUser(member, 'select public.accept_organization_invite($1)', [org.id])
  await assert.rejects(
    () => asUser(owner, 'select public.prepare_account_deletion()'),
    /Transfer ownership/,
  )
  assert.equal(
    (await pg.query('select deletion_pending from public.users where id=$1', [owner])).rows[0]
      .deletion_pending,
    false,
  )
  await asUser(owner, 'select public.transfer_organization_ownership($1,$2)', [org.id, member])
  await asUser(owner, 'select public.prepare_account_deletion()')
  await pg.query('delete from auth.users where id=$1', [owner])
  assert.equal(
    (await pg.query('select created_by from public.organizations where id=$1', [org.id])).rows[0]
      .created_by,
    member,
  )
})
test('Deletion preparation fences memberships and organization creation until service cancellation', async () => {
  const owner = await user(),
    other = await user()
  const org = await organization(owner)
  const plan = (await asUser(owner, 'select public.prepare_account_deletion(true) plan'))[0].plan
  assert.deepEqual(plan.organization_ids, [org.id])
  await assert.rejects(
    () => asUser(other, 'select public.request_to_join_organization($1)', [org.id]),
    /being deleted/,
  )
  await assert.rejects(() => organization(owner), /deletion is in progress/)
  await pg.query('select public.cancel_account_deletion($1)', [owner])
  await asUser(other, 'select public.request_to_join_organization($1)', [org.id])
})
test('Recurring events have individual dates and capacity', async () => {
  const owner = await user(),
    org = await organization(owner)
  const rows = await asUser(owner, 'select * from public.create_opportunity_series($1,3)', [
    JSON.stringify({
      organization_id: org.id,
      title: 'Weekly community cleanup',
      description: 'A recurring cleanup to care for our parks.',
      category: 'Environment',
      city: 'Indianapolis',
      location: 'Park',
      event_date: '2030-01-01',
      start_time: '09:00',
      end_time: '12:00',
      timezone: 'America/Indiana/Indianapolis',
      spots: 5,
      hours: 3,
      recurrence: 'weekly',
      status: 'published',
      skills: [],
    }),
  ])
  assert.equal(rows.length, 3)
  assert.equal(new Set(rows.map((r) => r.series_id)).size, 1)
  assert.deepEqual(
    rows.map((r) => r.event_date.toISOString?.().slice(0, 10) || r.event_date),
    ['2030-01-01', '2030-01-08', '2030-01-15'],
  )
})

test('Email and cleanup queues are service-only and respect email preferences', async () => {
  const id = await user()
  await asUser(id, 'update public.user_settings set email_notifications=true where user_id=$1', [
    id,
  ])
  await assert.rejects(() => asUser(id, 'select * from public.email_jobs'), /permission denied/)
  await assert.rejects(
    () => asUser(id, 'select public.claim_media_cleanup_jobs(50)'),
    /permission denied/,
  )
  await pg.query(
    "insert into public.notifications(user_id,type,message) values($1,'reminder','Email enabled')",
    [id],
  )
  assert.equal(
    (await pg.query('select count(*)::int n from public.email_jobs where user_id=$1', [id])).rows[0]
      .n,
    1,
  )
  await asUser(id, 'update public.user_settings set email_notifications=false where user_id=$1', [
    id,
  ])
  await pg.query(
    "insert into public.notifications(user_id,type,message) values($1,'reminder','In-app only')",
    [id],
  )
  assert.equal(
    (await pg.query('select count(*)::int n from public.email_jobs where user_id=$1', [id])).rows[0]
      .n,
    1,
  )
  const { rows: claimed } = await pg.query('select * from public.claim_email_jobs(100)')
  assert.equal(
    claimed.some((r) => r.email === id + '@example.test'),
    false,
  )
  assert.ok(
    (await pg.query('select cancelled_at from public.email_jobs where user_id=$1', [id])).rows[0]
      .cancelled_at,
  )
  await asUser(id, 'update public.users set avatar_path=$2 where id=$1', [id, id + '/old.png'])
  await asUser(id, 'update public.users set avatar_path=$2 where id=$1', [id, id + '/new.png'])
  const job = (await pg.query('select * from public.claim_media_cleanup_jobs(100)')).rows.find(
    (r) => r.path === id + '/old.png',
  )
  assert.ok(job)
  await pg.query('select public.finish_media_cleanup_job($1,null)', [job.id])
  assert.ok(
    (await pg.query('select completed_at from public.media_cleanup_jobs where id=$1', [job.id]))
      .rows[0].completed_at,
  )
})

test('Tomorrow reminders are idempotent and registration notifications honor opt-out', async () => {
  const owner = await user(),
    volunteer = await user(),
    org = await organization(owner),
    opp = await event(owner, org.id)
  await asUser(
    volunteer,
    'update public.user_settings set registration_notifications=false where user_id=$1',
    [volunteer],
  )
  const r = (
    await asUser(volunteer, 'select * from public.register_for_opportunity($1)', [opp.id])
  )[0]
  await asUser(owner, "select public.set_registration_status($1,'approved')", [r.id])
  assert.equal(
    (
      await pg.query(
        "select count(*)::int n from public.notifications where user_id=$1 and type='registration'",
        [volunteer],
      )
    ).rows[0].n,
    0,
  )
  await pg.query(
    "update public.opportunities set event_date=(now() at time zone timezone)::date+1,start_time=(now() at time zone timezone)::time,end_time=((now() at time zone timezone)::time + interval '1 minute')::time where id=$1",
    [opp.id],
  )
  await pg.query('select public.enqueue_event_reminders()')
  await pg.query('select public.enqueue_event_reminders()')
  assert.equal(
    (
      await pg.query(
        'select count(*)::int n from public.notifications where user_id=$1 and dedupe_key=$2',
        [volunteer, 'event-reminder:' + r.id],
      )
    ).rows[0].n,
    1,
  )
})

test('Legacy users with single-word names and empty org bios migrate without data loss', async () => {
  const id = randomUUID()
  const migrated = await createDatabase({
    beforeMigration: async (db, name) => {
      if (name === '20261107165500_domain_schema.sql') {
        await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
          id,
          JSON.stringify({ full_name: 'Fei', account_type: 'organization' }),
        ])
        await db.query('update public.profiles set bio=null where id=$1', [id])
      }
    },
  })
  try {
    const u = (await migrated.query('select * from public.users where id=$1', [id])).rows[0]
    assert.equal(u.full_name, 'Fei')
    assert.equal(u.last_name, '')
    assert.equal(
      (await migrated.query('select description from public.organizations where id=$1', [id]))
        .rows[0].description,
      '',
    )
  } finally {
    await migrated.close()
  }
})

test('Media cleanup cannot be tricked into deleting another owner folder', async () => {
  const a = await user(),
    b = await user()
  await asUser(a, 'update public.users set avatar_path=$2 where id=$1', [a, b + '/victim.png'])
  await asUser(a, 'update public.users set avatar_path=null where id=$1', [a])
  assert.equal(
    (
      await pg.query('select count(*)::int n from public.media_cleanup_jobs where path=$1', [
        b + '/victim.png',
      ])
    ).rows[0].n,
    0,
  )
  await asUser(a, "insert into storage.objects(bucket_id,name,owner_id) values('avatars',$1,$2)", [
    a + '/owned.png',
    a,
  ])
  await assert.rejects(
    () => asUser(b, 'select public.account_storage_objects($1)', [a]),
    /permission denied/,
  )
  const inventory = (await pg.query('select * from public.account_storage_objects($1)', [a])).rows
  assert.deepEqual(inventory, [{ bucket_id: 'avatars', name: a + '/owned.png' }])
  await asUser(a, 'select public.prepare_account_deletion()')
  await assert.rejects(
    () =>
      asUser(a, "insert into storage.objects(bucket_id,name) values('avatars',$1)", [
        a + '/new.png',
      ]),
    /row-level security/,
  )
})

test('Capacity reductions and missing-birth-date updates preserve server invariants', async () => {
  const owner = await user(),
    a = await user(),
    b = await user(),
    org = await organization(owner),
    opp = await event(owner, org.id, 2)
  await asUser(a, 'select public.register_for_opportunity($1)', [opp.id])
  await asUser(b, 'select public.register_for_opportunity($1)', [opp.id])
  await assert.rejects(
    () => asUser(owner, 'update public.opportunities set spots=1 where id=$1', [opp.id]),
    /existing active registrations/,
  )
  await assert.rejects(
    () => asUser(a, 'select public.set_missing_birth_date(current_date+1)'),
    /valid date/,
  )
  await pg.query('update public.users set date_of_birth=null where id=$1', [a])
  await asUser(a, "select public.set_missing_birth_date('1990-01-01')")
  await assert.rejects(
    () => asUser(a, "select public.set_missing_birth_date('1991-01-01')"),
    /already recorded/,
  )
  const unchanged = (await pg.query('select date_of_birth::text from public.users where id=$1', [b]))
    .rows[0].date_of_birth
  assert.equal(String(unchanged).slice(0, 10), '1995-01-01')
})

test('Profile audiences distinguish anonymous visitors, signed-in members, and connected organizations', async()=>{
 const person=await user(),outsider=await user(),owner=await user(),member=await user()
 const org=await organization(owner),opp=await event(owner,org.id)
 await asUser(person,"update public.users set phone='555-0100',availability='{\"notes\":\"Weekends\"}'::jsonb where id=$1",[person])
 await assert.rejects(()=>asAnon(`select public.get_user_profile_for_organization('${person}')`),/private/)
 await asUser(person,"update public.users set profile_visibility='members' where id=$1",[person])
 await assert.rejects(()=>asAnon(`select public.get_user_profile_for_organization('${person}')`),/private/)
 const membersView=(await asUser(outsider,'select public.get_user_profile_for_organization($1) profile',[person]))[0].profile
 assert.equal(membersView.phone,null)
 assert.equal(membersView.availability,null)
 assert.equal(membersView.verified_hours,null)
 assert.equal(membersView.history,null)
 await asUser(person,"update public.users set profile_visibility='everyone' where id=$1",[person])
 const anonymousView=(await asAnon(`select public.get_user_profile_for_organization('${person}') profile`))[0].profile
 assert.equal(anonymousView.id,person)
 assert.equal(anonymousView.phone,null)
 assert.equal('date_of_birth' in anonymousView,false)
 assert.equal('email' in anonymousView,false)
 await asUser(person,"update public.users set profile_visibility='organizations' where id=$1",[person])
 await assert.rejects(()=>asUser(owner,'select public.get_user_profile_for_organization($1)',[person]),/private/)
 await asUser(person,'select public.register_for_opportunity($1)',[opp.id])
 const connected=(await asUser(owner,'select public.get_user_profile_for_organization($1) profile',[person]))[0].profile
 assert.equal(connected.phone,'555-0100')
 await asUser(owner,"select public.invite_user_to_organization($1,$2,'member')",[org.id,member])
 await asUser(member,'select public.accept_organization_invite($1)',[org.id])
 await assert.rejects(()=>asUser(member,'select public.get_user_profile_for_organization($1)',[person]),/private/)
 await asUser(owner,"select public.set_organization_member_role($1,$2,'admin')",[org.id,member])
 assert.equal((await asUser(member,'select public.get_user_profile_for_organization($1) profile',[person]))[0].profile.phone,'555-0100')
 await asUser(owner,'select public.remove_organization_member($1,$2)',[org.id,member])
 await assert.rejects(()=>asUser(member,'select public.get_user_profile_for_organization($1)',[person]),/private/)
})

test('Legacy public_profile updates remain coherent with persisted audiences',async()=>{
 const person=await user()
 await asUser(person,'update public.users set public_profile=true where id=$1',[person])
 assert.equal((await pg.query('select profile_visibility from public.users where id=$1',[person])).rows[0].profile_visibility,'everyone')
 await asUser(person,"update public.users set profile_visibility='members' where id=$1",[person])
 assert.equal((await pg.query('select public_profile from public.users where id=$1',[person])).rows[0].public_profile,false)
 assert.equal((await asAnon('select id from public.public_users')).some(p=>p.id===person),false)
 await asUser(person,'update public.users set public_profile=true where id=$1',[person])
 assert.equal((await asAnon('select id from public.public_users')).some(p=>p.id===person),true)
})

test('Account deletion requires an explicit owned-organization choice and rejects pending successors',async()=>{
 const owner=await user(),successor=await user(),org=await organization(owner)
 await assert.rejects(()=>asUser(owner,'select public.prepare_account_deletion()'),/Confirm deletion/)
 assert.equal((await pg.query('select deletion_pending from public.users where id=$1',[owner])).rows[0].deletion_pending,false)
 await asUser(owner,"select public.invite_user_to_organization($1,$2,'member')",[org.id,successor])
 await asUser(successor,'select public.accept_organization_invite($1)',[org.id])
 await asUser(successor,'select public.prepare_account_deletion()')
 await assert.rejects(()=>asUser(owner,'select public.transfer_organization_ownership($1,$2)',[org.id,successor]),/deletion is in progress/)
})

test('Only owners prepare organization deletion and membership/content writes are fenced',async()=>{
 const owner=await user(),member=await user(),outsider=await user(),org=await organization(owner)
 await asUser(owner,"select public.invite_user_to_organization($1,$2,'admin')",[org.id,member])
 await asUser(member,'select public.accept_organization_invite($1)',[org.id])
 await assert.rejects(()=>asUser(member,'select public.prepare_organization_deletion($1)',[org.id]),/Only an owner/)
 await asUser(owner,'select public.prepare_organization_deletion($1)',[org.id])
 await assert.rejects(()=>asUser(outsider,'select public.request_to_join_organization($1)',[org.id]),/being deleted/)
 await assert.rejects(()=>asUser(owner,"insert into public.posts(author_user_id,organization_id,title,body,kind) values($1,$2,'Update','Our organization update','update')",[owner,org.id]),/being deleted/)
 await assert.rejects(()=>asUser(owner,"insert into storage.objects(bucket_id,name) values('post-images',$1)",[org.id+'/'+owner+'/new.png']),/row-level security/)
 await pg.query('select public.cancel_organization_deletion($1)',[org.id])
 await asUser(outsider,'select public.request_to_join_organization($1)',[org.id])
})

test('Existing organization onboarding clients can still send their supported minimal payload',async()=>{
 const id=randomUUID()
 await pg.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({full_name:'Jordan Organizer'})])
 await asUser(id,'select public.complete_user_onboarding($1)',[JSON.stringify({city:'Indianapolis',state:'IN',terms_accepted:true})])
 assert.equal((await pg.query('select onboarded,full_name from public.users where id=$1',[id])).rows[0].onboarded,true)
 assert.equal((await pg.query('select full_name from public.users where id=$1',[id])).rows[0].full_name,'Jordan Organizer')
})

test('Completed attendance and verified hours cannot be erased by volunteer cancellation',async()=>{
 const owner=await user(),volunteer=await user(),org=await organization(owner),opp=await event(owner,org.id)
 const registration=(await asUser(volunteer,'select * from public.register_for_opportunity($1)',[opp.id]))[0]
 await asUser(owner,"select public.set_registration_status($1,'approved')",[registration.id])
 await pg.query('update public.opportunities set event_date=current_date-1 where id=$1',[opp.id])
 await asUser(owner,'select public.set_attended($1,true)',[registration.id])
 await asUser(owner,'select public.verify_hours($1,3)',[registration.id])
 await assert.rejects(()=>asUser(volunteer,'select public.cancel_registration($1)',[registration.id]),/Contact the organization/)
 assert.equal((await pg.query('select hours_verified from public.registrations where id=$1',[registration.id])).rows[0].hours_verified,true)
})

test('Cleanup preserves a restored active image until it becomes unreferenced again',async()=>{
 const person=await user(),path=person+'/restored.png'
 await asUser(person,'update public.users set avatar_path=$2 where id=$1',[person,path])
 await asUser(person,'update public.users set avatar_path=null where id=$1',[person])
 await asUser(person,'update public.users set avatar_path=$2 where id=$1',[person,path])
 assert.equal((await pg.query('select * from public.claim_media_cleanup_jobs(100)')).rows.some(j=>j.path===path),false)
 await asUser(person,'update public.users set avatar_path=null where id=$1',[person])
 assert.equal((await pg.query('select * from public.claim_media_cleanup_jobs(100)')).rows.some(j=>j.path===path),true)
})
