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
| Organizations, opportunities (drafts and published), registrations, attendance, verified hours, manual hours, follows, saved items, posts, notifications, notification and privacy settings | **Real: Supabase** (tables, RLS, and RPCs) |
| Organization logo and cover images, opportunity images | **Real: Supabase Storage** (`org-logos`, `org-covers`, `opportunity-images`) |

**There is no sample data.** The app starts empty: every organization, opportunity, volunteer, registration and hour in it was created by a real user. The client keeps only an in-memory cache of what the signed-in person is allowed to see (`src/store`); nothing is persisted in the browser, and an old prototype key in `localStorage` is removed on load. Organizations create data (organizations, opportunities, posts, approvals, attendance, verified hours); volunteers create data (profile, follows, saves, registrations, manual hours); each sees the other's through the database's access rules.

Not built yet: organization membership screens (join requests, invites, roles; ownership transfer exists only inside the delete-account flow), `join_policy` choice (new organizations default to `approval`), post images, and an admin screen for organization verification.

## Team contract

- **Everyone is a standard IndyTeer user.** The database has no account type. A user is a `public.users` row; signup and onboarding are the same for everyone, and signup **never** sends `account_type` (or any authorization data). The signup trigger reads only `full_name` / `avatar_url`.
- Users start as volunteers: discover and register for opportunities, save, follow, log hours. **Any onboarded user can create an organization later** from the dashboard callout, the sidebar, or the account menu (`/create-organization`, the existing organization form). `create_organization` (RPC) creates it and the database makes the caller an active `owner`; the client never writes membership or ownership fields.
- **Organization management is granted by membership, not by account type.** An active `owner` or `admin` membership opens `/org/*` for that organization. A plain `member`, or a pending/invited/removed membership, does not. A user can manage several organizations: the sidebar switcher (and account menu) chooses which one, and the choice is remembered per browser. Roles/statuses: `owner` / `admin` / `member`; `invited` / `pending` / `active` / `rejected` / `removed`.
- The backend teammate owns the schema, trigger, backfill, RLS, RPCs, Storage SQL, and Edge Functions. Frontend setup must not apply or edit migrations independently.
- `users.id` equals the Auth user id. Name and avatar come from `users`, **not** from editable Auth metadata.
- `uploadAvatar` validates the signed-in user, uploads to `avatars/<user id>/avatar` (2 MiB limit, matching the bucket), then saves `avatar_url` + `avatar_path` through `updateUser`, and only reports success after the row update succeeds.
- Private data and privileged actions stay behind RLS and RPCs: the client has no direct write access to registrations, memberships, verification flags, or `verified`. Do not work around this from the client.

## Setup

1. In Supabase, create a project and copy its Project URL and browser-safe **publishable** key.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the variable name matches the backend; it holds the publishable key). `VITE_SUPABASE_PUBLISHABLE_KEY` still works as a fallback. Never put a secret or `service_role` key in any `VITE_` variable. `.env` and `.env.local` are ignored by Git.
3. Confirm with the backend owner that every migration in `supabase/migrations/` is applied (including `20261107210000_ownership_transfer.sql`, needed to transfer ownership) **and that the `delete-account` function is deployed from this repo's current `supabase/functions/delete-account/index.ts`** (the repo version adds a CORS header the browser needs and refuses to delete shared organizations). The client never creates a missing `users` row; a missing row shows an error screen.
4. In **Authentication → URL Configuration**, set the Site URL to your local origin (for example `http://localhost:5173` or `http://127.0.0.1:5173`) and allow `<origin>/**` as a redirect URL (this also covers `/reset-password`). Add the production HTTPS origin before deploying.
5. In **Authentication → Sign In / Providers**, enable Email. Email confirmation can be on or off:
   - **On (recommended):** signup shows a "check your email" screen; the link signs the user in and continues to profile setup.
   - **Off:** signup signs in immediately and continues to profile setup.
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
- `src/auth/SessionBridge.tsx`: once both are ready, loads everything the person may see into the client cache (`hydrate` in `src/store/sync.ts`, queries in `src/data/remote.ts`). The database `onboarded` flag and the memberships decide the account type and routing (`deriveUser`).
- `src/auth/onboardingService.ts`: `complete_user_onboarding` and `create_organization`, each skipped when already done, so retries and a second browser cannot create duplicates.
- `src/store/session.ts` (`useSession`) returns `{ user, volunteer, org, loading, profileError, retryProfile }`. The guards in `src/components/layout/RouteGuards.tsx` wait for `loading`, show an error screen (with retry and log out) for `profileError`, and otherwise route by onboarding state. A profile error is never treated as "signed out".
- Pages use `useAuth()` (`signIn`, `signUp`, `signOut`); `useLogout()` signs out and returns to the login screen. `src/auth/accountService.ts` holds password reset/change, email change, resend-confirmation, and saving the display name to `users`.
- "Remember me" off marks the session temporary: it is dropped the next time a browser session starts (`src/auth/rememberMe.ts`).
- Real authorization comes from the database (RLS, memberships, RPCs). Auth metadata is never trusted.

## Data flow

1. `SessionBridge` calls `hydrate` (signed out: public data only; signed in: everything RLS allows).
2. Pages read the cache through `useSession()` / `useDB()` and the selectors.
3. Every change is a function in `src/store/actions.ts`: it writes through `src/lib/api/*` (RLS tables, or an RPC for registrations, attendance, hours, membership), then calls `refresh()`. Handlers use `act()` (`src/store/act.ts`) to show the success or error message. The database decides what is allowed; the UI only hides what a person cannot do.
4. What an organization sees of a volunteer comes from `get_user_profile_for_organization`, so privacy settings are enforced by the database. Followers are only visible to the organization's own admins.

## Delete account

Settings → Account → **Delete account** opens a confirmation modal (`src/components/domain/DeleteAccountModal.tsx`, `src/account/deleteAccountService.ts`). It lists the consequences and requires typing `DELETE`. It also checks which organizations you own:

- **Organizations with another owner** keep going without you and need no decision.
- **Organizations you solely own** each need a decision before the account can be deleted: **transfer ownership** to another active member (you become an admin, then leave with the account), or **delete** the organization and its data (the modal says how many other people it affects). Nothing is deleted by default.
- Organizations you only belong to just lose this member.

The Edge Function enforces the same rule on the server (HTTP 409 until every solely-owned organization is decided, and only organizations whose ids are listed are deleted). Success is reported only when the function returns `{ deleted: true }`; any other outcome is shown as a failure, with a clear message when it may have been partial. Details, verified behavior, and deployment notes: [docs/ACCOUNT_DELETION_AND_OWNERSHIP.md](docs/ACCOUNT_DELETION_AND_OWNERSHIP.md).

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
  data/remote.ts        Loads and maps database rows for the pages (what the signed-in person may see)
  store/                Client cache (store.ts, sync.ts), actions = database writes (actions.ts), selectors, session hook, toasts
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
