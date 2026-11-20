# 춘천과팅 웹 카카오 로그인
카카오 Developers에서 춘천과팅 앱의 카카오 로그인을 활성화하고 REST API 키의 로그인 Redirect URI에 다음 주소를 등록한다.

    https://slddnhyvstfvobxxcazt.supabase.co/auth/v1/callback

Supabase Authentication → Sign In / Providers → Kakao에 REST API 키와 Client Secret을 저장한다. 카카오 이메일을 요청하지 않는 구성이면 Allow users without an email을 활성화한다. URL Configuration의 Redirect URLs에 다음 주소를 추가한다.

    https://chuncheon-dating5-0.vercel.app/auth/kakao

웹 빌드 환경에서 VITE_KAKAO_LOGIN_ENABLED=true를 설정하여 배포한다. 키와 시크릿은 Supabase에만 입력한다. 신규 카카오 계정의 학생증·약관·프로필 완료, 같은 계정 재로그인, 동의 취소, 기존 아이디 로그인 순서로 확인한다. 기존 아이디 회원이 처음 카카오로 가입하면 별도 계정이 될 수 있다. 이 변경은 웹/PWA용이다.

[Supabase 카카오 설정](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
