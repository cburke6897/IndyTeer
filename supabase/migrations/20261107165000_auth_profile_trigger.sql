-- Keep each public profile tied to its Supabase Auth user.
-- Signup must provide raw_user_meta_data.account_type as 'volunteer' or 'organization'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_account_type text := new.raw_user_meta_data ->> 'account_type';
begin
  if selected_account_type is null or selected_account_type not in ('volunteer', 'organization') then
    raise exception 'Signup metadata account_type must be volunteer or organization';
  end if;

  insert into public.profiles (id, account_type, full_name, avatar_url)
  values (
    new.id,
    selected_account_type::public.account_type,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing Auth users. Preserve profile values when a row already exists.
-- Legacy accounts without an account_type metadata value are assigned volunteer;
-- review those accounts and update their type if they are organizations.
insert into public.profiles (id, account_type, full_name, avatar_url)
select
  u.id,
  case
    when u.raw_user_meta_data ->> 'account_type' = 'organization' then 'organization'::public.account_type
    else 'volunteer'::public.account_type
  end,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    ''
  ),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(u.raw_user_meta_data ->> 'picture', '')
  )
from auth.users as u
on conflict (id) do nothing;
