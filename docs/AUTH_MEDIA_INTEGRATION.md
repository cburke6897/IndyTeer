# Auth & Media integration on main

Main's pages, route guards, ProfileProvider, SessionBridge and in-memory Supabase cache remain the active frontend. The alternate src/application screens are retained as source modules for later integration; their /manage routes are not mounted by main.

## Signup and sessions

Signup always sends full_name. Optional first_name, last_name, terms_accepted_at and avatar_url are allowed; authorization metadata such as account_type and role is excluded. Users complete the same onboarding, then create or join organizations. Organization access comes from active memberships.

AuthProvider restores and refreshes sessions using the shared PKCE client. ProfileProvider loads public.users and memberships. SessionBridge hydrates permitted business rows from Supabase. Route guards wait for that state. The display name and avatar come from users.full_name and users.avatar_url, with the Auth user ID as users.id.

## Media

Main's profile-photo picker uses src/media/avatarService.ts. Shared API uploads validate JPEG/PNG/WebP and a 2 MiB size limit, use unique owner-scoped paths, persist row references before reporting success, and compensate failed writes. uploadOrganizationImage returns {path,url}; main's cache action returns image.url to its picker. Opportunity uploads likewise persist the database reference.

Paths are avatars/<auth-id>/..., org logos/covers/posts <org-id>/<uploader-id>/..., opportunity images <opportunity-id>/<uploader-id>/.... Buckets are public; private identity/contact data is protected by RLS and RPCs. Deferred cleanup skips currently referenced images.

## Account deletion contract

Main calls delete-account with {deleteOrganizationIds: string[]}. The array lists each organization explicitly chosen for deletion. An organization with another active owner survives; sole ownership requires transfer or explicit deletion. The current modal preserves main's individual choices and ownership-transfer UI.

The handler verifies Auth, calls prepare_selected_account_deletion, fences concurrent writes, inventories all Auth-owned Storage objects, preserves active retained-organization images under service ownership, deletes chosen organizations and finally deletes Auth. A failure is reported as incomplete and releases deletion flags when possible. Storage/DB/Auth do not form one distributed transaction.

Legacy {deleteOwnedOrganizations:boolean} requests remain supported with their stricter shared-member rejection. New clients should use main's ID list. Ownership transfer returns organization_memberships. list_organization_members provides authorized member display names.

## Configuration and verification

Only VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY belong in frontend configuration. All service/secret keys and CRON_SECRET stay server-side. See DEPLOYMENT.md and STABILIZATION.md for hosted rollout and test boundaries.
