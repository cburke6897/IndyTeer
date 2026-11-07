-- Ownership may be transferred to another active organization member. Updating
-- created_by is required because it references users with ON DELETE CASCADE.
create or replace function public.transfer_organization_ownership(
  p_organization_id uuid,
  p_new_owner_id uuid
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target public.organization_memberships%rowtype;
  v_result public.organization_memberships%rowtype;
begin
  if v_actor is null then raise exception 'Sign in to transfer organization ownership.'; end if;
  if p_new_owner_id = v_actor then raise exception 'Choose another active organization member.'; end if;

  -- Serialize ownership changes for the organization.
  perform 1 from public.organizations o where o.id = p_organization_id for update;
  if not found then raise exception 'Organization not found.'; end if;

  perform 1 from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = v_actor
      and m.role = 'owner' and m.status = 'active'
    for update;
  if not found then raise exception 'Only an active organization owner can transfer ownership.'; end if;

  select * into v_target from public.organization_memberships m
    where m.organization_id = p_organization_id and m.user_id = p_new_owner_id
      and m.status = 'active' and m.role in ('admin', 'member')
    for update;
  if not found then raise exception 'The new owner must be an active admin or member of this organization.'; end if;

  update public.organization_memberships set role = 'admin', updated_at = now()
    where organization_id = p_organization_id and user_id = v_actor;
  update public.organization_memberships set role = 'owner', updated_at = now()
    where organization_id = p_organization_id and user_id = p_new_owner_id
    returning * into v_result;
  update public.organizations set created_by = p_new_owner_id, updated_at = now()
    where id = p_organization_id;

  insert into public.notifications(user_id, type, message, data)
    values (p_new_owner_id, 'ownership', 'You are now an owner of this organization.',
      jsonb_build_object('organization_id', p_organization_id, 'previous_owner_id', v_actor));
  return v_result;
end;
$$;

revoke execute on function public.transfer_organization_ownership(uuid,uuid) from public, anon;
grant execute on function public.transfer_organization_ownership(uuid,uuid) to authenticated;
