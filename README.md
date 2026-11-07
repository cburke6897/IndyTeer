# IndyTeer — independent complete-app branch

Volunteer discovery, organization workspaces, registration management, and verified hours for Indiana communities. React + TypeScript + Vite + Tailwind; Supabase Auth, Postgres, Storage, and Edge Functions provide the backend.

This implementation lives on **`fix/main-stabilization`**, based on main `d338c2f`. It retains the main backend's membership API contracts while replacing prototype-only business screens with connected flows. The user authorized deploying repairs to the shared IndyTeer project; deployment status is recorded in **[docs/STABILIZATION.md](docs/STABILIZATION.md)**. New contributors should use local Supabase or a separate project, and must coordinate shared schema changes with the team.

## Implemented

| Area | Connected behavior |
| --- | --- |
| Identity | Signup/login/logout, confirmation/resend, password recovery/change, email change, persisted/refreshed sessions, protected routes |
| Profile | Database-backed onboarding, names, biography, interests, availability, privacy controls, avatar upload/removal |
| Organizations | Create/edit, public directory, follows, invitations, join requests, owner/admin/member permissions, ownership transfer |
| Opportunities | Search/filter/paginate, draft/edit/publish/delete, images, dates/time zones, age/deadline checks, recurring occurrences |
| Participation | Save, register/cancel, capacity enforcement, approval/decline/removal, attendance, verified hours, manual personal hours |
| Community | Organization updates/images, platform announcements, notifications, reminder queue, email preferences |
| Reporting | Personal dashboard, organization overview/analytics, volunteer directory, privacy-mediated profile access |
| Administration | Platform-admin verification; actual server-side account deletion with shared-ownership protection |
| Operations | Private retry queues for email/media cleanup, authenticated background worker, SPA deployment rules, CI and isolated tests |

App data is stored in Supabase; the prototype's local mock database is removed. Supabase still persists authentication tokens in browser storage. Photos are public; database policies mediate access to private details.

## Run locally

Requirements: Node 22.12+ (or a supported newer version), npm, and Docker Desktop **if using the local Supabase stack**.

```powershell
git switch fix/main-stabilization
npm ci
npx supabase start
npx supabase db reset --local
npx supabase status
Copy-Item .env.example .env.local
```

Set `.env.local` to the local API URL and browser-safe publishable/anon key printed by `supabase status`. Then run `npm run dev` and open `http://localhost:5173`. Sign up and complete onboarding. Every user starts as a person; create or join organizations after signing in. Local confirmation is disabled by default; recovery emails appear at `http://localhost:54324`.

Hosted setup, functions, demo accounts, admin setup, scheduled work, and smoke checks: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. A GitHub checkout supplies code, not an automatically provisioned backend. The existing ignored `.env.local` may still reference the shared project; change it before testing data features.

## Data contract

- Signup sends **`full_name` only**, following the latest backend handoff. The former `account_type` contract is retired. Profile visibility is persisted as `everyone`, `members`, or `organizations`; contact data stays restricted.
- `public.users.id = auth.users.id`; display `users.full_name` and `users.avatar_url`. `users.avatar_path` holds the Storage path.
- Organizations are independent records; `organization_memberships` controls each person's role/status in each organization.
- Sensitive actions use SQL RPCs. Client route guards support navigation; RLS and column grants enforce authorization.
- Paths: avatars `<auth-id>/<file>`; brand/posts `<org-id>/<uploader-auth-id>/<file>`; opportunity images `<opportunity-id>/<uploader-auth-id>/<file>`.
- Images: JPEG/PNG/WebP, nonempty, at most 2 MiB. Avatar success requires persisting its URL; failed writes remove the new upload.

Integration entry points: **[docs/AUTH_MEDIA_INTEGRATION.md](docs/AUTH_MEDIA_INTEGRATION.md)**.

## Verification

```powershell
npm run check           # lint, frontend tests, database tests, typecheck/build
npm run check:edge      # Deno typecheck for both server functions
npm run test:edge       # endpoint tests with intercepted external requests
npm run test:e2e        # browser workflows against isolated mock HTTP
npm run types:generate # schema types from locally replayed SQL
```

Database tests replay every migration in embedded real PostgreSQL (PGlite), exercising roles, RLS, grants, and RPCs. `supabase/tests/platform.sql` substitutes only Supabase-managed Auth/Storage scaffolding and must never be deployed. These tests do not verify hosted email delivery, PostgREST embedding, actual object transfer, deployed gateways, or the Docker stack. Follow the live checklist after deploying.

Playwright uses Edge on Windows and Chromium elsewhere. On Linux/macOS run `npx playwright install chromium` first. Windows without Edge can change the browser channel in `playwright.config.ts`.

## Project map

```text
src/application/       Connected screens and account/organization contexts
src/auth/              Session provider and signup/login service
src/lib/api/           Typed Supabase queries, RPCs and uploads
src/components/ui/     Shared navy/gold/white components
src/types/             Domain models and migration-derived database types
supabase/migrations/   Ordered schema, RLS, RPCs, Storage and queues
supabase/functions/    delete-account and background-worker
scripts/               Database tests/type generation; local-only demo seed
e2e/                   Browser workflow tests with intercepted HTTP
```

The Word task guide remains an uncommitted local user file. Historical prototype setup notes are superseded by this README and the integration/deployment guides.
