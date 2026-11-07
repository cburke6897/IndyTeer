-- IndyTeer demo seed data
--
-- Before running this file:
-- 1. Create 4 organization accounts and 6 volunteer accounts in the app/Auth.
-- 2. Copy each account's Auth user ID (UUID) into the matching fill-in below.
-- 3. Replace every <..._ID> value in this file. Leave the quotes around each UUID.
-- 4. Run this file once from the Supabase SQL Editor.
--
-- This file intentionally does not create auth.users or profiles. The signup
-- trigger should create each profile; this script updates those existing rows.

begin;

-- Stop before any updates if fill-ins remain or an Auth-created profile is missing.
do $$
declare
  missing_ids text[] := array[]::text[];
  missing_profiles text[] := array[]::text[];
  demo_id text;
begin
  foreach demo_id in array array[
    '<ORG_EASTSIDE_ID>', '<ORG_FOUNTAIN_SQUARE_ID>', '<ORG_WHITE_RIVER_ID>', '<ORG_SENIOR_COMPANIONS_ID>',
    '<VOLUNTEER_01_ID>', '<VOLUNTEER_02_ID>', '<VOLUNTEER_03_ID>', '<VOLUNTEER_04_ID>', '<VOLUNTEER_05_ID>', '<VOLUNTEER_06_ID>'
  ] loop
    if demo_id like '<%_ID>' then
      missing_ids := array_append(missing_ids, demo_id);
    elsif not exists (select 1 from public.profiles where id = demo_id::uuid) then
      missing_profiles := array_append(missing_profiles, demo_id);
    end if;
  end loop;

  if cardinality(missing_ids) > 0 then
    raise exception 'Replace all ID fill-ins before running supabase/seed.sql. Still missing: %', array_to_string(missing_ids, ', ');
  end if;
  if cardinality(missing_profiles) > 0 then
    raise exception 'These Auth users do not have profiles yet. Finish signup/profile creation first: %', array_to_string(missing_profiles, ', ');
  end if;
end;
$$;

-- Four fictional organizations. Replace the ID in each WHERE clause.
update public.profiles set
  account_type = 'organization', full_name = 'Eastside Community Pantry',
  headline = 'Fighting hunger on the Near Eastside', neighborhood = 'Near Eastside',
  bio = 'A neighborhood pantry connecting local families with fresh food and caring neighbors.',
  causes = array['Hunger & Food'], skills = array['Food sorting', 'Community outreach']
where id = '<ORG_EASTSIDE_ID>'::uuid;

update public.profiles set
  account_type = 'organization', full_name = 'Fountain Square Reading Buddies',
  headline = 'Helping young readers grow', neighborhood = 'Fountain Square',
  bio = 'Volunteer-led reading time and book access for children in our neighborhood.',
  causes = array['Education & Youth', 'Arts & Culture'], skills = array['Tutoring', 'Reading']
where id = '<ORG_FOUNTAIN_SQUARE_ID>'::uuid;

update public.profiles set
  account_type = 'organization', full_name = 'White River Cleanup Crew',
  headline = 'Keeping the river and trails welcoming', neighborhood = 'Downtown',
  bio = 'Neighbors caring for the White River, its trails, and nearby habitats.',
  causes = array['Environment', 'Community Events'], skills = array['Cleanup', 'Gardening']
where id = '<ORG_WHITE_RIVER_ID>'::uuid;

update public.profiles set
  account_type = 'organization', full_name = 'Indy Senior Companions',
  headline = 'Building connection across generations', neighborhood = 'Meridian-Kessler',
  bio = 'Friendly visits and practical support that help older neighbors stay connected.',
  causes = array['Seniors', 'Health'], skills = array['Conversation', 'Technology help']
where id = '<ORG_SENIOR_COMPANIONS_ID>'::uuid;

-- Six fictional volunteer profiles. Replace the ID in each WHERE clause.
update public.profiles set
  account_type = 'volunteer', full_name = 'Jordan Lee', headline = 'Weekend food pantry volunteer',
  neighborhood = 'Near Eastside', causes = array['Hunger & Food'], skills = array['Food sorting', 'Delivery']
where id = '<VOLUNTEER_01_ID>'::uuid;

update public.profiles set
  account_type = 'volunteer', full_name = 'Sam Patel', headline = 'Reading mentor and book lover',
  neighborhood = 'Fountain Square', causes = array['Education & Youth'], skills = array['Tutoring', 'Reading']
where id = '<VOLUNTEER_02_ID>'::uuid;

update public.profiles set
  account_type = 'volunteer', full_name = 'Taylor Brooks', headline = 'Keeping Indy green',
  neighborhood = 'Downtown', causes = array['Environment'], skills = array['Cleanup', 'Planting']
where id = '<VOLUNTEER_03_ID>'::uuid;

update public.profiles set
  account_type = 'volunteer', full_name = 'Morgan Chen', headline = 'Neighbor, gardener, and helper',
  neighborhood = 'Irvington', causes = array['Seniors', 'Environment'], skills = array['Gardening', 'Technology help']
where id = '<VOLUNTEER_04_ID>'::uuid;

update public.profiles set
  account_type = 'volunteer', full_name = 'Alex Rivera', headline = 'Making community events happen',
  neighborhood = 'Mass Ave', causes = array['Community Events', 'Arts & Culture'], skills = array['Event setup', 'Photography']
where id = '<VOLUNTEER_05_ID>'::uuid;

update public.profiles set
  account_type = 'volunteer', full_name = 'Casey Johnson', headline = 'Here to lend a hand',
  neighborhood = 'Broad Ripple', causes = array['Health', 'Housing & Homelessness'], skills = array['Outreach', 'Cooking']
where id = '<VOLUNTEER_06_ID>'::uuid;

-- Twelve opportunities across causes and neighborhoods. Relative dates keep the demo current.
insert into public.opportunities (org_id, title, description, cause, neighborhood, address, starts_at, ends_at, spots)
values
  ('<ORG_EASTSIDE_ID>'::uuid, 'Saturday Pantry Sort and Pack', 'Sort donations and pack grocery boxes for local families. No experience needed.', 'Hunger & Food', 'Near Eastside', 'East Washington Street', now() + interval '7 days', now() + interval '7 days 3 hours', 12),
  ('<ORG_EASTSIDE_ID>'::uuid, 'Fresh Food Delivery Route', 'Deliver prepared grocery bags to neighbors who cannot visit the pantry.', 'Hunger & Food', 'Irvington', 'Eastside Community Pantry', now() + interval '10 days', now() + interval '10 days 3 hours', 6),
  ('<ORG_EASTSIDE_ID>'::uuid, 'Community Garden Harvest', 'Help harvest seasonal produce for the pantry shelves.', 'Hunger & Food', 'Garfield Park', 'Garfield Park Community Garden', now() + interval '14 days', now() + interval '14 days 2 hours', 8),
  ('<ORG_FOUNTAIN_SQUARE_ID>'::uuid, 'After-School Reading Hour', 'Read one-on-one with elementary students in a welcoming library room.', 'Education & Youth', 'Fountain Square', 'Fountain Square Library', now() + interval '5 days', now() + interval '5 days 2 hours', 5),
  ('<ORG_FOUNTAIN_SQUARE_ID>'::uuid, 'Little Free Library Refresh', 'Sort donated books and refresh neighborhood book boxes.', 'Education & Youth', 'Fletcher Place', 'Fountain Square Reading Room', now() + interval '9 days', now() + interval '9 days 3 hours', 10),
  ('<ORG_FOUNTAIN_SQUARE_ID>'::uuid, 'Family Storytime Helpers', 'Welcome families and help children choose books during storytime.', 'Arts & Culture', 'Fountain Square', 'Southside Community Center', now() + interval '12 days', now() + interval '12 days 2 hours', 4),
  ('<ORG_WHITE_RIVER_ID>'::uuid, 'White River Trail Cleanup', 'Collect litter along an easy section of the river trail. Gloves and bags provided.', 'Environment', 'Downtown', 'White River State Park entrance', now() + interval '6 days', now() + interval '6 days 2 hours', 20),
  ('<ORG_WHITE_RIVER_ID>'::uuid, 'Native Planting Morning', 'Plant native flowers to support pollinators near the river.', 'Environment', 'Downtown', 'White River trail garden', now() + interval '11 days', now() + interval '11 days 3 hours', 10),
  ('<ORG_WHITE_RIVER_ID>'::uuid, 'Trail Welcome Table', 'Share trail maps and cleanup information with visitors at a community event.', 'Community Events', 'Mass Ave', 'Canal Walk welcome tent', now() + interval '16 days', now() + interval '16 days 4 hours', 6),
  ('<ORG_SENIOR_COMPANIONS_ID>'::uuid, 'Friendly Tech Help Visits', 'Help older neighbors with phones, video calls, and basic device settings.', 'Seniors', 'Meridian-Kessler', 'Meridian-Kessler Community Center', now() + interval '8 days', now() + interval '8 days 2 hours', 5),
  ('<ORG_SENIOR_COMPANIONS_ID>'::uuid, 'Community Lunch Companions', 'Share lunch and conversation with older adults at a neighborhood gathering.', 'Seniors', 'Broad Ripple', 'Broad Ripple Community House', now() + interval '13 days', now() + interval '13 days 2 hours', 8),
  ('<ORG_SENIOR_COMPANIONS_ID>'::uuid, 'Accessible Garden Walk', 'Join older neighbors for a relaxed garden visit and help with light setup.', 'Health', 'Meridian-Kessler', 'Northside Community Garden', now() + interval '18 days', now() + interval '18 days 2 hours', 6);

-- Six applications: two pending, two accepted, and two declined.
insert into public.applications (opportunity_id, volunteer_id, message, status)
select o.id, seed.volunteer_id::uuid, seed.message, seed.status::public.application_status
from (values
  ('Saturday Pantry Sort and Pack', '<VOLUNTEER_01_ID>', 'Happy to help with sorting and packing.', 'pending'),
  ('After-School Reading Hour', '<VOLUNTEER_02_ID>', 'I enjoy reading with kids and can come weekly.', 'pending'),
  ('White River Trail Cleanup', '<VOLUNTEER_03_ID>', 'I can bring a reusable water bottle and work gloves.', 'accepted'),
  ('Friendly Tech Help Visits', '<VOLUNTEER_04_ID>', 'I can help with phones and video calls.', 'accepted'),
  ('Fresh Food Delivery Route', '<VOLUNTEER_05_ID>', 'I have a schedule conflict this time, but would love to help later.', 'declined'),
  ('Family Storytime Helpers', '<VOLUNTEER_06_ID>', 'Please keep me in mind for a future session.', 'declined')
) as seed(opportunity_title, volunteer_id, message, status)
join public.opportunities o on o.title = seed.opportunity_title;

-- Fifteen feed posts. Replace each author ID with the matching Auth user ID.
insert into public.posts (author_id, body) values
  ('<ORG_EASTSIDE_ID>'::uuid, 'This week our neighbors helped pack 42 grocery boxes. Thank you for showing up for one another!'),
  ('<VOLUNTEER_01_ID>'::uuid, 'A good morning at the pantry today. I learned how much teamwork goes into every grocery box.'),
  ('<ORG_FOUNTAIN_SQUARE_ID>'::uuid, 'Our reading corner is ready for another afternoon of stories, questions, and big imaginations.'),
  ('<VOLUNTEER_02_ID>'::uuid, 'Reading together is a small thing that can make a young reader feel seen.'),
  ('<ORG_WHITE_RIVER_ID>'::uuid, 'Cleanup crew update: we filled several bags and spotted new birds along the trail.'),
  ('<VOLUNTEER_03_ID>'::uuid, 'The river trail is looking brighter after this morning’s community cleanup.'),
  ('<ORG_SENIOR_COMPANIONS_ID>'::uuid, 'A reminder that a friendly visit and a little patience can make technology feel less intimidating.'),
  ('<VOLUNTEER_04_ID>'::uuid, 'Helped someone set up a video call with family today. That smile made my afternoon.'),
  ('<VOLUNTEER_05_ID>'::uuid, 'I love seeing different neighborhood groups share ideas and volunteers.'),
  ('<VOLUNTEER_06_ID>'::uuid, 'Looking for a low-pressure way to meet neighbors? A community event shift is a great start.'),
  ('<ORG_EASTSIDE_ID>'::uuid, 'The garden harvest is coming up. We could use a few extra hands and plenty of baskets.'),
  ('<ORG_FOUNTAIN_SQUARE_ID>'::uuid, 'We received a lovely stack of gently used children’s books. Thank you, book donors!'),
  ('<ORG_WHITE_RIVER_ID>'::uuid, 'Native planting day is on the calendar. We will provide tools and a quick walkthrough.'),
  ('<ORG_SENIOR_COMPANIONS_ID>'::uuid, 'Our community lunch is about good food, easy conversation, and making room at the table.'),
  ('<VOLUNTEER_02_ID>'::uuid, 'One of my favorite parts of volunteering is discovering how much our neighborhoods already care.');

commit;
