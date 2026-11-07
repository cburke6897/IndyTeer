# Auth and Media integration handoff

Snapshot reviewed on November 7, 2026:
- Auth and Media: `2c813ac` (`feat/auth-media`)
- Main: `31d1abf`
- Backend: `e7e23f0` (already included in main)
- Frontend: `2698d41` (includes the backend data access commit)

## Merge readiness

The branches need manual conflict resolution and functional integration before merging to main as a working application.

Auth and Media versus main has 3 conflict paths:
- `.env.example`
- `package-lock.json`
- `src/lib/supabase.ts`

Auth and Media versus frontend has 9 conflict paths:
- `.env.example`
- `README.md`
- `package-lock.json`
- `src/App.css` (deleted on frontend, modified on Auth and Media)
- `src/App.tsx`
- `src/components/layout/AuthLayout.tsx`
- `src/components/ui/Logo.tsx`
- `src/lib/supabase.ts`
- `vite.config.ts`

These were checked using Git merge-tree without changing any working branch.

## Conflict resolution decisions

- Use the frontend App routes, layout components, logo, and global theme as the final UI foundation.
- Wrap the frontend routes in AuthProvider. Update the existing frontend guards and useSession adapter to consume the real session and database profile.
- Keep one Supabase client. Combine the backend's createClient<Database> typing with Auth and Media's PKCE, persistence, refresh, and URL callback options.
- Standardize on VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. The backend currently reads VITE_SUPABASE_ANON_KEY; update that reference when combining the client.
- Keep React, Supabase, lucide-react, Tailwind, and the test dependencies needed by both branches.
- Merge package.json first, then regenerate the lockfile with npm install.
- Keep the frontend Tailwind Vite plugin and Auth and Media Vitest configuration.
- Preserve both sets of setup instructions in README.
- The standalone HomePage, AuthPage, ProfilePage, and App.css in Auth and Media are demonstration UI. Use the frontend's complete pages as the integration target.

## Frontend usage

AuthProvider supplies Supabase user, session, loading, and auth methods. It does not currently load a public.profiles row or expose application roles.

Wrap the existing frontend routes once:

```tsx
import { AuthProvider } from './auth/AuthProvider'

// Inside the existing BrowserRouter:
<AuthProvider>
  <Routes>{/* existing frontend routes */}</Routes>
</AuthProvider>
```

Call the real auth methods from the existing styled forms:

```tsx
import { useAuth } from '../../auth/useAuth'

const { user, session, loading, signIn, signUp, signOut } = useAuth()

await signIn(email, password)

const result = await signUp(email, password, `${firstName} ${lastName}`)
if (result.needsEmailConfirmation) {
  // Show the check-email message; onboarding requires a real session.
}

await signOut()
```

These methods are asynchronous and throw errors. Add pending states and display errors in the form.

Replace the mock login/signup/logout actions and localStorage sessionUserId as the source of authentication. The current frontend signup mock does not send the password to Supabase; its login mock accepts any password for non-demo accounts.

Load getProfile(user.id) from src/lib/api/profiles.ts after a real session is available. Adapt the returned profile to the UI's accountType/onboarded model. Wait for both auth and profile loading before redirecting. Treat profile-loading errors separately from being signed out.

The existing frontend guards consume useSession(), while Auth and Media supplies useAuth(). These must be bridged deliberately; merely wrapping AuthProvider will not change the mock guards. Use database profile fields for application role routing. Database RLS remains the actual authorization boundary.

The current standalone RequireAuth uses an Outlet and protects any signed-in route, but does not enforce onboarding or volunteer/organization role rules.

## Avatar integration

```tsx
import { uploadAvatar } from '../../media/avatarService'
import { updateProfile } from '../../lib/api/profiles'

if (!user) throw new Error('Sign in before uploading an avatar.')
const { publicUrl } = await uploadAvatar(file, user.id)
await updateProfile({ avatar_url: publicUrl })
```

uploadAvatar accepts a File, not the data URL currently returned by ImageUpload. Change the avatar picker to pass the original File, or add a separate File callback. Await Storage and profile updates before showing success, then refresh the UI profile cache.

The service currently also saves avatar_url and avatar_path in Auth metadata. public.profiles.avatar_url should be the shared display field for the integrated application. The profiles row must exist before updateProfile can succeed.

The public avatars bucket accepts JPEG, PNG, and WebP up to 5 MiB. The object path is user.id/avatar. Do not use this single-avatar helper for opportunity images, post images, or cover images: they need distinct paths and their own agreed policies.

## Backend work still needed

- The committed migration says profiles are created by a signup trigger, but does not define that trigger. Confirm the live database setup; version the trigger and backfill existing users if necessary. There is no profile INSERT policy or client createProfile method in the reviewed code.
- Agree how account-type selection and onboarding completion are stored. The frontend expects nullable accountType and onboarded; the current profiles schema defaults account_type to volunteer and has no onboarded field.
- Map the current signup metadata display_name to profiles.full_name, or agree on a shared metadata key and update signup accordingly.
- Preserve profiles.id = auth.users.id throughout frontend and backend.
- Map UI registration status approved to database accepted. The database also lacks the UI's cancelled and removed statuses; decide which workflows are supported.
- Map opportunity fields category/image/date to cause/image_url/starts_at. UI draft/published and database open/closed have different meanings; do not silently treat closed as draft.
- The Storage migration has already been applied manually in the shared project. Reconcile migration history rather than blindly rerunning the core schema CREATE statements.

## Teammate local setup

Fetch and check out feat/auth-media to review its standalone auth flow, then run npm ci.

Create .env.local from .env.example and set:
- VITE_SUPABASE_URL to the team's project URL.
- VITE_SUPABASE_PUBLISHABLE_KEY to the team's publishable key.

Never commit .env.local or put a secret/service-role key in VITE variables.

Run npm run dev. The shared project's auth redirect allow list must include the exact local origin being used. The current local setup uses http://127.0.0.1:5173 and http://127.0.0.1:5173/**.

The existing Auth and Media checks are npm test, npm run build, and npm run lint. After integration, also verify a real volunteer and organization workflow, profile creation, avatar visibility, session restoration, logout, and forbidden cross-user writes.
