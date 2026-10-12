-- Read only. Current retained state, NOT a historical conversion funnel.
-- Counts active ordinary accounts once each; never returns identities or image paths.
WITH members AS (SELECT id,is_verified,verification_status,student_id_image_path IS NOT NULL AS submitted
 FROM public.profiles WHERE role='user' AND status='active'),
saved AS (SELECT owner_id FROM public.teams UNION SELECT owner_id FROM public.team_drafts),
published AS (SELECT DISTINCT owner_id FROM public.teams),
requested AS (SELECT DISTINCT t.owner_id FROM public.match_requests r JOIN public.teams t ON t.id=r.from_team_id)
SELECT count(*) AS active_registered_members,
 count(*) FILTER (WHERE EXISTS(SELECT 1 FROM saved s WHERE s.owner_id=m.id)) AS retained_team_owners,
 count(*) FILTER (WHERE submitted) AS retained_verification_submissions,
 count(*) FILTER (WHERE is_verified AND verification_status='approved') AS currently_approved,
 count(*) FILTER (WHERE EXISTS(SELECT 1 FROM published p WHERE p.owner_id=m.id)) AS retained_published_owners,
 count(*) FILTER (WHERE EXISTS(SELECT 1 FROM requested r WHERE r.owner_id=m.id)) AS retained_request_senders
FROM members m;
