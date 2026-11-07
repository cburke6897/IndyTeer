-- IndyTeer development/staging demo data. Never run this seed in production.
--
-- Create 4 organization-owner Auth users and 6 volunteer Auth users first.
-- Replace every <..._ID> with the corresponding auth.users.id UUID, retaining quotes.
-- This script expects the signup trigger to have created public.users rows.
-- Run once; opportunities/posts are demo fixtures and are not idempotent.

begin;

do $$
declare missing_ids text[] := array[]::text[]; missing_users text[] := array[]::text[]; user_id_text text;
begin
  foreach user_id_text in array array[
    '<ORG_EASTSIDE_OWNER_ID>', '<ORG_FOUNTAIN_SQUARE_OWNER_ID>', '<ORG_WHITE_RIVER_OWNER_ID>', '<ORG_SENIOR_COMPANIONS_OWNER_ID>',
    '<VOLUNTEER_01_ID>', '<VOLUNTEER_02_ID>', '<VOLUNTEER_03_ID>', '<VOLUNTEER_04_ID>', '<VOLUNTEER_05_ID>', '<VOLUNTEER_06_ID>'
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

-- Give the demo volunteer users useful public profiles.
update public.users set full_name='Jordan Lee', first_name='Jordan', last_name='Lee', headline='Weekend food pantry volunteer',
  city='Indianapolis', interests=array['Hunger & Food'], skills=array['Food sorting','Delivery'], onboarded=true, public_profile=true
where id='<VOLUNTEER_01_ID>'::uuid;
update public.users set full_name='Sam Patel', first_name='Sam', last_name='Patel', headline='Reading mentor and book lover',
  city='Indianapolis', interests=array['Education & Youth'], skills=array['Tutoring','Reading'], onboarded=true, public_profile=true
where id='<VOLUNTEER_02_ID>'::uuid;
update public.users set full_name='Taylor Brooks', first_name='Taylor', last_name='Brooks', headline='Keeping Indy green',
  city='Indianapolis', interests=array['Environment'], skills=array['Cleanup','Planting'], onboarded=true, public_profile=true
where id='<VOLUNTEER_03_ID>'::uuid;
update public.users set full_name='Morgan Chen', first_name='Morgan', last_name='Chen', headline='Neighbor, gardener, and helper',
  city='Indianapolis', interests=array['Seniors','Environment'], skills=array['Gardening','Technology help'], onboarded=true, public_profile=true
where id='<VOLUNTEER_04_ID>'::uuid;
update public.users set full_name='Alex Rivera', first_name='Alex', last_name='Rivera', headline='Making community events happen',
  city='Indianapolis', interests=array['Community Events','Arts & Culture'], skills=array['Event setup','Photography'], onboarded=true, public_profile=true
where id='<VOLUNTEER_05_ID>'::uuid;
update public.users set full_name='Casey Johnson', first_name='Casey', last_name='Johnson', headline='Here to lend a hand',
  city='Indianapolis', interests=array['Health','Housing & Homelessness'], skills=array['Outreach','Cooking'], onboarded=true, public_profile=true
where id='<VOLUNTEER_06_ID>'::uuid;

-- Four fictional organizations. Users can own multiple organizations in normal app use.
insert into public.organizations (created_by,name,type,description,mission,city,state,focus,verified,join_policy)
values
  ('<ORG_EASTSIDE_OWNER_ID>'::uuid,'Eastside Community Pantry','Community nonprofit','A neighborhood pantry connecting families with fresh food and caring neighbors.','Make nutritious food accessible to every neighbor.','Indianapolis','IN',array['Hunger & Food'],true,'approval'),
  ('<ORG_FOUNTAIN_SQUARE_OWNER_ID>'::uuid,'Fountain Square Reading Buddies','Education nonprofit','Volunteer-led reading time and book access for children.','Help young readers grow through time, stories, and encouragement.','Indianapolis','IN',array['Education & Youth','Arts & Culture'],true,'approval'),
  ('<ORG_WHITE_RIVER_OWNER_ID>'::uuid,'White River Cleanup Crew','Community group','Neighbors caring for the White River, trails, and nearby habitats.','Keep local waterways and trails welcoming.','Indianapolis','IN',array['Environment','Community Events'],true,'invite_only'),
  ('<ORG_SENIOR_COMPANIONS_OWNER_ID>'::uuid,'Indy Senior Companions','Community nonprofit','Friendly visits and practical support for older neighbors.','Build connection across generations.','Indianapolis','IN',array['Seniors','Health'],true,'approval');

insert into public.organization_memberships (organization_id,user_id,role,status)
select id,created_by,'owner','active' from public.organizations
where name in ('Eastside Community Pantry','Fountain Square Reading Buddies','White River Cleanup Crew','Indy Senior Companions')
on conflict (organization_id,user_id) do nothing;

insert into public.opportunities (organization_id,title,description,category,city,location,address,starts_at,ends_at,
  event_date,start_time,end_time,timezone,registration_deadline,spots,status)
select o.id,s.title,s.description,s.category,s.city,s.location,s.address,
  (s.event_date+s.start_time) at time zone s.timezone,
  (s.event_date+s.end_time) at time zone s.timezone,
  s.event_date,s.start_time,s.end_time,s.timezone,s.event_date-1,s.spots,'published'
from (values
  ('Eastside Community Pantry','Saturday Pantry Sort and Pack','Sort donations and pack grocery boxes for local families. No experience needed.','Hunger & Food','Indianapolis','Pantry warehouse','East Washington Street',current_date+7,time '09:00',time '12:00','America/Indiana/Indianapolis',12),
  ('Eastside Community Pantry','Fresh Food Delivery Route','Deliver grocery bags to neighbors who cannot visit the pantry.','Hunger & Food','Indianapolis','Pantry pickup','East Washington Street',current_date+10,time '10:00',time '13:00','America/Indiana/Indianapolis',6),
  ('Eastside Community Pantry','Community Garden Harvest','Harvest seasonal produce for pantry shelves.','Hunger & Food','Indianapolis','Garfield Park Garden','Garfield Park',current_date+14,time '08:00',time '10:00','America/Indiana/Indianapolis',8),
  ('Fountain Square Reading Buddies','After-School Reading Hour','Read one-on-one with elementary students in a welcoming library room.','Education & Youth','Indianapolis','Fountain Square Library','Fountain Square',current_date+5,time '15:00',time '17:00','America/Indiana/Indianapolis',5),
  ('Fountain Square Reading Buddies','Little Free Library Refresh','Sort donated books and refresh neighborhood book boxes.','Education & Youth','Indianapolis','Reading Room','Fletcher Place',current_date+9,time '09:00',time '12:00','America/Indiana/Indianapolis',10),
  ('Fountain Square Reading Buddies','Family Storytime Helpers','Welcome families and help children choose books during storytime.','Arts & Culture','Indianapolis','Southside Community Center','Fountain Square',current_date+12,time '10:00',time '12:00','America/Indiana/Indianapolis',4),
  ('White River Cleanup Crew','White River Trail Cleanup','Collect litter along an easy section of river trail. Supplies provided.','Environment','Indianapolis','White River Trail','White River State Park',current_date+6,time '09:00',time '11:00','America/Indiana/Indianapolis',20),
  ('White River Cleanup Crew','Native Planting Morning','Plant native flowers to support pollinators near the river.','Environment','Indianapolis','Trail garden','White River State Park',current_date+11,time '08:00',time '11:00','America/Indiana/Indianapolis',10),
  ('White River Cleanup Crew','Trail Welcome Table','Share trail maps and cleanup information with visitors.','Community Events','Indianapolis','Canal Walk welcome tent','Downtown',current_date+16,time '10:00',time '14:00','America/Indiana/Indianapolis',6),
  ('Indy Senior Companions','Friendly Tech Help Visits','Help older neighbors with phones, video calls, and basic settings.','Seniors','Indianapolis','Meridian-Kessler Community Center','Meridian-Kessler',current_date+8,time '13:00',time '15:00','America/Indiana/Indianapolis',5),
  ('Indy Senior Companions','Community Lunch Companions','Share lunch and conversation at a neighborhood gathering.','Seniors','Indianapolis','Broad Ripple Community House','Broad Ripple',current_date+13,time '11:00',time '13:00','America/Indiana/Indianapolis',8),
  ('Indy Senior Companions','Accessible Garden Walk','Join older neighbors for a relaxed garden visit and light setup.','Health','Indianapolis','Northside Community Garden','Meridian-Kessler',current_date+18,time '09:00',time '11:00','America/Indiana/Indianapolis',6)
) as s(org_name,title,description,category,city,location,address,event_date,start_time,end_time,timezone,spots)
join public.organizations o on o.name=s.org_name;

insert into public.registrations (opportunity_id,user_id,message,status)
select o.id,s.user_id::uuid,s.message,s.status::public.registration_status
from (values
  ('Saturday Pantry Sort and Pack','<VOLUNTEER_01_ID>','Happy to help with sorting and packing.','pending'),
  ('After-School Reading Hour','<VOLUNTEER_02_ID>','I enjoy reading with kids and can come weekly.','pending'),
  ('White River Trail Cleanup','<VOLUNTEER_03_ID>','I can bring water and work gloves.','approved'),
  ('Friendly Tech Help Visits','<VOLUNTEER_04_ID>','I can help with phones and video calls.','approved'),
  ('Fresh Food Delivery Route','<VOLUNTEER_05_ID>','I have a schedule conflict this time, but would love to help later.','declined'),
  ('Family Storytime Helpers','<VOLUNTEER_06_ID>','Please keep me in mind for a future session.','declined')
) as s(title,user_id,message,status)
join public.opportunities o on o.title=s.title
on conflict (opportunity_id,user_id) do nothing;

insert into public.organization_follows(user_id,organization_id)
select f.user_id::uuid,o.id from (values
  ('<VOLUNTEER_01_ID>','Eastside Community Pantry'),
  ('<VOLUNTEER_02_ID>','Fountain Square Reading Buddies'),
  ('<VOLUNTEER_03_ID>','White River Cleanup Crew'),
  ('<VOLUNTEER_04_ID>','Indy Senior Companions'),
  ('<VOLUNTEER_05_ID>','Eastside Community Pantry')
) as f(user_id,org_name) join public.organizations o on o.name=f.org_name
on conflict (user_id,organization_id) do nothing;

-- Fifteen organization posts for the public feed.
insert into public.posts(author_user_id,organization_id,title,kind,body)
select o.created_by,o.id,p.title,'update',p.body
from (values
  ('Eastside Community Pantry','Pantry packing day','This week our neighbors packed 42 grocery boxes. Thank you for showing up for one another!'),
  ('Fountain Square Reading Buddies','Reading corner ready','Our reading corner is ready for another afternoon of stories, questions, and big imaginations.'),
  ('White River Cleanup Crew','Trail cleanup update','Cleanup crew update: we filled several bags and spotted new birds along the trail.'),
  ('Indy Senior Companions','Friendly tech help','A friendly visit and a little patience can make technology feel less intimidating.'),
  ('Eastside Community Pantry','Garden harvest coming up','The garden harvest is coming up. We could use a few extra hands and plenty of baskets.'),
  ('Fountain Square Reading Buddies','Book donations','We received a lovely stack of gently used children’s books. Thank you, book donors!'),
  ('White River Cleanup Crew','Native planting day','Native planting day is on the calendar. We will provide tools and a quick walkthrough.'),
  ('Indy Senior Companions','Community lunch','Our community lunch is about good food, easy conversation, and making room at the table.'),
  ('Eastside Community Pantry','Neighbors helping neighbors','Small acts of care add up. Thanks to everyone who helped sort donations today.'),
  ('Fountain Square Reading Buddies','Storytime volunteers','Storytime works because volunteers make every family feel welcome.'),
  ('White River Cleanup Crew','River wildlife','We saw more birds along the river this week. Thanks for helping keep their habitat clean.'),
  ('Indy Senior Companions','Visit reminders','A quick check-in can brighten a neighbor’s day. Sign up for a friendly visit this month.'),
  ('Eastside Community Pantry','Food drive thanks','Thanks to local donors for keeping the pantry shelves stocked for the coming week.'),
  ('Fountain Square Reading Buddies','Little libraries','We refreshed several neighborhood book boxes with new stories for young readers.'),
  ('White River Cleanup Crew','Community care','We love seeing neighbors share ideas and lend a hand to care for the places we share.')
) as p(org_name,title,body) join public.organizations o on o.name=p.org_name;

commit;
