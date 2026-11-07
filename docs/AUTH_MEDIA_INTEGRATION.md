# Auth and Media integration handoff

The Auth and Media branch now includes main at `31d1abf`, including the backend data access layer. The main merge conflicts have been resolved on this feature branch.

## Shared conventions selected

- Environment: use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, matching the backend. Put the browser-safe publishable key in the ANON_KEY variable; the name does not require switching key types. VITE_SUPABASE_PUBLISHABLE_KEY remains a fallback for existing local setups. ANON_KEY wins if both are set.
- Supabase: one createClient<Database> instance, combining backend database typing with explicit PKCE, session persistence, token refresh, and callback detection.
- Models and APIs: use src/types/models.ts and src/lib/api/* from main. Keep generated database types for database requests; adapt them to frontend display models where needed.
- Encoding: src/types/database.ts is now UTF-8. Its UTF-16 source compiled with TypeScript but caused ESLint to reject it as binary; only the encoding was changed.
- Names: signup now sends full_name for the backend profile contract, while preserving display_name for existing consumers. Profile display prefers full_name with a display_name fallback.
- Layout API: AuthLayout supports title, optional subtitle, children, and optional footer, matching the frontend component interface. During full UI integration, keep the complete frontend layout and route structure.
- Keep the frontend Tailwind Vite plugin and Auth and Media Vitest configuration. Regenerate the lockfile after dependency changes.

The frontend integration still requires manual route/layout conflict resolution and replacement of mock auth actions. Matching names alone does not connect the application data flow.

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

The service currently also saves avatar_url and avatar_path in Auth metadata. public.profiles.avatar_url should be the shared display field for the integrated application. The profiles row must exist before updateProfile can succeed. The standalone uploader still saves Auth metadata; the complete frontend must also call updateProfile as shown above.

The public avatars bucket accepts JPEG, PNG, and WebP up to 5 MiB. The object path is user.id/avatar. Do not use this single-avatar helper for opportunity images, post images, or cover images: they need distinct paths and their own agreed policies.

## Backend work still needed

- The committed migration says profiles are created by a signup trigger, but does not define that trigger. Confirm the live database setup; version the trigger and backfill existing users if necessary. There is no profile INSERT policy or client createProfile method in the reviewed code.
- Agree how account-type selection and onboarding completion are stored. The frontend expects nullable accountType and onboarded; the current profiles schema defaults account_type to volunteer and has no onboarded field.
- Signup now sends full_name and display_name. The profile-creation mechanism should populate profiles.full_name from full_name (with display_name as a compatibility fallback).
- Preserve profiles.id = auth.users.id throughout frontend and backend.
- Map UI registration status approved to database accepted. The database also lacks the UI's cancelled and removed statuses; decide which workflows are supported.
- Map opportunity fields category/image/date to cause/image_url/starts_at. UI draft/published and database open/closed have different meanings; do not silently treat closed as draft.
- The Storage migration has already been applied manually in the shared project. Reconcile migration history rather than blindly rerunning the core schema CREATE statements.

## Teammate local setup

Fetch and check out feat/auth-media to review its standalone auth flow, then run npm ci.

Create .env.local from .env.example and set:
- VITE_SUPABASE_URL to the team's project URL.
- VITE_SUPABASE_ANON_KEY to the team's browser-safe publishable key.

Never commit .env.local or put a secret/service-role key in VITE variables.

Run npm run dev. The shared project's auth redirect allow list must include the exact local origin being used. The current local setup uses http://127.0.0.1:5173 and http://127.0.0.1:5173/**.

The existing Auth and Media checks are npm test, npm run build, and npm run lint. After integration, also verify a real volunteer and organization workflow, profile creation, avatar visibility, session restoration, logout, and forbidden cross-user writes.
