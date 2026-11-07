# IndyTeer

Indiana's volunteer networking platform. Volunteers discover and register for opportunities and track hours; organizations post opportunities, manage registrations, and verify hours.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router · lucide-react · Supabase (Auth, Postgres, Storage)

## Current status

| Area | Status |
| --- | --- |
| Authentication: signup, login, logout, session restore, password reset/change, email change | **Real: Supabase Auth** |
| User profile (name, avatar, onboarding details), onboarding completion | **Real: `public.users`** (row created by the signup trigger; `complete_user_onboarding` RPC) |
| Organization creation and ownership | **Real: `create_organization` RPC** (creates the organization and an active `owner` membership) |
| Profile photo upload | **Real: Supabase Storage** (`avatars` bucket) + `users.avatar_url` / `avatar_path` |
| Delete account | **Real: `delete-account` Edge Function** (see [docs/ACCOUNT_DELETION_AND_OWNERSHIP.md](docs/ACCOUNT_DELETION_AND_OWNERSHIP.md)) |
| Opportunities, registrations, hours, follows, notifications, settings, organization profile content, posts | **Mock data in browser localStorage** (`src/store`, seeded by `src/data/seed.ts`); `src/lib/api/*` is ready but not wired to the UI yet |

There is no demo login: sessions come only from Supabase. Seeded organizations and opportunities are visible to every account. The mock store is keyed by the real Supabase user id and is replaced feature by feature by `src/lib/api/*`.

## Team contract

- The database has **no account type**. A user is a `public.users` row; organization access comes from `organization_memberships` (roles `owner` / `admin` / `member`, statuses `invited` / `pending` / `active` / `rejected` / `removed`). Signup **never** sends `account_type` (or any authorization data); the signup trigger reads only `full_name` / `avatar_url`.
- After signup the person chooses **volunteer or organization** on `/onboarding/account-type`. That choice only selects the setup flow (it is stored locally). Volunteers finish with `complete_user_onboarding`; organizations run `complete_user_onboarding` and then `create_organization`, which makes the caller the owner. Once the user row is onboarded and they own an organization, the type is derived from the membership on any browser.
- The backend teammate owns the schema, trigger, backfill, RLS, RPCs, Storage SQL, and Edge Functions. Frontend setup must not apply or edit migrations independently.
- `users.id` equals the Auth user id. Name and avatar come from `users`, **not** from editable Auth metadata.
- `uploadAvatar` validates the signed-in user, uploads to `avatars/<user id>/avatar` (2 MiB limit, matching the bucket), then saves `avatar_url` + `avatar_path` through `updateUser`, and only reports success after the row update succeeds.
- Private data and privileged actions stay behind RLS and RPCs: the client has no direct write access to registrations, memberships, verification flags, or `verified`. Do not work around this from the client.

## Setup

1. In Supabase, create a project and copy its Project URL and browser-safe **publishable** key.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put a secret or `service_role` key in any `VITE_` variable. `.env` and `.env.local` are ignored by Git.
3. Confirm with the backend owner that every migration in `supabase/migrations/` is applied **and that the `delete-account` function is deployed from this repo's current `supabase/functions/delete-account/index.ts`** (the repo version adds a CORS header the browser needs and refuses to delete shared organizations). The client never creates a missing `users` row; a missing row shows an error screen.
4. In **Authentication → URL Configuration**, set the Site URL to your local origin (for example `http://localhost:5173` or `http://127.0.0.1:5173`) and allow `<origin>/**` as a redirect URL (this also covers `/reset-password`). Add the production HTTPS origin before deploying.
5. In **Authentication → Sign In / Providers**, enable Email. Email confirmation can be on or off:
   - **On (recommended):** signup shows a "check your email" screen; the link signs the user in and continues to the account-type step.
   - **Off:** signup signs in immediately and continues to the account-type step.
6. `npm install`, then `npm run dev`.

### Verifying the backend locally (Docker)

```bash
npx supabase start          # applies every migration to a throwaway local stack
npx supabase gen types typescript > src/types/database.ts   # after any schema change
npx supabase functions serve                                  # serve Edge Functions locally
npx supabase stop
```

`supabase/seed.sql` intentionally aborts until its `<..._ID>` placeholders are replaced with real Auth user ids, so `supabase start` / `db reset` fail at the seed step unless `[db.seed] enabled` is temporarily set to `false` in `supabase/config.toml`.

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # type-check + production build
npm run lint
npm test          # Vitest
```

Tests cover the signup/login service, `AuthProvider`, the Supabase client configuration, avatar validation and persistence, onboarding (RPC order, idempotency), the profile sync into the local store, the route guards, the signup page, the account deletion service, and the delete-account modal.

## How authentication works

- `src/auth/AuthProvider.tsx`: the single session source (restore on load, follow sign-in/out, PKCE, token refresh).
- `src/auth/ProfileProvider.tsx` + `useProfile`: loads the user's `users` row and their own memberships once. `useProfileContext()` exposes `profile`, `memberships`, `loading`, `error`, `setProfile`, `retry`.
- `src/auth/SessionBridge.tsx`: once both are ready, mirrors the user into the local store (`syncAuthUser` in `src/store/actions.ts`). The database `onboarded` flag is authoritative: a row that is not onboarded is never treated as onboarded locally.
- `src/auth/onboardingService.ts`: `complete_user_onboarding` and `create_organization`, each skipped when already done, so retries and a second browser cannot create duplicates.
- `src/store/session.ts` (`useSession`) returns `{ user, volunteer, org, loading, profileError, retryProfile }`. The guards in `src/components/layout/RouteGuards.tsx` wait for `loading`, show an error screen (with retry and log out) for `profileError`, and otherwise route by onboarding state. A profile error is never treated as "signed out".
- Pages use `useAuth()` (`signIn`, `signUp`, `signOut`); `useLogout()` signs out and returns to the login screen. `src/auth/accountService.ts` holds password reset/change, email change, resend-confirmation, and saving the display name to `users`.
- "Remember me" off marks the session temporary: it is dropped the next time a browser session starts (`src/auth/rememberMe.ts`).
- Real authorization comes from the database (RLS, memberships, RPCs). Auth metadata and the local account-type choice are never trusted.

## Delete account

Settings → Account → **Delete account** opens a confirmation modal (`src/components/domain/DeleteAccountModal.tsx`) backed by `src/account/deleteAccountService.ts`. It lists the consequences, requires typing `DELETE`, and for an organization you solely own requires an explicit per-organization confirmation. An organization with **other active members blocks deletion**: ownership transfer does not exist in the database yet. Success is reported only when the Edge Function returns `{ deleted: true }`; any other outcome is shown as a failure, with a clear message when it may have been partial. Details and the proposed ownership-transfer migration: [docs/ACCOUNT_DELETION_AND_OWNERSHIP.md](docs/ACCOUNT_DELETION_AND_OWNERSHIP.md).

## Avatars

`ImageUpload` takes an optional `upload` prop. `useAvatarUpload()` (`src/media`) calls `uploadAvatar`, refreshes the cached user row from the saved row, and returns the public URL. The avatars bucket is public (anyone with an image URL can view it); Storage policies limit writes to the user's own folder, and the bucket restricts type (JPEG/PNG/WebP) and size (2 MiB). Organization logos, cover images, and event images still use local previews.

## Project structure

```
src/
  types.ts              Frontend domain types
  types/                Generated Supabase DB types and model aliases
  auth/                 AuthProvider, ProfileProvider, session bridge, auth, account, onboarding services
  account/              Account deletion service
  media/                Avatar upload service and hook
  lib/supabase.ts       The one typed Supabase client
  lib/api/              Supabase data-access functions (`users`, memberships, organization creation are in use; the rest are not wired to the UI yet)
  data/seed.ts          Seeded Indiana orgs, volunteers, opportunities (dates relative to today)
  store/                Local mock store (store.ts, actions.ts, selectors.ts), session hook, toasts
  components/           ui/ primitives · layout/ shell, guards · domain/ cards, tables, charts
  pages/                auth · onboarding · volunteer · org · shared
supabase/               config.toml, migrations, seed.sql, functions/delete-account
docs/AUTH_MEDIA_INTEGRATION.md   Auth/Media integration contract and status
```

## Security notes

- Signup metadata is input for the backend trigger, not a trusted source of authorization. Signup never sends an account type.
- A React route guard controls page display only; the database (RLS and RPCs) is the real boundary.
- Storage upload and row update are separate operations. If the row write fails after the file was replaced, the client reports failure rather than claiming success.
- Account deletion goes through the `delete-account` Edge Function with the user's own session. The function re-verifies the token, refuses to delete an organization that has other active members, and requires an explicit `deleteOwnedOrganizations` flag before deleting any owned organization.

## Design tokens

Defined in `src/index.css` (`@theme`): navy `#142C5B`, secondary blue `#244B85`, accent yellow `#F5C542`, light yellow `#FFF7DC`, background `#F7F8FA`, text `#202938` / `#687385`, borders `#E5E8ED`. Photos load from Unsplash with a graceful fallback.
