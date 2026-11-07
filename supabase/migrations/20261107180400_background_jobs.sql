-- Durable background work is private to the service role.
create table public.email_jobs(
 id uuid primary key default gen_random_uuid(),
 notification_id uuid unique references public.notifications(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 subject text not null, body text not null,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz, sent_at timestamptz, cancelled_at timestamptz, last_error text, created_at timestamptz not null default now()
);
create table public.media_cleanup_jobs(
 id uuid primary key default gen_random_uuid(),bucket text not null,path text not null,
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz,completed_at timestamptz,last_error text,created_at timestamptz not null default now(),unique(bucket,path)
);
alter table public.email_jobs enable row level security;
alter table public.media_cleanup_jobs enable row level security;
revoke all on public.email_jobs,public.media_cleanup_jobs from public,anon,authenticated;
grant all on public.email_jobs,public.media_cleanup_jobs to service_role;

create or replace function public.queue_notification_email()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.user_settings where user_id=new.user_id and email_notifications) then
  insert into public.email_jobs(notification_id,user_id,subject,body) values(new.id,new.user_id,'IndyTeer community update',new.message);
 end if;
 return new;
end;
$$;
create trigger notifications_queue_email after insert on public.notifications for each row execute function public.queue_notification_email();

create or replace function public.queue_media_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb:=to_jsonb(old);new_row jsonb:=case when tg_op='UPDATE' then to_jsonb(new) else '{}'::jsonb end;
 v_column text;v_bucket text;v_path text;v_prefix text;
begin
 for v_column,v_bucket in select * from (values
  ('avatar_path','avatars'),('logo_path','org-logos'),('cover_path','org-covers'),
  ('image_path',case when tg_table_name='posts' then 'post-images' else 'opportunity-images' end)
 ) as m(column_name,bucket_name) loop
  v_path:=old_row->>v_column;
  v_prefix:=case tg_table_name when 'posts' then (old_row->>'organization_id')||'/'||(old_row->>'author_user_id')||'/' else (old_row->>'id')||'/' end;
  -- Editable image references must never authorize removal from another owner's folder.
  if v_path is not null and v_prefix is not null and starts_with(v_path,v_prefix) and v_path is distinct from new_row->>v_column then
   insert into public.media_cleanup_jobs(bucket,path) values(v_bucket,v_path) on conflict(bucket,path) do nothing;
  end if;
 end loop;
 if tg_op='DELETE' then return old; end if; return new;
end;
$$;
create trigger users_media_cleanup after update of avatar_path or delete on public.users for each row execute function public.queue_media_cleanup();
create trigger org_media_cleanup after update of logo_path,cover_path or delete on public.organizations for each row execute function public.queue_media_cleanup();
create trigger opportunity_media_cleanup after update of image_path or delete on public.opportunities for each row execute function public.queue_media_cleanup();
create trigger post_media_cleanup after update of image_path or delete on public.posts for each row execute function public.queue_media_cleanup();

alter table public.notifications add column dedupe_key text;
create unique index notifications_dedupe_idx on public.notifications(user_id,dedupe_key) where dedupe_key is not null;
create or replace function public.enqueue_event_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 insert into public.notifications(user_id,type,message,data,dedupe_key)
 select r.user_id,'reminder','Reminder: '||o.title||' starts tomorrow.',
  jsonb_build_object('opportunity_id',o.id),'event-reminder:'||r.id::text
 from public.registrations r join public.opportunities o on o.id=r.opportunity_id
 where r.status='approved' and o.starts_at>=now()+interval '23 hours' and o.starts_at<now()+interval '25 hours'
 on conflict(user_id,dedupe_key) where dedupe_key is not null do nothing;
 get diagnostics v_count=row_count;return v_count;
end;
$$;

create or replace function public.claim_email_jobs(p_limit integer default 25)
returns table(id uuid,email text,subject text,body text)
language plpgsql security definer set search_path='' as $$
begin
 update public.email_jobs j set cancelled_at=now(),last_error='Email notifications disabled'
 where sent_at is null and cancelled_at is null and exists(select 1 from public.user_settings s where s.user_id=j.user_id and not s.email_notifications);
 return query with selected as (
 select j.id from public.email_jobs j join auth.users u on u.id=j.user_id
 where j.sent_at is null and j.cancelled_at is null and j.attempts<5 and j.next_attempt_at<=now()
 and (j.claimed_until is null or j.claimed_until<now()) and u.email is not null
 order by j.created_at limit least(greatest(p_limit,1),100) for update of j skip locked
 ), claimed as (update public.email_jobs j set attempts=attempts+1,claimed_until=now()+interval '5 minutes'
 where j.id in(select selected.id from selected) returning j.*)
 select c.id,u.email,c.subject,c.body from claimed c join auth.users u on u.id=c.user_id;
end;
$$;
create or replace function public.finish_email_job(p_id uuid,p_error text default null)
returns void language sql security definer set search_path='' as $$
 update public.email_jobs set claimed_until=null,last_error=p_error,
 sent_at=case when p_error is null then now() else sent_at end,
 next_attempt_at=now()+(least(power(2,attempts),1440)*interval '1 minute') where id=p_id;
$$;
create or replace function public.claim_media_cleanup_jobs(p_limit integer default 50)
returns table(id uuid,bucket text,path text)
language sql security definer set search_path='' as $$
 with selected as(select id from public.media_cleanup_jobs where completed_at is null and attempts<10
  and next_attempt_at<=now() and (claimed_until is null or claimed_until<now())
  order by created_at limit least(greatest(p_limit,1),100) for update skip locked),
 claimed as(update public.media_cleanup_jobs set attempts=attempts+1,claimed_until=now()+interval '5 minutes'
  where id in(select selected.id from selected) returning *)
 select id,bucket,path from claimed;
$$;
create or replace function public.finish_media_cleanup_job(p_id uuid,p_error text default null)
returns void language sql security definer set search_path='' as $$
 update public.media_cleanup_jobs set claimed_until=null,last_error=p_error,
 completed_at=case when p_error is null then now() else completed_at end,
 next_attempt_at=now()+(least(power(2,attempts),1440)*interval '1 minute') where id=p_id;
$$;
revoke all on function public.queue_notification_email(),public.queue_media_cleanup(),public.enqueue_event_reminders(),
 public.claim_email_jobs(integer),public.finish_email_job(uuid,text),public.claim_media_cleanup_jobs(integer),public.finish_media_cleanup_job(uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_event_reminders(),public.claim_email_jobs(integer),public.finish_email_job(uuid,text),
 public.claim_media_cleanup_jobs(integer),public.finish_media_cleanup_job(uuid,text) to service_role;
