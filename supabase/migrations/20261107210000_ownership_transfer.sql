-- A member directory for organization admins.
--
-- Why: the account-deletion flow lets a sole owner hand an organization to another member
-- (transfer_organization_ownership, from 20261107173000_organization_ownership.sql). The owner has to
-- see who the eligible members are, but memberships only hold user ids and users rows are private.
--
-- SECURITY DEFINER, checks the caller is an admin of the organization first, and is callable only by
-- signed-in users. No table, column, policy, or existing function changes.

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

revoke execute on function public.list_organization_members(uuid) from public, anon;
grant execute on function public.list_organization_members(uuid) to authenticated;
