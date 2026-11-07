-- Only a server worker can enumerate Auth-owned Storage objects, including
-- orphaned uploads whose opportunity/post has already been removed.
create or replace function public.account_storage_objects(p_user_id uuid)
returns table(bucket_id text,name text)
language sql stable security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o
 where coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=p_user_id::text;
$$;
revoke all on function public.account_storage_objects(uuid) from public,anon,authenticated;
grant execute on function public.account_storage_objects(uuid) to service_role;

create or replace function public.media_account_active()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid() and not deletion_pending);
$$;
revoke all on function public.media_account_active() from public,anon;
grant execute on function public.media_account_active() to authenticated;
create policy "Account deletion blocks media writes" on storage.objects as restrictive for all to authenticated
 using(public.media_account_active()) with check(public.media_account_active());
