/**
 * 환경변수를 안전하게 로드합니다.
 * - .env.local이 없거나 키가 비어있으면 즉시 에러를 던져서
 *   잘못된 상태로 서비스가 떠 있는 것을 방지합니다.
 * - service_role 키는 절대로 클라이언트에 들어오면 안 됩니다.
 *   (anon key 만 VITE_ 로 노출)
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // 빌드/개발 모두에서 빠르게 실패하도록 메시지 노출
  const msg =
    '[설정 오류 / Configuration error] 환경변수가 설정되지 않았습니다. (Environment variables are missing.)\n' +
    '프로젝트 루트에 .env.local 파일을 만들고 아래 두 값을 채워주세요.\n' +
    '(Create .env.local in the project root with the two values below.)\n\n' +
    'VITE_SUPABASE_URL=...\n' +
    'VITE_SUPABASE_ANON_KEY=...\n\n' +
    '주의: service_role key는 절대로 .env.local 또는 코드에 넣지 마세요.';
  // 화면에도 표시되도록 throw
  throw new Error(msg);
}

// service role 키 패턴이 노출되지 않도록 간단 검증
if (anon.includes('service_role')) {
  throw new Error('[보안 / Security] service_role key가 클라이언트에 사용되었습니다. 즉시 anon key로 교체하세요. (A service_role key was used in the client. Replace it with the anon key immediately.)');
}

export const env = {
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: anon,
} as const;
