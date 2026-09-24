# Database regression checks

Run `npm run test:db` with PostgreSQL **17** (`initdb`, `pg_ctl`, and `psql`) available on `PATH` and the project's supported Node version. The runner creates a disposable database cluster using only a private Unix socket. It discards inherited PostgreSQL connection settings, loads no environment file or remote credentials, and removes the cluster when finished. Do not run `baseline.sql` against an existing database.

`supabase-stubs.sql` supplies the small Auth/Storage schema surface this app references. `fixtures.sql` contains invented users, rosters, contacts, and object metadata. There are no copied production rows or real files.

The checks exercise:

- Nine known authorization failures on the baseline, each required to fail its security assertion before the migration and pass afterward.
- 39 independent transactions for anonymous, ordinary, suspended, unverified, and admin users, including signup, reconsent, private roster isolation, moderation, student-image protection, admin withdrawal, deletion preflight authorization, and current/previous-client team flows.
- A deliberately failing second member insert to verify the whole team edit rolls back.
- Two real overlapping connections for competing match acceptance and duplicate team creation.
- Idempotent historical notification redaction, with exact preservation of unaffected rows, row counts, and retained metadata.

Baseline failure probes run only in the disposable local database. Every ordinary test is rolled back. Concurrent cases use separate disposable database copies.

These are PostgreSQL authorization and transaction checks. They do not test the hosted Auth API, PostgREST schema cache, actual Storage file removal, upload MIME checks, or browser UI; those need their own validation. Frontend rollback compatibility keeps the security migration installed and uses existing endpoints; restoring the insecure grants is not a supported rollback.
