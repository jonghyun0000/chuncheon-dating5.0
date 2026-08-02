import { supabase, withTimeout } from '@/lib/supabaseClient';
import type { NotificationType, NotificationWithTarget } from '@/types/database.types';

const SELECT_WITH_TARGET = `
  *,
  target:profiles!notifications_target_user_id_fkey(
    id, username, name, school, gender, contact_type, contact_id
  )
`;

export interface ListNotificationsOptions {
  /** true 면 미처리만, false 면 전체 */
  unhandledOnly?: boolean;
  type?: NotificationType | 'all';
  limit?: number;
}

export async function listNotifications(
  opts: ListNotificationsOptions = {}
): Promise<NotificationWithTarget[]> {
  const { unhandledOnly = true, type = 'all', limit = 200 } = opts;

  let query = supabase
    .from('notifications')
    .select(SELECT_WITH_TARGET)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unhandledOnly) query = query.eq('is_handled', false);
  if (type !== 'all') query = query.eq('type', type);

  const { data, error } = await withTimeout(
    query,
    8000,
    { data: [], error: null } as any,
    'listNotifications'
  );

  if (error) {
    console.warn('[admin] listNotifications error:', error.message);
    return [];
  }

  return ((data ?? []) as any[]).map((n) => ({
    ...n,
    target: Array.isArray(n.target) ? (n.target[0] ?? null) : (n.target ?? null),
  })) as NotificationWithTarget[];
}

export async function countUnhandledNotifications(): Promise<number> {
  const { data, error } = await withTimeout(
    supabase.rpc('unhandled_notification_count' as any),
    5000,
    { data: 0, error: null } as any,
    'countUnhandledNotifications'
  );
  if (error) return 0;
  return Number(data ?? 0);
}

export async function setNotificationHandled(id: string, handled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_notification_handled' as any, {
    p_id: id,
    p_handled: handled,
  } as any);
  if (error) throw error;
}

export async function saveNotificationMemo(id: string, memo: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ admin_memo: memo })
    .eq('id', id);
  if (error) throw error;
}

/** 임시 비밀번호 추천값 생성 (영문+숫자 10자, 헷갈리는 문자 제외) */
export function generateTempPassword(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);

  // 앞 7자는 영문, 뒤 3자는 숫자 → 영문/숫자 조합 8자 이상 규칙 충족
  let out = '';
  for (let i = 0; i < 7; i += 1) out += chars[buf[i] % chars.length];
  for (let i = 7; i < 10; i += 1) out += digits[buf[i] % digits.length];
  return out;
}

/** 클립보드 복사 (https 가 아닌 환경까지 대응) */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 fallback 으로 진행
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
