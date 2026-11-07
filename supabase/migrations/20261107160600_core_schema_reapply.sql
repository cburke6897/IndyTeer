-- Creates core tables and policies for the app. This migration is run automatically by Supabase when you create a new project.
create type public.account_type as enum ('volunteer', 'organization');
create type public.opportunity_status as enum ('open', 'closed');
create type public.application_status as enum ('pending', 'accepted', 'declined');

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  account_type public.account_type not null default 'volunteer',
  full_name    text not null default '',
  headline     text,
  bio          text,
  neighborhood text,
  avatar_url   text,
  banner_url   text,
  website      text,
  causes       text[] not null default '{}',
  skills       text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.opportunities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text not null default '',
  cause        text not null,
  neighborhood text,
  address      text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  spots        int check (spots is null or spots > 0),
  image_url    text,
  status       public.opportunity_status not null default 'open',
  created_at   timestamptz not null default now()
);

create table public.applications (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  volunteer_id   uuid not null references public.profiles (id) on delete cascade,
  message        text,
  status         public.application_status not null default 'pending',
  created_at     timestamptz not null default now(),
  unique (opportunity_id, volunteer_id)
);

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  image_url  text,
  created_at timestamptz not null default now()
);

create index on public.opportunities (status, starts_at);
create index on public.opportunities (org_id);
create index on public.applications (volunteer_id);
create index on public.posts (author_id);
create index on public.posts (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Enable RLS on all tables. Policies are defined below.
alter table public.profiles      enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications  enable row level security;
alter table public.posts         enable row level security;

-- Helper: is the current user an organization?
create or replace function public.is_organization()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_type = 'organization'
  );
$$;

-- profiles: anyone can read; you can update only your own row.
-- No insert policy: rows are created by the signup trigger.
create policy "Profiles are public" on public.profiles
  for select using (true);
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- opportunities: anyone can read; organizations manage their own.
create policy "Opportunities are public" on public.opportunities
  for select using (true);
create policy "Orgs create own opportunities" on public.opportunities
  for insert to authenticated
  with check ((select auth.uid()) = org_id and public.is_organization());
create policy "Orgs update own opportunities" on public.opportunities
  for update to authenticated
  using ((select auth.uid()) = org_id) with check ((select auth.uid()) = org_id);
create policy "Orgs delete own opportunities" on public.opportunities
  for delete to authenticated using ((select auth.uid()) = org_id);

-- applications: visible to the volunteer and the owning organization only.
create policy "Volunteer or owning org reads applications" on public.applications
  for select to authenticated using (
    (select auth.uid()) = volunteer_id
    or exists (select 1 from public.opportunities o
               where o.id = opportunity_id and o.org_id = (select auth.uid()))
  );
create policy "Volunteers apply as themselves" on public.applications
  for insert to authenticated
  with check ((select auth.uid()) = volunteer_id and not public.is_organization());
create policy "Owning org updates application status" on public.applications
  for update to authenticated using (
    exists (select 1 from public.opportunities o
            where o.id = opportunity_id and o.org_id = (select auth.uid()))
  );
create policy "Volunteers withdraw own application" on public.applications
  for delete to authenticated using ((select auth.uid()) = volunteer_id);

-- posts: anyone can read; you create and delete your own.
create policy "Posts are public" on public.posts
  for select using (true);
create policy "Users create own posts" on public.posts
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Users delete own posts" on public.posts
  for delete to authenticated using ((select auth.uid()) = author_id);