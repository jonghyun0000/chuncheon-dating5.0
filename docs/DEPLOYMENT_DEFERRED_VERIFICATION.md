# 운영 적용 완료 — 2026-10-12 (한국 시간)

학생증 없이 가입하고 둘러보기·비공개 팀 초안을 사용할 수 있는 흐름을 운영에 반영했다.
학생증은 나중에 제출·재제출할 수 있으며 팀 공개와 매칭은 관리자 승인 후 가능하다.
승인만으로 팀을 자동 공개하지 않는다. 상대 연락처는 기존처럼 관리자 단체방 개설에만 사용한다.

- 운영: https://chuncheon-dating5-0.vercel.app
- PR: https://github.com/jonghyun0000/chuncheon-dating5.0/pull/4 (병합 완료)
- 운영 코드: 44fdb396384b49f5b2f5957f6afabcd4fce2301a
- Vercel 배포: dpl_4xCtdEB4pKWfN2crNTJeZoC5XJLm, READY, production
- DB migration: 20261012000030_deferred_student_verification.sql
- 확인한 DB 백업: 2026-10-12 03:55:15 KST, physical backup, 복구 버튼 제공. Storage 객체는 DB 백업에 포함되지 않으며 이번 변경에서 기존 객체를 수정·삭제하지 않았다.
- 이전 배포: dpl_4dt2qoHmcgi1qwTZmx4V9ctWK34A (프런트엔드 복구 대상)

## 검증 결과

기존 profiles 141, Auth 사용자 144, teams 30, team_members 51, match_requests 22, student-ids 객체 139개가 변경 전후 동일했다. 초기 초안은 0개다.
운영 DB에서 초안 RLS·소유자 접근 제한·익명 실행 차단·직접 INSERT/UPDATE 차단·학생증 버킷 비공개를 확인했다.
읽기 전용 역할 검사에서 일반 남자 계정은 여자 팀 1개, 일반 여자 계정은 남자 팀 11개, 관리자 계정은 남녀 12개를 모두 조회했다. 개별 회원 정보는 로그에 출력하지 않았다.

- 앱 테스트 92개, DB 회귀 검사 62개, 동시성 4개, 실제 로컬 Supabase 검사 35개 통과.
- Chrome 17개와 WebKit/Safari 계열 17개 통과. 가상 API를 사용하는 브라우저 테스트에서는 서비스 워커를 차단해 테스트 요청이 실제 네트워크로 빠져나가지 않도록 했다.
- GitHub 필수 application/database 검사 통과. 운영 main의 Verify service 및 Verify production release도 성공.
- 실제 운영 주소에서 배포 커밋 일치, 보안 헤더, 익명 개인정보 접근 차단, 모바일·데스크톱, 4개 언어, 공개 경로, 관리자 로그인 리다이렉트를 확인했다. 브라우저 미처리 예외와 CSP 오류는 없었다.
- 운영 가입 화면의 사진 input 0개와 '학생증 없이 가입' 안내를 직접 확인했다.
- npm audit: 취약점 0건. 기존 취약한 개발 패키지는 업데이트했고 감사 검사·운영 브랜치 보호 규칙을 유지했다.

운영 회원 계정으로 신규 가입·학생증 업로드·팀 공개·매칭 신청을 실행하지는 않았다. 전체 쓰기 흐름은 실제 로컬 Supabase와 가상 브라우저 데이터로 검증했다. 기존 운영 회원의 매칭·삭제를 테스트 목적으로 변경하지 않았다.
CSS 컴파일러 업데이트의 지원 범위는 Safari 16.4+, Chrome 111+, Firefox 128+이며 구형 브라우저는 검증 범위 밖이다. [공식 지원 범위](https://tailwindcss.com/docs/upgrade-guide).

Supabase의 기존 advisor 경고(필터가 있는 definer 공개 명단 뷰, 의도한 로그인 전 RPC, 유출 비밀번호 검사 설정 등)는 별도 점검 항목으로 남아 있다. npm 감사 0건이 모든 DB 보안 경고 해소를 뜻하지 않는다. 새 초안 테이블의 RLS 누락이나 새 함수의 익명 실행 권한은 없었다. [Advisor 안내](https://supabase.com/docs/guides/database/database-linter).

증거: validation/production-database-verification.json, production-release-smoke.json, production-deployment.json, production-registration.png, release-chrome-final.json, release-webkit.json, release-audit.json.

복구는 이전 프런트엔드 배포로 우선 되돌리고 새 초안과 새 가입자를 보존한다. 전체 DB 복구는 신규 데이터 유실과 다운타임을 동반할 수 있어 실제 데이터 문제가 있을 때만 별도 범위를 확인한다. 상세 절차는 DEFERRED_VERIFICATION_ROLLOUT.md를 참고한다.
