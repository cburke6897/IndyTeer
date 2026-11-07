# Auth & Media integration — complete-app branch

This branch implements frontend/backend independently, using the latest `users`/organizations handoff. It supersedes the former `profiles.account_type` design. Shared rollout is explicitly authorized; consult STABILIZATION.md for the verified result.

## Identity and profile

`src/auth/authService.ts`: `signUpWithEmail(email, password, fullName)` sends `options.data = { full_name: fullName.trim() }`, without `account_type`.

`AuthProvider` restores persisted sessions and follows auth events; a late initial read cannot overwrite newer state. The shared Supabase client enables PKCE, refresh, and URL session detection. Confirmation/recovery links should open in the requesting browser.

`ProtectedWorkspace` waits for Auth, then mounts `AccountProvider` keyed by Auth ID. It loads `users`, memberships, and organization projections. Onboarding completion is persisted in Postgres. Account/query changes hide stale data and ignore late requests.

`ProfilePage` saves details through `src/lib/api/users.ts`; display `users.full_name`, not editable Auth metadata. Privacy lives in `users`; notification preferences live in `user_settings`.

## Media

```ts
const { path, url } = await uploadAvatar(file)
// users.avatar_path and users.avatar_url are already persisted.
// Refresh AccountProvider; do not issue a duplicate profile write.
```

`src/lib/api/storage.ts` verifies Auth, validates size/type, creates unique paths, and compensates failed DB writes. Old owned files are removed only after saving their replacements. Storage policies enforce folder/role scopes. A private background queue handles deferred cleanup; editable references cannot authorize deletion outside the relevant owner's folder.

Images in these buckets are public. Private profile fields are served through restricted `users` access and `get_user_profile_for_organization`.

## Routes

- Public: `/`, `/signup`, `/login`, `/forgot-password`, `/reset-password`.
- Personal: `/onboarding`, `/app`, `/app/explore`, `/app/events`, `/app/hours`, `/app/profile`, `/app/settings`, `/app/feed`, `/app/notifications`.
- Organization discovery: `/app/organizations`, `/app/organizations/new`, `/app/organizations/:id`.
- Workspace: `/manage/:id` plus opportunities/registrations/members/volunteers/analytics/posts/settings.
- `/people/:id` uses the privacy RPC; `/admin` requires platform-admin status.

Membership changes, registration/capacity, attendance, hour verification, ownership, verification, and deletion preparation run through SQL RPCs. Normal edits use RLS and column grants. Do not replace sensitive RPCs with unrestricted table updates.

## Account deletion

Settings previews owned organizations, blocks shared ownership until transfer, and requires typed `DELETE` plus per-organization confirmation. It invokes `delete-account` with `{ deleteOwnedOrganizations: boolean }` and reports success only after `{ deleted: true }`.

The function verifies Auth and prepares a deletion plan. Shared owned organizations block deletion until ownership is transferred. It removes Auth-owned Storage objects (including orphans), solely owned organization media/data, and then the Auth user. Transferred organizations are retained. Server keys stay server-side.

Storage/Auth/DB changes are not one distributed transaction: an interruption may leave partial media cleanup and require retry. Normal new memberships, organization creation, and uploads are fenced during deletion. Failed attempts release flags; hard terminations may require the service-only cancellation RPC in the deployment guide.

## Future team integration

Connected screens in `src/application` replace the prototype's pages and mock store. Other branches can continue independently. Agree on the database deployment/version before integrating. Keep signup metadata, `users` fields, membership roles, and RPC signatures aligned. Reuse the tested Auth provider and API helpers. Do not merge both old and new signup triggers or restore `profiles.account_type`. Review ordered migrations before applying them to an existing dataset.

The ownership RPC returns `organization_memberships`, matching main. Organization deletion is a separate owner-only flow requiring the exact organization name and acknowledgement; it leaves member Auth accounts intact.
