# Account deletion and organization ownership

## What a user sees

Settings -> Account -> Delete account. The modal explains what is deleted and requires typing `DELETE`. For every organization the user **solely owns** (no other active owner) they must choose:

1. **Transfer ownership** to another active member (admin or member). The previous owner becomes an admin, `created_by` follows, the new owner is notified, and the organization and all its data stay.
2. **Delete the organization** and all of its opportunities, registrations, posts, and images. If other people are in it, the modal says how many are affected.

Organizations with another active owner live on without the user and need no decision. Organizations the user only belongs to just lose that member. If the server does not have the transfer functions yet, the modal says so and offers deletion only.

## What the server does

`supabase/functions/delete-account/index.ts` (service role, `verify_jwt = true`):

1. Verify the caller's token.
2. Find the organizations the account is responsible for (created by it, or active owner). For each: another active owner -> keep it (and point `created_by` at that owner so removing this user cannot cascade to it); otherwise it needs a decision.
3. If any needs a decision and its id is not in `deleteOrganizationIds` -> `409 ORGANIZATION_DECISION_REQUIRED`, nothing removed. Ids of organizations the caller is not responsible for are ignored.
4. Remove the user's avatar objects. For kept organizations, re-upload the departing user's logo/cover/post/opportunity images with the service role (same path and public URL, no longer owned by the user, because Auth refuses to delete a user who owns Storage objects). For deleted organizations, remove their images.
5. Delete the chosen organizations (cascades opportunities, registrations, posts, memberships).
6. Delete the Auth user (cascades `public.users` and everything keyed to it).

Steps 4-6 are not one transaction. A failure after step 4 can leave files or organizations changed while the account still exists. The function then returns `500`; the UI says so ("may already have been removed ... try again") and never reports success unless `{ deleted: true }` comes back. Ownership transfers done in the modal are separate calls made before the deletion: if the deletion then fails, the modal says which organizations were already handed over and the account still exists.

## Backend pieces

- Migration `supabase/migrations/20261107210000_ownership_transfer.sql` adds two `SECURITY DEFINER` functions, callable by signed-in users only; no table, column, policy, or existing function changes:
  - `transfer_organization_ownership(p_organization_id, p_new_owner)`: caller must be an active owner; the target must be an active member; promotes the target, demotes the caller to admin, updates `created_by`, notifies the new owner.
  - `list_organization_members(p_organization_id)`: names, roles, and statuses for an organization's admins (the `users` table is private, so memberships alone have only ids).
- `src/types/database.ts` was regenerated from the migrated local database.

## Verified on a local Supabase stack (all migrations applied)

| Case | Result |
| --- | --- |
| Plain user with an uploaded avatar | deleted, avatar object removed |
| Owner of a shared organization, no decision sent | `409`, nothing removed |
| Owner of two organizations: transfer one to an admin, delete the other (through the UI) | user gone; transferred organization survives owned by the admin with its opportunities, registrations, and the logo the old owner uploaded (still HTTP 200); the other organization is gone |
| Explicit `deleteOrganizationIds` | honored; ids of organizations the caller does not own cannot be smuggled in |
| `transfer_organization_ownership` called by a non-owner | refused |
| Browser CORS preflight with `x-client-info` | allowed |

## Deployment status

- Code and the migration are in the repo. **Nothing was deployed or pushed**: the project is not linked to the Supabase CLI (`supabase/.temp` is absent) and no access token was used.
- Until the migration is applied, the modal cannot list names or transfer, and offers deletion only. Until the function is deployed (`npx supabase functions deploy delete-account`), the remote function is the **old** version: no per-organization decision, no safe hand-over of images, and the browser CORS preflight fails. Apply the migration and deploy the function together.
