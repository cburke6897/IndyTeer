create type public.profile_visibility as enum('everyone','members','organizations');
alter table public.users add column profile_visibility public.profile_visibility not null default 'organizations';
update public.users set profile_visibility=case when public_profile then 'everyone'::public.profile_visibility else 'organizations'::public.profile_visibility end;
grant update(profile_visibility) on public.users to authenticated;

-- Keep legacy clients' public_profile toggle coherent with the new audience.
create or replace function public.sync_profile_visibility()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.profile_visibility is distinct from old.profile_visibility then new.public_profile:=(new.profile_visibility='everyone');
 elsif new.public_profile is distinct from old.public_profile then
  new.profile_visibility:=case when new.public_profile then 'everyone'::public.profile_visibility else 'organizations'::public.profile_visibility end;
 end if;
 return new;
end;
$$;
create trigger users_visibility_sync before update of profile_visibility,public_profile on public.users for each row execute function public.sync_profile_visibility();
revoke all on function public.sync_profile_visibility() from public,anon,authenticated;

create or replace view public.public_users as
select u.id,u.first_name,u.last_name,u.full_name,u.headline,u.bio,u.city,u.state,
 u.avatar_url,u.avatar_path,u.interests,u.skills,u.created_at from public.users u
where u.profile_visibility='everyone' or (u.profile_visibility='members' and auth.uid() is not null);

create or replace view public.public_organizations as
select o.id,o.name,o.logo_path,o.cover_path,o.type,o.description,o.mission,o.website,o.city,o.state,
 o.focus,o.verified,o.founded_year,o.created_at,o.join_policy from public.organizations o;

-- Public viewers get only public details. Phone/availability require a connected
-- active owner/admin with a pending or approved registration, or the profile owner.
create or replace function public.get_user_profile_for_organization(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user public.users%rowtype;v_connected boolean;v_self boolean;
begin
 select * into v_user from public.users where id=p_user_id;
 if not found then raise exception 'Profile unavailable.'; end if;
 v_self:=coalesce(auth.uid()=p_user_id,false);
 v_connected:=exists(select 1 from public.registrations r join public.opportunities o on o.id=r.opportunity_id
  join public.organization_memberships m on m.organization_id=o.organization_id
  where r.user_id=p_user_id and r.status in('pending','approved') and m.user_id=auth.uid()
   and m.status='active' and m.role in('owner','admin'));
 if not(v_self or v_connected or v_user.profile_visibility='everyone' or
  (v_user.profile_visibility='members' and auth.uid() is not null)) then raise exception 'This profile is private.'; end if;
 return jsonb_build_object('id',v_user.id,'full_name',v_user.full_name,'headline',v_user.headline,
  'bio',v_user.bio,'city',v_user.city,'state',v_user.state,'avatar_url',v_user.avatar_url,'avatar_path',v_user.avatar_path,
  'interests',v_user.interests,'skills',v_user.skills,'profile_visibility',v_user.profile_visibility,
  'phone',case when v_self or v_connected then v_user.phone end,
  'availability',case when v_self or v_connected then v_user.availability end,
  'show_hours',v_user.show_hours,'show_history',v_user.show_history,
  'verified_hours',case when v_user.show_hours then(select coalesce(sum(hours),0) from public.registrations where user_id=p_user_id and hours_verified) end,
  'history',case when v_user.show_history then(select coalesce(jsonb_agg(jsonb_build_object('opportunity_id',o.id,'title',o.title,
    'event_date',o.event_date,'status',r.status,'hours',case when r.hours_verified then r.hours end)),'[]'::jsonb)
   from public.registrations r join public.opportunities o on o.id=r.opportunity_id
   where r.user_id=p_user_id and r.status='approved' and r.attended and o.status='published') end);
end;
$$;
revoke all on function public.get_user_profile_for_organization(uuid) from public;
grant execute on function public.get_user_profile_for_organization(uuid) to anon,authenticated;
