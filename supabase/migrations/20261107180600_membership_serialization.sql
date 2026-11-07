-- Serialize organization membership decisions before locking individual memberships.


create or replace function public.request_to_join_organization(p_organization_id uuid)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_org public.organizations%rowtype; v_membership public.organization_memberships%rowtype; v_user uuid := auth.uid();
begin
  perform 1 from public.organizations where id=p_organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
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
  perform 1 from public.organizations where id=p_organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
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
  perform 1 from public.organizations where id=p_organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
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
  perform 1 from public.organizations where id=p_organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
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

create or replace function public.set_organization_member_role(p_organization_id uuid,p_user_id uuid,p_role public.organization_role)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_row public.organization_memberships%rowtype;
begin
  perform 1 from public.organizations where id=p_organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
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

create or replace function public.remove_organization_member(p_organization_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.organization_memberships%rowtype; v_owner_count integer;
begin
  perform 1 from public.organizations where id=p_organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
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
