# Main stabilization and connected features

Base: `d338c2f` from main. Work is isolated on `fix/main-stabilization`.

## First repair checkpoint

- Keep the Supabase client receiver when transferring ownership; retain the backend's membership return contract.
- Correct NULL last names and NULL organization descriptions during legacy-schema replay.
- Add an incremental migration granting the anonymous read-only membership predicate used by opportunity RLS.
- Generate types from locally replayed SQL, including server-only copies inside the Functions directory.
- Typecheck both deletion functions against the schema and pin their SDK version.
- Disable placeholder SQL seed execution during local startup; provide an explicit local-only demo seed.
- Reject server credentials in public build variables before bundling.

Validation: lint/build pass; 64 frontend tests, 2 database regression tests, and 2 configuration checks pass; both deletion functions pass Deno checking.

No cloud SQL, function deployment, account creation/deletion, or email delivery was performed. The local CLI requires Supabase login. Historical migration corrections affect new/replayed environments; existing deployments require review of the new incremental migrations rather than resetting or replaying the database.

Next: connect business workflows, add membership/ownership/deletion controls, extend server-side authorization and regression coverage, and verify the complete flow before deployment.
