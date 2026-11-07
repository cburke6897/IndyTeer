# IndyTeer

Indiana's volunteer networking platform. Volunteers discover and register for opportunities and track hours; organizations post opportunities, manage registrations, and verify hours.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router · lucide-react · Supabase (Auth, Postgres, Storage)

## Current status

| Area | Status |
| --- | --- |
| Authentication: signup, login, logout, session restore, password reset/change, email change | **Real: Supabase Auth** |
| Account type (volunteer / organization), display name, avatar | **Real: `public.profiles`** (created by the signup trigger; account type chosen at signup) |
| Profile photo upload | **Real: Supabase Storage** (`avatars` bucket) + `profiles.avatar_url` |
| Onboarding details, organization profiles, opportunities, registrations, hours, follows, notifications, settings | **Mock data in browser localStorage** (`src/store`, seeded by `src/data/seed.ts`) |

There is no demo login: sessions come only from Supabase. Seeded organizations and opportunities are visible to every account; new accounts start with an empty profile and onboard normally. The mock store is keyed by the real Supabase user id and is replaced feature by feature by `src/lib/api/*` as the database schema lands (see `SUPABASE_CHANGES_NEEDED.txt`).

## Team contract

- Users choose **volunteer or organization during signup**. Signup metadata is `full_name` and `account_type`; the signup service rejects a missing or invalid type before making a request. There is no second account-type screen after signup.
- The backend teammate owns the schema, profile trigger, backfill, RLS, and Storage SQL. Auth and Media owns the signup and upload flows. Do not apply or change migrations independently as part of frontend setup.
- `profiles.id` equals the Auth user id. Account type, display name, and avatar come from `profiles`, **not** from editable Auth metadata.
- `uploadAvatar` validates the signed-in user, uploads to `avatars/<user id>/avatar`, then saves the URL through `updateProfile`, and only reports success after the profile update succeeds.

## Setup

1. In Supabase, create a project and copy its Project URL and browser-safe **publishable** key.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the variable name matches the backend; it holds the publishable key). `VITE_SUPABASE_PUBLISHABLE_KEY` still works as a fallback. Never put a secret or `service_role` key in any `VITE_` variable. `.env.local` is ignored by Git.
3. Confirm with the backend owner that the migrations in `supabase/migrations/` are applied: the signup trigger and existing-user backfill (`…auth_profile_trigger.sql`), the schema, and the `avatars` bucket policies (`…auth_media.sql`). The client never creates a missing profile row; a missing row shows an error screen.
4. In **Authentication → URL Configuration**, set the Site URL to your local origin (for example `http://localhost:5173` or `http://127.0.0.1:5173`) and allow `<origin>/**` as a redirect URL (this also covers `/reset-password`). Add the production HTTPS origin before deploying.
5. In **Authentication → Sign In / Providers**, enable Email. Email confirmation can be on or off:
   - **On (recommended):** signup shows a "check your email" screen; the link signs the user in and continues to onboarding.
   - **Off:** signup signs in immediately and continues to onboarding.
6. `npm install`, then `npm run dev`.

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # type-check + production build
npm run lint
npm test          # Vitest
```

Tests cover the signup/login service, `AuthProvider`, the Supabase client configuration, avatar validation and persistence, the profile sync into the local store, the route guards, and the signup page.

## How authentication works

- `src/auth/AuthProvider.tsx`: the single session source (restore on load, follow sign-in/out, PKCE, token refresh).
- `src/auth/ProfileProvider.tsx` + `useProfile`: loads `profiles` for the signed-in user once. `useProfileContext()` exposes `profile`, `loading`, `error`, `setProfile`, `retry`.
- `src/auth/SessionBridge.tsx`: once both are ready, mirrors the user into the local store (`syncAuthUser` in `src/store/actions.ts`). The profile is authoritative for account type and avatar.
- `src/store/session.ts` (`useSession`) returns `{ user, volunteer, org, loading, profileError, retryProfile }`. The guards in `src/components/layout/RouteGuards.tsx` wait for `loading`, show an error screen (with retry and log out) for `profileError`, and otherwise route by account type and onboarding state. A profile error is never treated as "signed out".
- Pages use `useAuth()` (`signIn`, `signUp`, `signOut`); `useLogout()` signs out and returns to the login screen. `src/auth/accountService.ts` holds password reset/change, email change, resend-confirmation, and saving the display name to `profiles.full_name`.
- "Remember me" off marks the session temporary: it is dropped the next time a browser session starts (`src/auth/rememberMe.ts`).
- Account type in Auth metadata is only input for the backend trigger. Real authorization must come from the saved profile and database RLS.

## Avatars

`ImageUpload` takes an optional `upload` prop. `useAvatarUpload()` (`src/media`) calls `uploadAvatar`, refreshes the cached profile from the saved row, and returns the public URL. The avatars bucket is public (anyone with an image URL can view it); Storage policies limit writes to the user's own folder, and the bucket restricts type (JPEG/PNG/WebP) and size (5 MB). Organization logos, cover images, and event images still use local previews.

## Project structure

```
src/
  types.ts              Frontend domain types
  types/                Generated Supabase DB types and model aliases
  auth/                 AuthProvider, ProfileProvider, session bridge, auth + account services
  media/                Avatar upload service and hook
  lib/supabase.ts       The one typed Supabase client
  lib/api/              Supabase data-access functions (profiles are in use; the rest are not wired to the UI yet)
  data/seed.ts          Seeded Indiana orgs, volunteers, opportunities (dates relative to today)
  store/                Local mock store (store.ts, actions.ts, selectors.ts), session hook, toasts
  components/           ui/ primitives · layout/ shell, guards · domain/ cards, tables, charts
  pages/                auth · onboarding · volunteer · org · shared
supabase/               config.toml, migrations, seed.sql
docs/AUTH_MEDIA_INTEGRATION.md   Auth/Media integration contract and status
```

## Security notes

- Signup metadata is input for the backend trigger, not a trusted source of authorization.
- A React route guard controls page display only; a separate API (if added) must verify the access token.
- Storage upload and profile update are separate operations. If the profile write fails after the file was replaced, the client reports failure rather than claiming success.
- Account deletion in Settings removes the user's local data and signs out. Deleting the Auth user itself needs a server-side (Edge Function) call with the service role and is not implemented yet.

## Design tokens

Defined in `src/index.css` (`@theme`): navy `#142C5B`, secondary blue `#244B85`, accent yellow `#F5C542`, light yellow `#FFF7DC`, background `#F7F8FA`, text `#202938` / `#687385`, borders `#E5E8ED`. Photos load from Unsplash with a graceful fallback.
