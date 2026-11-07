-- RLS, organization membership workflow, registration RPCs, and onboarding.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_follows enable row level security;
alter table public.opportunities enable row level security;
alter table public.registrations enable row level security;
alter table public.posts enable row level security;
alter table public.user_settings enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.manual_hour_entries enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = (select auth.uid()) and m.status = 'active');
$$;
create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin'));
$$;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = (select auth.uid()) and u.is_platform_admin);
$$;
revoke all on function public.is_org_member(uuid), public.is_org_admin(uuid), public.is_platform_admin() from public, anon;
grant execute on function public.is_org_member(uuid), public.is_org_admin(uuid), public.is_platform_admin() to authenticated;

-- Public views expose only fields approved for public display. Contact details stay private.
create or replace view public.public_users as
select u.id, u.first_name, u.last_name, u.full_name, u.headline, u.bio, u.city, u.state,
  u.avatar_url, u.avatar_path, u.interests, u.skills, u.created_at
from public.users u where u.public_profile;
create or replace view public.public_organizations as
select o.id, o.name, o.logo_path, o.cover_path, o.type, o.description, o.mission,
  o.website, o.city, o.state, o.focus, o.verified, o.founded_year, o.created_at
from public.organizations o;
create or replace view public.opportunity_availability as
select o.id as opportunity_id, o.spots,
  greatest(o.spots - count(r.id) filter (where r.status in ('pending','approved')), 0)::integer as spots_left
from public.opportunities o left join public.registrations r on r.opportunity_id=o.id
where o.status='published' group by o.id, o.spots;
create or replace view public.volunteer_hour_entries with (security_invoker = true) as
select r.id, r.user_id, 'registration'::text as source, org.name as organization_name,
  o.title, o.event_date as entry_date, r.hours, r.hours_verified as verified
from public.registrations r join public.opportunities o on o.id=r.opportunity_id
join public.public_organizations org on org.id=o.organization_id
where r.status='approved' and r.attended
union all
select h.id, h.user_id, 'manual'::text as source, h.org_name as organization_name,
  h.title, h.entry_date, h.hours, false as verified
from public.manual_hour_entries h;
grant select on public.public_users, public.public_organizations, public.opportunity_availability to anon, authenticated;
grant select on public.volunteer_hour_entries to authenticated;

-- Explicit client privileges. Privileged state and registration writes are RPC-only.
revoke all on public.users, public.organizations, public.organization_memberships,
  public.opportunities, public.registrations, public.posts, public.user_settings,
  public.organization_follows, public.saved_opportunities, public.manual_hour_entries, public.notifications
  from anon, authenticated;
grant select on public.users to authenticated;
grant update (first_name, last_name, full_name, headline, bio, city, state, timezone, avatar_url,
  avatar_path, phone, availability, interests, skills, public_profile, show_hours, show_history)
  on public.users to authenticated;
grant select on public.organizations to authenticated;
grant update (name, logo_path, cover_path, type, description, mission, website, city,
  state, contact_email, phone, focus, join_policy, founded_year)
  on public.organizations to authenticated;
grant select on public.organization_memberships to authenticated;
grant select, insert, delete on public.organization_follows to authenticated;
grant select on public.opportunities to anon, authenticated;
grant insert (organization_id, title, description, category, city, location, address, virtual,
  min_age, skills, hours, registration_deadline, recurrence, instructions, event_date,
  start_time, end_time, timezone, spots, image_url, image_path) on public.opportunities to authenticated;
grant update (title, description, category, city, location, address, virtual, min_age, skills,
  hours, registration_deadline, recurrence, instructions, event_date, start_time, end_time,
  timezone, spots, image_url, image_path, status) on public.opportunities to authenticated;
grant delete on public.opportunities to authenticated;
grant select on public.registrations to authenticated;
grant select on public.posts to anon, authenticated;
grant insert (author_user_id, organization_id, title, kind, body, image_url, image_path) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant select on public.user_settings to authenticated;
grant update (new_opportunity_notifications, registration_notifications, email_notifications)
  on public.user_settings to authenticated;
grant select, insert, delete on public.saved_opportunities to authenticated;
grant select, insert, delete on public.manual_hour_entries to authenticated;
grant select, update (read_at) on public.notifications to authenticated;

-- User rows are private; the public_users view handles opt-in reads.
create policy "Users read own row" on public.users for select to authenticated
  using ((select auth.uid()) = id);
create policy "Users update permitted fields" on public.users for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Organization records are public through projection" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "Organization admins update their organization" on public.organizations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy "Users read their memberships" on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));
-- Membership mutations are only available through the RPCs below.

create policy "Users read relevant follows" on public.organization_follows for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));
create policy "Users follow organizations" on public.organization_follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users unfollow organizations" on public.organization_follows for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Published opportunities or active org members read" on public.opportunities
  for select using (status = 'published' or public.is_org_member(organization_id));
create policy "Organization admins create opportunities" on public.opportunities for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy "Organization admins update opportunities" on public.opportunities for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Organization admins delete opportunities" on public.opportunities for delete to authenticated
  using (public.is_org_admin(organization_id));

create policy "Volunteer or owning organization reads registrations" on public.registrations
  for select to authenticated using (
    user_id = (select auth.uid()) or exists (
      select 1 from public.opportunities o where o.id = opportunity_id and public.is_org_member(o.organization_id)
    ));
-- No direct registration INSERT/UPDATE/DELETE grants or policies.

create policy "Public posts are readable" on public.posts for select using (true);
create policy "Active org members create updates and admins announce" on public.posts
  for insert to authenticated with check (
    author_user_id = (select auth.uid()) and (
      (kind = 'update' and organization_id is not null and public.is_org_member(organization_id)) or
      (kind = 'announcement' and public.is_platform_admin())
    ));
create policy "Authors or org admins delete posts" on public.posts for delete to authenticated
  using (author_user_id = (select auth.uid()) or (organization_id is not null and public.is_org_admin(organization_id))
    or public.is_platform_admin());

create policy "Owners read settings" on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Owners update settings" on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owners manage saved opportunities" on public.saved_opportunities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owners manage manual hours" on public.manual_hour_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and entry_date <= coalesce(
    (select (now() at time zone u.timezone)::date from public.users u where u.id=(select auth.uid())),
    (now() at time zone 'America/Indiana/Indianapolis')::date));
create policy "Owners read notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Owners mark notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.create_organization(p_data jsonb)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_org public.organizations%rowtype;
begin
  if v_user is null then raise exception 'Sign in to create an organization.'; end if;
  if not exists (select 1 from public.users u where u.id = v_user and u.onboarded) then
    raise exception 'Complete your user profile first.';
  end if;
  insert into public.organizations (created_by, name, type, description, mission, website, city, state,
    contact_email, phone, focus, founded_year, join_policy)
  values (v_user, trim(p_data->>'name'), p_data->>'type', coalesce(p_data->>'description',''),
    p_data->>'mission', p_data->>'website', p_data->>'city', coalesce(p_data->>'state','IN'),
    p_data->>'contact_email', p_data->>'phone',
    coalesce(array(select jsonb_array_elements_text(p_data->'focus')), '{}'),
    nullif(p_data->>'founded_year','')::integer,
    coalesce((p_data->>'join_policy')::public.organization_join_policy, 'approval'))
  returning * into v_org;
  insert into public.organization_memberships(organization_id, user_id, role, status)
    values (v_org.id, v_user, 'owner', 'active');
  return v_org;
end;
$$;

create or replace function public.request_to_join_organization(p_organization_id uuid)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_org public.organizations%rowtype; v_membership public.organization_memberships%rowtype; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to join an organization.'; end if;
  select * into v_org from public.organizations where id = p_organization_id;
  if not found then raise exception 'Organization not found.'; end if;
  if v_org.join_policy = 'invite_only' then raise exception 'This organization requires an invitation.'; end if;
  insert into public.organization_memberships(organization_id, user_id, role, status)
    values (p_organization_id, v_user, 'member', 'pending')
    on conflict (organization_id, user_id) do update set status = 'pending', role = 'member'
    where public.organization_memberships.status in ('rejected', 'removed')
    returning * into v_membership;
  if v_membership.user_id is null then raise exception 'You already have a membership or pending request.'; end if;
  insert into public.notifications(user_id, type, message, data)
    select m.user_id, 'membership', 'A user requested to join your organization.',
      jsonb_build_object('organization_id', p_organization_id, 'user_id', v_user)
    from public.organization_memberships m where m.organization_id = p_organization_id
      and m.status = 'active' and m.role in ('owner','admin');
  return v_membership;
end;
$$;

create or replace function public.invite_user_to_organization(p_organization_id uuid, p_user_id uuid,
  p_role public.organization_role default 'member')
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_membership public.organization_memberships%rowtype;
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'Organization admin required.'; end if;
  if p_role = 'owner' then raise exception 'Use the ownership transfer workflow to assign an owner.'; end if;
  if not exists(select 1 from public.users u where u.id = p_user_id) then raise exception 'User not found.'; end if;
  insert into public.organization_memberships(organization_id, user_id, role, status, invited_by)
    values (p_organization_id, p_user_id, p_role, 'invited', auth.uid())
    on conflict (organization_id, user_id) do update set role = excluded.role,
      status = 'invited', invited_by = excluded.invited_by
    where public.organization_memberships.status in ('rejected', 'removed')
    returning * into v_membership;
  if v_membership.user_id is null then raise exception 'User already has an active or pending membership.'; end if;
  insert into public.notifications(user_id, type, message, data)
    values (p_user_id, 'membership_invite', 'You were invited to join an organization.',
      jsonb_build_object('organization_id', p_organization_id));
  return v_membership;
end;
$$;

create or replace function public.accept_organization_invite(p_organization_id uuid)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_membership public.organization_memberships%rowtype;
begin
  update public.organization_memberships set status = 'active'
    where organization_id = p_organization_id and user_id = auth.uid() and status = 'invited'
    returning * into v_membership;
  if v_membership.user_id is null then raise exception 'No pending invitation found.'; end if;
  return v_membership;
end;
$$;

create or replace function public.review_membership_request(p_organization_id uuid, p_user_id uuid, p_approve boolean)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_membership public.organization_memberships%rowtype;
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'Organization admin required.'; end if;
  update public.organization_memberships set status = case when p_approve then 'active'::public.membership_status else 'rejected'::public.membership_status end
    where organization_id = p_organization_id and user_id = p_user_id and status = 'pending'
    returning * into v_membership;
  if v_membership.user_id is null then raise exception 'No pending membership request found.'; end if;
  insert into public.notifications(user_id, type, message, data)
    values (p_user_id, 'membership', case when p_approve then 'Your organization request was approved.' else 'Your organization request was declined.' end,
      jsonb_build_object('organization_id', p_organization_id));
  return v_membership;
end;
$$;

create or replace function public.remove_organization_member(p_organization_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.organization_memberships%rowtype; v_owner_count integer;
begin
  select * into v_target from public.organization_memberships
    where organization_id = p_organization_id and user_id = p_user_id for update;
  if not found then raise exception 'Membership not found.'; end if;
  if auth.uid() <> p_user_id and not public.is_org_admin(p_organization_id) then raise exception 'Organization admin required.'; end if;
  if v_target.role = 'owner' then
    select count(*) into v_owner_count from public.organization_memberships
      where organization_id = p_organization_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then raise exception 'Transfer ownership before removing the last owner.'; end if;
  end if;
  update public.organization_memberships set status = 'removed'
    where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;

create or replace function public.set_organization_member_role(p_organization_id uuid,p_user_id uuid,p_role public.organization_role)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_row public.organization_memberships%rowtype;
begin
  if not exists (select 1 from public.organization_memberships m where m.organization_id=p_organization_id
    and m.user_id=auth.uid() and m.status='active' and m.role='owner') then
    raise exception 'Only an organization owner can change admin roles.';
  end if;
  if p_role='owner' then raise exception 'Transfer ownership using an ownership transfer workflow.'; end if;
  if exists (select 1 from public.organization_memberships m where m.organization_id=p_organization_id
    and m.user_id=p_user_id and m.role='owner' and m.status='active') and
    (select count(*) from public.organization_memberships m where m.organization_id=p_organization_id
      and m.role='owner' and m.status='active') <= 1 then
    raise exception 'An organization must keep at least one active owner.';
  end if;
  update public.organization_memberships set role=p_role where organization_id=p_organization_id
    and user_id=p_user_id and status='active' returning * into v_row;
  if v_row.user_id is null then raise exception 'Active membership not found.'; end if;
  return v_row;
end;
$$;

create or replace function public.set_organization_verified(p_organization_id uuid,p_verified boolean)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare v_row public.organizations%rowtype;
begin
  if not public.is_platform_admin() then raise exception 'Platform administrator required.'; end if;
  update public.organizations set verified=p_verified where id=p_organization_id returning * into v_row;
  if v_row.id is null then raise exception 'Organization not found.'; end if;
  return v_row;
end;
$$;

create or replace function public.complete_user_onboarding(p_data jsonb)
returns public.users language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_row public.users%rowtype;
begin
  if v_user is null then raise exception 'Sign in to complete onboarding.'; end if;
  if coalesce((p_data->>'terms_accepted')::boolean, false) is not true then raise exception 'Accept the terms to continue.'; end if;
  if nullif(p_data->>'date_of_birth','') is not null
    and (p_data->>'date_of_birth')::date > current_date then raise exception 'Date of birth cannot be in the future.'; end if;
  select * into v_row from public.users where id = v_user for update;
  if not found then raise exception 'User profile not found.'; end if;
  if v_row.onboarded then raise exception 'Onboarding is already complete.'; end if;
  update public.users set first_name = coalesce(p_data->>'first_name', first_name),
    last_name = coalesce(p_data->>'last_name', last_name),
    full_name = coalesce(nullif(trim(concat_ws(' ', p_data->>'first_name', p_data->>'last_name')), ''), full_name),
    headline = p_data->>'headline', bio = p_data->>'bio', city = p_data->>'city',
    state = coalesce(p_data->>'state','IN'), timezone = coalesce(p_data->>'timezone','America/Indiana/Indianapolis'), phone = p_data->>'phone',
    date_of_birth = nullif(p_data->>'date_of_birth','')::date,
    availability = coalesce(p_data->'availability','{}'::jsonb),
    interests = coalesce(array(select jsonb_array_elements_text(p_data->'interests')), '{}'),
    skills = coalesce(array(select jsonb_array_elements_text(p_data->'skills')), '{}'),
    terms_accepted_at = now(), onboarded = true
    where id = v_user returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.get_user_profile_for_organization(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_is_public boolean; v_has_org_registration boolean; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view this profile.'; end if;
  select coalesce(u.public_profile,false) into v_is_public from public.users u where u.id=p_user_id;
  if v_is_public is null then raise exception 'User not found.'; end if;
  select exists (select 1 from public.registrations r join public.opportunities o on o.id=r.opportunity_id
    where r.user_id=p_user_id and o.organization_id in (select m.organization_id from public.organization_memberships m
      where m.user_id=auth.uid() and m.status='active') and r.status in ('pending','approved')) into v_has_org_registration;
  if not v_is_public and not v_has_org_registration then raise exception 'This profile is private.'; end if;
  select jsonb_build_object('id',u.id,'full_name',u.full_name,'headline',u.headline,'bio',u.bio,
    'city',u.city,'state',u.state,'avatar_path',u.avatar_path,
    'phone',case when v_has_org_registration then u.phone else null end,
    'availability',case when v_has_org_registration then u.availability else null end,
    'show_hours',u.show_hours,'show_history',u.show_history,
    'verified_hours',case when u.show_hours then (select coalesce(sum(r.hours),0) from public.registrations r
      where r.user_id=u.id and r.hours_verified) else null end,
    'history',case when u.show_history then (select coalesce(jsonb_agg(jsonb_build_object('opportunity_id',r.opportunity_id,
      'status',r.status,'hours',case when r.hours_verified then r.hours else null end)), '[]'::jsonb)
      from public.registrations r where r.user_id=u.id) else null end)
    into v_result from public.users u where u.id=p_user_id;
  if v_result is null then raise exception 'User not found.'; end if;
  return v_result;
end;
$$;

create or replace function public.volunteer_dashboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('total_registrations', count(*),
    'pending_registrations', count(*) filter(where r.status='pending'),
    'upcoming_count', count(*) filter(where r.status='approved' and o.starts_at>now()),
    'completed_count', count(*) filter(where r.attended),
    'verified_hours', coalesce(sum(r.hours) filter(where r.hours_verified),0))
  from public.registrations r join public.opportunities o on o.id=r.opportunity_id
  where r.user_id=auth.uid();
$$;
create or replace function public.org_overview(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_org_member(p_organization_id) then raise exception 'Organization membership required.'; end if;
  return (select jsonb_build_object('opportunities',count(distinct o.id),
    'active_opportunities',count(distinct o.id) filter(where o.status='published' and o.event_date>=current_date),
    'registrations',count(r.id),'hours_to_verify',count(r.id) filter(where r.attended and not r.hours_verified),
    'verified_hours',coalesce(sum(r.hours) filter(where r.hours_verified),0),
    'unique_volunteers',count(distinct r.user_id))
    from public.opportunities o left join public.registrations r on r.opportunity_id=o.id
    where o.organization_id=p_organization_id);
end;
$$;

create or replace function public.org_analytics(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_overview jsonb; v_categories jsonb; v_monthly jsonb;
begin
  if not public.is_org_member(p_organization_id) then raise exception 'Organization membership required.'; end if;
  v_overview := public.org_overview(p_organization_id);
  select coalesce(jsonb_agg(jsonb_build_object('category',q.category,'registrations',q.total) order by q.total desc),'[]'::jsonb)
    into v_categories from (select o.category,count(r.id) as total from public.opportunities o
      left join public.registrations r on r.opportunity_id=o.id where o.organization_id=p_organization_id
      group by o.category) q;
  select coalesce(jsonb_agg(jsonb_build_object('month',m.month_start,'verified_hours',coalesce(h.total,0)) order by m.month_start),'[]'::jsonb)
    into v_monthly from generate_series(date_trunc('month',now()) - interval '5 months',date_trunc('month',now()),interval '1 month') m(month_start)
    left join lateral (select sum(r.hours) as total from public.registrations r join public.opportunities o on o.id=r.opportunity_id
      where o.organization_id=p_organization_id and r.hours_verified and date_trunc('month',r.verified_at)=m.month_start) h on true;
  return jsonb_build_object('overview',v_overview,'registrations_by_category',v_categories,'monthly_verified_hours',v_monthly);
end;
$$;

create or replace function public.org_volunteers(p_organization_id uuid,p_q text default null,p_sort text default 'recent')
returns table(user_id uuid,full_name text,avatar_path text,verified_hours numeric,registration_count bigint,last_event_date date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_org_member(p_organization_id) then raise exception 'Organization membership required.'; end if;
  return query select u.id,u.full_name,u.avatar_path,coalesce(sum(r.hours) filter(where r.hours_verified),0),
    count(r.id),max(o.event_date)
  from public.registrations r join public.opportunities o on o.id=r.opportunity_id
  join public.users u on u.id=r.user_id
  where o.organization_id=p_organization_id and r.status='approved' and r.attended
    and (p_q is null or u.full_name ilike '%'||p_q||'%')
  group by u.id,u.full_name,u.avatar_path
  order by case when p_sort='hours' then coalesce(sum(r.hours) filter(where r.hours_verified),0) end desc,
    case when p_sort='name' then u.full_name end asc,
    case when p_sort not in ('hours','name') then max(o.event_date) end desc;
end;
$$;

create or replace function public.register_for_opportunity(p_opportunity_id uuid, p_message text default null)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_opp public.opportunities%rowtype; v_row public.registrations%rowtype; v_count integer;
begin
  if v_user is null then raise exception 'Sign in to register.'; end if;
  if not exists(select 1 from public.users u where u.id=v_user and u.onboarded) then raise exception 'Complete onboarding first.'; end if;
  select * into v_opp from public.opportunities where id=p_opportunity_id for update;
  if not found or v_opp.status <> 'published' then raise exception 'Opportunity is not open for registration.'; end if;
  if v_opp.starts_at <= now() or (v_opp.registration_deadline is not null and v_opp.registration_deadline < current_date) then
    raise exception 'Registration is closed.';
  end if;
  if v_opp.min_age is not null and not exists (select 1 from public.users u where u.id=v_user
    and u.date_of_birth is not null and u.date_of_birth <= (current_date - (v_opp.min_age * interval '1 year'))::date) then
    raise exception 'You do not meet the minimum age for this opportunity.';
  end if;
  select count(*) into v_count from public.registrations r where r.opportunity_id=p_opportunity_id and r.status in ('pending','approved');
  if v_count >= v_opp.spots then raise exception 'SPOTS_FULL'; end if;
  select * into v_row from public.registrations where opportunity_id=p_opportunity_id and user_id=v_user for update;
  if found then
    if v_row.status <> 'cancelled' then raise exception 'Registration already exists or is closed.'; end if;
    update public.registrations set status='pending', attended=false, hours_verified=false, hours=null, verified_at=null, cancelled_at=null
      where id=v_row.id returning * into v_row;
  else
    insert into public.registrations(opportunity_id,user_id,message,status) values(p_opportunity_id,v_user,p_message,'pending') returning * into v_row;
  end if;
  insert into public.notifications(user_id,type,message,data)
    select m.user_id,'registration','A user registered for an opportunity.',jsonb_build_object('registration_id',v_row.id,'opportunity_id',p_opportunity_id)
    from public.organization_memberships m where m.organization_id=v_opp.organization_id and m.status='active' and m.role in ('owner','admin');
  return v_row;
end;
$$;

create or replace function public.cancel_registration(p_registration_id uuid)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_row public.registrations%rowtype;
begin
  select * into v_row from public.registrations where id=p_registration_id for update;
  if not found or auth.uid() is null or v_row.user_id <> auth.uid() then raise exception 'Registration not found.'; end if;
  if v_row.status not in ('pending','approved') then raise exception 'Registration cannot be cancelled.'; end if;
  update public.registrations set status='cancelled',attended=false,hours_verified=false,hours=null,verified_at=null,cancelled_at=now()
    where id=p_registration_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.set_registration_status(p_registration_id uuid,p_status public.registration_status)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_row public.registrations%rowtype; v_org uuid; v_count integer; v_opp public.opportunities%rowtype;
begin
  if p_status not in ('approved','declined','removed') then raise exception 'Invalid status transition.'; end if;
  select * into v_row from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  select * into v_opp from public.opportunities where id=v_row.opportunity_id for update;
  v_org := v_opp.organization_id;
  if not public.is_org_admin(v_org) then raise exception 'Organization admin required.'; end if;
  if p_status='approved' and v_row.status in ('pending','declined') then
    select count(*) into v_count from public.registrations r where r.opportunity_id=v_opp.id
      and r.status in ('pending','approved') and r.id<>p_registration_id;
    if v_count >= v_opp.spots then raise exception 'SPOTS_FULL'; end if;
  elsif not (p_status='declined' and v_row.status='pending') and not (p_status='removed' and v_row.status in ('pending','approved')) then
    raise exception 'Invalid status transition.';
  end if;
  update public.registrations set status=p_status,
    attended=false,
    hours_verified=false,hours=null,verified_at=null
    where id=p_registration_id returning * into v_row;
  insert into public.notifications(user_id,type,message,data)
    values(v_row.user_id,'registration','Your registration status changed.',jsonb_build_object('registration_id',p_registration_id,'status',p_status));
  return v_row;
end;
$$;

create or replace function public.set_attended(p_registration_id uuid,p_attended boolean)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_row public.registrations%rowtype; v_opp public.opportunities%rowtype;
begin
  select * into v_row from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  select * into v_opp from public.opportunities where id=v_row.opportunity_id;
  if not public.is_org_admin(v_opp.organization_id) then raise exception 'Organization admin required.'; end if;
  if v_row.status<>'approved' then raise exception 'Only approved registrations can be marked attended.'; end if;
  if p_attended and v_opp.event_date>current_date then raise exception 'Attendance can only be recorded on or after the event date.'; end if;
  update public.registrations set attended=p_attended,
    hours_verified=case when p_attended then hours_verified else false end,
    verified_at=case when p_attended then verified_at else null end
    where id=p_registration_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.verify_hours(p_registration_id uuid,p_hours numeric)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_row public.registrations%rowtype; v_opp public.opportunities%rowtype;
begin
  if p_hours<0.5 or p_hours>24 then raise exception 'Hours must be between 0.5 and 24.'; end if;
  select * into v_row from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  select * into v_opp from public.opportunities where id=v_row.opportunity_id;
  if not public.is_org_admin(v_opp.organization_id) then raise exception 'Organization admin required.'; end if;
  if not v_row.attended then raise exception 'Mark attendance first.'; end if;
  update public.registrations set hours=p_hours,hours_verified=true,verified_at=now()
    where id=p_registration_id returning * into v_row;
  insert into public.notifications(user_id,type,message,data)
    values(v_row.user_id,'hours','Your volunteer hours were verified.',jsonb_build_object('registration_id',p_registration_id,'hours',p_hours));
  return v_row;
end;
$$;

create or replace function public.unverify_hours(p_registration_id uuid)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_row public.registrations%rowtype; v_opp public.opportunities%rowtype;
begin
  select * into v_row from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  select * into v_opp from public.opportunities where id=v_row.opportunity_id;
  if not public.is_org_admin(v_opp.organization_id) then raise exception 'Organization admin required.'; end if;
  update public.registrations set hours_verified=false,verified_at=null where id=p_registration_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin update public.notifications set read_at=now() where id=p_notification_id and user_id=auth.uid(); end;
$$;
create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = '' as $$
begin update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null; end;
$$;

-- User/org updated_at maintenance and opportunity/follow notifications.
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings for each row execute function public.set_updated_at();

create or replace function public.notify_followers_on_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='published' and tg_op='INSERT' then
    insert into public.notifications(user_id,type,message,data)
    select f.user_id,'opportunity','An organization you follow published an opportunity.',jsonb_build_object('opportunity_id',new.id)
    from public.organization_follows f join public.user_settings s on s.user_id=f.user_id
    where f.organization_id=new.organization_id and s.new_opportunity_notifications;
  elsif new.status='published' and tg_op='UPDATE' and old.status is distinct from 'published' then
    insert into public.notifications(user_id,type,message,data)
    select f.user_id,'opportunity','An organization you follow published an opportunity.',jsonb_build_object('opportunity_id',new.id)
    from public.organization_follows f join public.user_settings s on s.user_id=f.user_id
    where f.organization_id=new.organization_id and s.new_opportunity_notifications;
  end if;
  return new;
end;
$$;
create trigger opportunities_notify_followers after insert or update of status on public.opportunities
  for each row execute function public.notify_followers_on_publish();

create or replace function public.notify_org_on_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id,type,message,data)
  select m.user_id,'follow','A user followed your organization.',jsonb_build_object('follower_id',new.user_id)
  from public.organization_memberships m
  where m.organization_id=new.organization_id and m.status='active' and m.role in ('owner','admin');
  return new;
end;
$$;
create trigger organization_follows_notify_org after insert on public.organization_follows
  for each row execute function public.notify_org_on_follow();

-- Private and security-definer functions are callable only by signed-in clients.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_organization(jsonb), public.request_to_join_organization(uuid),
  public.invite_user_to_organization(uuid,uuid,public.organization_role), public.accept_organization_invite(uuid),
  public.review_membership_request(uuid,uuid,boolean), public.remove_organization_member(uuid,uuid),
  public.set_organization_member_role(uuid,uuid,public.organization_role), public.set_organization_verified(uuid,boolean),
  public.complete_user_onboarding(jsonb), public.get_user_profile_for_organization(uuid),
  public.volunteer_dashboard(), public.org_overview(uuid), public.org_analytics(uuid),
  public.org_volunteers(uuid,text,text), public.register_for_opportunity(uuid,text),
  public.cancel_registration(uuid), public.set_registration_status(uuid,public.registration_status),
  public.set_attended(uuid,boolean), public.verify_hours(uuid,numeric), public.unverify_hours(uuid),
  public.mark_notification_read(uuid), public.mark_all_notifications_read() to authenticated;
