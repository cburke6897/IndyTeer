-- Upgrade the initial prototype schema to the agreed users/organizations model.
-- users.id remains identical to auth.users.id. Organization membership is many-to-many.

create type public.organization_role as enum ('owner', 'admin', 'member');
create type public.membership_status as enum ('invited', 'pending', 'active', 'rejected', 'removed');
create type public.organization_join_policy as enum ('approval', 'invite_only');
create type public.recurrence_type as enum ('none', 'weekly', 'biweekly', 'monthly');
create type public.post_kind as enum ('update', 'announcement');
create type public.registration_status as enum ('pending', 'approved', 'declined', 'cancelled', 'removed');
create type public.opportunity_status_v2 as enum ('draft', 'published');

-- Remove policies and helper functions tied to the prototype model.
-- Stop the prototype signup trigger before profiles is replaced. The next
-- migration installs the users-based trigger after the schema transition.
drop trigger if exists on_auth_user_created on auth.users;
drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Opportunities are public" on public.opportunities;
drop policy if exists "Orgs create own opportunities" on public.opportunities;
drop policy if exists "Orgs update own opportunities" on public.opportunities;
drop policy if exists "Orgs delete own opportunities" on public.opportunities;
drop policy if exists "Volunteer or owning org reads applications" on public.applications;
drop policy if exists "Volunteers apply as themselves" on public.applications;
drop policy if exists "Owning org updates application status" on public.applications;
drop policy if exists "Volunteers withdraw own application" on public.applications;
drop policy if exists "Posts are public" on public.posts;
drop policy if exists "Users create own posts" on public.posts;
drop policy if exists "Users delete own posts" on public.posts;
drop function if exists public.is_organization();

-- Shared account identity/profile data. All public.users IDs match Auth IDs.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  headline text,
  bio text,
  city text,
  state text not null default 'IN',
  timezone text not null default 'America/Indiana/Indianapolis',
  date_of_birth date,
  avatar_url text,
  avatar_path text,
  phone text,
  availability jsonb not null default '{}'::jsonb,
  interests text[] not null default '{}',
  skills text[] not null default '{}',
  onboarded boolean not null default false,
  is_platform_admin boolean not null default false,
  terms_accepted_at timestamptz,
  public_profile boolean not null default false,
  show_hours boolean not null default false,
  show_history boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_timezone_valid check (timezone in ('America/Indiana/Indianapolis','America/Chicago'))
);

insert into public.users (id, first_name, last_name, full_name, headline, bio, city, state,
  avatar_url, avatar_path, skills, interests, onboarded, created_at, updated_at)
select p.id,
  split_part(p.full_name, ' ', 1),
  nullif(trim(substr(p.full_name, length(split_part(p.full_name, ' ', 1)) + 1)), ''),
  p.full_name, p.headline, p.bio, p.neighborhood, 'IN', p.avatar_url, null,
  p.skills, p.causes, true, p.created_at, p.updated_at
from public.profiles p;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete cascade,
  name text not null,
  logo_path text,
  cover_path text,
  type text,
  description text not null default '',
  mission text,
  website text,
  city text,
  state text not null default 'IN',
  contact_email text,
  phone text,
  focus text[] not null default '{}',
  verified boolean not null default false,
  founded_year integer,
  join_policy public.organization_join_policy not null default 'approval',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_founded_year_check check (founded_year is null or founded_year between 1800 and 2200)
);

-- Preserve existing opportunity owner IDs by using each legacy organization profile ID
-- as the migrated organization ID. New organizations receive generated UUIDs.
insert into public.organizations (id, created_by, name, logo_path, cover_path, website, city, description, mission, focus, created_at, updated_at)
select p.id, p.id, p.full_name, p.avatar_url, p.banner_url, p.website, p.neighborhood, p.bio, p.headline, p.causes, p.created_at, p.updated_at
from public.profiles p
where p.account_type = 'organization'
   or exists (select 1 from public.opportunities o where o.org_id = p.id);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  status public.membership_status not null default 'pending',
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

insert into public.organization_memberships (organization_id, user_id, role, status)
select o.id, o.created_by, 'owner', 'active' from public.organizations o
on conflict (organization_id, user_id) do nothing;

-- Convert existing opportunities to organization ownership and the new event contract.
alter table public.opportunities drop constraint opportunities_org_id_fkey;
alter table public.opportunities rename column org_id to organization_id;
alter table public.opportunities add constraint opportunities_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;
alter table public.opportunities rename column cause to category;
alter table public.opportunities rename column neighborhood to city;
alter table public.opportunities add column location text not null default '',
  add column virtual boolean not null default false,
  add column min_age integer,
  add column skills text[] not null default '{}',
  add column hours numeric(4,1),
  add column registration_deadline date,
  add column recurrence public.recurrence_type not null default 'none',
  add column instructions text,
  add column event_date date,
  add column start_time time,
  add column end_time time,
  add column timezone text not null default 'America/Indiana/Indianapolis',
  add column image_path text;

update public.opportunities
set event_date = (starts_at at time zone 'America/Indiana/Indianapolis')::date,
    start_time = (starts_at at time zone 'America/Indiana/Indianapolis')::time,
    end_time = case when ends_at is null
      then least((starts_at at time zone 'America/Indiana/Indianapolis')::time + interval '1 hour', time '23:59')::time
      else (ends_at at time zone 'America/Indiana/Indianapolis')::time end,
    spots = greatest(coalesce(spots, 1), 1);
alter table public.opportunities alter column event_date set not null,
  alter column start_time set not null, alter column end_time set not null,
  alter column spots set not null, alter column status drop default;
alter table public.opportunities alter column status type public.opportunity_status_v2
  using (case status::text when 'open' then 'published' else 'draft' end)::public.opportunity_status_v2;
drop type public.opportunity_status;
alter type public.opportunity_status_v2 rename to opportunity_status;
alter table public.opportunities alter column status set default 'draft';
alter table public.opportunities add constraint opportunities_spots_positive check (spots >= 1) not valid,
  add constraint opportunities_min_age_valid check (min_age is null or min_age between 1 and 99) not valid,
  add constraint opportunities_hours_positive check (hours is null or hours > 0) not valid,
  add constraint opportunities_event_time_valid check (end_time > start_time) not valid,
  add constraint opportunities_deadline_valid check (registration_deadline is null or registration_deadline <= event_date) not valid,
  add constraint opportunities_timezone_valid check (timezone in ('America/Indiana/Indianapolis', 'America/Chicago')) not valid,
  add constraint opportunities_published_complete check (status <> 'published' or
    (length(trim(title)) >= 3 and length(trim(category)) > 0 and length(trim(city)) > 0
      and length(trim(location)) > 0 and event_date is not null and start_time is not null
      and end_time is not null and spots >= 1)) not valid;

-- Convert applications to registrations without dropping rows or their unique key.
alter table public.applications drop constraint applications_volunteer_id_fkey;
alter table public.applications rename to registrations;
alter table public.registrations rename column volunteer_id to user_id;
alter table public.registrations add constraint registrations_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;
alter table public.registrations alter column status drop default;
alter table public.registrations alter column status type public.registration_status
  using (case status::text when 'accepted' then 'approved' else status::text end)::public.registration_status;
drop type public.application_status;
alter table public.registrations alter column status set default 'pending';
alter table public.registrations add column attended boolean not null default false,
  add column hours_verified boolean not null default false,
  add column hours numeric(4,1), add column verified_at timestamptz, add column cancelled_at timestamptz;
alter table public.registrations add constraint registrations_hours_valid check (hours is null or hours between 0.5 and 24) not valid,
  add constraint registrations_verified_requires_attendance check (not hours_verified or attended) not valid,
  add constraint registrations_attendance_requires_approval check (not attended or status = 'approved') not valid;

-- Posts retain user authorship and can be associated with an organization.
alter table public.posts drop constraint posts_author_id_fkey;
alter table public.posts rename column author_id to author_user_id;
alter table public.posts add constraint posts_author_user_id_fkey
  foreign key (author_user_id) references public.users(id) on delete cascade;
alter table public.posts add column organization_id uuid references public.organizations(id) on delete cascade,
  add column title text not null default 'Community update',
  add column kind public.post_kind not null default 'update',
  add column image_path text;
update public.posts p set organization_id = o.id from public.organizations o where o.created_by = p.author_user_id;
alter table public.posts add constraint posts_title_min_length check (char_length(title) >= 3) not valid,
  add constraint posts_body_min_length check (char_length(body) >= 10) not valid;

-- User settings and organization-adjacent feature tables.
create table public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  new_opportunity_notifications boolean not null default true,
  registration_notifications boolean not null default true,
  email_notifications boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.user_settings(user_id) select id from public.users on conflict do nothing;

create table public.saved_opportunities (
  user_id uuid not null references public.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id, opportunity_id)
);
create table public.organization_follows (
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
create table public.manual_hour_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  org_name text not null, title text not null, entry_date date not null,
  hours numeric(4,1) not null check (hours between 0.5 and 24), notes text,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null, message text not null, data jsonb not null default '{}'::jsonb,
  read_at timestamptz, created_at timestamptz not null default now()
);

-- Trigger for storing wall-clock event times consistently across Indiana time zones.
create or replace function public.set_opportunity_timestamps()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.starts_at := (new.event_date + new.start_time) at time zone new.timezone;
  new.ends_at := (new.event_date + new.end_time) at time zone new.timezone;
  return new;
end;
$$;
create trigger opportunities_set_timestamps before insert or update of event_date, start_time, end_time, timezone
  on public.opportunities for each row execute function public.set_opportunity_timestamps();

-- Drop prototype profiles after every dependent row has been migrated to users/organizations.
drop trigger if exists profiles_set_updated_at on public.profiles;
drop table public.profiles;
drop type public.account_type;

create index opportunities_city_idx on public.opportunities(city);
create index opportunities_category_idx on public.opportunities(category);
create index opportunities_published_date_idx on public.opportunities(status, event_date) where status = 'published';
create index opportunities_skills_gin_idx on public.opportunities using gin(skills);
create index users_interests_gin_idx on public.users using gin(interests);
create index users_skills_gin_idx on public.users using gin(skills);
create index organizations_focus_gin_idx on public.organizations using gin(focus);
create index registrations_user_status_idx on public.registrations(user_id, status);
create index registrations_opportunity_status_idx on public.registrations(opportunity_id, status);
create index memberships_user_status_idx on public.organization_memberships(user_id, status);
create index memberships_org_status_idx on public.organization_memberships(organization_id, status);
create index organization_follows_org_idx on public.organization_follows(organization_id);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index manual_hours_user_date_idx on public.manual_hour_entries(user_id, entry_date desc);
