-- Local test-only substitutes for Supabase-managed schemas. Never deploy this file.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text, metadata jsonb, unique(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
 select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1)-1,0)]
$$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid(), storage.foldername(text) to anon, authenticated, service_role;
grant select,insert,update,delete on storage.objects to authenticated;
grant all on all tables in schema auth,storage to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
