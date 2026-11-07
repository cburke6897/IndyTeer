# Environments and deployment

## Shared project and new development environments

The team project is `shiuqwmvvcmorfiyxttg`. The user explicitly authorized the stabilization rollout to this project. See STABILIZATION.md for verified deployment status. Coordinate any future shared schema deployment with the team. Never reset/replay the shared database.

For independent development, use local Supabase or a new project. Git branches do not isolate external services. The existing ignored `.env.local` points to the shared project; use a separate URL/key when testing independently.

The installed Supabase CLI 3 defaults database commands to **local**, even after linking. Use an explicit `--remote` for the intended hosted target and preview migrations first.

## Local setup

Install/start Docker Desktop, then:

```powershell
npm ci
npx supabase start
npx supabase db reset --local
npx supabase status
```

`db reset --local` recreates disposable **local** data. Automatic SQL seeding is disabled. Use `npm run seed:demo` to create local demo data after configuring `.env.server.local` below.

Create `.env.local` from `.env.example`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local publishable/anon key>
```

Run `npm run dev`; open `http://localhost:5173`. Local email testing: `http://localhost:54324`. Auth URLs include localhost/127.0.0.1 and `/reset-password`. Update the allow-list if you choose another port.

### Demo accounts

Create ignored `.env.server.local` using **local** `supabase status` values:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<local publishable/anon key>
SUPABASE_SECRET_KEY=<local secret/service-role key>
DEMO_PASSWORD=<choose at least 8 characters>
```

Run `npm run seed:demo`. It refuses non-local URLs and creates real Auth identities, an organization, two events, a verified historical registration, and an update. Accounts: `owner@indyteer.test`, `volunteer@indyteer.test`, `member@indyteer.test`, `admin@indyteer.test`; password is your chosen `DEMO_PASSWORD`. It can rerun after successful setup with the same password. After interruption, reset the disposable local stack before reseeding. Do not use these identities in production.

### Local functions

Create ignored `supabase/.env.local`:

```dotenv
CRON_SECRET=<long random server-only secret>
# Optional notification email:
# RESEND_API_KEY=<server-only key>
# NOTIFICATION_FROM_EMAIL=IndyTeer <notifications@your-verified-domain>
```

```powershell
npx supabase functions serve --env-file supabase/.env.local
```

Supabase supplies platform URL/server keys to its runtime. `delete-account` retains JWT gateway verification and verifies Auth itself. `background-worker` disables JWT gateway verification and verifies the dedicated `CRON_SECRET`; ordinary user tokens are rejected. Keep that secret out of the frontend.

## Hosted independent project

1. Create a **new** Supabase project. Keep its database password separate from frontend configuration.
2. Review all migrations in order. They replace prototype tables/policies and contain destructive schema changes. Legacy nullable name/bio migration cases are tested; arbitrary prior cloud schema modifications are not.
3. Link only the new independent reference:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --remote --dry-run
npx supabase db push --remote --yes
```

For existing populated projects, back up and reconcile migration history first. Do not blindly repair history or run the initial schema reapply against production.

4. Set the independent project's URL and browser publishable key in `.env.local` and the frontend host environment. Every `VITE_` value is delivered to visitors. **Never put a secret/service-role key in a `VITE_` variable.**
5. Enable Supabase Email Auth. For production enable email confirmation and configure SMTP. Set Site URL to your production HTTPS origin and allow exact redirects for the origin, `/reset-password`, and `/app/settings`. Add local URLs only if needed. Open PKCE confirmation/recovery links in the requesting browser.
6. Deploy functions and server-only secrets:

```powershell
npx supabase functions deploy delete-account --remote=YOUR_PROJECT_REF
npx supabase functions deploy background-worker --remote=YOUR_PROJECT_REF
npx supabase secrets set --env-file supabase/.env.local --remote=YOUR_PROJECT_REF
```

For optional notification email, configure Resend with a verified sender. Supabase Auth confirmation/recovery uses **Auth SMTP**, a separate delivery path.

### Administrator

Create/onboard the real admin through the app, then explicitly grant that known Auth UUID in your independent SQL editor:

```sql
update public.users set is_platform_admin = true where id = 'ADMIN_AUTH_USER_UUID'::uuid;
```

Refresh the app to load `/admin`. Browser clients cannot grant platform-admin status or directly edit organization verification.

## Frontend hosting

Vercel: import this repository, select `main`, use Vite, set the two `VITE_` variables, build with `npm run build`, and publish `dist`. `vercel.json` handles nested client routes. Netlify: same build/output, with `public/_redirects` providing the SPA fallback. Add the final production origin to Auth URLs. Rebuild after environment changes.

Supabase hosts the backend. The frontend host runs the build and serves static assets; it does not deploy database migrations or functions automatically.

## Scheduled work

Use a trusted server scheduler (e.g. Supabase Cron with Vault) to POST to `<SUPABASE_URL>/functions/v1/background-worker` every **15 minutes**, sending `Authorization: Bearer <CRON_SECRET>`. Store it in the scheduler's server-side secret store. Never call it from the browser or commit credentials.

Each call enqueues reminders for approved events starting 23–25 hours later, cleans up to 25 media objects, and sends up to 5 notification emails if configured. Reminders are deduplicated; claims lease work for five minutes; retries back off and stop after 5 email/10 cleanup attempts. Provider idempotency keys reduce duplicate sends. Email opt-out is checked before claiming.

```sql
-- Service/admin inspection only:
select id, attempts, last_error, next_attempt_at from public.email_jobs
where sent_at is null and cancelled_at is null;
select id, bucket, path, attempts, last_error from public.media_cleanup_jobs
where completed_at is null;
```

Scheduling is required for timely reminders, notification email, and deferred cleanup. In-app notifications are immediate. The authorized shared project now runs `indyteer-background-v1` every 15 minutes. Its dedicated secret is stored in Vault and function secrets. Notification email still requires Resend and a verified sender. Configure another reviewed hosted target with `node scripts/configure-background.mjs --project-ref=YOUR_PROJECT_REF --apply`; this writes ignored local secret files and installs pg_cron/pg_net.

If a deletion function was forcibly terminated, inspect the account/organization state before running this service-only recovery RPC:

```sql
select public.cancel_account_deletion('AFFECTED_AUTH_USER_UUID'::uuid);
```

Deletion may remove media before a later step fails; the UI never reports success on failure. Shared organizations require ownership transfer first.

## Live smoke checklist

Use disposable accounts in the independent project:

- Signup, confirmation, onboarding, reload, logout/login; recovery and email change in the requesting browser.
- Name/avatar edit and persistence on a second browser; reject another user's Storage folder writes.
- Create an organization, invite/accept a member, approve a request, transfer ownership; reject member-only publish/role changes.
- Draft/publish/edit events and recurring series; register, approve, cancel, fill the final place; verify server capacity checks.
- Record attendance on/after event date, verify hours, inspect reports; test privacy against unrelated accounts.
- Publish/delete an image update; invoke the worker and inspect queued cleanup, notification delivery and opt-out.
- Block deletion of shared ownership; transfer it, delete a disposable account, verify Auth deletion and retained organization.
- Directly load nested frontend routes and `/reset-password` after hosting.

## Verification boundary

Database tests run PGlite with test-only Auth/Storage scaffolding. Browser/endpoint tests intercept external requests. They test app behavior and SQL authorization; they do not prove live SMTP, hosted gateways, PostgREST embedding/cache, actual Storage transfers/MIME enforcement, or remote deployment. Docker was unavailable in the implementation environment. The authorized shared deployment passed 12 live checks, including real Auth users, PostgREST embedding, uploads, cross-folder rejection, capacity, ownership transfer and both deletion endpoints. Run tagged QA explicitly with `npm run test:live -- --project-ref=YOUR_PROJECT_REF --allow-tagged-qa`. This creates and removes temporary identities; SMTP, frontend hosting and the full Docker stack remain separate checks.

Dependency audit: all dependencies report zero advisories. A minimatch 11.0.1 override addresses GHSA-g3hv-75wg-m249 while upstream lint-tool ranges still select vulnerable 10.x. Lint, tests, and production build verify the updated dependency.

References: [Supabase local development](https://supabase.com/docs/guides/local-development), [Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls), [Edge authentication](https://supabase.com/docs/guides/functions/auth), [Resend API](https://resend.com/docs/api-reference/emails/send-email).


## Profile visibility rules

`everyone` allows public profile details without login. `members` requires a signed-in account. `organizations` requires an active owner/admin of an organization with a pending or approved registration from the volunteer (the person can also view their own details). Phone and availability are restricted to that connected owner/admin or the profile owner at every visibility level. Date of birth and email are never returned by the shared-profile RPC. Hours and attended, published event history require their explicit sharing preferences.

Legacy `public_profile` values map to a coherent audience; old clients can still change that toggle. Existing organization-onboarding payloads and ownership-transfer membership return types remain compatible.

## Main frontend reconciliation

Main keeps /app/*, /org/* and /create-organization. The alternate /manage/*, /people/* and administration screens in src/application are not mounted on main. The main privacy toggle remains; persisted audience support exists in the backend for future UI integration. Account deletion now uses an explicit deleteOrganizationIds list; the old boolean contract is supported for existing clients. See the current main README for which features have screens.
