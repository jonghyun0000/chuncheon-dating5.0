# 춘천과팅 앱 개발 기반

2026-11-18. 서명된 Android 비공개 테스트 후보를 생성했다. **운영 DB 적용·Play 업로드·실기기 검증은 완료되지 않았으며, 아직 배포 승인된 빌드가 아니다.**

## 구성

- React/Vite 화면·업무 로직을 웹/Android/iOS가 공유한다. Capacitor 8 기반 네이티브 프로젝트는 `android/`, `ios/`에 저장한다.
- 기존 `npm run build`는 웹용 `dist/`를 만든다. `build:native`는 별도 `dist-native/`를 만들고 `mobile:sync`가 앱 프로젝트에 복사한다. `server.url`로 운영 웹을 원격 실행하지 않는다.
- 앱은 기존 Supabase의 **공개 URL·공개 키**를 사용하는 구성이다. 이번 서명 후보에는 실제 운영 공개 설정을 사용하므로 웹과 회원·팀·매칭 데이터를 공유한다. API 키 값은 문서에 기록하지 않는다. 운영 DB·Auth 설정은 변경하지 않았다. 실제 기기에서의 로그인·업무 흐름 검증은 별도로 남아 있다.
- 앱은 PWA 서비스 워커를 등록하지 않고 설치 배너를 숨긴다. 웹의 설치·캐시·로그인 동작은 유지한다. Android 뒤로가기는 열린 모달의 취소 동작을 먼저 처리하고, 페이지 이력이 있으면 뒤로, 없으면 홈으로 이동하며 홈에서는 앱을 최소화한다. 모달 취소 상태 처리 수정도 후보 코드에 포함했다.
- 웹 링크를 안내할 때 native `localhost` 대신 공개 웹 주소를 사용한다. 앱 첫 실행은 기존 아이디로 새로 로그인해야 한다. 웹 세션·PWA 바로가기를 앱 설치가 자동으로 이전하지 않는다.
- 기존 꽃 로고로 네이티브 아이콘과 시작 화면을 생성했다. Apple 앱 아이콘은 불투명 1024px이며 Android 일반/적응형 아이콘을 포함한다. `assets/logo.png`는 기존 maskable 원본 재사용이다. 스토어 홍보용 고해상도 원본은 제출 전 별도 확인한다.
- 앱 식별자 `kr.hyundo.chuncheondating`는 **제출 전 확정할 후보 값**이다. Google에 최초 업로드하기 전에 소유 주체와 최종 식별자를 확인한다. Android 업로드 키는 로컬에 생성했지만 Play에 등록하지 않았다. Apple Team은 아직 설정하지 않았다.

## 생성한 Android 후보

코드 기준: `39705ec509ac7f6f205550a845c47f9a67c25199`. 세부 빌드 정보와 파일 해시는 로컬 산출물 `release-candidates/android/BUILD_REPORT.json`에 기록한다. 패키지 내부 build-info의 커밋도 이 기록과 일치한다.

| 항목 | 상태 |
| --- | --- |
| 앱 버전 | `1.0.0-beta.1`, versionCode `1` |
| 제출 후보 | `release-candidates/android/chuncheon-1.0.0-beta.1-candidate.aab` — 서명 검사 통과 |
| 직접 설치 검사용 | `release-candidates/android/chuncheon-1.0.0-beta.1-candidate.apk` — Play 비공개 테스트 참여 기록을 대신하지 않음 |
| 업로드 키 | `~/.config/chuncheon-dating/android-signing/`에 로컬 생성. Play 미등록, 안전한 별도 백업 필요 |
| 상태 | `candidate-not-approved-for-upload` — 업로드·심사·테스트 시작을 의미하지 않음 |

키·비밀번호·서명 설정 파일은 저장소와 공유 문서에 넣지 않는다. 최초 업로드 전에 앱 식별자와 업로드 인증서를 확인하고, 키 및 복구에 필요한 정보는 접근이 제한된 별도 장소에 안전하게 백업한다. 현재 키가 있는 상태에서 새로 생성하거나 교체하지 않는다.

## 로컬 실행

Node 22.12 이상 22.x, JDK 21, Android SDK 36 및 호환 Android Studio, Xcode 26 이상을 사용한다. 비밀키는 저장소에 넣지 않는다.

```sh
npm ci
# .env.native.local에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 설정
# anon/publishable 키만 사용. 합성 데이터 검사는 격리 환경을 사용.
# 운영 공개 설정으로 빌드하면 앱 활동도 실제 서비스 데이터에 영향을 줌.
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

아이콘 재생성은 `npm run mobile:icons`를 사용한다. 서명 없는 로컬 컴파일:

```sh
cd android && ./gradlew --no-daemon assembleDebug
# 저장소 루트에서
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath native-build/ios CODE_SIGNING_ALLOWED=NO build
```

로컬 업로드 키가 준비된 상태에서 후보를 다시 만들 때는 `JAVA_HOME`과 `ANDROID_HOME`, `.env.native.local`의 실제 공개 백엔드 설정을 확인한 뒤 다음 명령을 사용한다. 이 명령은 스토어에 업로드하지 않는다.

```sh
npm run mobile:android:bundle
```

`Verify mobile builds` 워크플로는 PR에서 Android debug와 iOS Simulator 컴파일을 각각 실행한다. 가상 API 설정을 사용하며 스토어 서명·배포 권한을 사용하지 않는다. 기존 웹/DB/설치 업데이트 검사도 유지한다. 네이티브 컴파일 통과와 실제 기기에서의 로그인·카메라·백그라운드 복귀 검증은 다르다.

## 구현·검증 현황

최초 main 감사 기준은 `523970872db4233fea1b211f37dcefd4e837a2fe`이며, 아래는 후보 코드 `39705ec`까지의 로컬 결과다. 운영 DB를 조회·변경해 검증한 결과가 아니다.

- **개별 사용자 차단:** SQL migration, 차단·해제 UI, 팀/후기 작성자 차단, 서버 조회·신청·사진 권한 연동 및 로컬 테스트를 준비했다. `20261118044858_individual_user_blocking.sql`은 운영 미적용이다. 현재 운영 프로젝트 접근이 거부되어 원격 검증도 하지 못했다. 승인 후 적용하고 로그인된 일반 계정의 `user_blocking_available()`가 `true`를 반환하며 실제 차단이 동작하는지 확인해야 한다. 기능 확인이 실패하면 UI를 숨기는 구성이라 기존 DB의 미구현 RPC를 사용자에게 작동 가능한 기능으로 표시하지 않는다.
- **연령 입력:** `NativeAgeGate`에 만 19세 기준의 기기 내 자기신고 확인을 구현했다. 생년월일은 저장·전송하지 않고 확인 결과의 정책 버전·시각만 기기에 저장한다. 서버 연령 검증이나 실명·신분증 인증이 아니며 Console의 미성년 접근 제한 설정을 대신하지 않는다.
- **자동 검사:** 단위 테스트 147개, 격리 DB 테스트 111개와 동시성 시나리오 7개, 브라우저 기능 50개 통과. 이전 main에서 설치한 웹앱의 일반/관리자 업데이트 검사도 Chromium 5개·WebKit 5개 통과했다. 실기기 네이티브 검사는 별도다.
- **기기 검사:** Android 에뮬레이터가 호스트 환경 문제로 실행되지 않아 실제 Android 환경 검증은 미완료다. 컴파일·브라우저 테스트 결과로 설치·사진 선택·네이티브 뒤로가기·복귀·업데이트 동작을 검증했다고 간주하지 않는다.

## 남은 출시 전 보완 사항

1. 운영 접근 권한을 복구하고, 승인된 차단 migration 적용·기능 확인·일반/관리자 기존 권한 회귀 검증을 완료한다. 앱에서 버튼이 보인다는 사실만으로 서버 보호 기능을 확인하지 않는다.
2. `delete_my_account`의 관리자 처리 대기, Auth 계정 보존, 실제 사진/개인정보 삭제 완료 절차와 공개 안내를 맞춘다. 정지 회원의 삭제 요청 경로와 예외 보관 사유·기간도 확인한다.
3. 아동 안전 공개 기준·담당자·문의 창구, 개인정보처리방침, 삭제 안내를 실제 구현에 맞게 확정·게시한다. Console의 연령·데이터 보안·콘텐츠 등급 등을 실제 기능에 따라 작성한다.
4. 실제 Android/iPhone에서 사진 선택·HEIC·촬영 취소·키보드·안전 영역·모달에서 뒤로가기·광고 외부 링크·메일 앱·인증 세션 복귀를 확인한다. 푸시 알림, 스토어 결제, 연결 앱 링크는 현재 구현된 기능으로 안내하지 않는다.
5. 별도 심사용 계정·가상 팀을 준비하고, 앱 회원/관리자 기능과 앱 업데이트 후 세션·저장소 보존을 검증한다. 운영 데이터를 공유하는 후보로 실제 회원에게 테스트 신청을 보내지 않는다.
6. [스토어 준비 현황](MOBILE_STORE_READINESS.md)과 [비공개 테스트 실행 안내](android-closed-test/RUNBOOK.md)의 남은 항목을 완료한다. 대화에서 논의했던 Pro/GPT 기능은 현재 구현되었다고 간주하지 않는다.

## 의존성 감사 제한

2026-11-18 확인 결과 기존 main부터 이어진 개발 의존성의 high 5건이 남아 있다. 모두 picomatch의 ReDoS 공지([GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf))에서 전파된 결과다. `npm audit --omit=dev`는 0건이다. 후보 AAB 생성은 필수 감사 통과를 의미하지 않는다. 기존 audit 검사를 유지하며 강제 다운그레이드나 검사 우회를 적용하지 않는다. 해결 여부를 다시 확인하기 전 운영 병합·스토어 제출 준비 완료로 표시하지 않는다.
