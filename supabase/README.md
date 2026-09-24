# Database hardening and rollout

The production project is `slddnhyvstfvobxxcazt` (display name `chuncheon-dating4.0`), used by the deployed 5.0 frontend. All snapshot/test identities in this repository are synthetic or schema metadata. No production user rows or keys belong in these files.

## Files

- `baseline.sql`: reproducible public schema snapshot as of 2026-09-25. It assumes Supabase auth/storage schemas already exist. It is for a fresh disposable test database only; **never apply it to an existing project**.
- `migrations/20260924165302_harden_authorization_and_atomic_teams.sql`: expands API with atomic team save and private-data-safe home results, fixes privilege boundaries, restricts verification uploads, preserves old direct team write endpoints, adds indexes and bucket limits.
- `migrations/20260924165736_redact_completed_deletion_snapshots.sql`: idempotently redacts already completed deletion notification text/payload only when the target profile is deleted. It preserves every notification row, timestamps and status. This intentionally cannot be undone without reintroducing deleted personal information.
- `tests/` and `../scripts/test-db.mjs`: isolated PostgreSQL 17 integration tests with Supabase auth/storage stubs.

## API contracts

`save_my_team(p_team_id uuid, p_intro text, p_team_size integer, p_members jsonb, p_members_consent_confirmed boolean) -> teams`

All five arguments are required. Pass null for p_team_id to create a team, the existing ID to edit an active own team. The return is the created/updated team record. Members is an array of the existing MemberInput objects; IDs, team IDs, order and timestamps are assigned by the server. The caller must be active and verified, give consent, and provide exactly 1–4 members matching team_size. Intro is 4–50 characters (same as the form); each student number is 6–12 digits. Any failure rolls back the complete team/roster change, including trigger errors.

`get_home_teams() -> setof { id, owner_id, gender, intro, status, matched_at, created_at, team_size, members_consent_confirmed, members_consent_at, members, owner_verified }`

For active signed-in users, returns opposite-gender active teams with masked, contact-free member JSON and verification badges. It avoids granting access to other users' private profiles. Existing teams/member view queries remain available; the old profile join retains its original RLS behavior.

The public member view is deliberately **filtered and read-only with definer privileges**, instead of making private base contact rows broadly selectable. It denies anon and applies caller identity/active state plus ownership, opposite active-team, or prior-request relationship checks. Only SELECT is granted to authenticated.

`validate_account_deletion(p_user_id uuid) -> void`

Read-only deletion preflight: requires a signed-in active admin, an existing target other than the caller, and a target whose role is not admin (including inactive admins). Call it **before** listing/removing student-ID files for either admin deletion or approval. It throws on invalid targets and changes no data. Purge repeats the same validator after locking its target. Storage deletion policies independently protect every admin profile's images, including the caller's; normal user signup rollback and admin cleanup of non-admin/rejected/orphan student files remain available.

Existing matching/deletion/admin RPC names and arguments remain. Direct `purge_user_content` execution is denied; admin wrappers keep their checks and can invoke it internally. Purge additionally refuses while any student-ID object remains under the target UUID folder. Admin clients must list/remove the entire folder successfully before approval. It also removes only the `name` key copied at signup in `auth.users.raw_user_meta_data`, preserving the authentication account, username and other metadata. Previously issued tokens can retain their old metadata until refresh/expiry; the deleted profile remains barred from active-user operations and new uploads. This is not full authentication-account erasure.

## Compatibility

- Deployed signup uploads a file before inserting a profile; the new INSERT guard checks the user's folder/file, consent and safe initial state.
- An auth account without a profile can still upload its student ID and resume signup after proving its password.
- Approved, inactive and deleted users cannot upload/replace student-ID files with a stale token. Non-admin owners can still remove their files; admin read access and non-admin target cleanup are preserved. Admin profile images require an explicit privileged maintenance operation rather than the user-deletion flow.
- Existing consent updates work only with all three flags true and canonical version `v5.1`. The server stamps the actual time. **Update this version in the trigger alongside src/lib/terms.ts when changing terms.**
- Generic reports without a target remain supported, but users cannot forge moderation fields.
- Existing direct team creation/editing remains compatible through tighter RLS. New frontend uses the transactional save endpoint. Do not remove these compatibility policies while old deployed clients may still be active.
- Existing function ACLs explicitly grant authenticated/service_role; the anonymous revoke does not remove those grants. Only stats, username availability, username recovery and reset-request RPCs remain anonymous.
- `get_home_stats` historical +3 adjustment is preserved so the deployment does not reset the displayed historical count.

## Deployment order

1. Run `npm run test:db` with PostgreSQL 17 and the application tests/build.
2. Read-only production preflight: verify expected project, ensure no duplicate owner among active/matched teams, record table/status/object counts and current schema definitions. The unique index aborts instead of repairing conflicting data.
3. Apply the first migration **as one transaction**. It has a 5-second lock timeout and 30-second statement timeout; on timeout investigate and retry later, never remove the timeout to wait indefinitely on the live site.
4. Check old client paths and the new functions; home stats must remain readable without login, while member view/private rows and purge are blocked anonymously. Confirm table/object counts unchanged.
5. Deploy frontend using the two new RPCs and strict file cleanup. Old clients continue to work with the first migration.
6. Apply the separate, reviewed completed-deletion redaction migration as one transaction. Check affected row count and confirm total notification count unchanged. Active and pending deletion cases must remain untouched.
7. Run the Supabase security/performance advisors. The intentionally filtered definer view may still appear as a generic advisor warning; validate its explicit predicate and SELECT-only ACL, not only the warning label.

No migration creates accounts, rewrites active profiles or teams, deletes storage files, or removes live records. The second migration erases identifying text in finished deletion records and the Auth metadata name only for explicitly completed, already anonymized deleted profiles. It preserves account IDs, usernames, other Auth metadata and all record counts.

## Rollback

If the first migration fails, its surrounding transaction rolls back completely. If frontend deployment fails after a successful migration, roll back the frontend: existing client endpoints were retained. Do not restore public purge execution, unsafe initial role writes, or writable unfiltered member views as a rollback.

For an unexpected policy incompatibility, keep the security boundaries and apply a narrowly tested forward fix. The schema baseline is a test/reference snapshot, not a production rollback or backup; restoration would reopen the vulnerabilities. Completed personal-data redaction has no automatic rollback.

## Remaining operational responsibilities

The integration tests model Postgres authorization and transaction behavior; they do not replace a real-browser login/signup or Supabase Storage HTTP check. Leaked-password protection is an Auth dashboard setting and should be enabled independently if the account plan supports it. File deletion and database anonymization cross separate APIs: the DB prerequisite prevents a successful approval while known objects remain, and the frontend must surface any removal failure. Stale deleted accounts are blocked from further uploads.
