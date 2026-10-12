# 팀원별 선택 사진 및 관리자 보관함

## 요청과 동작

- 팀원 1명당 선택 사진 1장. 3명 팀은 0–3장, 기존 1–4명 팀 크기 유지.
- 학생증 없이 사진을 초안에 첨부할 수 있으나, 팀 공개는 기존 관리자 승인 조건을 그대로 적용.
- 공개 팀을 볼 수 있는 활성 회원에게만 해당 팀원의 사진 표시. 전체 학번·보관 검색 정보는 일반 조회 응답에서 제외.
- 관리자 `/admin/photos`: 학교 / 학과 / 학번 / 성별 / 이름(없으면 닉네임) / 닉네임 검색, 30개씩 페이지 조회.
- 현재 팀원 모델에 실명 연동이 없으므로 닉네임을 이름 표시값으로 저장. 별도 실명 입력 없음.
- 팀/초안 삭제 시 관리자만 90일 동안 사진과 당시 팀원 정보를 조회. 만료 즉시 신규 다운로드 차단.
- 사진 교체/제거/관리자 삭제 요청은 즉시 조회 차단 후 다음 정리 작업에서 삭제. 회원 탈퇴 시 조회 차단·검색 메타데이터 익명화 후 파일 삭제.
- 미저장 업로드는 24시간 후 만료. 매시간 17분에 정리 작업 실행. Storage 삭제 성공 후에만 DB 메타데이터 제거; 실패 시 다음 실행에서 재시도.
- 업로드 시 사진 당사자의 공개·보관 동의를 별도로 확인하고 `member-photo-v1-90d` 동의 버전과 시각 기록. 기존 필수약관 재동의는 강제하지 않음. 4개 언어의 선택 사진 안내/개인정보 문구 추가.

## 구조와 보안

- `member_photos`는 팀 행과 별도로 저장해 팀 삭제 후에도 관리자 보관이 가능하다. 원본 파일명 대신 UUID 경로 사용.
- `member-photos` 비공개 버킷, JPEG만 허용, 2MiB 저장 제한. 브라우저에서 JPG/PNG/WebP 최대 10MiB를 디코딩하고 긴 변 1280px JPEG로 재인코딩해 EXIF/GPS 제거.
- HTTP 인증 다운로드 후 Blob URL로 표시한다. 공개 영구 URL·서명 URL을 배포하지 않는다. 이미 화면에 내려받은 이미지나 캡처까지 회수할 수는 없다.
- 파일 예약 RPC는 동의·활성 사용자·일일 30회 한도를 검증. 소유자가 예약한 정확한 경로만 새 파일 업로드 가능. 파일 덮어쓰기 금지.
- 기존 `save_my_team`/`save_my_team_draft`의 검증을 유지하면서 사진 소유권·중복 연결·Storage 존재와 타입/용량을 같은 트랜잭션에서 검증한다.
- 이전 앱이 `photo_id`를 생략한 채 같은 팀원을 수정하면 사진을 유지한다. 새 앱의 명시적 null만 사진 제거로 처리한다. 다른 사람으로 팀원 정보가 바뀌면 이전 사진을 보여주지 않는다.
- 관리자 사진 삭제는 초안의 사진 참조도 제거하므로 이후 팀 공개가 막히지 않는다.
- 관리자 보관함과 파일 조회는 기존 관리자/MFA 판정을 사용한다. 사진 DB에 일반 회원의 직접 INSERT/UPDATE/DELETE 권한 없음.
- Auth/profile 물리 삭제로 사진 메타데이터가 사라져도 별도 파일 삭제 큐가 남아 파일 누락 없이 정리한다.
- 정리 Edge Function은 64자리 무작위 전용 토큰을 Vault에서 검증한다. `verify_jwt=false`는 이 커스텀 인증을 위한 설정이며, 인증 없이 삭제하지 않는다. API 키를 GitHub나 브라우저에 추가하지 않는다.
- 정리 요청은 삭제할 경로를 외부에서 받지 않으며, 만료/삭제 대기 큐만 대상으로 한다.

## 검증

- 앱 단위 테스트 101개, TypeScript 및 프로덕션 빌드 통과.
- PostgreSQL 17 회귀 테스트 73개, 마이그레이션 재실행, 기존 동시성 4개 통과.
- 실제 로컬 Supabase Auth/PostgREST/Storage/MFA 및 Vault/정리 작업 52개 통과. 가상 계정·가상 사진만 사용.
- Chrome 21개 / WebKit 21개 브라우저 테스트 통과.
- npm audit: 취약점 0건.
- 스크린샷의 분홍색 사진은 테스트용 가상 이미지이며 실제 회원 사진이 아니다.

## 배포 순서와 영향

대상: `slddnhyvstfvobxxcazt`, `jonghyun0000/chuncheon-dating5.0`, Vercel `chuncheon-dating5-0`.

1. GitHub 필수 검사를 통과한 코드 확인.
2. 기존 회원/팀/학생증 수와 현재 운영 버전 확인.
3. core `member_photos` migration을 짧은 lock_timeout과 트랜잭션으로 적용.
4. `cleanup-member-photos` Edge Function 배포.
5. `supabase/operations/*_member_photo_cleanup_runtime.sql`을 환경 migration으로 적용: pg_cron/pg_net 활성화, Vault 전용 토큰·호출 URL 생성, 매시간 작업 등록. 토큰/키는 출력하지 않음.
6. 빈 큐에서 예약 호출의 HTTP 200과 잘못된 토큰 HTTP 401 확인. 실제 회원 사진을 테스트로 업로드하지 않음.
7. 앱 main 병합 및 Vercel 배포. 정확한 커밋·운영 smoke 확인.
8. 기존 회원/팀/매칭/학생증 개수와 새 사진 권한 확인.

기존 Auth/학생증 버킷/회원 데이터는 변경하지 않는다. core migration은 새 테이블·버킷·함수·트리거를 추가하며 기존 팀 저장 함수 두 개만 확장한다. 운영 다운타임은 계획하지 않으며, 잠금 획득 실패 시 트랜잭션을 취소한다.

## 롤백·복구

- 직전 운영 앱 `44fdb396384b49f5b2f5957f6afabcd4fce2301a`, 배포 `dpl_4xCtdEB4pKWfN2crNTJeZoC5XJLm`으로 Vercel 롤백.
- 새 테이블/버킷을 DROP하지 않는다. 운영 사진이 생겼다면 데이터 보존과 만료 정리를 유지한다.
- 구 앱의 팀 저장도 사진 필드 생략을 지원하므로 롤백 이후 수정으로 기존 사진을 실수로 삭제하지 않는다.
- 정리 작업 장애 시 `cron.job_run_details`, `net._http_response`의 상태/응답만 확인한다. 요청 헤더와 Vault 값은 출력하지 않는다. `SELECT public.enqueue_member_photo_cleanup();`로 안전하게 재시도 가능.
- 삭제 작업은 Storage 오류 시 메타데이터를 보존하며 재실행 가능하다. 실패로 24시간 처리 목표를 넘기지 않도록 운영 모니터링이 필요하다.
- DB 백업은 Storage 파일 바이트 복구를 보장하지 않는다. 만료 후 의도적으로 삭제한 사진을 무조건 복원할 수 있다고 안내하지 않는다.

## 운영 백엔드 반영 기록 (2026-10-12 KST)

- core migration `20261012010137_member_photos`와 runtime migration `20261012010153_member_photo_cleanup_runtime` 적용 완료. 검증한 SQL 내용은 동일하며 파일명은 실제 적용 버전에 맞췄다.
- Edge Function `cleanup-member-photos` v1 ACTIVE. Vault 인증을 사용하는 예약 작업 활성화. 실제 예약 경로 호출 HTTP 200, 빈 큐 `removed=0, complete=true` 확인.
- 인증 없는 호출과 잘못된 토큰은 HTTP 401.
- 기존 profiles 141 / teams 30 / team_members 51 / match_requests 22 / 학생증 파일 139개 유지. 새 사진 0개.
- 앱 운영 배포는 GitHub 최종 검사 완료 후 진행.
