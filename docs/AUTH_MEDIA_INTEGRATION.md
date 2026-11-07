# Auth and Media integration contract

## Ownership

The backend teammate owns the Supabase schema, signup trigger, existing-user backfill, RLS, and Storage SQL migrations. Auth and Media owns the signup and upload flows. This change does not apply or alter schema/Storage migrations.

## Shared configuration

The feature branch includes main's typed backend data access layer. Use one createClient<Database> instance with PKCE, persistent sessions, token refresh, and auth callback detection.

Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Put the current browser-safe publishable key in ANON_KEY. The previous VITE_SUPABASE_PUBLISHABLE_KEY is accepted as a fallback; ANON_KEY wins if both are present. .env.local must stay out of Git.

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

The full frontend (App routes, layouts, Logo, theme) is the foundation; the standalone `AuthPage`, `HomePage`, `ProfilePage`, `AvatarUploader`, `RequireAuth`, and `App.css` demo screens were removed.

Done:

- `AuthProvider` wraps all routes, with `ProfileProvider` + `SessionBridge` inside it. Supabase Auth is the only source of "who is signed in"; the mock `login`, `signup`, `logout`, `loginDemo`, `chooseAccountType` actions and demo credentials are gone.
- Signup (`src/pages/auth/SignupPage.tsx`) requires an explicit account type and calls `signUp(email, password, fullName, accountType, extraMetadata?)`. The optional fifth argument adds `first_name`, `last_name`, and `terms_accepted_at` to the signup metadata; `full_name` and `account_type` always win. There is no account-type chooser after signup.
- `useSession()` combines the Auth session and the database profile. Role routing uses `profiles.account_type`. A profile-load failure shows an error screen (retry / log out) and is never treated as signed out.
- Avatar uploads use `uploadAvatar` through `ImageUpload`'s `upload` prop and refresh the cached profile from the saved row. The local volunteer avatar is synced from `profiles.avatar_url`.
- Display-name edits (onboarding, profile form, Settings) are written to `profiles.full_name`.
- Password reset, password change (re-checks the current password), email change, resend-confirmation, and "remember me" are real.

Still mock (local store only): onboarding details, volunteer and organization profile fields, opportunities, registrations, hours, follows, notifications, and settings. The `profiles` table has no `onboarded` flag, so onboarding completion is tracked locally: on a new device a signed-in user with a database profile but no local profile is sent through onboarding again.

Open items for the backend owner: an `onboarded`/profile-completion contract, mapping UI registration statuses and opportunity fields to the database model, and an Edge Function to delete Auth users.
