# Database hardening and rollout

The production project is `slddnhyvstfvobxxcazt` (display name `chuncheon-dating4.0`), used by the deployed 5.0 frontend. All snapshot/test identities in this repository are synthetic or schema metadata. No production user rows or keys belong in these files.

## Files

- `baseline.sql`: reproducible public schema snapshot as of 2026-09-25. It assumes Supabase auth/storage schemas already exist. It is for a fresh disposable test database only; **never apply it to an existing project**.
- `migrations/20260924171521_harden_authorization_and_atomic_teams.sql`: expands API with atomic team save and private-data-safe home results, fixes privilege boundaries, restricts verification uploads, preserves old direct team write endpoints, adds indexes and bucket limits.
- `migrations/20260924172034_redact_completed_deletion_snapshots.sql`: idempotently redacts already completed deletion notification text/payload only when the target profile is deleted. It preserves every notification row, timestamps and status. This intentionally cannot be undone without reintroducing deleted personal information.
- `tests/` and `../scripts/test-db.mjs`: isolated PostgreSQL 17 integration tests with Supabase auth/storage stubs.

## API contracts

`save_my_team(p_team_id uuid, p_intro text, p_team_size integer, p_members jsonb, p_members_consent_confirmed boolean) -> teams`

All five arguments are required. Pass null for p_team_id to create a team, the existing ID to edit an active own team. The return is the created/updated team record. Members is an array of the existing MemberInput objects; IDs, team IDs, order and timestamps are assigned by the server. The caller must be active and verified, give consent, and provide exactly 1–4 members matching team_size. Intro is 4–50 characters (same as the form); each student number is 6–12 digits. Any failure rolls back the complete team/roster change, including trigger errors.

`get_home_teams() -> setof { id, owner_id, gender, intro, status, matched_at, created_at, team_size, members_consent_confirmed, members_consent_at, members, owner_verified }`

For active signed-in members, returns opposite-gender active teams with masked, contact-free member JSON and verification badges. Active administrators receive both genders through the same endpoint. The administrator's own gender does not affect this view. Inactive/deleted administrators receive no home results. It avoids granting access to other users' private profiles. Existing teams/member view queries remain available; the old profile join retains its original RLS behavior.

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

### Administrator visibility and optional MFA

`20260924173007_admin_home_visibility.sql` fixes the home RPC's administrator gender restriction without changing ordinary member matching rules. Active teams owned by active profiles remain the only home entries; hidden/inactive records stay in the dedicated administration views. Row-independent caller checks are scalar subqueries rather than per-row function calls.

`20260924173227_enforce_opted_in_admin_mfa.sql` changes the existing `is_admin` helper. An active administrator with no **verified** MFA factor keeps existing access. Once the administrator explicitly enrolls and verifies a factor on their own device, privileged table, Storage, and admin RPC access require their own signed AAL2 session. An unverified enrollment does not lock the account, and another user's AAL2 token cannot satisfy the check. Enrollment is never automated by this migration. It only reads `auth.mfa_factors`; it neither changes the Auth schema nor reads factor secrets.

Before applying the MFA migration, inspect only the aggregate count of active administrators with verified factors. The initial production preflight found one active administrator and zero with verified factors. If that remains zero, apply the three database migrations before releasing the enrollment UI: existing administrators keep access, and the database protects the first verified enrollment immediately. If a verified factor already exists, first provide the challenge UI without exposing new enrollment, then apply the MFA migration before enabling enrollment. An enrolled AAL1 administrator retains ordinary own-account rights, but loses administration and the both-gender override until completing the challenge. MFA does not override inactive/deleted status.

`20260924173729_protect_relationship_helper_privacy.sql` limits relationship helper RPCs to the caller's own team/match information or an authorized administrator. A member cannot supply someone else's UUID to discover their hidden team IDs, accepted partner IDs, or unrelated pair status. Internal opponent-eligibility checks remain unchanged. Existing own-team and matching-history policies retain their return types and behavior. These helpers inherit the administrator's optional MFA check, so an enrolled AAL1 administrator cannot use them to inspect other accounts.

The three follow-up migrations change functions only and preserve every data row. Apply each in order as its own transaction, after the full database regression suite and MFA UI tests pass. If a client compatibility issue appears, keep the privacy/MFA checks and use a focused forward fix. Do not undo the privacy restriction to restore a client path that queried another member's private relationship state.

The integration tests model Postgres authorization and transaction behavior; they do not replace a real-browser login/signup or Supabase Storage HTTP check. Leaked-password protection is an Auth dashboard setting and should be enabled independently if the account plan supports it. File deletion and database anonymization cross separate APIs: the DB prerequisite prevents a successful approval while known objects remain, and the frontend must surface any removal failure. Stale deleted accounts are blocked from further uploads.

## Applied production history (2026-09-25 KST)

The migration filenames match the versions recorded by the Supabase migration API. Both were applied transactionally after isolated tests and CI succeeded. The source SQL did not change when the files were aligned with the applied version numbers.

- `20260924171521`: authorization and atomic-team hardening. SHA-256 `7172fcf6f7ebb468e14ad1c26646262eb5505282a4e495bf1a08ecaa1653d0c9`.
- `20260924172034`: completed-deletion redaction. SHA-256 `a87cc0851a1d728f142db3b36f059b9fbbf4cb3dac7dd807c7beaf4a248272e9`.

Read-only role checks confirmed anonymous isolation, active male/female home results, own-profile/storage access, accepted counterpart noncontact rosters, and administrator access. Counts remained 135 profiles, 138 Auth accounts, 28 teams, 47 members, 20 match requests, 59 notifications and 134 student-ID objects. The second migration redacted 7 completed deletion notifications and 7 copied Auth names; matching residue checks returned zero. Pending deletion cases and files were not removed.

The production frontend passed public mobile/desktop and direct-route smoke checks, actual security-header checks, and anonymous HTTP isolation checks. These checks do not constitute a real-member signup/matching/deletion write test, a backup restoration test, or a load test.
