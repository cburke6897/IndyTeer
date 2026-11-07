# IndyTeer Auth and Media

React and Vite implementation of email signup/login, persistent Supabase sessions, protected profile access, and avatar uploads. The full frontend can reuse the services with its own layouts and routes.

## Team contract

- Users choose volunteer or organization during signup. Auth signup metadata contains full_name and account_type; the signup service rejects missing or invalid account types before making a request.
- The backend teammate owns schema, profile creation trigger, backfill, RLS, and Storage SQL migrations. Auth and Media owns signup and upload flows. Do not apply or modify database migrations independently as part of frontend setup.
- profiles.id equals the Auth user ID. Display names come from profiles.full_name and avatars from profiles.avatar_url.
- uploadAvatar validates the signed-in Auth user, uploads to avatars/<Auth user ID>/avatar, then saves the URL through updateProfile. It reports success only after the profile update succeeds. No avatar fields are written to Auth metadata.

## Local setup

1. Run npm ci.
2. Copy .env.example to .env.local. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. The latter holds the browser-safe publishable key, matching the backend variable name. VITE_SUPABASE_PUBLISHABLE_KEY remains a compatibility fallback. Never use secret or service-role keys in VITE variables.
3. Coordinate with the backend teammate to confirm the signup trigger, existing-user backfill, and avatars bucket policies are deployed. The client does not create a missing profile row.
4. Configure the local auth Site URL as http://127.0.0.1:5173 and allow http://127.0.0.1:5173/** as a redirect URL. Leave email confirmation enabled for PKCE signup. Add the production HTTPS origin before deployment.
5. Run npm run dev and open the URL printed by Vite.

.env.local is ignored by Git. AuthProvider restores the stored session, detects auth callbacks, refreshes tokens, and follows auth changes. RequireAuth waits for session loading before redirecting a signed-out visitor.

## Routes and services

- /signup: full name, account-type selection, email, password, and confirmation feedback.
- /login: real Supabase email/password login.
- /profile: profile loaded by Auth ID, database display name and avatar, upload/replace, and logout.
- src/auth/useAuth.ts: user, session, loading, signUp, signIn, and signOut.
- src/auth/useProfile.ts: loads the database profile and updates the local profile cache after upload.
- src/media/avatarService.ts: File validation, own-folder upload, and profiles.avatar_url persistence.
- src/lib/api/profiles.ts: shared backend profile access methods.

See docs/AUTH_MEDIA_INTEGRATION.md for exact service signatures and frontend integration steps. Existing SQL files remain versioned; the backend owner controls their application and migration history.

## Security and error handling

The current avatars bucket is public: anyone with an image URL can view it. Storage ownership policies enforce authenticated writes to the user's own folder. Client validation accepts JPEG, PNG, and WebP up to 5 MiB; the backend owner must maintain equivalent bucket restrictions.

Signup metadata is input for the backend trigger, not a trusted source of authorization. Use the saved profile and database RLS for role/ownership checks. A browser route guard controls page access only; any separate API must verify the user's access token.

Profile-loading and profile-update failures are shown as errors. Storage upload and profile update are separate operations; if the profile write fails, the file may already have been replaced, and the client reports failure rather than claiming it was saved.

## Validation

Run npm test, npm run build, and npm run lint. Tests cover account-type metadata, signup/login flows, session state, route protection, the database profile contract, avatar ownership, and persistence failures.

Live acceptance flow: register each account type, confirm the email, verify profiles.id matches Auth user ID and account_type is correct, upload an avatar, reload to verify database persistence, and sign out. The backend teammate supplies schema/trigger/Storage readiness for these checks.
