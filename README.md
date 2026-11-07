# IndyTeer Auth and Media

This Vite and React implementation covers the Auth & Media Lead assignment: email signup, login, persistent sessions, a protected profile route, and avatar upload to Supabase Storage. It uses the current starter app as a working demonstration; connect the protected route and avatar component to the team's opportunity pages when those routes are added.

## Run the app

1. In Supabase, create a project and copy its Project URL and **publishable** API key.
2. Copy `.env.example` to `.env.local` and replace both example values. Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, matching the backend configuration. The latter holds the browser-safe publishable key; the previous `VITE_SUPABASE_PUBLISHABLE_KEY` name remains a fallback. Keep `.env.local` out of Git. A publishable key is expected in browser code; never put a `service_role` or secret key in any `VITE_` variable.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to the redirect URL allow list. Add the deployed app's HTTPS origin there before deploying.
4. In **Authentication → Sign In / Providers**, enable Email and leave email confirmation on for the PKCE signup flow. Signup shows a confirmation message; the user logs in after following the link. The confirmation redirect must be allow-listed.
5. Run `supabase/migrations/20261107000100_auth_media.sql` in the Supabase SQL Editor. This creates the public `avatars` bucket with a 5 MB limit and JPEG/PNG/WebP restrictions, then limits upload and replacement to each user's own folder.
6. Run `npm install`, then `npm run dev` and open the local Vite URL.

The `AuthProvider` reads the saved Supabase session on startup and follows sign-in and sign-out events. The client explicitly enables PKCE, session persistence, URL callback detection, and token refresh. `RequireAuth` waits for that session check before redirecting unauthenticated visitors to `/login`.

## Included routes and components

- `/signup` and `/login`: email/password forms, display name metadata, and email confirmation handling.
- `/profile`: protected demo route with current account details, logout, and avatar uploader.
- `src/auth/AuthProvider.tsx`: shared session state and auth actions.
- `src/routes/RequireAuth.tsx`: React Router guard. It protects page display only; it is not an API security boundary.
- `src/media/avatarService.ts`: image validation, per-user upload/replace, and avatar URL saved in the user's editable auth metadata.
- `supabase/migrations/20261107000100_auth_media.sql`: bucket configuration and Storage row-level security policies.

To use the guard for an existing route, nest its route under `<Route element={<RequireAuth />}>` in `src/App.tsx`. Use `useAuth()` in page components to read `user`, `session`, and `loading`, or to call `signIn`, `signUp`, and `signOut`. Add `<AvatarUploader />` to the signed-in profile screen.

## Security notes

- The `avatars` bucket is public so profile photos can render without signed URLs. Anyone who has an avatar URL can view that image. Uploads and replacements still require a signed-in user and Storage RLS restricts each object to a path beginning with that user's Auth ID.
- The client rejects unsupported types and files over 5 MB. The bucket repeats these restrictions on the server.
- `user_metadata` is user-editable. The included code stores only display name and avatar fields there; do not use it to authorize volunteer/organization roles.
- A React route guard only controls what the browser displays. If the team adds an Express API, verify the Supabase access token on every protected API request and enforce authorization on the server. Never trust a role or user ID supplied only by the browser.
- This branch now includes the backend Supabase data access layer and profiles schema from main. Its standalone auth pages still save avatars in Auth metadata. The complete frontend should also save the returned URL through `updateProfile({ avatar_url })`; the profiles row must exist first. Profile creation and onboarding contracts still need to be completed by the backend. See `docs/AUTH_MEDIA_INTEGRATION.md` for integration examples.

## Tests and checks

Run:

```sh
npm test
npm run build
npm run lint
```

The tests cover the auth form flows, client session-persistence configuration, signup/login/logout requests, session hydration and auth events, route protection, and avatar validation/upload behavior.
