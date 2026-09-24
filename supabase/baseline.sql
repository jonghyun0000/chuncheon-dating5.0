-- Reproducible public schema snapshot from production metadata, 2026-09-25.
-- NO ROW DATA. For disposable local tests AFTER auth/storage Supabase stubs.
-- Do not run this baseline against an existing project.
SET check_function_bodies = false;
CREATE SEQUENCE public.lookup_attempts_id_seq;
CREATE TABLE public."lookup_attempts" (
  "id" bigint DEFAULT nextval('lookup_attempts_id_seq'::regclass) NOT NULL,
  "kind" text NOT NULL,
  "key_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."lookup_attempts" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."match_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "from_team_id" uuid NOT NULL,
  "to_team_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone
);
ALTER TABLE public."match_requests" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "ref_id" uuid,
  "target_user_id" uuid,
  "title" text DEFAULT ''::text NOT NULL,
  "message" text DEFAULT ''::text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_handled" boolean DEFAULT false NOT NULL,
  "handled_at" timestamp with time zone,
  "handled_by" uuid,
  "admin_memo" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "username" text NOT NULL,
  "name" text NOT NULL,
  "gender" text NOT NULL,
  "school" text NOT NULL,
  "contact_type" text NOT NULL,
  "contact_id" text NOT NULL,
  "student_id_image_path" text,
  "is_verified" boolean DEFAULT false NOT NULL,
  "verification_status" text DEFAULT 'pending'::text NOT NULL,
  "role" text DEFAULT 'user'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "agreed_privacy" boolean DEFAULT false NOT NULL,
  "agreed_terms" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "student_number" text,
  "agreed_disclaimer" boolean DEFAULT false NOT NULL,
  "terms_version" text,
  "terms_agreed_at" timestamp with time zone
);
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "reporter_id" uuid NOT NULL,
  "target_team_id" uuid,
  "target_user_id" uuid,
  "category" text NOT NULL,
  "detail" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "admin_memo" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
ALTER TABLE public."reports" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "nickname" text NOT NULL,
  "school" text NOT NULL,
  "rating" integer NOT NULL,
  "content" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."reviews" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."team_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL,
  "member_order" integer NOT NULL,
  "school" text NOT NULL,
  "department" text NOT NULL,
  "student_number" text NOT NULL,
  "nickname" text NOT NULL,
  "smoking" boolean DEFAULT false NOT NULL,
  "contact_type" text NOT NULL,
  "contact_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "taste_tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "want_tags" text[] DEFAULT '{}'::text[] NOT NULL
);
ALTER TABLE public."team_members" ENABLE ROW LEVEL SECURITY;
CREATE TABLE public."teams" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "gender" text NOT NULL,
  "intro" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "matched_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "team_size" integer DEFAULT 3 NOT NULL,
  "members_consent_confirmed" boolean DEFAULT false NOT NULL,
  "members_consent_at" timestamp with time zone
);
ALTER TABLE public."teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_pkey" PRIMARY KEY (id);
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_rating_check" CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_school_check" CHECK ((school = ANY (ARRAY['강원대'::text, '한림대'::text, '성심대'::text, '춘교대'::text])));
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."match_requests" ADD CONSTRAINT "match_requests_check" CHECK ((from_team_id <> to_team_id));
ALTER TABLE public."match_requests" ADD CONSTRAINT "match_requests_from_team_id_to_team_id_key" UNIQUE (from_team_id, to_team_id);
ALTER TABLE public."match_requests" ADD CONSTRAINT "match_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."match_requests" ADD CONSTRAINT "match_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_contact_type_check" CHECK ((contact_type = ANY (ARRAY['kakao'::text, 'phone'::text, 'instagram'::text])));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_member_order_check" CHECK (((member_order >= 1) AND (member_order <= 4)));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_phone_format" CHECK (((contact_type <> 'phone'::text) OR (contact_id ~ '^01[0-9]{8,9}$'::text)));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_school_check" CHECK ((school = ANY (ARRAY['강원대'::text, '한림대'::text, '성심대'::text, '춘교대'::text])));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_student_number_check" CHECK ((student_number ~ '^[0-9]{0,12}$'::text));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_taste_tags_check" CHECK (((cardinality(taste_tags) <= 3) AND (taste_tags <@ ARRAY['drink_love'::text, 'drink_light'::text, 'cafe'::text, 'food'::text, 'workout'::text, 'game'::text, 'movie'::text, 'music'::text, 'travel'::text, 'photo'::text, 'pet'::text, 'fashion'::text])));
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_team_id_member_order_key" UNIQUE (team_id, member_order);
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_want_tags_check" CHECK (((cardinality(want_tags) <= 3) AND (want_tags <@ ARRAY['humor'::text, 'reaction'::text, 'talk'::text, 'lively'::text, 'calm'::text, 'drinker'::text, 'similar'::text, 'easygoing'::text])));
ALTER TABLE public."teams" ADD CONSTRAINT "teams_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])));
ALTER TABLE public."teams" ADD CONSTRAINT "teams_pkey" PRIMARY KEY (id);
ALTER TABLE public."teams" ADD CONSTRAINT "teams_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'hidden'::text, 'matched'::text])));
ALTER TABLE public."teams" ADD CONSTRAINT "teams_team_size_check" CHECK (((team_size >= 1) AND (team_size <= 4)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_contact_type_check" CHECK ((contact_type = ANY (ARRAY['kakao'::text, 'phone'::text, 'instagram'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_phone_format" CHECK (((contact_type <> 'phone'::text) OR (contact_id ~ '^01[0-9]{8,9}$'::text)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_school_check" CHECK ((school = ANY (ARRAY['강원대'::text, '한림대'::text, '성심대'::text, '춘교대'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'deleted'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_student_number_check" CHECK (((student_number IS NULL) OR (student_number ~ '^[0-9]{6,12}$'::text)));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE (username);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_verification_status_check" CHECK ((verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ((type = ANY (ARRAY['match_request'::text, 'match_accepted'::text, 'password_reset'::text, 'report'::text, 'account_deletion'::text])));
ALTER TABLE public."reports" ADD CONSTRAINT "reports_category_check" CHECK ((category = ANY (ARRAY['inappropriate'::text, 'no_show'::text, 'fraud'::text, 'privacy'::text, 'stalking'::text, 'fake'::text, 'other'::text])));
ALTER TABLE public."reports" ADD CONSTRAINT "reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."reports" ADD CONSTRAINT "reports_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])));
ALTER TABLE public."lookup_attempts" ADD CONSTRAINT "lookup_attempts_kind_check" CHECK ((kind = ANY (ARRAY['find_username'::text, 'password_reset'::text])));
ALTER TABLE public."lookup_attempts" ADD CONSTRAINT "lookup_attempts_pkey" PRIMARY KEY (id);
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."match_requests" ADD CONSTRAINT "match_requests_from_team_id_fkey" FOREIGN KEY (from_team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."match_requests" ADD CONSTRAINT "match_requests_to_team_id_fkey" FOREIGN KEY (to_team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public."teams" ADD CONSTRAINT "teams_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_handled_by_fkey" FOREIGN KEY (handled_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public."reports" ADD CONSTRAINT "reports_target_team_id_fkey" FOREIGN KEY (target_team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE public."reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.accept_match_request(req_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_from uuid;
  v_to uuid;
  v_to_owner uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 인증·활성 상태가 아니면 수락 불가
  if not public.can_participate(v_uid) then
    raise exception '학생증 인증이 완료된 활성 계정만 매칭을 수락할 수 있습니다.'
      using errcode = '42501';
  end if;

  select from_team_id, to_team_id, status
    into v_from, v_to, v_status
    from public.match_requests
   where id = req_id;

  if v_from is null then
    raise exception '신청이 존재하지 않습니다.';
  end if;

  if v_status <> 'pending' then
    raise exception '이미 처리된 신청입니다.';
  end if;

  select owner_id into v_to_owner from public.teams where id = v_to;
  if v_to_owner <> v_uid then
    raise exception '수락 권한이 없습니다.';
  end if;

  update public.match_requests
     set status = 'accepted', responded_at = now()
   where id = req_id;

  update public.teams
     set status = 'matched', matched_at = now()
   where id in (v_from, v_to);

  -- 남은 pending 은 '거절' 이 아니라 '취소' 로 정리합니다.
  update public.match_requests
     set status = 'cancelled', responded_at = now()
   where status = 'pending'
     and id <> req_id
     and (from_team_id in (v_from, v_to) or to_team_id in (v_from, v_to));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_approve_account_deletion(p_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.is_admin(v_admin) then
    raise exception '관리자만 사용할 수 있습니다.' using errcode = '42501';
  end if;

  if p_uid is null then
    raise exception '대상 회원이 지정되지 않았습니다.';
  end if;

  perform public.purge_user_content(p_uid);

  -- 탈퇴 알림을 처리 완료로 표시 (기록은 남김)
  update public.notifications
     set is_handled = true,
         handled_at = now(),
         handled_by = v_admin
   where target_user_id = p_uid
     and type = 'account_deletion'
     and is_handled = false;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.is_admin(v_admin) then
    raise exception '관리자만 사용할 수 있습니다.' using errcode = '42501';
  end if;

  if p_uid is null then
    raise exception '대상 회원이 지정되지 않았습니다.';
  end if;

  if p_uid = v_admin then
    raise exception '본인 계정은 삭제할 수 없습니다.';
  end if;

  if public.is_admin(p_uid) then
    raise exception '다른 관리자 계정은 삭제할 수 없습니다.';
  end if;

  perform public.purge_user_content(p_uid);

  update public.notifications
     set is_handled = true,
         handled_at = now(),
         handled_by = v_admin
   where target_user_id = p_uid
     and type = 'account_deletion'
     and is_handled = false;
end $function$;

CREATE OR REPLACE FUNCTION public.can_participate(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.status = 'active' and p.is_verified
       from public.profiles p
      where p.id = uid),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_request_match(from_team uuid, to_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1
      from public.teams f
      join public.teams t  on t.id = to_team
      join public.profiles fp on fp.id = f.owner_id
      join public.profiles tp on tp.id = t.owner_id
     where f.id = from_team
       and f.status = 'active'
       and t.status = 'active'
       and f.gender <> t.gender
       -- 양쪽 팀 주인 모두 인증 완료 · 활성 상태
       and fp.status = 'active' and fp.is_verified
       and tp.status = 'active' and tp.is_verified
       -- 팀 인원수가 정확히 같아야 합니다. (3:3 만 3:3 과 매칭)
       and coalesce(f.team_size, 3) = coalesce(t.team_size, 3)
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_team_roster(team uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    -- (1) 내가 소유한 팀
    exists (select 1 from public.teams t where t.id = team and t.owner_id = uid)
    -- (2) 홈에 노출되는 활성 팀 (소유자도 활성 상태여야 함)
    or exists (
      select 1 from public.teams t
        join public.profiles p on p.id = t.owner_id
       where t.id = team and t.status = 'active' and p.status = 'active'
    )
    -- (3) 내 팀과 신청을 주고받은 팀 (보낸 신청·받은 신청 모두)
    or exists (
      select 1
        from public.match_requests r
       where (r.from_team_id = team and r.to_team_id   in (select public.my_team_ids(uid)))
          or (r.to_team_id   = team and r.from_team_id in (select public.my_team_ids(uid)))
    );
$function$;

CREATE OR REPLACE FUNCTION public.check_lookup_rate(p_kind text, p_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hash text := md5(lower(coalesce(p_key, '')));
  v_cnt  int;
begin
  -- 오래된 기록 정리 (테이블이 커지지 않게)
  delete from public.lookup_attempts where created_at < now() - interval '1 hour';

  select count(*) into v_cnt
    from public.lookup_attempts
   where kind = p_kind
     and key_hash = v_hash
     and created_at > now() - interval '10 minutes';

  if v_cnt >= 5 then
    return false;
  end if;

  insert into public.lookup_attempts (kind, key_hash) values (p_kind, v_hash);
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_p   record;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select username, name, school, gender, contact_type, contact_id, status
    into v_p
    from public.profiles
   where id = v_uid;

  if not found then
    raise exception '회원 정보를 찾을 수 없습니다.';
  end if;

  if v_p.status = 'deleted' then
    -- 이미 탈퇴한 계정 — 중복 알림을 만들지 않고 조용히 종료합니다.
    return;
  end if;

  -- 1) 내 팀을 즉시 내려서 다른 회원에게 더 이상 보이지 않게 합니다.
  --    (팀원 정보·매칭 신청은 FK cascade 로 함께 삭제)
  delete from public.teams where owner_id = v_uid;

  -- 2) 나에게 오던 기존 알림 정리
  delete from public.notifications where target_user_id = v_uid;

  -- 3) 계정 즉시 이용 중지 (status 만 변경 → 트리거 통과)
  update public.profiles
     set status = 'deleted'
   where id = v_uid;

  -- 4) 관리자 대시보드에 탈퇴 알림 등록
  insert into public.notifications (type, ref_id, target_user_id, title, message, payload)
  values (
    'account_deletion',
    v_uid,
    v_uid,
    v_p.name || ' 회원이 탈퇴했습니다.',
    v_p.name || '(@' || v_p.username || ') 님이 탈퇴를 요청했습니다.' || E'\n' ||
    '학교: ' || v_p.school || E'\n' ||
    '계정은 이미 이용 중지되었고 등록했던 팀은 삭제되었습니다.' || E'\n' ||
    '[탈퇴 승인] 을 누르면 이름·연락처·학생증 사진이 완전히 삭제됩니다.',
    jsonb_build_object(
      'username',     v_p.username,
      'name',         v_p.name,
      'school',       v_p.school,
      'gender',       v_p.gender,
      'contact_type', v_p.contact_type,
      'contact_id',   v_p.contact_id,
      'requested_at', now()
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.find_username(p_name text, p_school text, p_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_username text;
begin
  perform pg_sleep(1);

  if coalesce(btrim(p_name), '') = ''
     or coalesce(btrim(p_school), '') = ''
     or coalesce(btrim(p_key), '') = '' then
    return null;
  end if;

  if not public.check_lookup_rate('find_username', btrim(p_name) || '|' || btrim(p_school)) then
    return null;
  end if;

  select username
    into v_username
    from public.profiles
   where status <> 'deleted'
     and lower(btrim(name))   = lower(btrim(p_name))
     and btrim(school)        = btrim(p_school)
     and (
       (student_number is not null
        and regexp_replace(student_number, '\D', '', 'g') =
            regexp_replace(p_key,          '\D', '', 'g')
        and regexp_replace(p_key, '\D', '', 'g') <> '')
       or lower(btrim(contact_id)) = lower(btrim(p_key))
       -- 전화번호 회원: 하이픈·공백 섞인 입력도 숫자만 비교
       or (contact_type = 'phone'
           and regexp_replace(p_key, '\D', '', 'g') <> ''
           and regexp_replace(contact_id, '\D', '', 'g') =
               regexp_replace(p_key,      '\D', '', 'g'))
     )
   order by created_at
   limit 1;

  return v_username;
end $function$;

CREATE OR REPLACE FUNCTION public.finish_my_team()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.teams
     set status = 'hidden'
   where owner_id = v_uid
     and status = 'matched';
end $function$;

CREATE OR REPLACE FUNCTION public.get_home_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    -- 지금 살아 있는 팀 (종료된 hidden 팀은 제외)
    'total_teams',   (select count(*) from public.teams
                       where status in ('active','matched')),
    -- 수락된 신청 1건 = 매칭 성사 1건
    -- + 3 : 회원 탈퇴로 팀이 삭제되면서 함께 사라진 과거 매칭 보정 (2026-09)
    'matched_count', (select count(*) from public.match_requests
                       where status = 'accepted') + 3,
    'total_users',   (select count(*) from public.profiles
                       where status = 'active')
  );
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- service_role / 내부 작업 (auth.uid() 없음) 은 통과
  if auth.uid() is null then
    return new;
  end if;

  -- 관리자는 통과
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.username is distinct from old.username then
    raise exception '아이디(username)는 변경할 수 없습니다. 관리자에게 문의해주세요.'
      using errcode = '42501';
  end if;

  if new.gender is distinct from old.gender then
    raise exception '성별은 학생증 인증과 연결되어 있어 변경할 수 없습니다.'
      using errcode = '42501';
  end if;

  if new.school is distinct from old.school then
    raise exception '학교는 학생증 인증과 연결되어 있어 변경할 수 없습니다.'
      using errcode = '42501';
  end if;

  -- 권한 상승 / 셀프 인증 / 학생증 교체 방지
  if new.role                   is distinct from old.role
     or new.is_verified         is distinct from old.is_verified
     or new.verification_status is distinct from old.verification_status
     or new.student_id_image_path is distinct from old.student_id_image_path then
    raise exception '해당 항목은 관리자만 변경할 수 있습니다.'
      using errcode = '42501';
  end if;

  -- 계정 상태는 '탈퇴(deleted)' 로만 본인이 바꿀 수 있습니다.
  -- (관리자가 inactive 처리한 계정을 스스로 active 로 되돌리는 것을 막습니다.
  --  기존 delete_my_account() RPC 는 status='deleted' 이므로 그대로 동작합니다.)
  if new.status is distinct from old.status and new.status <> 'deleted' then
    raise exception '계정 상태는 관리자만 변경할 수 있습니다.'
      using errcode = '42501';
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.has_active_team(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.teams
     where owner_id = uid
       and status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_open_team(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.teams
     where owner_id = uid
       and status in ('active','matched')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_active_user(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select status = 'active' from public.profiles where id = uid), false);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select role = 'admin' from public.profiles where id = uid),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_matched_with(team_a uuid, team_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.match_requests
     where status = 'accepted'
       and (
         (from_team_id = team_a and to_team_id = team_b) or
         (from_team_id = team_b and to_team_id = team_a)
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_my_matched_counterpart(team uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1
      from public.match_requests mr
     where mr.status = 'accepted'
       and (
         (mr.from_team_id = team
          and mr.to_team_id   in (select id from public.teams where owner_id = uid)) or
         (mr.to_team_id = team
          and mr.from_team_id in (select id from public.teams where owner_id = uid))
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text := lower(trim(coalesce(p_username, '')));
begin
  -- 형식이 규칙에 안 맞으면 굳이 조회하지 않고 false
  if v_name !~ '^[a-z0-9_]{4,20}$' then
    return false;
  end if;

  -- 무차별 대입으로 아이디 목록을 긁어가는 것을 조금이라도 늦춥니다.
  perform pg_sleep(0.3);

  return not exists (
    select 1 from public.profiles where lower(username) = v_name
  );
end $function$;

CREATE OR REPLACE FUNCTION public.my_gender(uid uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select gender from public.profiles where id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.my_matched_partner_team_ids(uid uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
           when mr.from_team_id in (select id from public.teams where owner_id = uid)
             then mr.to_team_id
           else mr.from_team_id
         end
    from public.match_requests mr
   where mr.status = 'accepted'
     and (
       mr.from_team_id in (select id from public.teams where owner_id = uid) or
       mr.to_team_id   in (select id from public.teams where owner_id = uid)
     );
$function$;

CREATE OR REPLACE FUNCTION public.my_team_ids(uid uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.teams where owner_id = uid;
$function$;

CREATE OR REPLACE FUNCTION public.notify_match_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r          record;
  v_name     text;
  v_other_schools text;
  v_other_intro   text;
  v_size     int;
  v_msg      text;
  v_roster   jsonb;
begin
  if new.status <> 'accepted' or old.status = 'accepted' then
    return new;
  end if;

  -- 양 팀 명단 + 연락처 (관리자 단체방 개설용, 관리자 전용 payload)
  select jsonb_agg(team_info order by team_info->>'gender')
    into v_roster
    from (
      select jsonb_build_object(
               'team_id',        t.id,
               'gender',         t.gender,
               'intro',          t.intro,
               'owner_name',     p.name,
               'owner_username', p.username,
               'members',        (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'member_order', m.member_order,
                          'nickname',     m.nickname,
                          'school',       m.school,
                          'department',   m.department,
                          'contact_type', m.contact_type,
                          'contact_id',   m.contact_id
                        ) order by m.member_order), '[]'::jsonb)
                   from public.team_members m
                  where m.team_id = t.id
               )
             ) as team_info
        from public.teams t
        join public.profiles p on p.id = t.owner_id
       where t.id in (new.from_team_id, new.to_team_id)
    ) s;

  for r in
    select new.from_team_id as me, new.to_team_id as other
    union all
    select new.to_team_id   as me, new.from_team_id as other
  loop
    select p.name into v_name
      from public.teams t
      join public.profiles p on p.id = t.owner_id
     where t.id = r.me;

    select t.intro, coalesce(t.team_size, 3)
      into v_other_intro, v_size
      from public.teams t
     where t.id = r.other;

    select string_agg(distinct m.school, ' · ')
      into v_other_schools
      from public.team_members m
     where m.team_id = r.other;

    v_msg :=
      '[춘천과팅] ' || coalesce(v_name, '회원') || '님, 매칭이 성사되었습니다!' || E'\n\n' ||
      '상대팀 : ' || coalesce(v_other_schools, '-') || ' ' || v_size || ':' || v_size || E'\n' ||
      '한줄소개 : "' || coalesce(v_other_intro, '') || '"' || E'\n\n' ||
      '관리자가 곧 양 팀이 함께하는 카카오톡 단체방을 만들어' || E'\n' ||
      '가입하실 때 등록한 카카오톡 ID/전화번호로 초대해드립니다.' || E'\n' ||
      '초대가 오면 수락만 해주시면 돼요. (연락처는 상대 팀에게 공개되지 않습니다)' || E'\n\n' ||
      '- 첫 만남은 사람이 많은 공공장소에서 만나주세요.' || E'\n' ||
      '- 금전 거래나 개인정보 요구는 절대 응하지 마세요.' || E'\n' ||
      '- 불쾌한 일이 있으면 앱 [내 정보 > 신고하기] 로 알려주세요.' || E'\n\n' ||
      '과팅이 끝나면 [팀등록 > 새 과팅 시작하기] 를 눌러주셔야' || E'\n' ||
      '다음 매칭에 다시 참여하실 수 있어요.' || E'\n\n' ||
      '춘천과팅 드림';

    insert into public.notifications (type, ref_id, target_user_id, title, message, payload)
    select
      'match_accepted',
      new.id,
      t.owner_id,
      '매칭 성사 — 단체방 개설 필요',
      v_msg,
      jsonb_build_object(
        'my_team_id',    r.me,
        'other_team_id', r.other,
        'team_size',     v_size,
        'schools',       coalesce(v_other_schools, ''),
        'roster',        coalesce(v_roster, '[]'::jsonb)
      )
    from public.teams t
    where t.id = r.me;
  end loop;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.notify_new_match_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_to_owner     uuid;
  v_to_name      text;
  v_from_intro   text;
  v_from_size    int;
  v_from_schools text;
  v_msg          text;
begin
  select t.owner_id, p.name
    into v_to_owner, v_to_name
    from public.teams t
    join public.profiles p on p.id = t.owner_id
   where t.id = new.to_team_id;

  select t.intro, coalesce(t.team_size, 3)
    into v_from_intro, v_from_size
    from public.teams t
   where t.id = new.from_team_id;

  select string_agg(distinct m.school, ' · ')
    into v_from_schools
    from public.team_members m
   where m.team_id = new.from_team_id;

  v_msg :=
    '[춘천과팅] ' || coalesce(v_to_name, '회원') || '님 안녕하세요!' || E'\n\n' ||
    '방금 ' || coalesce(v_from_schools, '상대') || ' ' || v_from_size || ':' || v_from_size ||
    ' 팀에서 매칭 신청이 들어왔어요.' || E'\n' ||
    '한줄소개 : "' || coalesce(v_from_intro, '') || '"' || E'\n\n' ||
    '앱에서 [신청내역 > 받은 신청] 으로 들어가시면 수락 또는 거절하실 수 있어요.' || E'\n' ||
    '하루 안에 답변해주시면 상대팀이 오래 기다리지 않습니다.' || E'\n\n' ||
    '춘천과팅 드림';

  insert into public.notifications (type, ref_id, target_user_id, title, message, payload)
  values (
    'match_request',
    new.id,
    v_to_owner,
    '매칭 신청 도착',
    v_msg,
    jsonb_build_object(
      'from_team_id', new.from_team_id,
      'to_team_id',   new.to_team_id,
      'team_size',    v_from_size,
      'schools',      coalesce(v_from_schools, '')
    )
  );

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.notify_new_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reporter text;
  v_target   text;
  v_label    text;
begin
  select name into v_reporter from public.profiles where id = new.reporter_id;
  select name into v_target   from public.profiles where id = new.target_user_id;

  v_label := case new.category
    when 'inappropriate' then '부적절한 언행'
    when 'no_show'       then '약속 불이행(노쇼)'
    when 'fraud'         then '금전 요구·사기'
    when 'privacy'       then '개인정보 유출'
    when 'stalking'      then '스토킹·지속적 괴롭힘'
    when 'fake'          then '허위 정보·사칭'
    else '기타' end;

  insert into public.notifications (type, ref_id, target_user_id, title, message, payload)
  values (
    'report',
    new.id,
    new.reporter_id,
    '신고 접수: ' || v_label,
    '[춘천과팅] ' || coalesce(v_reporter, '회원') || '님, 신고 접수를 확인했습니다.' || E'\n\n' ||
    '유형 : ' || v_label || E'\n' ||
    '접수 내용은 관리자가 직접 확인하고 있으며, 사실관계를 파악한 뒤 조치하겠습니다.' || E'\n' ||
    '추가로 전달하실 내용이 있으면 이 대화로 답장 주세요.' || E'\n\n' ||
    '급하거나 위험한 상황이라면 지체 없이 112에 신고해주세요.' || E'\n\n' ||
    '춘천과팅 드림',
    jsonb_build_object(
      'report_id',   new.id,
      'category',    new.category,
      'target_name', coalesce(v_target, ''),
      'target_user_id', new.target_user_id,
      'detail',      left(new.detail, 500)
    )
  );

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.purge_user_content(p_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 1) 내 팀 → 팀원·매칭신청까지 FK cascade 로 함께 삭제
  delete from public.teams where owner_id = p_uid;

  -- 2) 내가 쓴 후기
  delete from public.reviews where user_id = p_uid;

  -- 3) 나에게 발송 예정이던 알림 (연락처 스냅샷 포함)
  --    탈퇴 알림 자체는 관리자 기록으로 남겨야 하므로 제외합니다.
  delete from public.notifications
   where target_user_id = p_uid
     and type <> 'account_deletion';

  -- 4) 프로필 익명화
  --    · contact_type 을 kakao 로 바꿔야 profiles_phone_format CHECK 를
  --      위반하지 않습니다. (전화번호 회원의 contact_id 를 비우기 때문)
  --    · 아이디(username)는 재가입·문의 대응을 위해 남깁니다.
  update public.profiles
     set status                = 'deleted',
         name                  = '탈퇴한 회원',
         contact_type          = 'kakao',
         contact_id            = '',
         student_number        = null,
         student_id_image_path = null
   where id = p_uid;
end $function$;

CREATE OR REPLACE FUNCTION public.reject_match_request(req_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_to uuid;
  v_to_owner uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select to_team_id, status into v_to, v_status
    from public.match_requests where id = req_id;

  if v_to is null then
    raise exception '신청이 존재하지 않습니다.';
  end if;
  if v_status <> 'pending' then
    raise exception '이미 처리된 신청입니다.';
  end if;

  select owner_id into v_to_owner from public.teams where id = v_to;
  if v_to_owner <> v_uid then
    raise exception '거절 권한이 없습니다.';
  end if;

  update public.match_requests
     set status = 'rejected', responded_at = now()
   where id = req_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_password_reset(p_username text, p_name text, p_school text, p_memo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid  uuid;
  v_name text;
begin
  perform pg_sleep(1);

  if coalesce(btrim(p_username), '') = ''
     or coalesce(btrim(p_name), '') = ''
     or coalesce(btrim(p_school), '') = '' then
    return;
  end if;

  if not public.check_lookup_rate('password_reset', btrim(p_username)) then
    return;
  end if;

  select id, name
    into v_uid, v_name
    from public.profiles
   where status <> 'deleted'
     and lower(btrim(username)) = lower(btrim(p_username))
     and lower(btrim(name))     = lower(btrim(p_name))
     and btrim(school)          = btrim(p_school)
   limit 1;

  if v_uid is null then
    return;
  end if;

  if exists (
    select 1 from public.notifications
     where type = 'password_reset'
       and target_user_id = v_uid
       and is_handled = false
  ) then
    return;
  end if;

  insert into public.notifications (type, ref_id, target_user_id, title, message, payload)
  values (
    'password_reset',
    null,
    v_uid,
    '비밀번호 재설정 요청',
    '[춘천과팅] ' || coalesce(v_name, '회원') || '님, 비밀번호 재설정 요청 확인했습니다.' || E'\n\n' ||
    '임시 비밀번호 : {{임시비밀번호}}' || E'\n\n' ||
    '로그인하신 뒤 [내 정보 > 비밀번호 변경] 에서 반드시 새 비밀번호로 바꿔주세요.' || E'\n' ||
    '임시 비밀번호는 다른 사람에게 절대 공유하지 마세요.' || E'\n\n' ||
    '춘천과팅 드림',
    jsonb_build_object(
      'username', btrim(p_username),
      'memo',     coalesce(btrim(p_memo), '')
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.set_notification_handled(p_id uuid, p_handled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception '관리자만 사용할 수 있습니다.' using errcode = '42501';
  end if;

  update public.notifications
     set is_handled = p_handled,
         handled_at = case when p_handled then now() else null end,
         handled_by = case when p_handled then v_uid else null end
   where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.unhandled_notification_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when public.is_admin(auth.uid())
    then (select count(*)::int from public.notifications where is_handled = false)
    else 0
  end;
$function$;

CREATE VIEW public."team_members_public" AS  SELECT id,
    team_id,
    member_order,
    school,
    department,
        CASE
            WHEN (regexp_replace(COALESCE(student_number, ''::text), '\D'::text, ''::text, 'g'::text) = ''::text) THEN ''::text
            WHEN ((length(regexp_replace(student_number, '\D'::text, ''::text, 'g'::text)) >= 4) AND (((SUBSTRING(regexp_replace(student_number, '\D'::text, ''::text, 'g'::text) FROM 1 FOR 4))::integer >= 1990) AND ((SUBSTRING(regexp_replace(student_number, '\D'::text, ''::text, 'g'::text) FROM 1 FOR 4))::integer <= ((EXTRACT(year FROM now()))::integer + 1)))) THEN SUBSTRING(regexp_replace(student_number, '\D'::text, ''::text, 'g'::text) FROM 3 FOR 2)
            ELSE SUBSTRING(regexp_replace(student_number, '\D'::text, ''::text, 'g'::text) FROM 1 FOR 2)
        END AS student_number,
    nickname,
    smoking,
    created_at,
    taste_tags,
    want_tags
   FROM team_members;
CREATE TRIGGER trg_notify_new_match_request AFTER INSERT ON public.match_requests FOR EACH ROW EXECUTE FUNCTION notify_new_match_request();
CREATE TRIGGER trg_notify_match_accepted AFTER UPDATE OF status ON public.match_requests FOR EACH ROW EXECUTE FUNCTION notify_match_accepted();
CREATE TRIGGER trg_notify_new_report AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION notify_new_report();
CREATE TRIGGER trg_guard_profile_immutable BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_immutable_fields();
CREATE POLICY "mr_admin_delete" ON public."match_requests" FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "mr_admin_select" ON public."match_requests" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "mr_admin_update" ON public."match_requests" FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "mr_owner_insert" ON public."match_requests" FOR INSERT TO authenticated WITH CHECK (((from_team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids)) AND can_participate(auth.uid()) AND (from_team_id <> to_team_id) AND can_request_match(from_team_id, to_team_id)));
CREATE POLICY "mr_owner_select" ON public."match_requests" FOR SELECT TO authenticated USING (((from_team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids)) OR (to_team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids))));
CREATE POLICY "notifications_admin_delete" ON public."notifications" FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "notifications_admin_select" ON public."notifications" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "notifications_admin_update" ON public."notifications" FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "profiles_admin_delete" ON public."profiles" FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "profiles_admin_select" ON public."profiles" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "profiles_admin_update" ON public."profiles" FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "profiles_self_insert" ON public."profiles" FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));
CREATE POLICY "profiles_self_select" ON public."profiles" FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "profiles_self_update" ON public."profiles" FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK (((id = auth.uid()) AND (role = 'user'::text)));
CREATE POLICY "reports_admin_delete" ON public."reports" FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "reports_admin_select" ON public."reports" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "reports_admin_update" ON public."reports" FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "reports_self_insert" ON public."reports" FOR INSERT TO authenticated WITH CHECK (((reporter_id = auth.uid()) AND is_active_user(auth.uid()) AND (target_user_id IS DISTINCT FROM auth.uid())));
CREATE POLICY "reports_self_select" ON public."reports" FOR SELECT TO authenticated USING ((reporter_id = auth.uid()));
CREATE POLICY "reviews_admin_delete" ON public."reviews" FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "reviews_admin_select" ON public."reviews" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "reviews_admin_update" ON public."reviews" FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "reviews_public_select" ON public."reviews" FOR SELECT TO authenticated USING ((status = 'approved'::text));
CREATE POLICY "reviews_self_insert" ON public."reviews" FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "reviews_self_select" ON public."reviews" FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "reviews_self_update" ON public."reviews" FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (status = 'pending'::text))) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "tm_admin_all" ON public."team_members" FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "tm_admin_select" ON public."team_members" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "tm_owner_delete" ON public."team_members" FOR DELETE TO authenticated USING ((team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids)));
CREATE POLICY "tm_owner_insert" ON public."team_members" FOR INSERT TO authenticated WITH CHECK ((team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids)));
CREATE POLICY "tm_owner_select" ON public."team_members" FOR SELECT TO authenticated USING ((team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids)));
CREATE POLICY "tm_owner_update" ON public."team_members" FOR UPDATE TO authenticated USING ((team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids))) WITH CHECK ((team_id IN ( SELECT my_team_ids(auth.uid()) AS my_team_ids)));
CREATE POLICY "teams_admin_delete" ON public."teams" FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "teams_admin_select" ON public."teams" FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "teams_admin_update" ON public."teams" FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "teams_matched_partner_select" ON public."teams" FOR SELECT TO authenticated USING ((id IN ( SELECT my_matched_partner_team_ids(auth.uid()) AS my_matched_partner_team_ids)));
CREATE POLICY "teams_matched_select" ON public."teams" FOR SELECT TO authenticated USING (is_my_matched_counterpart(id, auth.uid()));
CREATE POLICY "teams_owner_delete" ON public."teams" FOR DELETE TO authenticated USING (((owner_id = auth.uid()) AND (status <> 'matched'::text)));
CREATE POLICY "teams_owner_insert" ON public."teams" FOR INSERT TO authenticated WITH CHECK (((owner_id = auth.uid()) AND can_participate(auth.uid()) AND (gender = my_gender(auth.uid())) AND (NOT has_open_team(auth.uid()))));
CREATE POLICY "teams_owner_select" ON public."teams" FOR SELECT TO authenticated USING ((owner_id = auth.uid()));
CREATE POLICY "teams_owner_update" ON public."teams" FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) AND (status <> 'matched'::text))) WITH CHECK ((owner_id = auth.uid()));
CREATE POLICY "teams_public_select" ON public."teams" FOR SELECT TO authenticated USING (((status = 'active'::text) AND (gender <> COALESCE(my_gender(auth.uid()), ''::text)) AND is_active_user(auth.uid()) AND is_active_user(owner_id)));
CREATE POLICY "student-ids delete admin" ON storage."objects" FOR DELETE TO authenticated USING (((bucket_id = 'student-ids'::text) AND is_admin(auth.uid())));
CREATE POLICY "student-ids delete self" ON storage."objects" FOR DELETE TO authenticated USING (((bucket_id = 'student-ids'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "student-ids select admin" ON storage."objects" FOR SELECT TO authenticated USING (((bucket_id = 'student-ids'::text) AND is_admin(auth.uid())));
CREATE POLICY "student-ids select self" ON storage."objects" FOR SELECT TO authenticated USING (((bucket_id = 'student-ids'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "student-ids update self" ON storage."objects" FOR UPDATE TO authenticated USING (((bucket_id = 'student-ids'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "student-ids upload self" ON storage."objects" FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'student-ids'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."match_requests" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."match_requests" TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."notifications" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."notifications" TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."profiles" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."profiles" TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."reports" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."reports" TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."reviews" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."reviews" TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."team_members" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."team_members" TO authenticated;
GRANT SELECT ON public."team_members_public" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."team_members_public" TO authenticated;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."teams" TO anon;
GRANT DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE ON public."teams" TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Explicit effective API privileges observed in the live snapshot.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_pkey ON public.reviews USING btree (id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS match_requests_pkey ON public.match_requests USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS match_requests_from_team_id_to_team_id_key ON public.match_requests USING btree (from_team_id, to_team_id);
CREATE INDEX IF NOT EXISTS idx_match_requests_from ON public.match_requests USING btree (from_team_id);
CREATE INDEX IF NOT EXISTS idx_match_requests_to ON public.match_requests USING btree (to_team_id);
CREATE INDEX IF NOT EXISTS idx_match_requests_st ON public.match_requests USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_pkey ON public.team_members USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_id_member_order_key ON public.team_members USING btree (team_id, member_order);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members USING btree (team_id);
CREATE UNIQUE INDEX IF NOT EXISTS teams_pkey ON public.teams USING btree (id);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams USING btree (status);
CREATE INDEX IF NOT EXISTS idx_teams_gender ON public.teams USING btree (gender);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles USING btree (username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles USING btree (status);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON public.profiles USING btree (verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_name_school ON public.profiles USING btree (name, school);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_pkey ON public.notifications USING btree (id);
CREATE INDEX IF NOT EXISTS idx_notifications_handled ON public.notifications USING btree (is_handled, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications USING btree (target_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS reports_pkey ON public.reports USING btree (id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports USING btree (target_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS lookup_attempts_pkey ON public.lookup_attempts USING btree (id);
CREATE INDEX IF NOT EXISTS idx_lookup_attempts ON public.lookup_attempts USING btree (kind, key_hash, created_at DESC);
