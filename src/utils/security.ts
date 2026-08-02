/**
 * 보안 관련 유틸.
 * - 사용자가 입력한 텍스트를 화면에 표시할 때 React가 기본적으로 escape를 해주지만,
 *   text 길이 제한, 개행 정리, 위험한 패턴 차단 등을 추가로 처리합니다.
 */

export const sanitizeText = (s: string, max = 500) =>
  s
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // 제어문자 제거
    .slice(0, max);

    export const usernameToFakeEmail = (username: string) =>
      `${username.toLowerCase()}@chuncheongating.com`;
