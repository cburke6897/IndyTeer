-- IndyTeer demo data. Intended for development/staging projects.
-- The IDs below are existing Auth users; signup must have created public.users rows.
-- Upload the bundled organization logo/cover photos with seed-images.ps1 first.
-- The SQL CLI may commit statements separately; repair any partial run before retrying.

begin;

do $$
declare missing_ids text[] := array[]::text[]; missing_users text[] := array[]::text[]; user_id_text text;
begin
  foreach user_id_text in array array[
    '054cd7a1-1eb0-49e5-8770-23550f5446b7', '32c76857-7457-4265-a753-49cc1a9d933f', '374c697b-8b73-4b5f-962f-46e81afea32b', '99e3cedc-707c-4624-8009-d312c8f84f41',
    'b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd', 'b3003af4-ada7-4d12-8964-8192213ec197', 'c86ef6f9-01de-463b-bacb-95e9f0e754c6', 'df7c2907-68da-4e0e-b67a-dc41fc174ecb', 'f43c231a-b93a-43ab-a86b-9c228d974e5e', 'f5b44d36-9780-450c-b883-a7c207435f82'
  ] loop
    if user_id_text like '<%_ID>' then
      missing_ids := array_append(missing_ids, user_id_text);
    elsif not exists (select 1 from public.users where id = user_id_text::uuid) then
      missing_users := array_append(missing_users, user_id_text);
    end if;
  end loop;
  if cardinality(missing_ids) > 0 then
    raise exception 'Replace every ID fill-in before running seed.sql: %', array_to_string(missing_ids, ', ');
  end if;
  if cardinality(missing_users) > 0 then
    raise exception 'These Auth users need signup/profile rows first: %', array_to_string(missing_users, ', ');
  end if;
end;
$$;

-- Populate the four demo organization owners and six volunteer profiles.
update public.users set full_name='Maya Torres', first_name='Maya', last_name='Torres', headline='Eastside pantry coordinator',
  bio='Organizing neighbors to make fresh food easier to access.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=75', onboarded=true
where id='054cd7a1-1eb0-49e5-8770-23550f5446b7'::uuid;
update public.users set full_name='Daniel Kim', first_name='Daniel', last_name='Kim', headline='Reading program director',
  bio='Helping young readers find confidence through stories.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=75', onboarded=true
where id='32c76857-7457-4265-a753-49cc1a9d933f'::uuid;
update public.users set full_name='Priya Shah', first_name='Priya', last_name='Shah', headline='River stewardship lead',
  bio='Bringing volunteers together to care for local trails and waterways.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&h=400&q=75', onboarded=true
where id='374c697b-8b73-4b5f-962f-46e81afea32b'::uuid;
update public.users set full_name='Thomas Reed', first_name='Thomas', last_name='Reed', headline='Senior outreach coordinator',
  bio='Building connection and practical support across generations.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&h=400&q=75', onboarded=true
where id='99e3cedc-707c-4624-8009-d312c8f84f41'::uuid;
update public.users set full_name='Jordan Lee', first_name='Jordan', last_name='Lee', headline='Weekend food pantry volunteer',
  bio='I enjoy helping neighbors and making food access easier.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&h=400&q=75',
  availability='{"days":["Saturday","Sunday"],"timeOfDay":"morning"}'::jsonb, interests=array['Hunger & Food'], skills=array['Food sorting','Delivery','Cooking'], onboarded=true, public_profile=true, show_hours=true, show_history=true
where id='b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd'::uuid;
update public.users set full_name='Sam Patel', first_name='Sam', last_name='Patel', headline='Reading mentor and book lover',
  bio='I volunteer to help students build reading confidence.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=75',
  availability='{"days":["Tuesday","Thursday"],"timeOfDay":"afternoon"}'::jsonb, interests=array['Education & Youth'], skills=array['Tutoring','Reading','Mentoring'], onboarded=true, public_profile=true, show_hours=true, show_history=true
where id='b3003af4-ada7-4d12-8964-8192213ec197'::uuid;
update public.users set full_name='Taylor Brooks', first_name='Taylor', last_name='Brooks', headline='Keeping Indy green',
  bio='I like hands-on projects that leave parks and trails better than we found them.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=400&h=400&q=75',
  availability='{"days":["Saturday"],"timeOfDay":"morning"}'::jsonb, interests=array['Environment'], skills=array['Cleanup','Planting','Gardening'], onboarded=true, public_profile=true, show_hours=true, show_history=true
where id='c86ef6f9-01de-463b-bacb-95e9f0e754c6'::uuid;
update public.users set full_name='Morgan Chen', first_name='Morgan', last_name='Chen', headline='Neighbor, gardener, and helper',
  bio='I am glad to share time and practical skills with neighbors.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&h=400&q=75',
  availability='{"days":["Wednesday","Saturday"],"timeOfDay":"flexible"}'::jsonb, interests=array['Seniors','Health'], skills=array['Gardening','Technology help','Conversation'], onboarded=true, public_profile=true, show_hours=true, show_history=true
where id='df7c2907-68da-4e0e-b67a-dc41fc174ecb'::uuid;
update public.users set full_name='Alex Rivera', first_name='Alex', last_name='Rivera', headline='Making community events happen',
  bio='I help welcome people and make local events run smoothly.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&h=400&q=75',
  availability='{"days":["Friday","Saturday"],"timeOfDay":"afternoon"}'::jsonb, interests=array['Community Events','Arts & Culture'], skills=array['Event setup','Photography','Hospitality'], onboarded=true, public_profile=true, show_hours=true, show_history=true
where id='f43c231a-b93a-43ab-a86b-9c228d974e5e'::uuid;
update public.users set full_name='Casey Johnson', first_name='Casey', last_name='Johnson', headline='Here to lend a hand',
  bio='I enjoy practical projects that help people feel welcome and supported.', city='Indianapolis', avatar_url='https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&h=400&q=75',
  availability='{"days":["Sunday"],"timeOfDay":"afternoon"}'::jsonb, interests=array['Health','Housing & Homelessness'], skills=array['Outreach','Cooking','First aid'], onboarded=true, public_profile=true, show_hours=true, show_history=true
where id='f5b44d36-9780-450c-b883-a7c207435f82'::uuid;

-- Four fictional organizations. Users can own multiple organizations in normal app use.
insert into public.organizations
  (id,created_by,name,logo_path,cover_path,type,description,mission,website,city,state,contact_email,phone,focus,verified,founded_year,join_policy)
values
  ('a0000000-0000-4000-8000-000000000001','054cd7a1-1eb0-49e5-8770-23550f5446b7'::uuid,'Eastside Community Pantry','a0000000-0000-4000-8000-000000000001/054cd7a1-1eb0-49e5-8770-23550f5446b7/seed-logo.jpg','a0000000-0000-4000-8000-000000000001/054cd7a1-1eb0-49e5-8770-23550f5446b7/seed-cover.jpg','Community nonprofit','A neighborhood pantry connecting families with fresh food and caring neighbors. Volunteers sort donations, pack grocery boxes, and support local deliveries.','Make nutritious food accessible to every neighbor.','https://example.com/eastside-pantry','Indianapolis','IN','hello@eastside-pantry.example','317-555-0101',array['Hunger & Food','Community Development'],true,2009,'approval'),
  ('a0000000-0000-4000-8000-000000000002','32c76857-7457-4265-a753-49cc1a9d933f'::uuid,'Fountain Square Reading Buddies','a0000000-0000-4000-8000-000000000002/32c76857-7457-4265-a753-49cc1a9d933f/seed-logo.jpg','a0000000-0000-4000-8000-000000000002/32c76857-7457-4265-a753-49cc1a9d933f/seed-cover.jpg','Education nonprofit','Volunteer-led reading time and book access for children across the south side.','Help young readers grow through time, stories, and encouragement.','https://example.com/reading-buddies','Indianapolis','IN','hello@reading-buddies.example','317-555-0102',array['Education & Youth','Arts & Culture'],true,2014,'approval'),
  ('a0000000-0000-4000-8000-000000000003','374c697b-8b73-4b5f-962f-46e81afea32b'::uuid,'White River Cleanup Crew','a0000000-0000-4000-8000-000000000003/374c697b-8b73-4b5f-962f-46e81afea32b/seed-logo.jpg','a0000000-0000-4000-8000-000000000003/374c697b-8b73-4b5f-962f-46e81afea32b/seed-cover.jpg','Community group','Neighbors caring for the White River, trails, and nearby habitats through cleanups and native planting.','Keep local waterways and trails welcoming for people and wildlife.','https://example.com/white-river-crew','Indianapolis','IN','hello@white-river-crew.example','317-555-0103',array['Environment','Community Events'],true,2018,'invite_only'),
  ('a0000000-0000-4000-8000-000000000004','99e3cedc-707c-4624-8009-d312c8f84f41'::uuid,'Indy Senior Companions','a0000000-0000-4000-8000-000000000004/99e3cedc-707c-4624-8009-d312c8f84f41/seed-logo.jpg','a0000000-0000-4000-8000-000000000004/99e3cedc-707c-4624-8009-d312c8f84f41/seed-cover.jpg','Community nonprofit','Friendly visits and practical support for older neighbors, including technology help and community lunches.','Build connection and independence across generations.','https://example.com/senior-companions','Indianapolis','IN','hello@senior-companions.example','317-555-0104',array['Seniors','Health'],true,2012,'approval')
on conflict (id) do update set
  created_by=excluded.created_by,name=excluded.name,logo_path=excluded.logo_path,cover_path=excluded.cover_path,
  type=excluded.type,description=excluded.description,
  mission=excluded.mission,website=excluded.website,city=excluded.city,state=excluded.state,
  contact_email=excluded.contact_email,phone=excluded.phone,focus=excluded.focus,
  verified=excluded.verified,founded_year=excluded.founded_year,join_policy=excluded.join_policy;

insert into public.organization_memberships (organization_id,user_id,role,status)
select id,created_by,'owner','active' from public.organizations
where name in ('Eastside Community Pantry','Fountain Square Reading Buddies','White River Cleanup Crew','Indy Senior Companions')
on conflict (organization_id,user_id) do nothing;

insert into public.organization_memberships (organization_id,user_id,role,status,invited_by)
select o.id,m.user_id,'member','active',o.created_by
from (values
  ('Eastside Community Pantry','b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd'::uuid),
  ('Fountain Square Reading Buddies','b3003af4-ada7-4d12-8964-8192213ec197'::uuid),
  ('White River Cleanup Crew','c86ef6f9-01de-463b-bacb-95e9f0e754c6'::uuid),
  ('Indy Senior Companions','df7c2907-68da-4e0e-b67a-dc41fc174ecb'::uuid),
  ('Eastside Community Pantry','f43c231a-b93a-43ab-a86b-9c228d974e5e'::uuid),
  ('Indy Senior Companions','f5b44d36-9780-450c-b883-a7c207435f82'::uuid)
) as m(org_name,user_id)
join public.organizations o on o.name=m.org_name
on conflict (organization_id,user_id) do nothing;

insert into public.opportunities
  (organization_id,title,description,category,city,location,address,virtual,min_age,skills,hours,
   registration_deadline,recurrence,instructions,event_date,start_time,end_time,timezone,starts_at,ends_at,
   spots,image_url,image_path,status)
select o.id,s.title,s.description,s.category,s.city,s.location,s.address,s.virtual,s.min_age,s.skills,s.hours,
  s.registration_deadline,s.recurrence::public.recurrence_type,s.instructions,s.event_date,s.start_time,s.end_time,s.timezone,
  (s.event_date+s.start_time) at time zone s.timezone,
  (s.event_date+s.end_time) at time zone s.timezone,
  s.spots,s.image_url,null,'published'::public.opportunity_status
from (values
  ('Eastside Community Pantry','Saturday Pantry Sort and Pack','Sort donations and pack grocery boxes for local families. No experience needed.','Hunger & Food','Indianapolis','Pantry warehouse','East Washington Street',false,16,array['Food sorting','Teamwork'],3,current_date+6,'weekly','Closed-toe shoes recommended. Check in at the east entrance.',current_date+7,time '09:00',time '12:00','America/Indiana/Indianapolis',12,'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=75'),
  ('Eastside Community Pantry','Fresh Food Delivery Route','Deliver grocery bags to neighbors who cannot visit the pantry.','Hunger & Food','Indianapolis','Pantry pickup','East Washington Street',false,18,array['Driving','Delivery'],3,current_date+9,'none','Bring a valid driver license. The pantry provides route sheets and insulated bags.',current_date+10,time '10:00',time '13:00','America/Indiana/Indianapolis',6,'https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&w=1200&q=75'),
  ('Eastside Community Pantry','Community Garden Harvest','Harvest seasonal produce for pantry shelves.','Hunger & Food','Indianapolis','Garfield Park Garden','Garfield Park',false,14,array['Gardening','Food sorting'],2,current_date+13,'none','Tools and gloves are available on site. Dress for outdoor work.',current_date+14,time '08:00',time '10:00','America/Indiana/Indianapolis',8,'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=75'),
  ('Fountain Square Reading Buddies','After-School Reading Hour','Read one-on-one with elementary students in a welcoming library room.','Education & Youth','Indianapolis','Fountain Square Library','Fountain Square',false,18,array['Tutoring','Reading','Mentoring'],2,current_date+4,'weekly','Bring a photo ID for the first visit. A staff member will introduce you to your student.',current_date+5,time '15:00',time '17:00','America/Indiana/Indianapolis',5,'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=75'),
  ('Fountain Square Reading Buddies','Little Free Library Refresh','Sort donated books and refresh neighborhood book boxes.','Education & Youth','Indianapolis','Reading Room','Fletcher Place',false,14,array['Sorting','Organization'],3,current_date+8,'none','Meet at the reading room to collect books and the route map.',current_date+9,time '09:00',time '12:00','America/Indiana/Indianapolis',10,'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75'),
  ('Fountain Square Reading Buddies','Family Storytime Helpers','Welcome families and help children choose books during storytime.','Arts & Culture','Indianapolis','Southside Community Center','Fountain Square',false,16,array['Hospitality','Child engagement'],2,current_date+11,'none','Arrive 15 minutes early for a quick welcome and room setup.',current_date+12,time '10:00',time '12:00','America/Indiana/Indianapolis',4,'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=75'),
  ('White River Cleanup Crew','White River Trail Cleanup','Collect litter along an easy section of river trail. Supplies provided.','Environment','Indianapolis','White River Trail','White River State Park',false,14,array['Cleanup','Walking'],2,current_date+5,'none','Meet at the canal-side trail entrance. Gloves and bags are provided.',current_date+6,time '09:00',time '11:00','America/Indiana/Indianapolis',20,'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=75'),
  ('White River Cleanup Crew','Native Planting Morning','Plant native flowers to support pollinators near the river.','Environment','Indianapolis','Trail garden','White River State Park',false,14,array['Gardening','Planting'],3,current_date+10,'none','Bring gardening gloves if you have them. Water and tools are provided.',current_date+11,time '08:00',time '11:00','America/Indiana/Indianapolis',10,'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=75'),
  ('White River Cleanup Crew','Trail Welcome Table','Share trail maps and cleanup information with visitors.','Community Events','Indianapolis','Canal Walk welcome tent','Downtown',false,16,array['Hospitality','Public speaking'],4,current_date+15,'none','A brief orientation and printed maps are provided at the tent.',current_date+16,time '10:00',time '14:00','America/Indiana/Indianapolis',6,'https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=1200&q=75'),
  ('Indy Senior Companions','Friendly Tech Help Visits','Help older neighbors with phones, video calls, and basic settings.','Seniors','Indianapolis','Meridian-Kessler Community Center','Meridian-Kessler',false,18,array['Technology help','Patience'],2,current_date+7,'weekly','Bring a charged device if available. Staff remain on site.',current_date+8,time '13:00',time '15:00','America/Indiana/Indianapolis',5,'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=75'),
  ('Indy Senior Companions','Community Lunch Companions','Share lunch and conversation at a neighborhood gathering.','Seniors','Indianapolis','Broad Ripple Community House','Broad Ripple',false,16,array['Hospitality','Conversation'],2,current_date+12,'none','Lunch is provided. Let the coordinator know about access needs.',current_date+13,time '11:00',time '13:00','America/Indiana/Indianapolis',8,'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=75'),
  ('Indy Senior Companions','Accessible Garden Walk','Join older neighbors for a relaxed garden visit and light setup.','Health','Indianapolis','Northside Community Garden','Meridian-Kessler',false,16,array['Gardening','Hospitality'],2,current_date+17,'none','The route is paved and seating is available. Meet by the garden gate.',current_date+18,time '09:00',time '11:00','America/Indiana/Indianapolis',6,'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=75')
) as s(org_name,title,description,category,city,location,address,virtual,min_age,skills,hours,registration_deadline,recurrence,instructions,event_date,start_time,end_time,timezone,spots,image_url)
join public.organizations o on o.name=s.org_name
where not exists (
  select 1 from public.opportunities existing where existing.organization_id=o.id and existing.title=s.title
);

insert into public.registrations
  (opportunity_id,user_id,message,status,attended,hours_verified,hours,verified_at,created_at)
select o.id,s.user_id::uuid,s.message,s.status::public.registration_status,
  s.attended,s.hours_verified,s.hours,
  case when s.hours_verified then now()-s.days_ago*interval '1 day' else null end,
  now()-s.days_ago*interval '1 day'
from (values
  ('Saturday Pantry Sort and Pack','b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','Happy to help with sorting and packing.','pending',false,false,null::numeric,2),
  ('After-School Reading Hour','b3003af4-ada7-4d12-8964-8192213ec197','I enjoy reading with kids and can come weekly.','approved',false,false,null::numeric,1),
  ('White River Trail Cleanup','c86ef6f9-01de-463b-bacb-95e9f0e754c6','I can bring water and work gloves.','pending',false,false,null::numeric,1),
  ('Friendly Tech Help Visits','df7c2907-68da-4e0e-b67a-dc41fc174ecb','I can help with phones and video calls.','approved',false,false,null::numeric,4),
  ('Fresh Food Delivery Route','f43c231a-b93a-43ab-a86b-9c228d974e5e','I have a schedule conflict this time, but would love to help later.','declined',false,false,null::numeric,3),
  ('Family Storytime Helpers','f5b44d36-9780-450c-b883-a7c207435f82','Please keep me in mind for a future session.','pending',false,false,null::numeric,1)
) as s(title,user_id,message,status,attended,hours_verified,hours,days_ago)
join public.opportunities o on o.title=s.title
on conflict (opportunity_id,user_id) do nothing;

insert into public.organization_follows(user_id,organization_id)
select f.user_id::uuid,o.id from (values
  ('b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','Eastside Community Pantry'),
  ('b3003af4-ada7-4d12-8964-8192213ec197','Fountain Square Reading Buddies'),
  ('c86ef6f9-01de-463b-bacb-95e9f0e754c6','White River Cleanup Crew'),
  ('df7c2907-68da-4e0e-b67a-dc41fc174ecb','Indy Senior Companions'),
  ('f43c231a-b93a-43ab-a86b-9c228d974e5e','Eastside Community Pantry'),
  ('f5b44d36-9780-450c-b883-a7c207435f82','Indy Senior Companions'),
  ('b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','White River Cleanup Crew'),
  ('b3003af4-ada7-4d12-8964-8192213ec197','Eastside Community Pantry'),
  ('c86ef6f9-01de-463b-bacb-95e9f0e754c6','Indy Senior Companions'),
  ('df7c2907-68da-4e0e-b67a-dc41fc174ecb','Fountain Square Reading Buddies')
) as f(user_id,org_name) join public.organizations o on o.name=f.org_name
on conflict (user_id,organization_id) do nothing;

insert into public.saved_opportunities (user_id,opportunity_id)
select s.user_id::uuid,o.id
from (values
  ('b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','Community Garden Harvest'),
  ('b3003af4-ada7-4d12-8964-8192213ec197','Little Free Library Refresh'),
  ('c86ef6f9-01de-463b-bacb-95e9f0e754c6','Native Planting Morning'),
  ('df7c2907-68da-4e0e-b67a-dc41fc174ecb','Community Lunch Companions'),
  ('f43c231a-b93a-43ab-a86b-9c228d974e5e','Trail Welcome Table'),
  ('f5b44d36-9780-450c-b883-a7c207435f82','Accessible Garden Walk')
) as s(user_id,title) join public.opportunities o on o.title=s.title
on conflict (user_id,opportunity_id) do nothing;

insert into public.manual_hour_entries (id,user_id,org_name,title,entry_date,hours,notes)
values
  ('a3000000-0000-4000-8000-000000000001','b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','Eastside Community Pantry','Donation pickup and sorting',current_date-21,2.5,'Sorted shelf-stable donations and prepared pickup totes.'),
  ('a3000000-0000-4000-8000-000000000002','b3003af4-ada7-4d12-8964-8192213ec197','Fountain Square Reading Buddies','Reading practice preparation',current_date-16,1.5,'Prepared books and reading prompts for a student session.'),
  ('a3000000-0000-4000-8000-000000000003','c86ef6f9-01de-463b-bacb-95e9f0e754c6','White River Cleanup Crew','Trail supply preparation',current_date-10,1.0,'Prepared gloves, grabbers, and bags for cleanup volunteers.'),
  ('a3000000-0000-4000-8000-000000000004','df7c2907-68da-4e0e-b67a-dc41fc174ecb','Indy Senior Companions','Technology help follow-up',current_date-7,1.5,'Wrote a simple phone setup guide after the visit.')
on conflict (id) do nothing;

insert into public.user_settings (user_id,new_opportunity_notifications,registration_notifications,email_notifications)
select u.id,true,true,(u.id in ('b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd'::uuid,'b3003af4-ada7-4d12-8964-8192213ec197'::uuid,'f43c231a-b93a-43ab-a86b-9c228d974e5e'::uuid))
from public.users u
where u.id in (
  '054cd7a1-1eb0-49e5-8770-23550f5446b7','32c76857-7457-4265-a753-49cc1a9d933f',
  '374c697b-8b73-4b5f-962f-46e81afea32b','99e3cedc-707c-4624-8009-d312c8f84f41',
  'b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','b3003af4-ada7-4d12-8964-8192213ec197',
  'c86ef6f9-01de-463b-bacb-95e9f0e754c6','df7c2907-68da-4e0e-b67a-dc41fc174ecb',
  'f43c231a-b93a-43ab-a86b-9c228d974e5e','f5b44d36-9780-450c-b883-a7c207435f82'
)
on conflict (user_id) do update set
  new_opportunity_notifications=excluded.new_opportunity_notifications,
  registration_notifications=excluded.registration_notifications,
  email_notifications=excluded.email_notifications;

insert into public.notifications (id,user_id,type,message,data,read_at)
values
  ('a4000000-0000-4000-8000-000000000001','b2cbafd6-cc32-4e0b-bea4-b90d555ab6fd','registration_update','Your pantry shift registration is awaiting approval.',jsonb_build_object('opportunity_title','Saturday Pantry Sort and Pack'),null),
  ('a4000000-0000-4000-8000-000000000002','b3003af4-ada7-4d12-8964-8192213ec197','registration_update','Your reading hour registration has been approved.',jsonb_build_object('opportunity_title','After-School Reading Hour'),now()-interval '6 hours'),
  ('a4000000-0000-4000-8000-000000000003','c86ef6f9-01de-463b-bacb-95e9f0e754c6','organization_update','White River Cleanup Crew posted a new trail opportunity.',jsonb_build_object('organization_name','White River Cleanup Crew'),null),
  ('a4000000-0000-4000-8000-000000000004','df7c2907-68da-4e0e-b67a-dc41fc174ecb','registration_update','Your friendly tech help registration has been approved.',jsonb_build_object('opportunity_title','Friendly Tech Help Visits'),null),
  ('a4000000-0000-4000-8000-000000000005','f43c231a-b93a-43ab-a86b-9c228d974e5e','registration_update','Your delivery route registration was declined. Browse other pantry opportunities.',jsonb_build_object('opportunity_title','Fresh Food Delivery Route'),now()-interval '1 day'),
  ('a4000000-0000-4000-8000-000000000006','f5b44d36-9780-450c-b883-a7c207435f82','new_opportunity','A new family storytime opportunity is available.',jsonb_build_object('opportunity_title','Family Storytime Helpers'),null),
  ('a4000000-0000-4000-8000-000000000007','054cd7a1-1eb0-49e5-8770-23550f5446b7','new_registration','A volunteer registered for Saturday Pantry Sort and Pack.',jsonb_build_object('opportunity_title','Saturday Pantry Sort and Pack'),null),
  ('a4000000-0000-4000-8000-000000000008','32c76857-7457-4265-a753-49cc1a9d933f','new_registration','A volunteer registered for After-School Reading Hour.',jsonb_build_object('opportunity_title','After-School Reading Hour'),null)
on conflict (id) do update set
  user_id=excluded.user_id,type=excluded.type,message=excluded.message,data=excluded.data,read_at=excluded.read_at;

-- Fifteen illustrated organization posts for the public feed.
insert into public.posts (author_user_id,organization_id,title,kind,body,image_url,image_path,created_at)
select o.created_by,o.id,p.title,p.kind::public.post_kind,p.body,p.image_url,null,p.created_at
from (values
  ('Eastside Community Pantry','Pantry packing day','update','This week neighbors packed grocery boxes for families across the east side. Thank you for showing up for one another!','https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=75',now()-interval '15 days'),
  ('Fountain Square Reading Buddies','Reading corner ready','update','Our reading corner is ready for another afternoon of stories, questions, and big imaginations.','https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=75',now()-interval '14 days'),
  ('White River Cleanup Crew','Trail cleanup update','update','Our crew filled several bags and spotted new birds along the trail. Thanks for caring for the river.','https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=75',now()-interval '13 days'),
  ('Indy Senior Companions','Friendly tech help','update','A friendly visit and a little patience can make technology feel less intimidating.','https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=75',now()-interval '12 days'),
  ('Eastside Community Pantry','Garden harvest coming up','announcement','The garden harvest is coming up. We could use a few extra hands and plenty of baskets.','https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=75',now()-interval '11 days'),
  ('Fountain Square Reading Buddies','Book donations','update','We received a lovely stack of gently used children’s books. Thank you, book donors!','https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=75',now()-interval '10 days'),
  ('White River Cleanup Crew','Native planting day','announcement','Native planting day is on the calendar. We will provide tools, gloves, and a quick walkthrough.','https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=75',now()-interval '9 days'),
  ('Indy Senior Companions','Community lunch','update','Our community lunch is about good food, easy conversation, and making room at the table.','https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=75',now()-interval '8 days'),
  ('Eastside Community Pantry','Neighbors helping neighbors','update','Small acts of care add up. Thanks to everyone who helped sort donations today.','https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=1200&q=75',now()-interval '7 days'),
  ('Fountain Square Reading Buddies','Storytime volunteers','announcement','Storytime works because volunteers make every family feel welcome.','https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=75',now()-interval '6 days'),
  ('White River Cleanup Crew','River wildlife','update','We saw more birds along the river this week. Thanks for helping keep their habitat clean.','https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=75',now()-interval '5 days'),
  ('Indy Senior Companions','Visit reminders','update','A quick check-in can brighten a neighbor’s day. Sign up for a friendly visit this month.','https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=75',now()-interval '4 days'),
  ('Eastside Community Pantry','Food drive thanks','announcement','Thanks to local donors for keeping pantry shelves stocked for the coming week.','https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&w=1200&q=75',now()-interval '3 days'),
  ('Fountain Square Reading Buddies','Little libraries','update','We refreshed several neighborhood book boxes with new stories for young readers.','https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=75',now()-interval '2 days'),
  ('White River Cleanup Crew','Community care','update','We love seeing neighbors share ideas and lend a hand to care for the places we share.','https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=1200&q=75',now()-interval '1 day')
) as p(org_name,title,kind,body,image_url,created_at)
join public.organizations o on o.name=p.org_name
where not exists (select 1 from public.posts existing where existing.organization_id=o.id and existing.title=p.title);

commit;
