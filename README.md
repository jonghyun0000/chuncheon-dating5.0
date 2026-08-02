# 춘천과팅

강원대 · 한림대 · 성심대 · 춘교대 학생을 위한 과팅 매칭 웹앱 (1:1 ~ 4:4).

| 영역 | 스택 |
| --- | --- |
| 프론트엔드 | React + TypeScript + Vite + Tailwind CSS |
| 백엔드 / DB / Auth / Storage | Supabase (서버리스) |
| 배포 | Vercel |
| 소스 | GitHub |

---

## 0. 빠른 시작 (로컬 실행)

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 설정 (1단계 참조)
cp .env.example .env.local
# .env.local 을 열어 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 입력

# 3) 개발 서버 실행
npm run dev        # http://localhost:5173

# 4) 빌드 검증
npm run build
npm run preview
```

> `.env.local` 없이 실행하면 의도적으로 즉시 에러가 발생합니다. 정상 동작입니다.

---

## 1. Supabase 프로젝트 세팅

### 1-1. 프로젝트 생성
1. <https://supabase.com> 가입 후 새 프로젝트 생성 (Region: **Northeast Asia (Seoul)** 권장)
2. 프로젝트 비밀번호는 별도 안전한 곳에 보관

### 1-2. 키 확인 — 매우 중요
- 프로젝트 → **Settings → API**
- 클라이언트(`.env.local`)에 들어갈 두 가지:
  - **Project URL** → `VITE_SUPABASE_URL`
  - **anon (public) key** → `VITE_SUPABASE_ANON_KEY`
- **`service_role` 키는 절대 클라이언트 / `.env.local` / GitHub / 채팅 / 어디에도 노출 금지**
  - 이 키가 한 번이라도 푸시되면 즉시 Supabase 대시보드에서 키 회전(rotate)
  - 의심되면 무조건 회전 — "혹시 모르니"는 사치

### 1-3. SQL 실행
- 좌측 메뉴 **SQL Editor → New query**
- 마이그레이션 SQL 을 **순서대로** 붙여넣고 RUN
  1. `0001_init.sql` — 최초 1회 (이미 운영 중인 프로젝트라면 건너뜁니다)
  2. `0002_v5_update.sql` — 5.0 기능 추가 (알림·춘교대·약관·학번)
  3. `0003_hardening.sql` — **실서비스 오픈 전 필수. 보안·정책 보강**
- `0002` 는 전부 idempotent 하게 작성되어 있어 여러 번 실행해도 안전합니다.
- 결과: 테이블 + 정책 + Storage 버킷 + RPC 함수 일괄 생성/갱신

### 1-4. Storage 확인
- **Storage** → `student-ids` 버킷이 자동 생성되어 있는지 확인 (private)
- 없다면 직접 생성: **New bucket** → 이름 `student-ids`, **Public 체크 해제**

### 1-5. Auth 설정
- **Authentication → Providers → Email** 활성화 (기본값)
- **Authentication → Settings → Confirm email** → `OFF` (즉시 로그인 가능하게)
- 배포 후 **Site URL** 에 Vercel 도메인 추가

### 1-6. 첫 관리자 계정 만들기
1. 일반 회원가입 페이지에서 운영자 계정으로 가입 (학생증·약관 모두 정상 입력)
2. Supabase 대시보드 → **SQL Editor** 에서 한 줄 실행:
   ```sql
   update public.profiles
   set role = 'admin'
   where username = '<운영자_username>';
   ```
3. 다시 로그인하면 `/admin` 메뉴 접근 가능

> **왜 코드에 ID/PW를 박지 않는가?**
> - 하드코딩된 비밀번호는 GitHub 누출 즉시 모든 보안이 무너집니다.
> - Supabase Auth가 비밀번호를 bcrypt로 안전하게 저장 → 우리는 `role` 컬럼만 보면 됩니다.
> - 비밀번호 재설정/탈퇴 같은 기본 보안 기능을 Supabase가 무료로 제공합니다.

---

## 2. GitHub 업로드 — 푸시 전 필수 확인

```bash
git init
git add .
git commit -m "feat: 춘천과팅 초기 커밋"

# GitHub에서 빈 저장소 생성 후
git branch -M main
git remote add origin https://github.com/<your-id>/<repo-name>.git
git push -u origin main
```

> 푸시 전 반드시 다음을 확인하세요:
> ```bash
> git status -s              # .env.local 이 절대 등장하면 안 됨
> git ls-files | grep env    # 추적되고 있는 env 파일이 있는지 재확인
> ```
> `.gitignore` 가 `.env*.local` 을 막고 있다면 정상적으로 보이지 않습니다.
> 만약 실수로 한 번이라도 커밋했다면, 키 회전 + `git filter-repo` 로 히스토리 정리.

---

## 3. Vercel 배포

1. <https://vercel.com> → **New Project** → **Import Git Repository** → 위 저장소 선택
2. Framework Preset: **Vite** (자동 감지)
3. Build Command / Output Directory 는 기본값 (`npm run build` / `dist`)
4. **Environment Variables** 에 두 개 추가 (Vercel 대시보드에서만 입력, 코드에 직접 넣지 말 것):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy** 클릭
6. 배포 완료 후 발급된 도메인(`https://xxx.vercel.app`)을 Supabase **Auth → URL Configuration → Site URL** 에 추가

`vercel.json` 의 SPA rewrites 가 모든 경로를 `index.html` 로 보내므로 `/admin/users` 등을 직접 새로고침해도 정상 동작합니다.

---

## 3-1. 5.0 업데이트 요약

`0002_v5_update.sql` 실행 후 다음 기능이 활성화됩니다.

### (1) 관리자 알림 대시보드 — `/admin/notifications`
매칭 0건의 직접 원인(신청이 왔는지 모름)을 겨냥한 기능입니다.

- 매칭 **신청**이 들어오거나 **수락**되면 DB 트리거가 `notifications` 테이블에 자동 기록
- 관리자 화면에서 미처리 알림 목록 확인 → 카카오톡 발송 문구가 **자동 완성**되어 원클릭 복사
- 발송 후 **처리 완료** 표시, **30초마다 자동 갱신**, 사이드바에 미처리 건수 배지
- 자동 발송이 아니라 운영자가 개인 톡으로 직접 보내는 구조 → 비용 0원, 반응률 높음

> 알림 문구에는 **상대팀 연락처를 넣지 않습니다.** 연락처는 앱 안에서만 공개되며,
> 알림은 "앱에서 확인하세요"로 유도합니다.

### (2) 아이디 찾기 — `/find-username`
- 본인 확인: **이름 + 학교 + (학번 또는 연락처 ID)**
- 4.0 이전 가입자는 `student_number` 가 비어 있으므로 **연락처 ID** 로 확인됩니다.
- brute force 방지: 서버 RPC 에서 `pg_sleep(2)` + 클라이언트에서 최소 3초 보장

### (3) 비밀번호
- **변경 (로그인 상태)** — `/me/change-password`
  현재 비밀번호 재확인 후 변경. 임시 비밀번호를 받은 회원이 스스로 바꿀 수 있습니다.
- **재설정 요청 (미로그인)** — `/reset-password-request`
  본인 확인 정보를 넣으면 알림 대시보드에 뜨고, 관리자가 Supabase 대시보드
  (**Authentication → Users → 해당 유저 → Reset password**)에서 임시 비밀번호를 설정한 뒤
  알림 화면의 입력칸에 같은 값을 넣으면 문구에 자동으로 채워집니다.
  계정 존재 여부는 노출되지 않으며, 미처리 요청이 있으면 중복 생성되지 않습니다.

### (3-1) 학번 정책
- **저장은 전체 학번, 표시는 입학년도.** 학생증에 적힌 그대로 받습니다. 예) `20233105`
- 입력 규칙: 숫자 **6~12자리** (하이픈·공백은 자동 제거). `profiles_student_number_check` 로 DB에서도 강제합니다.
- 화면에는 `admissionLabel()` 로 입학년도 두 자리만 표시합니다. `20233105` → `23학번`
- `team_members_public` 뷰가 **전체 학번 대신 입학년도만** 내려보냅니다.
  전체 학번은 학교 시스템 조회에 쓰일 수 있는 식별자라 매칭 전 단계에서는 노출하지 않습니다.
  전체 학번을 보는 곳은 **본인 팀 화면**과 **관리자 인증 화면**(학생증 대조용) 두 곳뿐입니다.
- `team_members` 는 4.0 시절 두 자리 학번이 남아 있어 DB 제약을 느슨하게 뒀습니다.
  기존 팀을 수정 저장하면 그때 전체 학번으로 다시 입력하게 됩니다.

### (4) 개인정보 수정 — `/me/edit`
- 수정 가능: 이름, 학번, 연락수단, 연락처 ID
- **수정 불가: username · 성별 · 학교** — 학생증 인증과 연결되어 있어
  `guard_profile_immutable_fields` 트리거가 DB 레벨에서 차단합니다.
- 같은 트리거가 `role` / `is_verified` / `verification_status` / 학생증 경로 변경도 막고,
  계정 상태는 본인 탈퇴(`deleted`)로만 바꿀 수 있게 제한합니다.

### (5) 춘교대 추가 — 4개 대학
`profiles` · `team_members` · `reviews` 의 CHECK 제약, 필터 UI, 뱃지 색상(주황) 모두 반영.

### (6) 약관 3종
| 키 | 내용 |
| --- | --- |
| `privacy` | 개인정보 수집 및 이용 동의 |
| `service` | 서비스 이용약관 |
| `disclaimer` | **면책조항 및 안전 이용 안내** |

면책조항에는 두 종류의 면책이 들어갑니다.

1. **학생증 사진 유출** — 회원 부주의 / 불가항력 / 외부 인프라 장애 / 회원의 외부 공유로 인한 유출 시 면책
2. **매칭 이후 사건** — 부적절한 언행, 안전사고, 금전 사기, 상대방을 통한 개인정보 유출, 스토킹, 약속 불이행 등에 대한 면책 + 안전 수칙 8개 권장

전문은 `src/lib/terms.ts` 에 있고, 동의 버전은 `profiles.terms_version` 에 기록됩니다.

> 약관 문안은 운영을 위한 초안입니다. 공개 운영 전에 법률 전문가 검토를 권장합니다.

### 새로 생긴 DB 오브젝트
| 종류 | 이름 |
| --- | --- |
| 테이블 | `notifications` |
| 컬럼 | `profiles.student_number`(숫자 6~12자리) / `agreed_disclaimer` / `terms_version` / `terms_agreed_at` |
| 트리거 | `trg_guard_profile_immutable`, `trg_notify_new_match_request`, `trg_notify_match_accepted` |
| 뷰 | `team_members_public` 재정의 (전체 학번 → 입학년도 2자리) |
| RPC | `find_username`, `request_password_reset`, `set_notification_handled`, `unhandled_notification_count` |

---

## 3-2. 오픈 전 보강 (`0003_hardening.sql`)

4.0/5.0 정책을 점검하다 발견한 구멍들을 막고, 매칭이 0건이었던 구조적 원인을 손봤습니다.

### (1) 참여 자격 게이트 — 가장 중요
`is_verified` 와 `profiles.status` 는 **어떤 RLS 정책에도 쓰이지 않았습니다.**
학생증 미인증자도 팀 등록·신청·수락이 전부 가능했고, 관리자가 정지시킨 계정도 그대로 서비스를 썼습니다.

```
can_participate(uid) = (status = 'active' AND is_verified)
```

| 동작 | 게이트 |
| --- | --- |
| 팀 등록 | `teams_owner_insert` 에 `can_participate` |
| 매칭 신청 | `mr_owner_insert` 에 `can_participate` + 상대 팀 주인도 확인 |
| 매칭 수락 | `accept_match_request` 시작부에서 확인 |
| 홈 노출 | 정지 회원의 팀은 목록에서 제외 |

> **정책 안에서 `profiles` 를 직접 조인하면 안 됩니다.** 남의 프로필은 RLS 때문에 보이지 않아
> 조건이 항상 거짓이 되고, `teams` 를 다시 조회하면 무한 재귀가 납니다.
> 그래서 `can_participate` / `has_open_team` / `can_request_match` 모두 SECURITY DEFINER 로 감쌌습니다.

화면에서는 `VerificationBanner` 가 이유를 설명하고, 정지 계정은 `AccountGate` 가 전체 차단 화면을 띄웁니다.

### (2) 매칭 사이즈 ±1 허용
사이즈 **정확 일치**를 요구하면 55명을 성별 2 × 사이즈 4로 쪼개 버킷당 팀이 1~2개밖에 안 남습니다.
인원 차이 1명까지 허용하고, 카드에 "인원 1명 차이" 뱃지와 안내 문구를 붙였습니다.
(3:3 팀은 2:2 · 3:3 · 4:4 에 신청 가능. 3:3 ↔ 1:1 은 여전히 불가)

### (3) 자동 거절 → 취소로 분리
매칭이 성사되면 남은 신청이 전부 `rejected` 가 되어 신청자에게 "거절당했다" 로 보였습니다.
`cancelled` 상태를 추가해 **"상대 팀이 다른 팀과 먼저 매칭되어 자동 종료되었어요. 거절당하신 게 아닙니다."**
로 표시합니다.

### (4) 앱 내 신고 — `/report`
이메일 접수를 대체합니다. 7가지 유형(부적절한 언행 · 노쇼 · 금전 요구 · 개인정보 유출 · 스토킹 · 사칭 · 기타),
접수 즉시 관리자 알림 자동 생성, `/admin/reports` 에서 확인 중 / 처리 완료 / 반려 / **대상 회원 정지**까지 한 화면에서.
신고자는 마이페이지에서 처리 상태와 관리자 답변을 볼 수 있습니다.

### (5) 약관 재동의 게이트 — `/terms-consent`
`terms_version` 이 현재 버전(`TERMS_VERSION`)이 아니면 로그인 후 재동의 화면으로 보냅니다.
5.0 이전 가입자 전원이 면책조항에 동의하지 않은 상태였고, 그대로 두면 사고가 나도 면책을 주장할 수 없습니다.

### (6) 조회 RPC 레이트 리밋
`pg_sleep(2)` 만으로는 스크립트 공격 시 커넥션을 오래 잡아 무료 플랜 커넥션 풀이 고갈됩니다.
지연을 1초로 줄이고 `lookup_attempts` 테이블로 **같은 대상 10분 5회** 제한을 겁니다.
이 테이블은 RLS 활성 + 정책 없음 + 권한 회수라 SECURITY DEFINER 함수 외에는 아무도 접근할 수 없습니다.

### (7) 팀원 동의 확인
팀장이 팀원 정보를 대신 입력하는 구조라, 등록·수정 시 **동의 확인 체크박스를 필수**로 하고
`teams.members_consent_confirmed` / `members_consent_at` 에 기록합니다.

### (8) 불필요한 anon 권한 회수
- `reviews` 비로그인 공개 → 로그인 후에만 (닉네임+학교가 소규모 캠퍼스에서 개인 특정으로 이어짐)
- `get_home_stats` anon 실행 권한 회수
  (주의: PostgreSQL 은 함수에 PUBLIC EXECUTE 를 기본 부여하므로 `revoke ... from public` 부터 해야 합니다)

### 아직 남은 것 (코드로 해결 불가)
| 문제 | 상태 |
| --- | --- |
| 카톡 ID / 인스타 DM 전달률 | 실제로 보내 봐야 알 수 있음 — 기존 회원 5명에게 테스트 권장 |
| 방학 타이밍 | 개강 2주 전 재오픈 권장 |
| 1인 운영 SPOF | 알림·인증 승인을 대신할 사람이 필요 |
| Supabase 무료 플랜 7일 일시정지 | GitHub Actions 로 주기적 핑 |
| 연락처 회수 불가 | 구조적 한계 — 안전 수칙과 신고로 완화 |

---

## 4. 폴더 구조

```
chuncheon-gating/
├── index.html
├── package.json / vite.config.ts / tailwind.config.ts / tsconfig.json
├── vercel.json                    # SPA rewrites
├── .env.example / .gitignore
├── supabase/
│   └── migrations/                # DB 마이그레이션 (비공개로 관리)
│       ├── 0001_init.sql
│       ├── 0002_v5_update.sql     # 5.0 기능 (알림/춘교대/약관/학번)
│       └── 0003_hardening.sql     # 오픈 전 보강 (게이트/신고/레이트리밋)
└── src/
    ├── app/                       # App, Router
    ├── lib/                       # supabaseClient, env, constants, terms(약관 전문)
    ├── hooks/                     # useAuth, useUnhandledNotifications
    ├── routes/                    # ProtectedRoute, AdminRoute, AccountGate
    ├── components/                # common, layout, team, match, admin
    ├── features/
    │   ├── auth/                  # 로그인/회원가입/아이디찾기/비번재설정요청
    │   ├── home/                  # 통계, 필터, 팀 목록
    │   ├── teams/                 # 1:1 ~ 4:4 팀등록
    │   ├── matches/               # 신청/수락/거절 + 연락처 공개
    │   ├── reviews/               # 후기 작성/공개
    │   ├── reports/               # 신고 접수 / 내 신고 내역
    │   ├── mypage/                # 마이페이지 / 개인정보수정 / 비번변경
    │   └── admin/                 # 관리자 페이지 (알림 대시보드 포함)
    ├── types/                     # DB / 공통 타입
    ├── utils/                     # validators, format, errors, security
    └── styles/index.css           # Tailwind + 사용자 스타일
```

---

## 5. 보안 원칙

> 구체적인 정책 / 함수 / 트랜잭션 설계는 **비공개 운영 문서**로 관리합니다.
> 본 README 에는 일반적인 운영 원칙만 기술합니다.

- **다층 방어** — 클라이언트 검증은 UX 용이며, 모든 권한 검증은 데이터베이스 측 정책에서 최종 결정됩니다.
- **최소 권한** — 클라이언트는 anon 키만 사용하며, 권한 상승이 필요한 작업은 서버 측 함수(RPC)를 통해서만 수행합니다.
- **민감 데이터 격리** — 학생증 등 개인 식별 자료는 비공개 Storage 에 보관되며, 본인 / 권한자에 한해 짧은 만료 시간을 가진 서명 URL 로만 노출됩니다.
- **연락처 보호** — 매칭 합의 전에는 일반 조회 경로에 연락처 컬럼이 포함되지 않습니다. 클라이언트 코드 결함이 있어도 노출되지 않도록 데이터 계층에서 차단합니다.
- **키 위생** — `supabase` 객체를 전역(`window` 등)에 노출하지 않고, `service_role` 패턴이 환경변수에 잡히면 앱이 즉시 실행 중단됩니다. `.env*.local` 은 처음부터 `.gitignore`.

---

## 6. 배포 전 보안 체크리스트

- [ ] `.env.local` 이 `git status` 에 나타나지 않는가?
- [ ] `git ls-files | grep env` 결과가 `.env.example` 외에 비어 있는가?
- [ ] `service_role` 키가 코드 / 환경변수 / 채팅 / 어디에도 없는가?
- [ ] Supabase 모든 테이블이 정책 활성 상태인가? (Authentication → Policies)
- [ ] 다른 학교 사용자로 로그인 시 `/admin` 진입이 차단되는가?
- [ ] 미수락 상태에서 상대 연락처가 클라이언트에서 보이지 않는가? (DevTools Network 탭으로 검증)
- [ ] 학생증 이미지에 직접 URL 접근 시 401 / 403 이 뜨는가?
- [ ] 비밀번호가 8자 이상 + 영문 / 숫자 조합으로 강제되는가?
- [ ] 같은 팀에 중복 신청 시 즉시 차단되는가?
- [ ] 한 사용자가 활성 팀을 2개 이상 만들 수 없는가?
- [ ] **Email Confirmation** 이 `Off` 상태에서 회원가입 직후 바로 로그인 가능한가?
- [ ] 일반 회원이 `/me/edit` 에서 username / 성별 / 학교를 바꿀 수 없는가? (DB 트리거)
- [ ] 일반 회원이 `/admin/notifications` 에 접근할 수 없는가?
- [ ] 관리자 외 계정에서 `notifications` 테이블 조회 시 0건인가?
- [ ] 아이디 찾기에서 틀린 정보 입력 시에도 응답이 3초 걸리는가? (타이밍 노출 방지)
- [ ] **미인증 계정으로 팀 등록·매칭 신청이 차단되는가?** (`0003` 적용 확인)
- [ ] **정지(inactive) 계정으로 로그인 시 전체 차단 화면이 뜨는가?**
- [ ] 정지 회원의 팀이 다른 사람 홈 목록에서 사라지는가?
- [ ] 3:3 팀이 4:4 팀에 신청되고, 1:1 팀에는 신청이 막히는가?
- [ ] 매칭 성사 후 다른 신청이 '거절'이 아니라 '자동 종료'로 표시되는가?
- [ ] 아이디 찾기를 같은 이름·학교로 6번 시도하면 차단되는가?
- [ ] 비로그인 상태에서 `reviews` 를 직접 조회하면 0건인가?
- [ ] `terms_version` 이 비어 있는 계정으로 로그인하면 재동의 화면이 뜨는가?

---

## 7. 테스트 시나리오

권장 테스트 데이터:

| 역할 | username | 학교 |
| --- | --- | --- |
| 남자 1 | `test_m1` | 강원대 |
| 남자 2 | `test_m2` | 한림대 |
| 여자 1 | `test_w1` | 강원대 |
| 여자 2 | `test_w2` | 성심대 |
| 여자 3 | `test_w3` | 춘교대 |
| 관리자 | `<운영자_username>` | — |

### 7-1. 회원가입 / 로그인
1. `/register` → 모든 필드 + 학생증 + 약관 동의 → 가입
2. 약관 미동의 시 폼 제출 차단
3. 학생증 5MB 초과 업로드 시 차단
4. `/login` 에서 잘못된 PW 입력 시 한글 에러 메시지

### 7-2. 학교 인증
1. 관리자가 `/admin/verification` 에서 학생증 이미지 확인
2. **승인** → 해당 사용자가 등록한 팀 카드에 `인증완료` 뱃지 표시
3. **거절** → `미인증` 상태 유지

### 7-3. 팀등록
1. 일반 사용자가 `/team` 에서 3명 정보 + 한줄소개 입력 → 등록
2. 같은 사용자가 추가 활성 팀 등록 시도 → 차단 (또는 기존 팀 표시)
3. 매칭 상태에서 팀 삭제 시도 → 차단

### 7-4. 홈 노출 규칙
1. **남자 계정** 홈 → 여자 팀만 노출
2. **여자 계정** 홈 → 남자 팀만 노출
3. 학교 필터 / 비흡연 필터 정상 동작
4. 자기 팀이 자기 홈에 노출되지 않음

### 7-5. 매칭 신청
1. 신청 → `/requests` 에서 보낸 신청 확인
2. 같은 팀에 다시 신청 → **이미 신청** 메시지
3. 자기 팀에 신청 시도 → 차단

### 7-6. 수락 / 거절 / 연락처
1. 수신 측 `/requests` → 받은 신청 → **수락**
2. 두 팀 모두 홈 목록에서 사라짐 (matched)
3. 양쪽 신청내역에 **연락처 카드** 노출 (카카오 / 인스타 ID)
4. 다른 신청은 자동 거절 처리
5. 거절된 신청자에게는 안내, 거절된 팀은 계속 홈 노출

### 7-7. 후기
1. `/reviews` → 후기 작성 → `status=pending`
2. `/admin/reviews` → 승인 → 일반 화면에 노출
3. 거절 시 비공개

### 7-8. 관리자 회원관리
1. `/admin/users` 에서 회원 활성/비활성 토글
2. 비활성된 회원 로그인 시도 → 정책상 데이터 조회 거의 모두 차단

### 7-9. 알림 대시보드 (5.0)
1. 계정 A 가 계정 B 팀에 신청 → `/admin/notifications` 에 **매칭 신청** 알림 1건
2. 문구 복사 → 클립보드에 카톡 발송용 전문이 들어오는가
3. B 가 수락 → **매칭 성사** 알림이 **2건**(양 팀 각각) 생성
4. 처리 완료 → 미처리 목록에서 사라지고 사이드바 배지 감소
5. 30초 방치 → 새 알림이 자동으로 나타나는가

### 7-10. 계정 찾기 / 비밀번호 (5.0)
1. `/find-username` 에 이름+학교+전체 학번(예: 20233105) → 아이디 노출
2. 연락처 ID 로도 조회되는가 (기존 회원 케이스)
3. 틀린 정보 → "일치하는 정보를 찾지 못했어요"
3-1. 학번 앞 두 자리(`23`)만 입력 → 찾지 못해야 정상 (부분 일치 금지)
4. `/reset-password-request` 제출 → 알림 대시보드에 요청 표시
5. 같은 계정으로 재요청 → 중복 생성 안 됨
6. `/me/change-password` 에서 현재 비밀번호 틀리면 차단

### 7-11. 개인정보 수정 (5.0)
1. `/me/edit` 에서 이름·학번·연락처 변경 → 저장 성공
2. username/성별/학교는 **변경할 수 없는 항목** 으로만 표시되는가

### 7-11-1. 학번 (5.0)
1. 회원가입에서 `24` 입력 → "숫자 6~12자리" 안내로 차단
2. `2023-3105` 입력 → 하이픈이 제거되고 `20233105` 로 저장
3. 홈에서 상대 팀 카드에 `23학번` 으로 표시 (전체 학번이 아님)
4. DevTools Network 에서 `team_members_public` 응답에 전체 학번이 없는지 확인
5. 관리자 인증관리 화면에는 `학번 20233105` 로 전체가 보이는가 (학생증 대조용)

### 7-12. 춘교대 (5.0)
1. 회원가입 학교 선택에 춘교대가 있는가
2. 팀원 학교에 춘교대 선택 후 등록되는가 (CHECK 제약 통과)
3. 홈 학교 필터에 춘교대가 있고 정상 동작하는가

### 7-13. 약관 (5.0)
1. `/register` 에서 약관 3개가 모두 체크되어야 가입 버튼이 통과되는가
2. 각 약관의 **전문 보기** 모달이 열리는가
3. 가입 후 `profiles.agreed_disclaimer = true`, `terms_version = 'v5.0'` 인가

### 7-13-1. 신고 (0003)
1. `/report` 에서 유형 선택 + 10자 이상 입력 → 접수
2. `/admin/notifications` 에 **신고** 알림이 뜨는가
3. `/admin/reports` 에서 확인 중 → 처리 완료로 바뀌는가
4. 처리 메모를 남기면 신고자의 `/report` 화면에 관리자 답변으로 보이는가
5. [대상 회원 정지] → 그 계정으로 로그인 시 차단 화면

### 7-13-2. 참여 자격 게이트 (0003)
1. 인증 대기 계정으로 팀 등록 시도 → 이유가 설명된 한글 메시지
2. 관리자가 승인 → 즉시 등록 가능
3. 관리자가 회원을 비활성 → 그 회원 화면 전체 차단
4. 비활성 회원의 팀이 상대 홈에서 사라지는가

### 7-14. 환경변수 누락
1. `.env.local` 삭제 후 `npm run dev` → 친절한 한글 에러 메시지

---

## 8. 자주 발생하는 이슈

**`JWT expired` / 401 에러**
브라우저 LocalStorage 의 인증 키 삭제 후 다시 로그인.

**Vercel 빌드 시 `process.env` undefined**
Vite 는 `process.env` 가 아니라 `import.meta.env` 입니다. 환경변수는 반드시 `VITE_` 접두어가 있어야 클라이언트에 노출됩니다.

**Supabase 가 한국 사용자에게 느림**
프로젝트 region 이 `Northeast Asia (Seoul)` 인지 확인하세요. 무료 플랜은 region 변경이 불가하므로, 다른 region 으로 만들었다면 새 프로젝트를 생성하고 마이그레이션을 다시 실행해야 합니다.

---

## 9. 라이선스 / 운영 메모

- 본 코드는 학습 / 사이드 프로젝트 용도입니다. 상용 운영 전에는 추가 보안 감사를 진행하세요.
- 신고는 별도 DB 가 아닌 운영자 이메일로 접수합니다. 운영자 연락처는 앱 내 안내 페이지에서 확인하세요.
- 회원가입 시 받은 약관 동의는 프로필 테이블에 `agreed_privacy` / `agreed_terms` / `agreed_disclaimer` + `terms_version` + `terms_agreed_at` 으로 저장됩니다. 약관을 개정하면 `TERMS_VERSION` 을 올리고, 이전 버전 동의자에게 재동의를 받아야 합니다.
- 알림 발송은 자동화되어 있지 않습니다. 운영자가 `/admin/notifications` 에서 직접 카카오톡으로 전달하는 구조이며, 하루 1~2회 확인을 권장합니다.

좋은 인연 만드세요.
