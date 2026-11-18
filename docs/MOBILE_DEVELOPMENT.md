# 춘천과팅 앱 개발 기반

2026-11-18. 이 브랜치는 출시 준비용이며 운영 배포·스토어 업로드용 완성본이 아니다.

## 구성

- React/Vite 화면·업무 로직을 웹/Android/iOS가 공유한다. Capacitor 8 기반 네이티브 프로젝트는 `android/`, `ios/`에 저장한다.
- 기존 `npm run build`는 웹용 `dist/`를 만든다. `build:native`는 별도 `dist-native/`를 만들고 `mobile:sync`가 앱 프로젝트에 복사한다. `server.url`로 운영 웹을 원격 실행하지 않는다.
- 앱 빌드에 기존 Supabase의 **공개 URL·공개 키**를 지정하면 동일 회원·팀·매칭 데이터를 사용한다. 이번 빌드 검증은 `https://test.invalid`와 가상 공개 키를 사용하므로 실제 회원이 로그인할 수 있는 베타가 아니다. 운영 DB·Auth 설정은 변경하지 않았다.
- 앱은 PWA 서비스 워커를 등록하지 않고 설치 배너를 숨긴다. 웹의 설치·캐시·로그인 동작은 유지한다. Android 뒤로가기는 페이지 이력이 있으면 뒤로, 없으면 홈으로 이동하고 홈에서 앱을 최소화한다.
- 웹 링크를 안내할 때 native `localhost` 대신 공개 웹 주소를 사용한다. 앱 첫 실행은 기존 아이디로 새로 로그인해야 한다. 웹 세션·PWA 바로가기를 앱 설치가 자동으로 이전하지 않는다.
- 기존 꽃 로고로 네이티브 아이콘과 시작 화면을 생성했다. Apple 앱 아이콘은 불투명 1024px이며 Android 일반/적응형 아이콘을 포함한다. `assets/logo.png`는 기존 maskable 원본 재사용이다. 스토어 홍보용 고해상도 원본은 제출 전 별도 확인한다.
- 앱 식별자 `kr.hyundo.chuncheondating`는 **제출 전 확정할 임시 값**이다. Google에 최초 업로드하기 전에 소유 주체와 최종 식별자를 확인한다. 서명 키·Apple Team은 아직 설정하지 않았다.

## 로컬 실행

Node 22.12 이상 22.x, JDK 21, Android SDK 36 및 호환 Android Studio, Xcode 26 이상을 사용한다. 비밀키는 저장소에 넣지 않는다.

```sh
npm ci
# .env.native.local에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 설정
# anon/publishable 키만 사용. 테스트는 별도 환경의 URL·공개 키 사용.
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

`Verify mobile builds` 워크플로는 PR에서 Android debug와 iOS Simulator 컴파일을 각각 실행한다. 가상 API 설정을 사용하며 스토어 서명·배포 권한을 사용하지 않는다. 기존 웹/DB/설치 업데이트 검사도 유지한다. 네이티브 컴파일 통과와 실제 기기에서의 로그인·카메라·백그라운드 복귀 검증은 다르다.

## 확인한 출시 전 보완 사항

코드 기준은 main `523970872db4233fea1b211f37dcefd4e837a2fe`다. 운영 DB를 조회한 감사 결과는 아니다.

1. 같은 학과 숨기기와 별도로 개별 사용자 차단·해제를 서버 조회/신청/사진 권한까지 반영해야 한다.
2. 약관의 성인 이용 조건과 실제 가입·앱 접근의 연령 확인을 일치시켜야 한다.
3. `delete_my_account`는 관리자 처리 대기 방식이다. 공개 안내의 즉시 삭제 설명, Auth 계정 보존, 실제 사진/개인정보 삭제 완료 절차를 맞춰야 한다. 정지 회원도 삭제 요청 경로에 접근할 수 있어야 한다.
4. 실제 Android/iPhone에서 사진 선택·HEIC·촬영 취소·키보드·안전 영역·모달에서 뒤로가기·광고 외부 링크·메일 앱·인증 세션 복귀를 확인해야 한다. 아직 푸시 알림, 스토어 결제, 연결 앱 링크는 구현하지 않았다.
5. 별도 테스트 계정·가상 팀을 가진 검증 환경으로 앱 회원/관리자 기능을 확인하고, 앱 업그레이드 후 저장소 보존을 실기기에서 검사해야 한다.
6. 스토어 안전 정책·계정 준비는 [MOBILE_STORE_READINESS.md](MOBILE_STORE_READINESS.md)를 따른다. 현재 main에는 대화에서 논의했던 Pro/GPT 기능이 확인되지 않아 제거하거나 새로 추가하지 않았다.

## 의존성 감사 제한

2026-11-18의 `npm audit`는 기존 main과 이 브랜치 모두 개발 의존성에서 high 5건을 보고한다. 모두 picomatch의 ReDoS 공지([GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf))에서 전파된 결과다. 당시 공식 패치 버전은 없으며 `npm audit --omit=dev`는 양쪽 모두 0건이다. 기존 필수 audit 검사를 유지하며 강제 다운그레이드나 검사 우회는 적용하지 않는다. 해결 전 운영 병합용으로 표시하지 않는다.
