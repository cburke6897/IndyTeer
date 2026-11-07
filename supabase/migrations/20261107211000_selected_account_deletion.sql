-- Match main's per-organization confirmation without dropping deletion locks.
create function public.prepare_selected_account_deletion(p_delete_organization_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_org public.organizations%rowtype; v_ids uuid[]:='{}'; v_successor uuid;
begin
 if v_user is null then raise exception 'Sign in to delete your account.'; end if;
 if p_delete_organization_ids is null then raise exception 'Explicit deletion choices are required.'; end if;
 update public.users set deletion_pending=true where id=v_user;
 if not found then raise exception 'User profile not found.'; end if;
 for v_org in select o.* from public.organizations o where o.created_by=v_user or exists(
   select 1 from public.organization_memberships m where m.organization_id=o.id and m.user_id=v_user and m.role='owner' and m.status='active')
   order by o.id for update loop
  select user_id into v_successor from public.organization_memberships
   where organization_id=v_org.id and user_id<>v_user and role='owner' and status='active' order by user_id limit 1;
  if v_successor is not null then
   if v_org.created_by=v_user then update public.organizations set created_by=v_successor where id=v_org.id; end if;
  else
   if not v_org.id=any(p_delete_organization_ids) then
    raise exception 'Transfer ownership or explicitly select each owned organization for deletion.';
   end if;
   update public.organizations set deleting=true where id=v_org.id;
   v_ids:=array_append(v_ids,v_org.id);
  end if;
 end loop;
 return jsonb_build_object('organization_ids',v_ids);
end;
$$;
revoke all on function public.prepare_selected_account_deletion(uuid[]) from public,anon;
grant execute on function public.prepare_selected_account_deletion(uuid[]) to authenticated;
