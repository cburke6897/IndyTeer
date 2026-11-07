-- Auth owns sign-in identity; public.users stores the app-facing user row.
-- Signup metadata may contain full_name/name and avatar_url/picture. Account type
-- is not collected at signup; organization membership controls organization access.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_full_name text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''), '');
begin
  insert into public.users (id, full_name, first_name, last_name, avatar_url)
  values (
    new.id,
    v_full_name,
    coalesce(nullif(split_part(v_full_name, ' ', 1), ''), ''),
    coalesce(nullif(trim(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 1)), ''), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), nullif(new.raw_user_meta_data ->> 'picture', ''))
  ) on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing Auth users after migrating existing profile rows.
insert into public.users (id, full_name, first_name, last_name, avatar_url)
select u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), ''),
  coalesce(nullif(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1), ''), ''),
  coalesce(nullif(trim(substr(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
    length(split_part(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), ' ', 1)) + 1)), ''), ''),
  coalesce(nullif(u.raw_user_meta_data ->> 'avatar_url', ''), nullif(u.raw_user_meta_data ->> 'picture', ''))
from auth.users u on conflict (id) do nothing;
insert into public.user_settings (user_id)
select id from public.users on conflict (user_id) do nothing;
