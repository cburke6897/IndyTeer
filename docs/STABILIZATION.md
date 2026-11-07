# Main stabilization and connected features

Base: main `d338c2f`. Branch: `fix/main-stabilization`. The earlier isolated rollout is recorded below; see the main merge reconciliation at the end.

## Shared deployment — 2026-11-07

The user authorized deployment to `shiuqwmvvcmorfiyxttg` and completed management login.

- Applied incremental migrations through `20261107181100`; remote dry-run reports up to date.
- Deployed `delete-account`, `delete-organization`, and `background-worker`.
- Enabled `indyteer-background-v1` every 15 minutes using pg_cron/pg_net and Vault. The worker's dedicated secret is server-only. Manual invocation returned 200; emailConfigured was false.
- Frontend remains a local Vite app until a frontend hosting deployment is chosen. Existing ignored local configuration points to the shared project.

## Delivered

- Fixed ownership RPC receiver binding, preserved the membership return contract, corrected legacy nullable names/bios, and restored anonymous published-opportunity access.
- Connected signup/login/recovery, onboarding, profile/avatar persistence, protected routes and sessions. Latest signup metadata is full_name only; account_type was retired by the backend handoff.
- Connected organizations, memberships/invitations/requests, ownership transfer, opportunities/recurrence, registrations/capacity, attendance/hours, feed, notifications and administration.
- Added persisted profile audiences and contact privacy. Birth date/email are never returned by the shared-profile RPC. Completed attendance cannot be erased through cancellation.
- Added real deletion with explicit confirmation, shared-ownership protection, deletion fences, paginated Storage inventory and retry cleanup. Cleanup skips currently referenced media.
- Removed mock business storage, generated schema types for browser/functions, split lazy frontend chunks, guarded public environment values, and patched the minimatch advisory. No server credentials or private snapshots are committed.

## Verification

36 frontend, 29 database, 3 configuration, 9 Edge endpoint and 11 browser tests pass (88 total). Lint/build and all three Deno typechecks pass; npm audit reports zero vulnerabilities.

12 live checks passed using explicitly tagged temporary identities: real Auth trigger/onboarding, anonymous embedded event reads, capacity rejection, registration changes, cross-folder Storage denial, persisted avatar, private-profile filtering, ownership transfer, shared-owner deletion rejection, old-owner deletion preserving the transferred organization, organization deletion and temporary identity cleanup. SMTP delivery was not tested.

## Shared-data incident and recovery

A private pre-deployment snapshot recorded 13 users, 4 organizations, 12 opportunities, 6 registrations and 15 posts. Later verification found the original organizations and cascading business rows absent. Work paused for investigation and recovery.

Database statement statistics showed one direct SQL deletion of four organization IDs under the postgres role, with stats_since 2026-11-07 19:48:23.103325 UTC, before the deployment's live endpoint tests (approximately 20:07 UTC). This was distinct from the single tagged-QA organization deletion through PostgREST. The executor is unknown; the evidence does not identify a person or client.

Restored original business rows transactionally from the private snapshot, preserving IDs, timestamps and statuses and keeping existing users/settings unchanged. All original business row values were compared field by field and matched after restoration. All original 13 user IDs remained; an additional real signup was preserved. Private snapshots/recovery SQL remain ignored locally and contain no committed user data. Concurrent shared-project edits require coordination.

## Remaining configuration and checks

Notification email needs RESEND_API_KEY and NOTIFICATION_FROM_EMAIL for a verified sender; Auth confirmation/recovery uses separate Supabase Auth SMTP. Real email delivery, a full Docker-stack run, and production frontend hosting have not been verified. The original deployment did not merge main; the subsequent integration is recorded below.

See [deployment instructions](DEPLOYMENT.md) and [integration contract](AUTH_MEDIA_INTEGRATION.md).

## Main merge reconciliation — 2026-11-07

Merged fix/main-stabilization into latest main f7223e9, prioritizing main on ordinary conflicts. Main pages, routes, Supabase cache, onboarding, organization switcher and per-organization deletion modal remain active. Alternate src/application modules remain in source for later integration, rather than replacing the frontend. Browser coverage was adapted to the retained main routes.

Fixed integration errors: generated Tables aliases support tables and views; organization upload return types agree; SDK imports are valid; ownership RPC preserves its client receiver. Added prepare_selected_account_deletion to match main’s exact ID choices with transaction locks/deletion fences. Retained organization media survives deletion of its former owner. Both additional migrations through 20261107211000 and the updated account function were deployed to the authorized shared project.

Merge verification: 86 frontend, 30 database, 3 configuration, 10 Edge endpoint and 4 main browser tests (133 total), production build/lint and function typechecks. The live smoke also checks that main’s ID-list request preserves transferred organization media; 13 live checks passed, including that new retained-media case. Existing complete-app branch’s prior 11 browser checks describe that branch, not main’s retained UI. Main’s existing frontend bundle emits a size warning; the build succeeds.
