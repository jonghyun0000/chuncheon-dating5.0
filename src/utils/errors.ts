export const koMessage = (e: unknown): string => {
  if (!e) return '알 수 없는 오류가 발생했습니다.';
  const msg = (e as { message?: string }).message ?? String(e);

  // Supabase가 반환하는 영문 메시지 일부 한글화
  if (/duplicate key/i.test(msg)) return '이미 존재하는 값입니다.';

  // RLS 차단은 테이블마다 원인이 다르므로 구체적으로 안내합니다.
  // (그냥 "권한 없음"으로 보여주면 사용자가 이유를 알 수 없습니다)
  if (/violates row-level security/i.test(msg)) {
    if (/"teams"/.test(msg)) {
      return (
        '팀을 등록할 수 없습니다.\n' +
        '아래 중 하나에 해당하는지 확인해주세요.\n' +
        '· 학생증 인증이 아직 승인되지 않음\n' +
        '· 이미 진행 중인 팀이 있음 (과팅 종료 후 새로 등록)\n' +
        '· 계정이 이용 제한 상태'
      );
    }
    if (/"match_requests"/.test(msg)) {
      return (
        '이 팀에는 신청할 수 없습니다.\n' +
        '아래 중 하나에 해당하는지 확인해주세요.\n' +
        '· 학생증 인증이 아직 승인되지 않음\n' +
        '· 상대 팀이 이미 매칭되었거나 인증 대기 중\n' +
        '· 팀 인원 차이가 1명을 넘음'
      );
    }
    if (/"team_members"/.test(msg)) return '팀원 정보를 저장할 권한이 없습니다. 내 팀인지 확인해주세요.';
    if (/"reports"/.test(msg)) return '신고를 접수할 수 없습니다. 본인을 신고하거나, 계정이 제한된 상태일 수 있습니다.';
    if (/"notifications"/.test(msg)) return '관리자만 사용할 수 있는 기능입니다.';
    return '권한이 없는 요청입니다.';
  }

  if (/check constraint .*student_number/i.test(msg))
    return '학번은 숫자 6~12자리로 입력해주세요. (예: 20233105)';
  if (/check constraint .*school/i.test(msg))
    return '지원하지 않는 학교입니다. 강원대·한림대·성심대·춘교대 중에서 선택해주세요.';
  if (/check constraint .*team_size|check constraint .*member_order/i.test(msg))
    return '팀 인원은 1명에서 4명까지 가능합니다.';

  if (/Email not confirmed/i.test(msg)) return '이메일 인증이 필요합니다.';
  if (/Invalid login credentials/i.test(msg)) return '아이디 또는 비밀번호가 올바르지 않습니다.';
  if (/User already registered/i.test(msg)) return '이미 가입된 사용자입니다.';
  if (/rate limit|too many requests/i.test(msg))
    return '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.';
  if (/JWT expired|session.*expired/i.test(msg))
    return '로그인 정보가 만료되었습니다. 다시 로그인해주세요.';
  if (/Failed to fetch|NetworkError/i.test(msg))
    return '네트워크가 불안정합니다. 잠시 후 다시 시도해주세요.';

  return msg;
};
