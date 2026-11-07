-- Normalize nullable legacy city values before making the new contract explicit.
update public.opportunities set city='' where city is null;
alter table public.opportunities alter column city set default '', alter column city set not null;

create or replace function public.validate_opportunity_write()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.hours is not null and new.hours not between 0.5 and 24 then raise exception 'Hours must be between 0.5 and 24.'; end if;
 if tg_op='UPDATE' and new.spots<old.spots and new.spots<(select count(*) from public.registrations where opportunity_id=new.id and status in ('pending','approved'))
 then raise exception 'Capacity cannot be lower than existing active registrations.'; end if;
 if new.status='published' then
  if length(trim(new.title))<3 or length(trim(new.description))<20 or length(trim(new.city))<1
     or length(trim(new.location))<1 or length(trim(new.category))<1 then raise exception 'Complete the title, description, cause, city, and venue before publishing.'; end if;
  if tg_op='INSERT' then
   if new.event_date<(now() at time zone new.timezone)::date then raise exception 'New events must be today or later.'; end if;
  elsif old.status='draft' and new.event_date<(now() at time zone new.timezone)::date then raise exception 'New events must be today or later.';
  end if;
 end if;
 return new;
end;
$$;
create trigger opportunities_validate_write before insert or update on public.opportunities for each row execute function public.validate_opportunity_write();
revoke all on function public.validate_opportunity_write() from public,anon,authenticated;

create or replace function public.normalize_user_name()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
  new.full_name:=trim(concat_ws(' ',nullif(trim(new.first_name),''),nullif(trim(new.last_name),'')));
 elsif new.full_name is distinct from old.full_name then
  new.full_name:=trim(new.full_name);
  new.first_name:=split_part(new.full_name,' ',1);
  new.last_name:=trim(substr(new.full_name,length(new.first_name)+1));
 end if;
 if new.onboarded and length(trim(new.full_name))<1 then raise exception 'A full name is required.'; end if;
 return new;
end;
$$;
create trigger users_normalize_name before update of first_name,last_name,full_name on public.users for each row execute function public.normalize_user_name();
revoke all on function public.normalize_user_name() from public,anon,authenticated;

alter table public.users add column deletion_pending boolean not null default false;
alter table public.organizations add column deleting boolean not null default false;

-- Membership changes lock the organization row, the same lock held by deletion preparation.
create or replace function public.protect_organization_membership()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_deleting boolean;
begin
 select deleting into v_deleting from public.organizations where id=new.organization_id for update;
 if v_deleting is null or v_deleting then raise exception 'Organization is being deleted.'; end if;
 return new;
end;
$$;
create trigger memberships_protect_deletion before insert or update of role,status on public.organization_memberships
 for each row execute function public.protect_organization_membership();
revoke all on function public.protect_organization_membership() from public,anon,authenticated;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
  where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin') and not o.deleting)
$$;

create or replace function public.prepare_account_deletion(p_delete_owned boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_org public.organizations%rowtype; v_ids uuid[]:='{}';
begin
 if v_user is null then raise exception 'Sign in to delete your account.'; end if;
 update public.users set deletion_pending=true where id=v_user;
 if not found then raise exception 'User profile not found.'; end if;
 for v_org in select o.* from public.organizations o where o.created_by=v_user or exists(
   select 1 from public.organization_memberships m where m.organization_id=o.id and m.user_id=v_user and m.role='owner' and m.status='active')
   order by o.id for update loop
  if exists(select 1 from public.organization_memberships where organization_id=v_org.id and user_id<>v_user and status='active')
   then raise exception 'Transfer ownership of shared organizations before deleting your account.'; end if;
  if not p_delete_owned then raise exception 'Confirm deletion of owned organizations before deleting your account.'; end if;
  update public.organizations set deleting=true where id=v_org.id;
  v_ids:=array_append(v_ids,v_org.id);
 end loop;
 return jsonb_build_object('organization_ids',v_ids);
end;
$$;
revoke all on function public.prepare_account_deletion(boolean) from public,anon;
grant execute on function public.prepare_account_deletion(boolean) to authenticated;

create or replace function public.cancel_account_deletion(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.organizations o set deleting=false where o.created_by=p_user_id or exists(
  select 1 from public.organization_memberships m where m.organization_id=o.id and m.user_id=p_user_id and m.role='owner' and m.status='active');
 update public.users set deletion_pending=false where id=p_user_id;
end;
$$;
revoke all on function public.cancel_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.cancel_account_deletion(uuid) to service_role;

create or replace function public.prevent_new_org_during_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.users where id=new.created_by and not deletion_pending for update;
 if not found then raise exception 'Account deletion is in progress.'; end if;
 return new;
end;
$$;
create trigger organizations_protect_creator before insert on public.organizations
 for each row execute function public.prevent_new_org_during_deletion();
revoke all on function public.prevent_new_org_during_deletion() from public,anon,authenticated;
