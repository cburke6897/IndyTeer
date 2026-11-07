# IndyTeer

Indiana's volunteer networking platform. Volunteers discover and register for opportunities and track hours; organizations post opportunities, manage registrations, and verify hours.

**Stack:** Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router · lucide-react · Supabase (Auth + Storage)

## Current status

| Area | Status |
| --- | --- |
| Authentication (signup, login, logout, session restore, password reset/change, email change) | **Real: Supabase Auth** |
| Profile photo upload | **Real: Supabase Storage** (`avatars` bucket) |
| Account type (volunteer / organization) | Saved in Supabase Auth `user_metadata` (routing only) |
| Profiles, opportunities, registrations, hours, follows, notifications, settings | **Mock data in browser localStorage** (`src/store`, seeded by `src/data/seed.ts`) |

There is no demo login any more: sessions come only from Supabase. Seeded organizations and opportunities are still visible to every account; new accounts start with an empty profile and onboard normally. The local mock store is keyed by the real Supabase user id and will be replaced by `src/lib/api/*` as the database schema lands (see `SUPABASE_CHANGES_NEEDED.txt`).

## Setup

1. In Supabase, create a project and copy its Project URL and **publishable** API key.
2. Copy `.env.example` to `.env.local` and fill in both values. Keep `.env.local` out of Git. A publishable key is meant for browser code; **never** put a `service_role` or secret key in any `VITE_` variable.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to your local origin (e.g. `http://localhost:5173`) and add `http://localhost:5173/**` to the redirect URL allow list (this also covers `/reset-password`). Add the deployed HTTPS origin before deploying.
4. In **Authentication → Sign In / Providers**, enable Email. Email confirmation may be on or off:
   - **On:** signup shows a "check your email" screen; the confirmation link signs the user in and continues to onboarding.
   - **Off:** signup signs in immediately and continues to onboarding.
5. Run `supabase/migrations/20261107000100_auth_media.sql` in the Supabase SQL Editor. It creates the public `avatars` bucket (5 MB limit, JPEG/PNG/WebP) and limits uploads and replacement to each user's own folder.
6. `npm install`, then `npm run dev`.

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # type-check + production build
npm run lint
npm test          # Vitest: auth service, AuthProvider, Supabase client config, avatar service
```

## How authentication works

- `src/auth/AuthProvider.tsx` is the **single session source** (Supabase session: restored on load, follows sign-in/out events, PKCE, token refresh).
- `src/auth/SessionBridge.tsx` mirrors the signed-in Supabase user into the local app store (`syncAuthUser` in `src/store/actions.ts`) so the UI can load that user's profile and data.
- `src/store/session.ts` (`useSession`) returns `{ user, volunteer, org, loading }`. The route guards in `src/components/layout/RouteGuards.tsx` wait for `loading`, then route by saved account type and onboarding state.
- Pages call `useAuth()` (`signIn`, `signUp`, `signOut`). `useLogout()` signs out and returns to the login screen. `src/auth/accountService.ts` holds account-type saving, password reset/change, email change, and resend-confirmation.
- "Remember me" off marks the session temporary: it is dropped the next time a browser session starts (`src/auth/rememberMe.ts`).
- Account type in `user_metadata` is user-editable, so it drives navigation only. Real authorization must come from database RLS.

## Avatars

`ImageUpload` takes an optional `upload` prop. `useAvatarUpload()` (`src/media`) uploads the chosen file to Storage at `avatars/<user id>/avatar` and returns the public URL, which is stored on the profile. Organization logos, cover images, and event images still use local previews (no bucket for them yet).

## Project structure

```
src/
  types.ts              Frontend domain types
  types/                Generated Supabase DB types
  auth/                 AuthProvider, session bridge, auth + account services, useAuth/useLogout
  media/                Avatar upload service and hook
  lib/supabase.ts       The one typed Supabase client
  lib/api/              Supabase data-access functions (not yet used by the UI)
  data/seed.ts          Seeded Indiana orgs, volunteers, opportunities (dates relative to today)
  store/                Local mock store (store.ts, actions.ts, selectors.ts), session hook, toasts
  components/           ui/ primitives · layout/ shell, guards · domain/ cards, tables, charts
  pages/                auth · onboarding · volunteer · org · shared
supabase/migrations/    Database and Storage migrations
docs/AUTH_MEDIA_INTEGRATION.md   Integration handoff notes
```

## Security notes

- The `avatars` bucket is public: anyone with an avatar URL can view it. Uploads and replacements require a signed-in user, and Storage RLS restricts each object to a path starting with that user's id. The bucket also enforces the size and MIME limits.
- A React route guard only controls what the browser shows. Authorization has to be enforced by RLS or database functions.
- Account deletion in Settings removes the user's local data and signs out. Deleting the Supabase Auth user itself needs a server-side (Edge Function) call with the service role and is not implemented yet.

## Design tokens

Defined in `src/index.css` (`@theme`): navy `#142C5B`, secondary blue `#244B85`, accent yellow `#F5C542`, light yellow `#FFF7DC`, background `#F7F8FA`, text `#202938` / `#687385`, borders `#E5E8ED`. Photos load from Unsplash with a graceful fallback.
