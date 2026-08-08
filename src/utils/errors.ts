import { tr } from '@/i18n';

/**
 * Supabase / DB 오류를 현재 선택된 언어의 문구로 바꿉니다.
 * (이름은 4.0 시절 그대로 koMessage 이지만, 지금은 4개 언어를 모두 처리합니다)
 *
 * 서버(RPC·트리거)가 한국어로 raise 하는 메시지도
 * errors.serverMap 을 거쳐 현재 언어로 번역됩니다.
 */
export const koMessage = (e: unknown): string => {
  const t = tr().errors;
  if (!e) return t.unknown;
  const msg = (e as { message?: string }).message ?? String(e);

  // 서버가 한국어로 던지는 메시지 (RPC raise exception) → 현재 언어로
  const mapped = t.serverMap[msg.trim()];
  if (mapped) return mapped;

  if (/duplicate key/i.test(msg)) return t.duplicate;

  // RLS 차단은 테이블마다 원인이 다르므로 구체적으로 안내합니다.
  if (/violates row-level security/i.test(msg)) {
    if (/"teams"/.test(msg)) return t.rlsTeams;
    if (/"match_requests"/.test(msg)) return t.rlsMatchRequests;
    if (/"team_members"/.test(msg)) return t.rlsTeamMembers;
    if (/"reports"/.test(msg)) return t.rlsReports;
    if (/"notifications"/.test(msg)) return t.rlsNotifications;
    return t.rlsDefault;
  }

  if (/check constraint .*student_number/i.test(msg)) return t.checkStudentNumber;
  if (/check constraint .*phone_format/i.test(msg)) return t.checkPhone;
  if (/check constraint .*contact_type/i.test(msg)) return t.checkContactType;
  if (/check constraint .*school/i.test(msg)) return t.checkSchool;
  if (/check constraint .*team_size|check constraint .*member_order/i.test(msg)) return t.checkTeamSize;

  if (/Email not confirmed/i.test(msg)) return t.emailNotConfirmed;
  if (/Invalid login credentials/i.test(msg)) return t.invalidCredentials;
  if (/User already registered/i.test(msg)) return t.alreadyRegistered;
  if (/rate limit|too many requests/i.test(msg)) return t.rateLimited;
  if (/JWT expired|session.*expired/i.test(msg)) return t.sessionExpired;
  if (/Failed to fetch|NetworkError/i.test(msg)) return t.network;

  return msg;
};
