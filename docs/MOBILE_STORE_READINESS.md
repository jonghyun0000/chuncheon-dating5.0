# 춘천과팅 웹·앱 동시 운영 및 스토어 출시 준비

기준일: 2026-11-18. 사용자 확인: Google Play Console 계정 준비 완료, Apple Developer 계정은 아직 준비 전.

이 문서는 출시 전 확인할 항목이다. 아래 체크되지 않은 항목이 현재 서비스에 반드시 없거나 잘못되었다는 뜻은 아니다. 실제 코드·설정·실기기 검증 결과로 체크해야 하며, 앱 패키지 생성만으로 심사 통과나 출시가 보장되지는 않는다.

## 웹과 앱을 함께 운영하는 구조

- 웹·iOS·Android는 같은 Supabase 백엔드의 계정·팀·매칭·권한을 사용한다. 앱용으로 회원을 복제하거나 DB를 새로 만들지 않는다.
- 같은 아이디로 로그인하되 각 브라우저·기기의 세션은 별도다. 웹 로그인 상태가 설치한 앱으로 자동 이전된다고 안내하지 않는다.
- 앱에는 빌드된 화면 파일을 포함한다. 운영 웹 URL을 앱의 원격 실행 주소로 사용하지 않는다. 웹 배포가 이미 설치된 앱의 실행 파일을 교체하지 않으므로 앱 버전은 스토어 배포로 관리한다.
- 앱이 공유하는 데이터·권한은 백엔드 변경의 영향을 받는다. 향후 DB·RPC 변경은 이전 앱 버전과 호환되게 추가한 후 단계적으로 전환하고, 구버전 지원 기간이 끝난 뒤 제거한다. 서버 권한 검사를 앱 버전에 의존시키지 않는다.
- 웹 배포 전 기존 자동 검사에 더해 앱 빌드, 로그인·사진 선택·복귀·뒤로가기, 일반/관리자 권한, 앱 업데이트 후 세션 유지 검사를 수행한다. 네이티브 실기기 검사는 브라우저 엔진 검사로 대체하지 않는다.

## 계정·배포 준비

- [x] Google Play Console 계정 준비 여부 확인.
- [ ] Google 계정 유형과 생성일 확인. 2023-11-13 이후 생성된 개인 계정이면 최소 12명이 연속 14일 참여하는 비공개 테스트와 프로덕션 접근 신청이 필요하다. 계정 보유와 프로덕션 접근 승인은 다르다. [Google 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [ ] Apple Developer 가입·본인/조직 확인·App Store Connect 접근 준비. 공식 연회비는 99 USD이며 지역 금액은 가입 화면에서 확인한다. 개인 가입은 법적 개인 이름이 판매자로 표시된다. [Apple 가입 안내](https://developer.apple.com/help/account/membership/program-enrollment/)
- [ ] 최종 앱 식별자, 표시 이름, 서명 주체, 배포 지역 결정. 서명·스토어 제출 단계에는 개발자 계정 정보와 해당 권한이 필요하다. 비밀번호·서명 비밀키를 저장소나 대화에 넣지 않는다.
- [ ] 앱 아이콘·시작 화면·실제 기기 스크린샷·지원 URL·개인정보처리방침·콘텐츠 등급 작성. 최신 SDK·제출 요건은 실제 제출 직전에 다시 확인한다.

## 제출 전 필수 기능·정책 확인

- [ ] **앱 사용성과 차별화:** 모바일 화면, 사진 선택, 복귀, 뒤로가기, 오류 복구를 실기기에서 검증한다. Apple은 단순 웹 포장보다 충분한 기능을 요구하고, 데이팅 분야의 의미 있는 차별화를 심사한다. 팀 단위 만남·대학 인증·양방향 지인 피하기를 실제 동작과 함께 설명한다. 특정 네이티브 기능 하나를 추가했다고 승인되는 것은 아니다. [Apple 심사 안내](https://developer.apple.com/app-store/review/), [Apple 4.3](https://developer.apple.com/app-store/review/guidelines/#spam)
- [ ] **신고·차단·관리:** 콘텐츠와 이용자 신고, 악성 이용자 차단, 부적절한 사진·글 필터링, 관리자 처리 및 문의 창구를 검증한다. 같은 학교·학과 숨기기는 악성 이용자 차단을 대신하지 않는다. 게시 전에 약관 동의를 받고 금지 콘텐츠와 처리 기준을 고지한다. [Google UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), [Apple 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- [ ] **연령 제한:** 매칭이 핵심인 앱으로 Google Play의 대상 연령을 18세 이상으로 설정하고 Restrict Minor Access를 적용한다. 대학 재학 여부와 나이 확인은 별개이므로 앱의 연령 제한 방식도 점검한다. [Google 매칭 앱 요건](https://support.google.com/googleplay/android-developer/answer/16838200?hl=en), [Play Console 설정](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en)
- [ ] **아동 안전:** 서비스명을 명시한 공개 아동 안전 기준 URL, 앱 안 신고 창구, 신고 콘텐츠 대응·삭제·관련 기관 신고 절차, 담당 연락처를 마련하고 Play Console에 선언한다. 성인 대상 소셜·데이팅 앱에도 해당한다. [Google Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en)
- [ ] **회원 탈퇴:** 앱 안에서 계정 삭제를 시작할 수 있고 연관 데이터·사진 삭제도 실제 처리되는지 확인한다. Google에는 앱 외부에서 삭제를 요청할 수 있는 웹 URL도 제공한다. 예외 보관의 사유·기간을 명확히 하고, 팀 삭제 후 사진 보관 규칙을 회원 탈퇴에 자동 적용하지 않는다. [Apple 계정 삭제](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Google 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [ ] **사진 권한:** 학생증·프로필 사진 선택에는 시스템 선택기를 우선한다. 전체 사진함 접근이 핵심 기능에 필요하지 않다면 Android의 광범위한 사진·동영상 권한을 요청하지 않는다. [Google 최소 권한 안내](https://support.google.com/googleplay/android-developer/answer/16935362?hl=en)
- [ ] **개인정보·SDK 신고:** 실제 수집·공유·보관·삭제 동작을 Apple 개인정보 및 Google Data safety 신고와 맞춘다. 광고·분석 SDK를 추가할 때도 다시 점검한다.
- [ ] **심사 접근:** 정상 동작하는 별도 심사용 계정과 기능별 안내를 준비한다. 실제 학생증 제출·관리자 수동 승인 대기 없이 심사자가 필요한 기능을 확인할 수 있게 구성하되, 운영 관리자 계정이나 실제 회원 개인정보를 제공하지 않는다. 필요한 역할은 별도 테스트 권한·데이터로 검증한다. [Apple 심사 자료](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)

## 향후 기능을 추가할 때 적용할 조건

현재 main 코드 감사에서는 대화에서 언급했던 Pro 결제와 GPT 분석 기능을 확인하지 못했다. 아래 항목은 현재 구현되었다고 간주하거나 출시 장애로 확정하는 것이 아니라, 실제 추가·활성화할 때 적용하는 조건이다.

- **Pro·사진 무제한 이용권:** 앱의 디지털 기능 결제에는 기본적으로 StoreKit/Google Play Billing을 사용한다. 한국 대체결제는 별도 프로그램·권한·API 등 조건이 있어 계좌번호만 표시하는 방식으로 충족되지 않는다. [Google 결제 정책](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Google 한국 대체결제](https://support.google.com/googleplay/android-developer/answer/11222040?hl=en), [Apple 한국 대체결제](https://developer.apple.com/kr/support/storekit-external-entitlement-kr)
- **웹 구매 권한 공유:** Apple의 멀티플랫폼 규정은 웹에서 구매한 기능을 앱에서 쓸 때 해당 항목의 앱 내 구입 제공 조건을 둔다. 구매 버튼만 숨기면 해결된다고 가정하지 않는다. 실제 상품·지역·정책에 맞게 설계한다. [Apple 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods)
- **GPT 소개글 분석:** 개인 데이터를 제3자 AI로 전송한다면 대상·목적을 고지하고 명시적 동의를 받은 뒤 전송하도록 검증한다. [Apple 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)

## 진행 순서

1. 격리 환경에서 앱 기반 구성과 합성 데이터 테스트를 완료한다.
2. Android/iOS 실제 기기에서 가입·인증 사진·팀·매칭·신고·탈퇴·기존 앱 업데이트를 확인한다.
3. 위 항목의 결과를 기록하고 스토어 정보·서명을 준비한다.
4. Google 비공개 테스트와 Apple TestFlight로 검증하고, 계정별 출시 조건을 충족한 빌드를 심사에 제출한다.
5. 웹과 앱을 각각 배포·검증하면서 공통 백엔드의 구버전 호환성을 유지한다.
