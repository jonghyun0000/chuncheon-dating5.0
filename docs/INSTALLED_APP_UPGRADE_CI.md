# 기존 설치 사용자 배포 호환성 검사

## 목적과 배포 기준

배포 후 이전 앱을 열어 둔 사용자가 예전 해시의 JavaScript 파일을 요청하면 파일이 없어질 수 있다. 이때 HTML이 모듈로 반환되거나 복구되지 않아 일반·관리자 화면이 오류 페이지로 바뀌는 회귀를 검사한다.

`Verify service`의 `installed-app-upgrade`는 Chromium과 WebKit 검사 모두가 성공해야 통과한다. 한쪽 실패·취소·건너뛰기도 실패로 취급한다. `main` 보호 규칙에는 기존 `application`, `database`와 함께 이 상태를 필수로 설정한다. 관리자를 포함해 정상 PR 병합 경로에서 검사를 우회할 수 없도록 한다. Vercel 관리자 권한으로 직접 수행하는 배포·승격까지 GitHub 규칙이 차단하는 것은 아니다.

## 배포 전 검사

`scripts/test-installed-upgrade.mjs`는 PR의 실제 base SHA 또는 main push 직전 SHA를 별도 임시 폴더에 추출한다. 이전 소스와 후보 소스를 각각 빌드하고 같은 로컬 주소에서 서버의 제공 버전을 교체한다. 문서만 바뀐 배포도 누락된 청크 복구를 검사하도록 임시 이전 빌드에만 식별 표시를 추가한다. 이전·후보 lockfile이 다르면 이전 버전 의존성도 별도로 설치한다.

각 브라우저에서 다음 다섯 경로를 독립적으로 확인한다.

| 계정 | 페이지 |
| --- | --- |
| 일반 | 팀 등록, 매칭 상세 |
| 관리자 | 신고, 후기 관리, 매칭 상세 |

매칭 상세는 가상 ID의 빈 결과 안내까지 렌더링하는 모듈 로딩 검사다. 실제 매칭의 업무 동작 전체를 검증하는 것은 아니다.

- 이전 버전 로그인·서비스 워커를 유지한 상태에서 후보 버전으로 전환
- 실제 누락된 이전 청크 요청 발생 및 한 번의 자동 새로고침으로 복구
- 후보 버전에도 다음 배포를 위한 복구 이벤트 연결과 반복 새로고침 방지 유지
- 로그인 토큰·localStorage·sessionStorage·IndexedDB의 가상 값 유지
- HTML로 오염된 JS 캐시만 제거하고 정상 이전 JS 및 무관한 캐시 유지
- 새 버전에서 같은 URL 다시 열기 및 홈의 가상 팀 표시
- 일반 계정의 관리자 접근 차단 유지
- 설치 앱 이름·식별자·시작 주소·범위·표시 모드 유지와 Apple Touch Icon 로딩

실제 Supabase 계정·운영 키·회원 데이터는 사용하지 않는다. API는 로컬 가상 데이터로 응답하며 변경 요청을 거부한다. API URL은 빌드 시 로컬 서버로 고정하고 브라우저의 외부 요청도 차단한다. 저장소 보존 검사는 브라우저 저장소의 가상 값 기준이며, 저장하지 않은 React 폼 입력의 복원을 보장하지 않는다.

## 배포 후 검사

기존 `Verify production release`는 신뢰할 수 있는 최신 main의 배포 SHA를 확인한 뒤 읽기 전용으로 운영 주소를 검사한다. 다음 항목을 추가로 검사한다.

- 초기 JavaScript와 매칭 상세·신고·후기 관리 청크가 HTTP 200 및 JavaScript MIME으로 응답
- 존재하지 않는 `/assets/*.js`는 HTTP 404로 응답
- HTML·서비스 워커의 재검증 캐시 설정 유지
- manifest 연결 및 설치 앱 이름·시작 주소·범위 유지
- favicon, Apple Touch Icon, Android 일반·maskable 192/512 PNG의 응답·실제 파일 크기

운영에서는 실제 계정으로 로그인하거나 DB를 수정하지 않는다. 일반·관리자 로그인 후 버전 전환은 위의 격리 환경에서 검사한다. 배포 후 검사의 실패는 GitHub Actions에서 실패로 표시하며 자동 롤백은 수행하지 않는다.

## 실행과 증거

```sh
npm ci
npx playwright install --with-deps chromium webkit
CC_UPGRADE_BASE_REF=<이전 커밋의 전체 40자리 SHA> npm run test:installed-upgrade -- chromium
CC_UPGRADE_BASE_REF=<이전 커밋의 전체 40자리 SHA> npm run test:installed-upgrade -- webkit
```

기본 base는 로컬 HEAD다. macOS 로컬 Chromium 실행은 설치된 Chrome을 사용하고 CI에서는 Playwright Chromium을 사용한다. 결과는 `test-results/installed-app-upgrade/<브라우저>/report.json`, 빌드 로그, 실패 시 화면 캡처에 남는다. GitHub Actions는 브라우저별 증거를 14일 보관한다. 실제 사용자 정보·키는 보고서에 넣지 않는다.

최초 도입 시 Chromium·WebKit 각 다섯 시나리오가 통과했다. 복구 기능 도입 전 커밋 `7cc5ccbc7cccb4e8f554bf7b5e0f57c08ed85326`을 이전 버전으로 사용한 음성 대조 검사에서는 누락된 팀 등록 모듈로 `Unexpected Application Error!`를 재현하고 검사 실패를 확인했다.

이 검사는 모바일 화면과 standalone 상태를 모사한 브라우저 엔진 검사다. 실제 iPhone·삼성 기기의 홈 화면 설치 UI, OS가 보관하는 아이콘 캐시, 모든 과거 앱 버전까지 인증하는 것은 아니다. manifest나 설치 안내를 바꿀 때에는 실제 기기 확인도 병행한다.
