# 춘천과팅 웹·앱 동시 운영 및 스토어 출시 준비

기준일: 2026-11-18. 사용자 확인: Google Play Console **개인 계정**, 약 1년 전 생성, 춘천과팅 **앱 생성·AAB 업로드·출시 이력 없음**. Apple Developer 계정은 아직 준비 전.

서명된 Android 후보는 생성했지만 **Play 업로드·비공개 테스트 시작·운영 DB 적용은 하지 않았다.** 체크되지 않은 항목은 구현 부재뿐 아니라 원격 검증·공개 정책·실기기 확인 등이 남았음을 뜻한다. 패키지 생성만으로 심사 통과나 출시가 보장되지는 않는다.

## 현재 준비된 것과 남은 조건

| 항목 | 2026-11-18 현재 상태 |
| --- | --- |
| Android 후보 | 코드 `39705ec`, `1.0.0-beta.1` / versionCode `1`. 서명 AAB·검사용 APK 생성, 서명·내부 소스 커밋 검사 통과. 로컬 빌드 기록: `release-candidates/android/BUILD_REPORT.json` |
| 백엔드 | 후보는 실제 운영 공개 Supabase 설정 사용. 웹과 데이터 공유. 운영 DB·Auth 변경 없음 |
| 업로드 키 | `~/.config/chuncheon-dating/android-signing/`에 생성. Play 미등록, 안전한 별도 백업 필요. 키·비밀번호는 문서/Git에 기록하지 않음 |
| 개별 차단 | SQL·UI·로컬 테스트 완료. 운영 접근 거부로 적용·원격 검증 미완료. 승인 후 migration 적용 및 `user_blocking_available() === true` 확인 필수 |
| 나이 확인 | NativeAgeGate의 기기 내 만 19세 자기신고 구현. 생년월일 미저장·미전송. 서버/실명·신분증 연령 검증은 아님 |
| 기능 검사 | 단위 테스트 147개, 격리 DB 테스트 111개, 동시성 7개, 브라우저 50개, 일반/관리자 웹앱 업데이트 Chromium 5개·WebKit 5개 통과 |
| 실제 Android 검사 | 호스트 환경의 에뮬레이터 실행 실패로 미완료. 실기기 설치·업데이트·복귀 검증 필요 |
| 정책·심사·보안 | 공개 정책·삭제 구현/안내 대조·심사용 계정·Console 작성 미완료. 기존 의존성 audit high 5건 남음 |

후보 파일이 있다는 이유로 제출 준비 완료 처리하지 않는다. [개발·검증 세부 기록](MOBILE_DEVELOPMENT.md)을 함께 확인한다.

## 웹과 앱을 함께 운영하는 구조

- 웹·iOS·Android는 같은 Supabase 백엔드의 계정·팀·매칭·권한을 사용한다. 앱용으로 회원을 복제하거나 DB를 새로 만들지 않는다.
- 같은 아이디로 로그인하되 각 브라우저·기기의 세션은 별도다. 웹 로그인 상태가 설치한 앱으로 자동 이전된다고 안내하지 않는다.
- 앱에는 빌드된 화면 파일을 포함한다. 운영 웹 URL을 앱의 원격 실행 주소로 사용하지 않는다. 웹 배포가 이미 설치된 앱의 실행 파일을 교체하지 않으므로 앱 버전은 스토어 배포로 관리한다.
- 앱이 공유하는 데이터·권한은 백엔드 변경의 영향을 받는다. 향후 DB·RPC 변경은 이전 앱 버전과 호환되게 추가한 후 단계적으로 전환하고, 구버전 지원 기간이 끝난 뒤 제거한다. 서버 권한 검사를 앱 버전에 의존시키지 않는다.
- 웹 배포 전 기존 자동 검사에 더해 앱 빌드, 로그인·사진 선택·복귀·뒤로가기, 일반/관리자 권한, 앱 업데이트 후 세션 유지 검사를 수행한다. 네이티브 실기기 검사는 브라우저 엔진 검사로 대체하지 않는다.

## 계정·배포 준비

- [x] Google Play Console 계정 준비 여부 확인.
- [x] Google 계정 유형과 대략적인 생성 시기 확인: 개인 계정, 약 1년 전 생성, 앱 생성·업로드·출시 이력 없음.
- [ ] [최초 앱 생성 안내](android-closed-test/FIRST_APP_SETUP.md)에 따라 Console에 새 앱 생성. 생성·서명 등록은 아직 실행하지 않음.
- [ ] 최소 12명이 연속 14일 동안 비공개 테스트 참여를 선택한 상태를 유지하고 프로덕션 접근을 신청한다. Console 계정 확인 작업과 실제 참여 시작일을 별도 확인한다. APK 직접 설치·내부 테스트·이메일 등록만으로 조건을 충족하지 않으며 14일 후 자동 승인되지 않는다. [Google 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [ ] Apple Developer 가입·본인/조직 확인·App Store Connect 접근 준비. 공식 연회비는 99 USD이며 지역 금액은 가입 화면에서 확인한다. 개인 가입은 법적 개인 이름이 판매자로 표시된다. [Apple 가입 안내](https://developer.apple.com/help/account/membership/program-enrollment/)
- [x] Android 로컬 업로드 키 생성 및 서명 후보 빌드 확인.
- [ ] 최종 앱 식별자 `kr.hyundo.chuncheondating`, 표시 이름, 서명 주체, 배포 지역 확정. 키를 안전하게 백업하고 Play 앱 서명·업로드 인증서를 설정한다. 비밀번호·서명 비밀키를 저장소나 대화에 넣지 않는다.
- [ ] 앱 아이콘·시작 화면·실제 기기 스크린샷·지원 URL·개인정보처리방침·콘텐츠 등급 작성. 최신 SDK·제출 요건은 실제 제출 직전에 다시 확인한다.

## 제출 전 필수 기능·정책 확인

- [ ] **앱 사용성과 차별화:** 모바일 화면, 사진 선택, 복귀, 뒤로가기, 오류 복구를 실기기에서 검증한다. Apple은 단순 웹 포장보다 충분한 기능을 요구하고, 데이팅 분야의 의미 있는 차별화를 심사한다. 팀 단위 만남·대학 인증·양방향 지인 피하기를 실제 동작과 함께 설명한다. 특정 네이티브 기능 하나를 추가했다고 승인되는 것은 아니다. [Apple 심사 안내](https://developer.apple.com/app-store/review/), [Apple 4.3](https://developer.apple.com/app-store/review/guidelines/#spam)
- [ ] **신고·차단·관리:** 로컬 구현한 개별 차단 migration을 승인 후 적용하고 일반/관리자 계정에서 서버 보호와 기능 동작을 검증한다. 콘텐츠·이용자 신고, 부적절한 사진·글 관리 및 문의 창구를 실제 확인한다. 같은 학교·학과 숨기기는 개별 차단을 대신하지 않는다. 금지 콘텐츠와 처리 기준을 고지한다. [Google UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), [Apple 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
- [ ] **연령 제한:** 만 19세 자기신고 확인은 로컬 구현 완료. 대학 재학·학생증 승인과 연령 확인을 구분하고 실제 앱 접근 흐름을 검증한다. Play Console의 성인 대상 설정과 Restrict Minor Access도 적용한다. 이는 콘텐츠 등급 설문 답변이나 공식 본인 인증을 대신하지 않는다. [Google 매칭 앱 요건](https://support.google.com/googleplay/android-developer/answer/16838200?hl=en), [Play Console 설정](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en)
- [ ] **아동 안전:** [공개 기준 초안](android-closed-test/CHILD_SAFETY_POLICY_DRAFT.md)을 검토해 담당자·연락처·공개 URL을 확정한다. 앱 안 신고, 콘텐츠 대응·삭제·관련 기관 신고 절차를 검증한 뒤 Play Console에 선언한다. 성인 대상 소셜·데이팅 앱에도 해당한다. [Google Child Safety Standards](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en)
- [ ] **회원 탈퇴:** 앱 안에서 계정 삭제를 시작할 수 있고 연관 데이터·사진 삭제도 실제 처리되는지 확인한다. Google에는 앱 외부에서 삭제를 요청할 수 있는 웹 URL도 제공한다. 예외 보관의 사유·기간을 명확히 하고, 팀 삭제 후 사진 보관 규칙을 회원 탈퇴에 자동 적용하지 않는다. [Apple 계정 삭제](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Google 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [ ] **사진 권한:** 학생증·프로필 사진 선택에는 시스템 선택기를 우선한다. 전체 사진함 접근이 핵심 기능에 필요하지 않다면 Android의 광범위한 사진·동영상 권한을 요청하지 않는다. [Google 최소 권한 안내](https://support.google.com/googleplay/android-developer/answer/16935362?hl=en)
- [ ] **개인정보·SDK 신고:** [데이터 보안 검토표](android-closed-test/DATA_SAFETY_WORKSHEET.md)에 따라 실제 수집·공유·보관·삭제 동작을 Apple 개인정보 및 Google Data safety 신고와 맞춘다. 기기 내 생년월일 계산과 서버에 저장되는 사진·광고 활동·차단 기록을 구분한다. 광고·분석 SDK를 추가할 때도 다시 점검한다.
- [ ] **심사 접근:** 정상 동작하는 별도 심사용 계정과 기능별 안내를 준비한다. 실제 학생증 제출·관리자 수동 승인 대기 없이 심사자가 필요한 기능을 확인할 수 있게 구성하되, 운영 관리자 계정이나 실제 회원 개인정보를 제공하지 않는다. 필요한 역할은 별도 테스트 권한·데이터로 검증한다. [Apple 심사 자료](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)

## 향후 기능을 추가할 때 적용할 조건

현재 main 코드 감사에서는 대화에서 언급했던 Pro 결제와 GPT 분석 기능을 확인하지 못했다. 아래 항목은 현재 구현되었다고 간주하거나 출시 장애로 확정하는 것이 아니라, 실제 추가·활성화할 때 적용하는 조건이다.

- **Pro·사진 무제한 이용권:** 앱의 디지털 기능 결제에는 기본적으로 StoreKit/Google Play Billing을 사용한다. 한국 대체결제는 별도 프로그램·권한·API 등 조건이 있어 계좌번호만 표시하는 방식으로 충족되지 않는다. [Google 결제 정책](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en), [Google 한국 대체결제](https://support.google.com/googleplay/android-developer/answer/11222040?hl=en), [Apple 한국 대체결제](https://developer.apple.com/kr/support/storekit-external-entitlement-kr)
- **웹 구매 권한 공유:** Apple의 멀티플랫폼 규정은 웹에서 구매한 기능을 앱에서 쓸 때 해당 항목의 앱 내 구입 제공 조건을 둔다. 구매 버튼만 숨기면 해결된다고 가정하지 않는다. 실제 상품·지역·정책에 맞게 설계한다. [Apple 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods)
- **GPT 소개글 분석:** 개인 데이터를 제3자 AI로 전송한다면 대상·목적을 고지하고 명시적 동의를 받은 뒤 전송하도록 검증한다. [Apple 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)

## 다음 진행 순서

1. 기존 의존성 감사 미해결 사항을 해결한다. 운영 접근을 복구한 뒤 승인된 안전 기능 migration을 적용하고 서버 기능·기존 서비스 회귀를 검증한다.
2. 실제 Android에서 별도 테스트 계정으로 가입·인증 사진·팀·매칭·신고·차단·탈퇴·뒤로가기·업데이트를 확인한다. 실제 운영 데이터를 사용하는 후보임을 고려해 다른 회원에게 테스트 신청을 보내지 않는다.
3. 삭제 처리·공개 정책·지원 연락처·심사 접근을 확정하고 스토어 자료·최종 식별자·키 백업을 확인한다. 변경한 코드가 있으면 새 후보를 빌드하고 보고서를 갱신한다.
4. [비공개 테스트 실행 안내](android-closed-test/RUNBOOK.md)에 따라 Console을 작성하고, 검토 가능한 최종 자료로 업로드를 진행한다. 실제 참여 링크와 기간을 확인한 뒤 [테스터 안내](android-closed-test/TESTER_GUIDE.md)를 사용한다.
5. 실제 테스트 피드백을 반영하고 조건 충족 후 프로덕션 접근을 신청한다. Apple은 개발자 계정 준비 후 별도로 TestFlight·iPhone 검증을 진행한다. 웹과 앱은 공통 백엔드의 구버전 호환성을 유지하며 각각 배포·검증한다.

스토어 문구·이미지 준비 목록은 [등록정보 초안](android-closed-test/STORE_LISTING_DRAFT.md)에 정리했다. 초안 문서 작성, 후보 빌드 생성, Play 제출·공개는 서로 다른 완료 단계다.
