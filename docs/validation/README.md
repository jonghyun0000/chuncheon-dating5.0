# Validation evidence

## Isolated database recovery and load drill

Run `node scripts/test-db-resilience.mjs` with PostgreSQL 17 tools (`initdb`, `pg_ctl`, `psql`, `pg_dump`, `pg_dumpall`, `pg_restore`, `pgbench`) on `PATH`. Output goes to `supabase/.temp/validation/db-resilience.json`; an optional first argument changes the report path. Both runners also honor `CC_VALIDATION_REPORT_DIR` (for example `/tmp/cc-validation` when CI mounts the repository read-only).

The runner creates two fresh native PostgreSQL clusters with private Unix sockets and strips inherited connection settings. It never reads a project environment file or connects to a hosted database. Both clusters are removed after the run. Durability settings stay enabled.

The source contains the complete checked-in schema/migrations, invented baseline fixtures, and 200 additional synthetic users with teams and two-member rosters. A custom-format dump and global roles are restored into the second fresh cluster. The drill compares every table's row count and content digest, schema definitions, constraints, RLS policies, functions, triggers, indexes, roles, and normalized object privileges. It also tests ordinary-user isolation after restoration. One deliberate write after the snapshot must be absent from the restored database, demonstrating the snapshot boundary.

Load cases use 16 local connections: 320 home-list reads, 160 edits on independent teams, and 160 conflicting edits to the same team. Every transaction must complete without errors; the final team count, roster sizes, matching header/member markers, and one-open-team constraint must remain consistent. Latency measurements are observations on this machine, not hosted capacity estimates or production service objectives.

The dated JSON records the measured dump/restore duration, percentiles, hashes of tested migrations, and outcomes. **This does not validate Supabase hosted backups, PITR, production RPO/RTO, incident response time, or recovery of actual Storage file bytes.** Those require a separate production-equivalent backup policy and recovery exercise.

## Real local Supabase integration (opt in)

Run `node scripts/test-supabase-local.mjs` only when a local Docker engine is available and downloading the Supabase images is acceptable. The script uses CLI 2.117.0, a unique `cc-quality-*` project, API port 55341 and database port 55342. It does not alter other Docker projects or the normal 5432 database. Nonessential services are disabled. Initial startup is capped at 15 minutes; cleanup stops and deletes only its own local project data. Images remain cached for later runs.

The integration uses real Auth-issued sessions, a synthetic one-pixel student image, actual Storage requests, real PostgREST RLS enforcement, and real TOTP MFA. It tests signup/profile insertion, privilege escalation denial, admin verification, image isolation, AAL1/AAL2 enforcement, team creation, match acceptance, private/public roster separation, and admin deletion after actual file removal. Output is `supabase/.temp/validation/supabase-local.json`, with no passwords, keys, JWTs, MFA secrets, or personal identities.

These tests run against the local Supabase service versions selected by the pinned CLI. They do not send email, create a paid branch/project, exercise the public deployment, or use production accounts.
