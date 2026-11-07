-- Permit the read-only membership predicate in anonymous opportunity RLS.
grant execute on function public.is_org_member(uuid) to anon;

-- Ownership keeps the membership return contract introduced in 20261107173000.

-- Membership contributors may attach images to their own organization updates.
create policy "Active members upload own post images" on storage.objects for insert to authenticated
  with check(bucket_id='post-images' and public.is_org_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2]=(select auth.uid())::text);
create policy "Active members delete own post images" on storage.objects for delete to authenticated
  using(bucket_id='post-images' and public.is_org_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2]=(select auth.uid())::text);

create or replace function public.filter_notification_preferences()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.type='registration' and exists(select 1 from public.user_settings where user_id=new.user_id and not registration_notifications)
 then return null; end if;
 return new;
end;
$$;
revoke all on function public.filter_notification_preferences() from public,anon,authenticated;
create trigger notifications_preferences before insert on public.notifications
 for each row execute function public.filter_notification_preferences();

-- Each recurring event is an individual, capacity-limited occurrence.
alter table public.opportunities add column series_id uuid, add column series_index integer;
create index opportunities_series_idx on public.opportunities(series_id) where series_id is not null;
create or replace function public.create_opportunity_series(p_data jsonb,p_occurrences integer)
returns setof public.opportunities language plpgsql security definer set search_path='' as $$
declare v_org uuid:=(p_data->>'organization_id')::uuid; v_date date:=(p_data->>'event_date')::date;
 v_series uuid:=gen_random_uuid(); v_recurrence text:=coalesce(p_data->>'recurrence','none'); v_row public.opportunities%rowtype; i integer;
begin
 if auth.uid() is null or not public.is_org_admin(v_org) then raise exception 'Organization admin required.'; end if;
 if p_occurrences<1 or p_occurrences>24 then raise exception 'Choose between 1 and 24 occurrences.'; end if;
 if v_recurrence not in ('weekly','biweekly','monthly') then raise exception 'Choose a supported recurrence.'; end if;
 for i in 0..p_occurrences-1 loop
  insert into public.opportunities(organization_id,title,description,category,city,location,address,virtual,
   min_age,skills,hours,registration_deadline,recurrence,instructions,event_date,start_time,end_time,timezone,spots,status,series_id,series_index)
  values(v_org,p_data->>'title',p_data->>'description',p_data->>'category',p_data->>'city',p_data->>'location',
   p_data->>'address',coalesce((p_data->>'virtual')::boolean,false),nullif(p_data->>'min_age','')::integer,
   coalesce(array(select jsonb_array_elements_text(p_data->'skills')),'{}'),nullif(p_data->>'hours','')::numeric,
   case when nullif(p_data->>'registration_deadline','') is not null then
    ((p_data->>'registration_deadline')::date + case v_recurrence when 'weekly' then i*interval '1 week'
      when 'biweekly' then i*interval '2 weeks' else i*interval '1 month' end)::date end,
   v_recurrence::public.recurrence_type,p_data->>'instructions',
   (v_date+case v_recurrence when 'weekly' then i*interval '1 week' when 'biweekly' then i*interval '2 weeks' else i*interval '1 month' end)::date,
   (p_data->>'start_time')::time,(p_data->>'end_time')::time,coalesce(p_data->>'timezone','America/Indiana/Indianapolis'),
   (p_data->>'spots')::integer,coalesce((p_data->>'status')::public.opportunity_status,'draft'),v_series,i)
  returning * into v_row;
  return next v_row;
 end loop;
end;
$$;
revoke all on function public.create_opportunity_series(jsonb,integer) from public,anon;
grant execute on function public.create_opportunity_series(jsonb,integer) to authenticated;
