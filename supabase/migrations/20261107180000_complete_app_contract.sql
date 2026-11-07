-- Complete-app branch validation, transactional behavior, and organization ownership.

create or replace function public.complete_user_onboarding(p_data jsonb)
returns public.users language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_row public.users%rowtype;
begin
  if v_user is null then raise exception 'Sign in to complete onboarding.'; end if;
  if p_data ? 'first_name' and length(trim(coalesce(p_data->>'first_name',''))) < 1 then raise exception 'Enter your first name.'; end if;
  if p_data ? 'bio' and length(trim(coalesce(p_data->>'bio',''))) not between 20 and 400 then raise exception 'Biography must be 20 to 400 characters.'; end if;
  if nullif(trim(p_data->>'city'),'') is null then raise exception 'Choose your city.'; end if;
  if p_data ? 'interests' and (jsonb_typeof(p_data->'interests') is distinct from 'array' or jsonb_array_length(p_data->'interests') < 1) then raise exception 'Choose at least one interest.'; end if;
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

create or replace function public.create_organization(p_data jsonb)
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_org public.organizations%rowtype;
begin
  if v_user is null then raise exception 'Sign in to create an organization.'; end if;
  if not exists (select 1 from public.users u where u.id = v_user and u.onboarded) then
    raise exception 'Complete your user profile first.';
  end if;
  if length(trim(coalesce(p_data->>'name',''))) < 3 then raise exception 'Organization name must be at least 3 characters.'; end if;
  if length(trim(coalesce(p_data->>'description',''))) < 30 then raise exception 'Organization description must be at least 30 characters.'; end if;
  if length(trim(coalesce(p_data->>'mission',''))) < 10 then raise exception 'Organization mission must be at least 10 characters.'; end if;
  if jsonb_typeof(p_data->'focus') is distinct from 'array' or jsonb_array_length(p_data->'focus') < 1 then raise exception 'Choose at least one focus area.'; end if;
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

create or replace function public.register_for_opportunity(p_opportunity_id uuid, p_message text default null)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_opp public.opportunities%rowtype; v_row public.registrations%rowtype; v_count integer;
begin
  if v_user is null then raise exception 'Sign in to register.'; end if;
  if not exists(select 1 from public.users u where u.id=v_user and u.onboarded) then raise exception 'Complete onboarding first.'; end if;
  select * into v_opp from public.opportunities where id=p_opportunity_id for update;
  if not found or v_opp.status <> 'published' then raise exception 'Opportunity is not open for registration.'; end if;
  if v_opp.starts_at <= now() or (v_opp.registration_deadline is not null and v_opp.registration_deadline < (now() at time zone v_opp.timezone)::date) then
    raise exception 'Registration is closed.';
  end if;
  if v_opp.min_age is not null and exists(select 1 from public.users where id=v_user and date_of_birth is null) then raise exception 'Add your date of birth in My profile before registering for an age-limited event.'; end if;
  if v_opp.min_age is not null and not exists (select 1 from public.users u where u.id=v_user
    and u.date_of_birth is not null and u.date_of_birth <= (v_opp.event_date - (v_opp.min_age * interval '1 year'))::date) then
    raise exception 'You do not meet the minimum age for this opportunity.';
  end if;
  select count(*) into v_count from public.registrations r where r.opportunity_id=p_opportunity_id and r.status in ('pending','approved');
  if v_count >= v_opp.spots then raise exception 'SPOTS_FULL'; end if;
  select * into v_row from public.registrations where opportunity_id=p_opportunity_id and user_id=v_user for update;
  if found then
    if v_row.status <> 'cancelled' then raise exception 'Registration already exists or is closed.'; end if;
    update public.registrations set status='pending', attended=false, hours_verified=false, hours=v_opp.hours, verified_at=null, cancelled_at=null
      where id=v_row.id returning * into v_row;
  else
    insert into public.registrations(opportunity_id,user_id,message,status,hours) values(p_opportunity_id,v_user,p_message,'pending',v_opp.hours) returning * into v_row;
  end if;
  insert into public.notifications(user_id,type,message,data)
    select m.user_id,'registration','A user registered for an opportunity.',jsonb_build_object('registration_id',v_row.id,'opportunity_id',p_opportunity_id)
    from public.organization_memberships m where m.organization_id=v_opp.organization_id and m.status='active' and m.role in ('owner','admin');
  return v_row;
end;
$$;

create or replace function public.set_registration_status(p_registration_id uuid,p_status public.registration_status)
returns public.registrations language plpgsql security definer set search_path = '' as $$
declare v_row public.registrations%rowtype; v_org uuid; v_count integer; v_opp public.opportunities%rowtype;
begin
  if p_status not in ('approved','declined','removed') then raise exception 'Invalid status transition.'; end if;
  select * into v_row from public.registrations where id=p_registration_id;
  if not found then raise exception 'Registration not found.'; end if;
  select * into v_opp from public.opportunities where id=v_row.opportunity_id for update;
  select * into v_row from public.registrations where id=p_registration_id for update;
  if not found then raise exception 'Registration not found.'; end if;
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
    hours_verified=false,hours=case when p_status='approved' then v_opp.hours else null end,verified_at=null
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
  if p_attended and v_opp.event_date>(now() at time zone v_opp.timezone)::date then raise exception 'Attendance can only be recorded on or after the event date.'; end if;
  update public.registrations set attended=p_attended,
    hours_verified=case when p_attended then hours_verified else false end,
    verified_at=case when p_attended then verified_at else null end
    where id=p_registration_id returning * into v_row;
  return v_row;
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
  if v_target.role = 'owner' and auth.uid() <> p_user_id and not exists (
    select 1 from public.organization_memberships where organization_id=p_organization_id and user_id=auth.uid() and role='owner' and status='active'
  ) then raise exception 'Only an owner can remove another owner.'; end if;
  if v_target.role = 'owner' then
    select count(*) into v_owner_count from public.organization_memberships
      where organization_id = p_organization_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then raise exception 'Transfer ownership before removing the last owner.'; end if;
  end if;
  update public.organization_memberships set status = 'removed'
    where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;
