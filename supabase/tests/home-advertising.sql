-- TEST AD01_access PASS Anonymous and ordinary members cannot use ad management or read raw metrics
SET LOCAL ROLE anon;
SELECT test_support.expect_denied('SELECT public.get_home_advertising()');
SELECT test_support.expect_denied($q$SELECT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true)$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied('SELECT * FROM public.get_admin_home_ad_banners()');
SELECT test_support.expect_denied('SELECT * FROM public.get_admin_home_ad_metrics(current_date,current_date)');
SELECT test_support.expect_denied($q$SELECT public.create_home_ad_banner('a0000000-0000-4000-8000-000000000001','Shop','Offer','','https://example.test',NULL,NULL,NULL)$q$);
SELECT test_support.expect_denied($q$SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000001',true)$q$);
SELECT test_support.expect_denied('SELECT * FROM home_ads.visits');
SELECT test_support.expect_denied('SELECT * FROM home_ads.reach');
SELECT test_support.expect_denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES('ad-banner-images','00000000-0000-4000-8000-000000000002/a0000000-0000-4000-8000-000000000001.jpg')$q$);

-- TEST AD02_banner_lifecycle PASS Registration is paused, is safe to retry and preserves private images
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name)
VALUES('ad-banner-images','00000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg');
SELECT public.create_home_ad_banner('a0000000-0000-4000-8000-000000000001','Shop','Offer','Benefit','https://example.test/offer',
  '00000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg',NULL,NULL);
SELECT public.create_home_ad_banner('a0000000-0000-4000-8000-000000000001','Shop','Offer','Benefit','https://example.test/offer',
  '00000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg',NULL,NULL);
SELECT test_support.assert((SELECT count(*)=1 AND bool_and(NOT enabled) FROM public.get_admin_home_ad_banners()),'one paused banner after retry');
SELECT test_support.assert((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='ad-banner-images'),'admin can preview image');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(public.get_home_advertising()->'banner'='null'::jsonb,'paused banner hidden');
SELECT test_support.expect_no_rows($q$SELECT * FROM storage.objects WHERE bucket_id='ad-banner-images'$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(public.get_home_advertising()->'banner'->>'headline'='Offer','live banner delivered');
SELECT test_support.assert((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='ad-banner-images'),'active image available');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(public.get_home_advertising()->'banner'='null'::jsonb,'paused banner disappears');
SELECT test_support.assert(NOT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true),'stale clicks cannot be counted after pause');
SELECT test_support.expect_no_rows($q$SELECT * FROM storage.objects WHERE bucket_id='ad-banner-images'$q$);

-- TEST AD03_unique_counts PASS Repeat visits and clicks are deduplicated and a fast click includes a view
INSERT INTO home_ads.banners(id,advertiser,headline,destination_url,starts_at,enabled)
VALUES('a0000000-0000-4000-8000-000000000001','Shop','Offer','https://example.test',now(),true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.get_home_advertising();
SELECT public.get_home_advertising();
SELECT test_support.assert(public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true),'fast click accepted');
SELECT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true);
SELECT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.get_home_advertising();
SELECT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',false);
SELECT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT public.get_home_advertising();
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert(public.get_home_advertising()->'banners'->0->>'headline'='Offer','admin can see live ads');
SELECT test_support.assert((SELECT visitors=3 AND viewers=2 AND clickers=1 AND tracked
  FROM public.get_admin_home_ad_metrics((now() AT TIME ZONE 'Asia/Seoul')::date,(now() AT TIME ZONE 'Asia/Seoul')::date)),
  'three visitors, two viewers, one clicker');

-- TEST AD04_reporting PASS All-banner totals deduplicate across banners and dates are Korea dates
SET LOCAL TIME ZONE 'Pacific/Honolulu';
INSERT INTO home_ads.banners(id,advertiser,headline,destination_url,starts_at)
VALUES('a0000000-0000-4000-8000-000000000001','Shop A','Offer A','https://example.test',now()),
 ('a0000000-0000-4000-8000-000000000002','Shop B','Offer B','https://example.test',now());
INSERT INTO home_ads.visits(day,member_id)
VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date-1,'00000000-0000-4000-8000-000000000002'),
 ((now() AT TIME ZONE 'Asia/Seoul')::date,'00000000-0000-4000-8000-000000000002');
INSERT INTO home_ads.reach(day,banner_id,member_id,clicked)
VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date,'a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true),
 ((now() AT TIME ZONE 'Asia/Seoul')::date,'a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',false);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert((SELECT count(*)=3 FROM public.get_admin_home_ad_metrics(
 (now() AT TIME ZONE 'Asia/Seoul')::date-2,(now() AT TIME ZONE 'Asia/Seoul')::date)),'three calendar days');
SELECT test_support.assert((SELECT visitors=1 AND viewers=1 AND clickers=1 FROM public.get_admin_home_ad_metrics(
 (now() AT TIME ZONE 'Asia/Seoul')::date,(now() AT TIME ZONE 'Asia/Seoul')::date)),'one person across two banners');
SELECT test_support.assert((SELECT visitors=1 AND viewers=1 AND clickers=0 FROM public.get_admin_home_ad_metrics(
 (now() AT TIME ZONE 'Asia/Seoul')::date,(now() AT TIME ZONE 'Asia/Seoul')::date,'a0000000-0000-4000-8000-000000000002')),'banner filter affects only exposure and clicks');
SELECT test_support.assert((SELECT NOT tracked FROM public.get_admin_home_ad_metrics(
 (now() AT TIME ZONE 'Asia/Seoul')::date-2,(now() AT TIME ZONE 'Asia/Seoul')::date-2)),'pre-tracking dates are not reported as observed zero');
SELECT test_support.expect_denied('SELECT * FROM public.get_admin_home_ad_metrics(current_date-90,current_date)');

-- TEST AD05_schedule PASS Overlapping schedules are allowed and ended or future ads are not counted
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.create_home_ad_banner('a0000000-0000-4000-8000-000000000001','A','A','','https://example.test',NULL,now()-interval '2 days',now()-interval '1 day');
SELECT public.create_home_ad_banner('a0000000-0000-4000-8000-000000000002','B','B','','https://example.test',NULL,now()+interval '1 day',now()+interval '2 days');
SELECT public.create_home_ad_banner('a0000000-0000-4000-8000-000000000003','C','C','','https://example.test',NULL,now()+interval '1 day',NULL);
SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000002',true);
SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000003',true);
SELECT test_support.expect_denied($q$SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000001',true)$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(public.get_home_advertising()->'banner'='null'::jsonb,'future/ended banner hidden');
SELECT test_support.assert(NOT public.record_home_ad_event('a0000000-0000-4000-8000-000000000002',false),'future events rejected');

-- TEST AD06_mfa PASS Enrolled administrators need a verified MFA session to manage ads
INSERT INTO auth.mfa_factors(user_id,status) VALUES('00000000-0000-4000-8000-000000000001','verified');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied('SELECT * FROM public.get_admin_home_ad_banners()');
SELECT test_support.expect_denied('SELECT * FROM public.get_admin_home_ad_metrics(current_date,current_date)');
SELECT set_config('request.jwt.claim.aal','aal2',true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_admin_home_ad_banners()),'AAL2 admits administrator');

-- TEST AD07_validation PASS Unsafe destinations and missing or mismatched images are rejected
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.create_home_ad_banner(
 'a0000000-0000-4000-8000-000000000001','A','A','','javascript:alert(1)',NULL,NULL,NULL)$q$);
SELECT test_support.expect_denied($q$SELECT public.create_home_ad_banner(
 'a0000000-0000-4000-8000-000000000001','A','A','','https://shop.example@elsewhere.test',NULL,NULL,NULL)$q$);
SELECT test_support.expect_denied($q$SELECT public.create_home_ad_banner(
 'a0000000-0000-4000-8000-000000000001','A','A','','https://shop.example','00000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.jpg',NULL,NULL)$q$);

-- TEST AD08_ineligible PASS Rejected and inactive members do not receive ads or affect the counts
INSERT INTO home_ads.banners(id,advertiser,headline,destination_url,starts_at,enabled)
VALUES('a0000000-0000-4000-8000-000000000001','Shop','Offer','https://example.test',now(),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET verification_status='rejected' WHERE id='00000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(public.get_home_advertising() IS NULL,'rejected member excluded');
SELECT test_support.assert(NOT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true),'rejected click excluded');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SELECT test_support.assert(public.get_home_advertising() IS NULL,'inactive member excluded');
SELECT test_support.assert(NOT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true),'inactive click excluded');
RESET ROLE;
SELECT test_support.assert((SELECT count(*)=0 FROM home_ads.visits),'no invalid visitors');
SELECT test_support.assert((SELECT count(*)=0 FROM home_ads.reach),'no invalid exposures');

-- TEST AD09_multiple_live PASS Multiple active banners are ordered and admin preview preserves metrics
INSERT INTO home_ads.banners(id,advertiser,headline,destination_url,starts_at,enabled)
VALUES ('a0000000-0000-4000-8000-000000000001','Shop A','Offer A','https://example.test',now()-interval '1 minute',true),
       ('a0000000-0000-4000-8000-000000000002','Shop B','Offer B','https://example.test',now(),true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(public.get_home_advertising()->'banners' @>
 '[{"headline":"Offer A"},{"headline":"Offer B"}]'::jsonb, 'both live ads delivered');
SELECT test_support.assert(public.get_home_advertising()->'banners'->0->>'headline'='Offer A','stable start order');
SELECT test_support.assert(public.record_home_ad_event('a0000000-0000-4000-8000-000000000002',true),'second banner recorded');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert(jsonb_array_length(public.get_home_advertising()->'banners')=2,'admin sees both');
SELECT test_support.assert(NOT public.record_home_ad_event('a0000000-0000-4000-8000-000000000001',true),'admin click ignored');
SELECT test_support.assert((SELECT visitors=1 AND viewers=1 AND clickers=1
  FROM public.get_admin_home_ad_metrics((now() AT TIME ZONE 'Asia/Seoul')::date,(now() AT TIME ZONE 'Asia/Seoul')::date)),
  'only member activity counted');
SELECT public.set_home_ad_enabled('a0000000-0000-4000-8000-000000000001',false);
SELECT test_support.assert(public.get_home_advertising()->'banners'->0->>'headline'='Offer B','pausing leaves the other ad live');

-- TEST AD10_edit PASS An authorized edit preserves status and statistics and protects image ownership
INSERT INTO home_ads.banners(id,advertiser,headline,destination_url,starts_at,enabled)
VALUES ('a0000000-0000-4000-8000-000000000001','Shop','Old headline','https://example.test',now(),true);
INSERT INTO home_ads.reach(day,banner_id,member_id,clicked)
VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date,'a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',true);
INSERT INTO storage.objects(bucket_id,name,owner)
VALUES ('ad-banner-images','00000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000004.jpg','00000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.expect_denied($q$SELECT public.edit_home_ad_banner(
 'a0000000-0000-4000-8000-000000000001','Shop','Forbidden','','https://example.test',false,NULL,NULL,NULL)$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.expect_denied($q$SELECT public.edit_home_ad_banner(
 'a0000000-0000-4000-8000-000000000001','Shop','Forbidden','','https://example.test',true,'other/private.jpg',NULL,NULL)$q$);
SELECT public.edit_home_ad_banner('a0000000-0000-4000-8000-000000000001','New shop','New headline','Benefit',
 'https://example.test/new',true,'00000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000004.jpg',NULL,now()+interval '1 day');
SELECT test_support.assert((SELECT enabled AND headline='New headline' AND image_path IS NOT NULL
 FROM public.get_admin_home_ad_banners()),'title and image changed while enabled');
SELECT test_support.assert((SELECT viewers=1 AND clickers=1
 FROM public.get_admin_home_ad_metrics((now() AT TIME ZONE 'Asia/Seoul')::date,(now() AT TIME ZONE 'Asia/Seoul')::date)),
 'existing metrics preserved');
SELECT public.edit_home_ad_banner('a0000000-0000-4000-8000-000000000001','New shop','New headline','Benefit',
 'https://example.test/new',false,NULL,NULL,NULL);
SELECT test_support.assert((SELECT enabled AND image_path IS NOT NULL AND ends_at IS NULL
 FROM public.get_admin_home_ad_banners()),'keep image and clear end time');
SELECT public.edit_home_ad_banner('a0000000-0000-4000-8000-000000000001','New shop','New headline','Benefit',
 'https://example.test/new',true,NULL,NULL,NULL);
SELECT test_support.assert((SELECT enabled AND image_path IS NULL
 FROM public.get_admin_home_ad_banners()),'remove image without changing enabled status');
