-- Let users opt out of future organization invitations and explicitly decline
-- invitations they already have. Existing invitations are left untouched.
alter table public.user_settings
  add column opt_out_organization_invites boolean not null default false;

grant update (opt_out_organization_invites) on public.user_settings to authenticated;

create or replace function public.invite_user_to_organization(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role default 'member'
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.organization_memberships%rowtype;
  v_opt_out boolean;
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Organization admin required.';
  end if;
  if p_role = 'owner' then
    raise exception 'Use the ownership transfer workflow to assign an owner.';
  end if;
  if not exists (select 1 from public.users u where u.id = p_user_id) then
    raise exception 'User not found.';
  end if;
  select s.opt_out_organization_invites into v_opt_out
    from public.user_settings s where s.user_id = p_user_id for update;
  if coalesce(v_opt_out, false) then
    raise exception 'This user has opted out of organization invitations.';
  end if;

  insert into public.organization_memberships(organization_id, user_id, role, status, invited_by)
  values (p_organization_id, p_user_id, p_role, 'invited', auth.uid())
  on conflict (organization_id, user_id) do update
    set role = excluded.role, status = 'invited', invited_by = excluded.invited_by
    where public.organization_memberships.status in ('rejected', 'removed')
  returning * into v_membership;
  if v_membership.user_id is null then
    raise exception 'User already has an active or pending membership.';
  end if;

  insert into public.notifications(user_id, type, message, data)
  values (p_user_id, 'membership_invite', 'You were invited to join an organization.',
    jsonb_build_object('organization_id', p_organization_id));
  return v_membership;
end;
$$;

create or replace function public.decline_organization_invite(p_organization_id uuid)
returns public.organization_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.organization_memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to decline an invitation.'; end if;
  update public.organization_memberships
    set status = 'rejected', updated_at = now()
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and status = 'invited'
  returning * into v_membership;
  if v_membership.user_id is null then raise exception 'No pending invitation found.'; end if;
  return v_membership;
end;
$$;

revoke execute on function public.decline_organization_invite(uuid) from public, anon;
grant execute on function public.decline_organization_invite(uuid) to authenticated;
