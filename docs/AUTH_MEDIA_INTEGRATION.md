# Auth and Media integration contract

> **Superseded in part. There is no account type any more: everyone is a standard user, and organization access comes from memberships.** Treat any mention below of choosing volunteer or organization as historical.
>
> (Earlier note.) The `profiles` / `account_type` model described in the early sections below was replaced by the `public.users` + organization-membership schema (migrations `20261107165500` onward). Signup no longer sends `account_type`; see "Frontend integration status" at the end for the current contract.

## Ownership

The backend teammate owns the Supabase schema, signup trigger, existing-user backfill, RLS, and Storage SQL migrations. Auth and Media owns the signup and upload flows. This change does not apply or alter schema/Storage migrations.

## Shared configuration

The feature branch includes main's typed backend data access layer. Use one createClient<Database> instance with PKCE, persistent sessions, token refresh, and auth callback detection.

Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY with the project's browser-safe publishable key. .env.local must stay out of Git.

## Signup contract

The signup screen requires explicit account-type selection. The service signature is:

```tsx
const { signUp } = useAuth()
const result = await signUp(email, password, fullName, accountType)
// accountType must be 'volunteer' or 'organization'.
```

The exact Auth signup metadata is:

```json
{
  "full_name": "Kai Volunteer",
  "account_type": "volunteer"
}
```

The service validates account_type and a nonempty full_name before calling Supabase. The backend trigger validates those fields and creates profiles.id = auth.users.id. No client INSERT fallback is used. Users with no session yet receive email-confirmation feedback rather than proceeding as authenticated users.

The frontend's existing signup action currently creates a mock local user. Replace that call with await signUp(...), including the selected account type. Do not keep a second account-type chooser after signup. Other onboarding details may still be collected after authentication according to the backend's completion contract.

## Session and profile contract

Wrap the existing frontend routes in AuthProvider once. useAuth supplies user, session, loading, signIn, signUp, and signOut. Replace mock localStorage sessionUserId with the actual Supabase session as the source of authentication.

Load getProfile(user.id), or use useProfile(user?.id), after a real session is available. Display names and avatars must come from profiles.full_name and profiles.avatar_url. Read account_type from the saved profile for role routing, not from editable Auth metadata.

The standalone ProfilePage now reads this database profile. useProfile returns profile, loading, error, and setProfile. Its setProfile updates the local cache after a successful upload; it does not write the database. A missing profile displays an error and blocks uploads, so trigger/backfill issues are visible rather than hidden by a metadata fallback.

Adapt the frontend's existing useSession and guards to this real session/profile pair. Wait for loading to finish and handle profile errors separately from being signed out. The complete frontend layout and routes remain the integration foundation.

## Avatar contract

```tsx
const { profile: savedProfile } = await uploadAvatar(file, user.id)
setProfile(savedProfile)
```

uploadAvatar takes the original File and the Auth user ID. It validates the signed-in user against that ID, uploads to the avatars bucket under <Auth user ID>/avatar, and calls the backend updateProfile({ avatar_url }) method. That method scopes the database update to the authenticated user's profile ID. The returned profile contains the saved avatar_url; update the frontend profile cache from that row.

The helper already persists profiles.avatar_url. Callers should not perform a duplicate profile update. Auth avatar metadata is no longer written or used for display. The returned object also includes path and publicUrl for callers that need them.

The current ImageUpload component returns a local data URL. Change the avatar picker to pass the original File or add a File callback. The helper supports JPEG, PNG, and WebP up to 5 MiB. Cover photos, post images, and opportunity images need separate object names and backend-owned policies; do not reuse the single-avatar path for them.

Storage and profile writes are not one transaction. A profile-write failure is surfaced as an upload-flow failure even though the Storage object may already have been replaced. A retry uses the same own-user path.

## Remaining integration work

Resolve full-frontend layout and routing conflicts using its App routes, design tokens, layout components, and Logo. Keep the Tailwind plugin plus the Vitest setup. Combine dependencies in package.json and regenerate the lockfile.

Keep generated database models for requests and adapt display models where names differ. UI approved maps to database accepted for applications; cancelled/removed workflows need backend agreement. UI draft/published is not equivalent to database open/closed.

The backend teammate deploys and versions the trigger/backfill/Storage policies. Existing Storage SQL was applied manually earlier in development; backend ownership includes reconciling migration history. Existing Auth users may need backfill before this database-profile flow can work for them.

Run npm test, npm run build, and npm run lint. Then test real signup for both account types, profile creation with matching Auth UUID, avatar persistence after refresh, logout, session restoration, and rejected cross-user writes against the backend-managed project.

## Frontend integration status

Current (users + organizations schema):

- `AuthProvider` wraps all routes, with `ProfileProvider` + `SessionBridge` inside it. Supabase Auth is the only source of "who is signed in"; the mock `login`, `signup`, `logout`, `loginDemo` actions and demo credentials are gone.
- Signup (`src/pages/auth/SignupPage.tsx`) calls `signUp(email, password, fullName, extraMetadata?)`. Metadata is `full_name` plus optional `first_name`, `last_name`, `terms_accepted_at`; **no `account_type`**. The trigger creates the `public.users` row from `full_name` / `avatar_url`.
- After signup everyone goes through the same single onboarding page (`/onboarding`, `complete_user_onboarding`) and lands in the standard app (`/app`). Any onboarded user can later create an organization (`/create-organization`, `create_organization` RPC); the database makes them its owner. `/org/*` is available to users with an active owner/admin membership; the sidebar switcher chooses between several organizations.
- `useSession()` combines the Auth session, the `users` row, and the user's memberships. A row-load failure shows an error screen (retry / log out) and is never treated as signed out.
- Avatar uploads use `uploadAvatar` (2 MiB limit) and save `avatar_url` + `avatar_path` on `users`.
- Display-name edits are written to `users` (`first_name`, `last_name`, `full_name`).
- Password reset, password change, email change, resend-confirmation, and "remember me" are real.
- Delete account is real (Edge Function); see `docs/ACCOUNT_DELETION_AND_OWNERSHIP.md`.

The data layer is real as well: opportunities, registrations, attendance and verified hours, manual hours, follows, saves, posts, notifications, settings, organization profiles and images all read and write Supabase (see the README "Data flow"). The app ships with no sample data.

Known gaps against the database model: the organization membership UI (join requests, invites, roles, ownership transfer), a `join_policy` choice, post images, platform-admin verification, and volunteers' interests/skills are not exposed to organizations by `get_user_profile_for_organization`. Registrations that are declined, removed or cancelled show the volunteer as "Volunteer" to the organization, because that function only shares profiles with pending/approved registrations or public profiles. Replacing an image uploads a new file and leaves the old one in Storage.
