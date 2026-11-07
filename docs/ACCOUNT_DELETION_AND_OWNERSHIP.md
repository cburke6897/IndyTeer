# Account deletion and organization ownership

## How deletion works

`supabase/functions/delete-account/index.ts` (service role, `verify_jwt = true`) runs in this order:

1. Verify the caller's token (`auth.getUser`).
2. Work out which organizations would be deleted: every organization with `created_by = caller` plus every organization where the caller is an **active owner**.
3. **Safety checks (added in this repo, see "Deployment status")**:
   - another **active** member in any of those organizations -> `409 ORGANIZATION_HAS_MEMBERS`, nothing is removed;
   - owned organizations but no `deleteOwnedOrganizations: true` in the body -> `409 ORGANIZATION_DELETION_NOT_CONFIRMED`, nothing is removed.
4. Remove Storage objects (`avatars/<uid>`, `org-logos`, `org-covers`, `post-images`, `opportunity-images`, scoped to the user or the deleted organization).
5. Delete the owned organizations (cascades opportunities, registrations, posts, memberships).
6. Delete the Auth user (cascades `public.users` and everything keyed to it).

Steps 4-6 are not one transaction. A failure after step 4 can leave files or organizations removed while the account still exists. The function returns `500`; the UI says so ("may already have been removed ... try again") and never reports success unless `{ deleted: true }` comes back.

## Verified behavior (local Supabase stack, all migrations applied)

| Case | Original function | Function in this repo |
| --- | --- | --- |
| Plain user with an uploaded avatar | deleted, avatar object removed | same |
| Sole owner, flag not sent | deleted the organization silently | `409 ORGANIZATION_DELETION_NOT_CONFIRMED`, nothing removed |
| Sole owner, `deleteOwnedOrganizations: true` | deleted | deleted |
| Owner of an organization with another active member | **deleted the organization and removed the other member's access, no warning** | `409 ORGANIZATION_HAS_MEMBERS`, nothing removed (with or without the flag) |
| Browser CORS preflight with `x-client-info` | header not allowed (browser blocks the call) | allowed |

## Why ownership cannot be transferred today

- `set_organization_member_role` and `invite_user_to_organization` both reject `owner`; their messages point to an "ownership transfer workflow" that does not exist.
- `organizations.created_by` is `not null ... on delete cascade`. Even a second owner would not save the organization, because deleting the creator's `users` row cascades to it.

The UI therefore blocks deletion for an organization with other active members and tells the owner to remove the other members (supported by `remove_organization_member`) or contact the team. It does not try to bypass RLS.

## Proposed migration (not applied; needs backend-owner review)

Purpose: let an owner hand an organization to an eligible active member, and stop the creator's account deletion from cascading to organizations that have another owner.

```sql
-- 1. The creator may be deleted while the organization lives on under another owner.
alter table public.organizations alter column created_by drop not null;
alter table public.organizations drop constraint organizations_created_by_fkey;
alter table public.organizations add constraint organizations_created_by_fkey
  foreign key (created_by) references public.users(id) on delete set null;

-- 2. Ownership transfer: the caller must be an active owner; the target an active member.
create or replace function public.transfer_organization_ownership(p_organization_id uuid, p_new_owner uuid)
returns public.organization_memberships language plpgsql security definer set search_path = '' as $$
declare v_row public.organization_memberships%rowtype;
begin
  if not exists (select 1 from public.organization_memberships m where m.organization_id = p_organization_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active') then
    raise exception 'Only an organization owner can transfer ownership.';
  end if;
  if p_new_owner = auth.uid() then raise exception 'Choose a different member.'; end if;
  update public.organization_memberships set role = 'owner'
    where organization_id = p_organization_id and user_id = p_new_owner and status = 'active'
    returning * into v_row;
  if v_row.user_id is null then raise exception 'The new owner must be an active member.'; end if;
  update public.organizations set created_by = p_new_owner where id = p_organization_id and created_by = auth.uid();
  insert into public.notifications(user_id, type, message, data)
    values (p_new_owner, 'membership', 'You are now an owner of an organization.',
      jsonb_build_object('organization_id', p_organization_id));
  return v_row;
end;
$$;
revoke execute on function public.transfer_organization_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;
```

If adopted, also update the Edge Function so `organizationsToDelete` ignores organizations that still have another **active owner**, and add a "Transfer ownership" choice to the delete modal. Regenerate `src/types/database.ts` afterwards.

## Deployment status

- Code is in the repo. **Nothing was deployed or pushed** from this change: the project is not linked to the Supabase CLI (`supabase/.temp` is absent) and no access token was used.
- The function currently deployed on the remote project is the **original** version. Until the repo version is deployed (`npx supabase functions deploy delete-account`), the safety checks above are **not active on the server**, and a browser call fails the CORS preflight. The UI's pre-check (blocks shared organizations, requires explicit confirmation) is the only safeguard in that window, and a direct API call can still delete a shared organization.
