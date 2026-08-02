import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  Copy,
  ExternalLink,
  Handshake,
  Heart,
  KeyRound,
  MessageSquareWarning,
  RefreshCw,
  RotateCcw,
  Shuffle,
} from 'lucide-react';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import {
  NOTIFICATION_POLL_MS,
  SCHOOL_BADGE_COLOR,
  TEMP_PASSWORD_PLACEHOLDER,
  labelContact,
  labelNotificationType,
} from '@/lib/constants';
import type { NotificationType, NotificationWithTarget, School } from '@/types/database.types';
import { formatDateTime } from '@/utils/format';
import { koMessage } from '@/utils/errors';
import {
  copyToClipboard,
  generateTempPassword,
  listNotifications,
  setNotificationHandled,
} from './notifications.api';

type TypeFilter = NotificationType | 'all';

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: '유형 전체' },
  { key: 'match_request', label: '매칭 신청' },
  { key: 'match_accepted', label: '매칭 성사' },
  { key: 'password_reset', label: '비밀번호' },
  { key: 'report', label: '신고' },
];

function TypeIcon({ type }: { type: NotificationType }) {
  const common = { size: 16, strokeWidth: 2 } as const;
  if (type === 'match_request') return <Heart {...common} />;
  if (type === 'match_accepted') return <Handshake {...common} />;
  if (type === 'report') return <MessageSquareWarning {...common} />;
  return <KeyRound {...common} />;
}

const typeTone = (t: NotificationType) =>
  t === 'match_request' ? 'pink'
  : t === 'match_accepted' ? 'green'
  : t === 'report' ? 'gray'
  : 'amber';

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<NotificationWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unhandledOnly, setUnhandledOnly] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const copyTimer = useRef<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const rows = await listNotifications({ unhandledOnly, type: typeFilter });
        setItems(rows);
        setLastSync(new Date());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [unhandledOnly, typeFilter]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // 30초마다 자동 갱신
  useEffect(() => {
    const id = window.setInterval(() => void load(true), NOTIFICATION_POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  const unhandledCount = useMemo(() => items.filter((n) => !n.is_handled).length, [items]);

  const buildMessage = (n: NotificationWithTarget) => {
    const temp = tempPasswords[n.id];
    if (n.type === 'password_reset') {
      return n.message.replace(
        TEMP_PASSWORD_PLACEHOLDER,
        temp && temp.trim() ? temp.trim() : TEMP_PASSWORD_PLACEHOLDER
      );
    }
    return n.message;
  };

  const onCopy = async (n: NotificationWithTarget) => {
    const ok = await copyToClipboard(buildMessage(n));
    if (!ok) {
      alert('복사에 실패했어요. 문구를 길게 눌러 직접 복사해주세요.');
      return;
    }
    setCopiedId(n.id);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 1800);
  };

  const onToggleHandled = async (n: NotificationWithTarget) => {
    setBusyId(n.id);
    try {
      await setNotificationHandled(n.id, !n.is_handled);
      if (unhandledOnly && !n.is_handled) {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
      } else {
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_handled: !n.is_handled } : x))
        );
      }
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-zinc-900">
            <BellRing size={22} strokeWidth={1.8} className="text-sakura-500" />
            알림
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            신청과 수락이 발생하면 자동으로 쌓입니다. 문구를 복사해 카카오톡으로 직접 보내주세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[11px] text-zinc-400">
              {formatDateTime(lastSync.toISOString())} 기준
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-200"
          >
            <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setUnhandledOnly(true)}
          className={`rounded-full px-4 py-1.5 text-sm ring-1 transition ${
            unhandledOnly
              ? 'bg-sakura-500 text-white ring-sakura-500'
              : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
          }`}
        >
          미처리 {unhandledOnly && unhandledCount > 0 ? `(${unhandledCount})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setUnhandledOnly(false)}
          className={`rounded-full px-4 py-1.5 text-sm ring-1 transition ${
            !unhandledOnly
              ? 'bg-sakura-500 text-white ring-sakura-500'
              : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
          }`}
        >
          전체
        </button>

        <span className="mx-1 h-4 w-px bg-zinc-200" />

        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTypeFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm ring-1 transition ${
              typeFilter === f.key
                ? 'bg-zinc-800 text-white ring-zinc-800'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading label="알림을 불러오고 있어요" />
      ) : items.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center justify-center py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold text-zinc-700">
            {unhandledOnly ? '미처리 알림이 없습니다' : '알림이 없습니다'}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            새 신청이나 수락이 생기면 30초 안에 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((n) => {
            const target = n.target;
            const instagramUrl =
              target?.contact_type === 'instagram' && target.contact_id
                ? `https://instagram.com/${target.contact_id.replace(/^@/, '')}`
                : null;

            return (
              <article
                key={n.id}
                className={`card p-5 ${n.is_handled ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={typeTone(n.type)} className="gap-1">
                      <TypeIcon type={n.type} />
                      {labelNotificationType(n.type)}
                    </Badge>
                    {n.is_handled ? (
                      <Badge tone="gray">처리 완료</Badge>
                    ) : (
                      <Badge tone="amber">미처리</Badge>
                    )}
                    {target?.school && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${
                          SCHOOL_BADGE_COLOR[target.school as School]
                        }`}
                      >
                        {target.school}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400">{formatDateTime(n.created_at)}</span>
                </div>

                {/* 받는 사람 */}
                <div className="mt-3 rounded-2xl bg-zinc-50/70 px-4 py-3 ring-1 ring-zinc-100">
                  {target ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {target.name}
                          <span className="ml-1.5 font-mono text-xs font-normal text-zinc-400">
                            @{target.username}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {labelContact(target.contact_type)} · {target.contact_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(target.contact_id)}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                        >
                          <Copy size={12} strokeWidth={2} />
                          ID 복사
                        </button>
                        {instagramUrl && (
                          <a
                            href={instagramUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                          >
                            <ExternalLink size={12} strokeWidth={2} />
                            인스타
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">대상 회원 정보를 찾을 수 없습니다. (탈퇴했을 수 있습니다)</p>
                  )}
                </div>

                {/* 비밀번호 재설정: 임시 비밀번호 입력 */}
                {n.type === 'password_reset' && (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                    <p className="text-xs font-semibold text-amber-800">
                      Supabase 대시보드 &gt; Authentication &gt; Users 에서 비밀번호를 바꾼 뒤,
                      아래에 같은 값을 넣으면 문구에 자동으로 들어갑니다.
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="input flex-1 py-2 font-mono text-sm"
                        placeholder="임시 비밀번호"
                        value={tempPasswords[n.id] ?? ''}
                        onChange={(e) =>
                          setTempPasswords((s) => ({ ...s, [n.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTempPasswords((s) => ({ ...s, [n.id]: generateTempPassword() }))
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                      >
                        <Shuffle size={13} strokeWidth={2} />
                        생성
                      </button>
                    </div>
                  </div>
                )}

                {/* 발송 문구 */}
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">카카오톡 발송 문구</p>
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-white px-4 py-3 text-[13px] leading-relaxed text-zinc-700 ring-1 ring-zinc-200">
{buildMessage(n)}
                  </pre>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onCopy(n)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-sakura-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-sakura-600"
                  >
                    {copiedId === n.id ? (
                      <><Check size={15} strokeWidth={2.4} /> 복사됨</>
                    ) : (
                      <><Copy size={15} strokeWidth={2} /> 문구 복사</>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => void onToggleHandled(n)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold ring-1 transition disabled:opacity-50 ${
                      n.is_handled
                        ? 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {n.is_handled ? (
                      <><RotateCcw size={15} strokeWidth={2} /> 미처리로</>
                    ) : (
                      <><Check size={15} strokeWidth={2.4} /> 처리 완료</>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
