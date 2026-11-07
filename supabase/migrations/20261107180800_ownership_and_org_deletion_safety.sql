-- Preserve the main branch's ownership RPC signature and membership return type.
create or replace function public.transfer_organization_ownership(p_organization_id uuid,p_new_owner_id uuid)
returns public.organization_memberships language plpgsql security definer set search_path='' as $$
declare v_result public.organization_memberships%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in to transfer ownership.'; end if;
 -- Take user locks before the organization lock, matching account deletion preparation.
 perform 1 from public.users where id in(auth.uid(),p_new_owner_id) order by id for update;
 if exists(select 1 from public.users where id in(auth.uid(),p_new_owner_id) and deletion_pending)
 then raise exception 'An account deletion is in progress.'; end if;
 perform 1 from public.organizations where id=p_organization_id and not deleting for update;
 if not found then raise exception 'Organization is being deleted or does not exist.'; end if;
 if not exists(select 1 from public.organization_memberships where organization_id=p_organization_id
   and user_id=auth.uid() and role='owner' and status='active') then raise exception 'Only an owner can transfer ownership.'; end if;
 if p_new_owner_id=auth.uid() or not exists(select 1 from public.organization_memberships
   where organization_id=p_organization_id and user_id=p_new_owner_id and status='active' and role in('member','admin'))
 then raise exception 'Choose another active member or admin.'; end if;
 update public.organization_memberships set role='admin' where organization_id=p_organization_id and user_id=auth.uid();
 update public.organization_memberships set role='owner' where organization_id=p_organization_id and user_id=p_new_owner_id returning * into v_result;
 update public.organizations set created_by=p_new_owner_id where id=p_organization_id;
 insert into public.notifications(user_id,type,message,data) values(p_new_owner_id,'ownership',
  'You are now an owner of this organization.',jsonb_build_object('organization_id',p_organization_id,'previous_owner_id',auth.uid()));
 return v_result;
end;
$$;

create or replace function public.prepare_organization_deletion(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to delete an organization.'; end if;
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Organization not found.'; end if;
 if not exists(select 1 from public.organization_memberships where organization_id=p_organization_id
   and user_id=auth.uid() and role='owner' and status='active') then raise exception 'Only an owner can delete this organization.'; end if;
 update public.organizations set deleting=true where id=p_organization_id;
 return jsonb_build_object('organization_id',p_organization_id);
end;
$$;
revoke all on function public.prepare_organization_deletion(uuid) from public,anon;
grant execute on function public.prepare_organization_deletion(uuid) to authenticated;

create or replace function public.cancel_organization_deletion(p_organization_id uuid)
returns void language sql security definer set search_path='' as $$
 update public.organizations set deleting=false where id=p_organization_id;
$$;
revoke all on function public.cancel_organization_deletion(uuid) from public,anon,authenticated;
grant execute on function public.cancel_organization_deletion(uuid) to service_role;

create or replace function public.protect_organization_content()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.organization_id is not null then
  perform 1 from public.organizations where id=new.organization_id and not deleting for update;
  if not found then raise exception 'Organization is being deleted.'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.protect_organization_content() from public,anon,authenticated;
create trigger posts_protect_deletion before insert or update on public.posts for each row execute function public.protect_organization_content();
create trigger opportunities_protect_deletion before insert or update on public.opportunities for each row execute function public.protect_organization_content();

create or replace function public.media_organization_active(p_bucket text,p_path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_first text:=split_part(p_path,'/',1);v_org uuid;
begin
 if p_bucket='avatars' then return true; end if;
 if v_first !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
 if p_bucket='opportunity-images' then
  select organization_id into v_org from public.opportunities where id=v_first::uuid;
 elsif p_bucket in('org-logos','org-covers','post-images') then v_org:=v_first::uuid;
 else return false;
 end if;
 return exists(select 1 from public.organizations where id=v_org and not deleting);
end;
$$;
revoke all on function public.media_organization_active(text,text) from public,anon;
grant execute on function public.media_organization_active(text,text) to authenticated;
create policy "Organization deletion blocks media writes" on storage.objects as restrictive for all to authenticated
 using(public.media_organization_active(bucket_id,name)) with check(public.media_organization_active(bucket_id,name));
