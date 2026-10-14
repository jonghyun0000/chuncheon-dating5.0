-- Synthetic-only regressions. Each case executes in a disposable DB transaction.

-- TEST signup-without-photo NORMAL Signup without a photo is denied even when the UI is bypassed
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,agreed_privacy,agreed_terms,agreed_disclaimer,terms_version,terms_agreed_at)
VALUES(auth.uid(),'no-photo','Synthetic','male','강원대','kakao','synthetic',true,true,true,'v5.1',now())$q$);

-- TEST draft-private NORMAL Unverified users can persist and edit only their private draft
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Synthetic draft',2,test_support.members(),true);
SELECT public.save_my_team_draft((SELECT id FROM public.team_drafts WHERE owner_id=auth.uid()),'Edited draft',1,test_support.members(1),true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.team_drafts WHERE owner_id=auth.uid() AND intro='Edited draft' AND team_size=1),'one editable draft');
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.teams WHERE owner_id=auth.uid()),'draft never enters teams');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.expect_no_rows('SELECT * FROM public.team_drafts');
SELECT test_support.expect_no_changes('DELETE FROM public.team_drafts');
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000006'),'home excludes draft');
SELECT test_support.expect_no_rows($q$SELECT contact_id FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000006'$q$);

-- TEST draft-photo-pending NORMAL Pending uploaded photos allow publishing without an approval badge
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Synthetic draft',2,test_support.members(),true);
SELECT public.publish_my_team_draft((SELECT id FROM public.team_drafts WHERE owner_id=auth.uid()));
SELECT test_support.assert(public.can_participate(auth.uid()),'pending uploaded account can participate');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert((SELECT NOT owner_verified AND jsonb_array_length(members)=2 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000006'),'pending team visible without badge');
SELECT test_support.assert(public.can_request_match('10000000-0000-4000-8000-000000000002',(SELECT id FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000006')),'pending team can match');

-- TEST draft-publish-approved NORMAL Approval retains private draft until owner explicitly publishes
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Synthetic draft',2,test_support.members(),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id='00000000-0000-4000-8000-000000000006';
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000006'),'approval does not publish automatically');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT public.publish_my_team_draft((SELECT id FROM public.team_drafts WHERE owner_id=auth.uid()));
SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id=auth.uid() AND status='active'),'approved publish creates one team');
SELECT test_support.assert((SELECT count(*)=2 FROM public.team_members WHERE team_id IN (SELECT id FROM public.teams WHERE owner_id=auth.uid())),'complete roster published atomically');
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.team_drafts WHERE owner_id=auth.uid()),'published draft removed');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000006'),'approved team visible');
SELECT test_support.expect_no_rows($q$SELECT contact_id FROM public.team_members WHERE team_id IN(SELECT id FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000006')$q$);

-- TEST draft-cross-owner NORMAL Draft RPC rejects another owner and direct table writes
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Synthetic draft',2,test_support.members(),true);
SELECT set_config('test.draft_id',(SELECT id::text FROM public.team_drafts WHERE owner_id=auth.uid()),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(current_setting('test.draft_id')::uuid,'Hijacked draft',2,test_support.members(),true)$q$);
SELECT test_support.expect_denied($q$SELECT public.publish_my_team_draft(current_setting('test.draft_id')::uuid)$q$);
SELECT test_support.expect_denied($q$UPDATE public.team_drafts SET owner_id=auth.uid()$q$);
SELECT test_support.expect_denied($q$INSERT INTO public.team_drafts(owner_id,gender,intro,team_size,members,members_consent_confirmed) VALUES(auth.uid(),'male','Direct draft',2,test_support.members(),true)$q$);

-- TEST draft-invalid-atomic NORMAL Invalid roster never replaces a valid draft
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Original draft',2,test_support.members(),true);
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Invalid draft',2,test_support.members(1),true)$q$);
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Invalid draft',2,test_support.members(),false)$q$);
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Invalid draft',2,jsonb_set(test_support.members(),'{0,school}','"Other"'),true)$q$);
SELECT test_support.assert((SELECT intro='Original draft' AND jsonb_array_length(members)=2 FROM public.team_drafts WHERE owner_id=auth.uid()),'failed edit preserves entire draft');

-- TEST student-id-submit NORMAL Later upload and rejected resubmission cannot self-approve
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('student-ids',auth.uid()::text||'/resubmitted.png',auth.uid());
SELECT public.submit_student_id(auth.uid()::text||'/resubmitted.png');
SELECT test_support.assert((SELECT student_id_image_path=auth.uid()::text||'/resubmitted.png' AND NOT is_verified AND verification_status='pending' FROM public.profiles WHERE id=auth.uid()),'submission remains pending');
SELECT test_support.expect_denied($q$UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id=auth.uid()$q$);
SELECT test_support.expect_denied($q$SELECT public.submit_student_id('00000000-0000-4000-8000-000000000003/fixture.jpg')$q$);
SELECT test_support.expect_denied($q$SELECT public.submit_student_id(auth.uid()::text||'/missing.png')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET is_verified=false,verification_status='rejected' WHERE id='00000000-0000-4000-8000-000000000006';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('student-ids',auth.uid()::text||'/retry.png',auth.uid());
SELECT public.submit_student_id(auth.uid()::text||'/retry.png');
SELECT test_support.assert((SELECT verification_status='pending' AND NOT is_verified AND verification_restricted FROM public.profiles WHERE id=auth.uid()),'rejected resubmission stays restricted');
SELECT test_support.assert(NOT public.can_participate(auth.uid()),'resubmission cannot bypass restriction');
SELECT test_support.expect_denied($q$UPDATE public.profiles SET verification_restricted=false WHERE id=auth.uid()$q$);
SELECT test_support.expect_denied($q$SELECT public.save_my_team(NULL,'Blocked team',2,test_support.members(),true)$q$);
SELECT test_support.expect_no_rows('SELECT * FROM public.get_home_teams()');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id='00000000-0000-4000-8000-000000000006';
SELECT test_support.assert(public.can_participate('00000000-0000-4000-8000-000000000006'),'reapproval restores participation');
SELECT test_support.assert((SELECT NOT verification_restricted FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000006'),'reapproval clears restriction');

-- TEST approval-needs-photo NORMAL Legacy missing-photo members remain able to browse but cannot be approved without a photo
-- Privileged setup models an existing legacy record, not a new signup.
UPDATE public.profiles SET student_id_image_path=NULL WHERE id='00000000-0000-4000-8000-000000000006';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(public.is_active_user(auth.uid()) AND NOT public.can_participate(auth.uid()),'legacy missing-photo user keeps browsing only');
SELECT test_support.assert((SELECT count(*)>0 FROM public.get_home_teams()),'legacy browsing preserved');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.expect_denied($q$UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id='00000000-0000-4000-8000-000000000006'$q$);

-- TEST draft-inactive-anon NORMAL Inactive and anonymous sessions cannot save publish or upload
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Suspended draft',2,test_support.members(),true)$q$);
SELECT test_support.expect_denied($q$SELECT public.submit_student_id(auth.uid()::text||'/fixture.jpg')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Anon draft',2,test_support.members(),true)$q$);
SELECT test_support.expect_denied($q$SELECT public.publish_my_team_draft(NULL)$q$);
SELECT test_support.expect_denied($q$SELECT public.submit_student_id(NULL)$q$);
SELECT test_support.expect_no_rows('SELECT * FROM public.team_drafts');

-- TEST draft-withdrawal NORMAL Withdrawal deletes draft contacts and blocks stale sessions
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Synthetic draft',2,test_support.members(),true);
SELECT public.delete_my_account();
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Withdrawn draft',2,test_support.members(),true)$q$);
RESET ROLE;
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.team_drafts WHERE owner_id='00000000-0000-4000-8000-000000000006'),'withdrawal clears draft contacts');

-- TEST revoked-team-hidden NORMAL Revoked owners disappear from recruitment and matching APIs
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET is_verified=false,verification_status='rejected' WHERE id='00000000-0000-4000-8000-000000000008';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000008'),'revoked team removed from home');
SELECT test_support.expect_no_rows($q$SELECT * FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000008'$q$);
SELECT test_support.assert(NOT public.can_request_match('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000008'),'revoked team cannot receive match');

-- TEST rejection-existing-match NORMAL Rejection blocks both directions even for existing requests and accepted matches
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET is_verified=false,verification_status='rejected' WHERE id='00000000-0000-4000-8000-000000000003';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.expect_no_rows($q$SELECT * FROM public.teams WHERE id='10000000-0000-4000-8000-000000000003'$q$);
SELECT test_support.expect_no_rows($q$SELECT * FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000003'$q$);
SELECT test_support.expect_no_rows($q$SELECT * FROM public.match_requests WHERE id='30000000-0000-4000-8000-000000000001'$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT test_support.expect_no_rows($q$SELECT * FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000002'$q$);
SELECT test_support.expect_no_rows('SELECT * FROM public.match_requests');
SELECT test_support.assert((SELECT verification_restricted FROM public.profiles WHERE id=auth.uid()),'restricted member can still read correction status');
SELECT public.delete_my_account();
SELECT test_support.assert((SELECT status='deleted' FROM public.profiles WHERE id=auth.uid()),'restriction must not prevent withdrawal');

-- TEST reapproval-suspended NORMAL Verification approval never lifts an independent administrator suspension
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET verification_status='rejected',is_verified=false WHERE id='00000000-0000-4000-8000-000000000005';
UPDATE public.profiles SET verification_status='approved',is_verified=true WHERE id='00000000-0000-4000-8000-000000000005';
SELECT test_support.assert(NOT public.can_participate('00000000-0000-4000-8000-000000000005'),'approved suspended account remains blocked');
