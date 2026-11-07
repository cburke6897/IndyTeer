-- Restoring or reusing an owned image reference must prevent queued cleanup from
-- deleting that active file. References outside their owner scope do not count.
create or replace function public.media_is_referenced(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select case p_bucket
 when 'avatars' then exists(select 1 from public.users u where u.avatar_path=p_path and starts_with(p_path,u.id::text||'/'))
 when 'org-logos' then exists(select 1 from public.organizations o where o.logo_path=p_path and starts_with(p_path,o.id::text||'/'))
 when 'org-covers' then exists(select 1 from public.organizations o where o.cover_path=p_path and starts_with(p_path,o.id::text||'/'))
 when 'opportunity-images' then exists(select 1 from public.opportunities o where o.image_path=p_path and starts_with(p_path,o.id::text||'/'))
 when 'post-images' then exists(select 1 from public.posts p where p.image_path=p_path and starts_with(p_path,p.organization_id::text||'/'||p.author_user_id::text||'/'))
 else true end;
$$;
revoke all on function public.media_is_referenced(text,text) from public,anon,authenticated;
grant execute on function public.media_is_referenced(text,text) to service_role;

create or replace function public.claim_media_cleanup_jobs(p_limit integer default 50)
returns table(id uuid,bucket text,path text)
language sql security definer set search_path='' as $$
 with selected as(select j.id from public.media_cleanup_jobs j where j.completed_at is null and j.attempts<10
  and j.next_attempt_at<=now() and (j.claimed_until is null or j.claimed_until<now())
  and not public.media_is_referenced(j.bucket,j.path)
  order by j.created_at limit least(greatest(p_limit,1),100) for update skip locked),
 claimed as(update public.media_cleanup_jobs set attempts=attempts+1,claimed_until=now()+interval '5 minutes'
  where id in(select selected.id from selected) returning *)
 select id,bucket,path from claimed;
$$;
