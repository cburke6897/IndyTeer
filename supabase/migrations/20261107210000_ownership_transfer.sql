-- Ownership transfer and a member directory for organization admins.
--
-- Why: the account-deletion flow must let a sole owner hand an organization to another member instead
-- of deleting it, but the schema had no way to do that (set_organization_member_role and
-- invite_user_to_organization both reject the 'owner' role). The owner also needs to see who the
-- eligible members are; memberships only hold user ids and users rows are private.
--
-- Both functions are SECURITY DEFINER, check the caller's own membership first, and are callable only
-- by signed-in users. No table, column, policy, or existing function changes.

create or replace function public.transfer_organization_ownership(p_organization_id uuid, p_new_owner uuid)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_row public.organization_memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to transfer ownership.'; end if;
  -- Lock the caller's own membership so two concurrent transfers cannot both succeed.
  perform 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active'
    for update;
  if not found then raise exception 'Only an organization owner can transfer ownership.'; end if;
  if p_new_owner = auth.uid() then raise exception 'Choose a different member.'; end if;

  update public.organization_memberships set role = 'owner'
    where organization_id = p_organization_id and user_id = p_new_owner and status = 'active'
    returning * into v_row;
  if v_row.user_id is null then raise exception 'The new owner must be an active member of the organization.'; end if;

  -- A transfer, not a share: the previous owner becomes an admin, and the creator pointer follows.
  update public.organization_memberships set role = 'admin'
    where organization_id = p_organization_id and user_id = auth.uid();
  update public.organizations set created_by = p_new_owner where id = p_organization_id and created_by = auth.uid();

  insert into public.notifications(user_id, type, message, data)
    values (p_new_owner, 'membership', 'You are now an owner of an organization.',
      jsonb_build_object('organization_id', p_organization_id));
  return v_row;
end;
$$;

-- Names for the people in an organization, for its admins only (the users table is private).
create or replace function public.list_organization_members(p_organization_id uuid)
returns table(user_id uuid, full_name text, avatar_path text, role public.organization_role, status public.membership_status)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_org_admin(p_organization_id) then raise exception 'Organization admin required.'; end if;
  return query
    select m.user_id, u.full_name, u.avatar_path, m.role, m.status
    from public.organization_memberships m join public.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and m.status in ('active', 'pending', 'invited')
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, u.full_name;
end;
$$;

revoke execute on function public.transfer_organization_ownership(uuid, uuid), public.list_organization_members(uuid) from public, anon;
grant execute on function public.transfer_organization_ownership(uuid, uuid), public.list_organization_members(uuid) to authenticated;
