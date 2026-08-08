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
  TriangleAlert,
  UsersRound,
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
import type {
  NotificationType,
  NotificationWithTarget,
  RosterTeam,
  School,
} from '@/types/database.types';
import { tr, useI18n, type Dict } from '@/i18n';
import { formatDateTime } from '@/utils/format';
import { koMessage } from '@/utils/errors';
import {
  copyToClipboard,
  generateTempPassword,
  listNotifications,
  setNotificationHandled,
} from './notifications.api';

type TypeFilter = NotificationType | 'all';

const TYPE_FILTERS: { key: TypeFilter; label: (t: Dict) => string }[] = [
  { key: 'all', label: (t) => t.admin.filterAllTypes },
  { key: 'match_request', label: (t) => t.admin.typeMatchRequest },
  { key: 'match_accepted', label: (t) => t.admin.typeMatchAccepted },
  { key: 'password_reset', label: (t) => t.admin.typePassword },
  { key: 'report', label: (t) => t.admin.typeReport },
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

/** 매칭 성사 payload 에서 단체방 개설용 명단을 꺼냅니다. (없으면 빈 배열) */
const rosterOf = (n: NotificationWithTarget): RosterTeam[] => {
  const r = (n.payload as { roster?: unknown } | null)?.roster;
  return Array.isArray(r) ? (r as RosterTeam[]) : [];
};

/** 단체방 개설용 명단을 텍스트로 (메모장·카톡에 붙여넣기 용) */
const rosterToText = (roster: RosterTeam[]): string => {
  const d = tr();
  return roster
    .map((team) => {
      const genderLabel = team.gender === 'male' ? d.admin.maleTeam : d.admin.femaleTeam;
      const head = d.admin.rosterTextHeader(genderLabel, team.intro, team.owner_name, team.owner_username);
      const rows = (team.members ?? [])
        .map((m) => `- ${m.nickname} (${d.schools.short[m.school] ?? m.school} ${m.department}) · ${labelContact(m.contact_type)}: ${m.contact_id}`)
        .join('\n');
      return `${head}\n${rows}`;
    })
    .join('\n\n');
};

/** 매칭 성사 알림 전용: 양 팀 명단 + 연락처 (관리자만 보는 화면) */
function RosterPanel({
  roster,
  onCopyAll,
  copiedAll,
}: {
  roster: RosterTeam[];
  onCopyAll: () => void;
  copiedAll: boolean;
}) {
  const { t } = useI18n();
  if (roster.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl bg-emerald-50/60 px-4 py-3 ring-1 ring-emerald-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
          <UsersRound size={14} strokeWidth={2} />
          {t.admin.rosterTitle}
        </p>
        <button
          type="button"
          onClick={onCopyAll}
          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
        >
          {copiedAll ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2} />}
          {copiedAll ? t.common.copied : t.admin.rosterCopyAll}
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {roster.map((team) => (
          <div key={team.team_id} className="rounded-xl bg-white p-3 ring-1 ring-zinc-100">
            <p className="text-xs font-bold text-zinc-800">
              <span className={team.gender === 'male' ? 'text-blue-600' : 'text-sakura-600'}>
                {team.gender === 'male' ? t.admin.maleTeam : t.admin.femaleTeam}
              </span>
              <span className="ml-1.5 font-medium text-zinc-500">"{team.intro}"</span>
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {t.admin.rosterOwner(team.owner_name, team.owner_username)}
            </p>
            <ul className="mt-2 space-y-1.5">
              {(team.members ?? []).map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-zinc-700">
                    {m.nickname}
                    <span className="ml-1 text-[11px] text-zinc-400">{t.schools.short[m.school] ?? m.school}</span>
                  </span>
                  {m.contact_type === 'instagram' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-200">
                      <TriangleAlert size={11} strokeWidth={2} />
                      {t.admin.legacyInstagram}
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                      {labelContact(m.contact_type)} {m.contact_id}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-emerald-700/80">
        {t.admin.rosterFooter}
      </p>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unhandledOnly, setUnhandledOnly] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedRosterId, setCopiedRosterId] = useState<string | null>(null);
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
      alert(t.admin.copyFailed);
      return;
    }
    setCopiedId(n.id);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 1800);
  };

  const onCopyRoster = async (n: NotificationWithTarget) => {
    const ok = await copyToClipboard(rosterToText(rosterOf(n)));
    if (!ok) {
      alert(t.admin.rosterCopyFailed);
      return;
    }
    setCopiedRosterId(n.id);
    window.setTimeout(() => setCopiedRosterId((cur) => (cur === n.id ? null : cur)), 1800);
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
            {t.admin.notifTitle}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.admin.notifSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[11px] text-zinc-400">
              {t.admin.asOf(formatDateTime(lastSync.toISOString()))}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-200"
          >
            <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
            {t.common.refresh}
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
          {t.admin.filterUnhandled} {unhandledOnly && unhandledCount > 0 ? `(${unhandledCount})` : ''}
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
          {t.common.all}
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
            {f.label(t)}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center justify-center py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold text-zinc-700">
            {unhandledOnly ? t.admin.notifEmptyUnhandled : t.admin.notifEmptyAll}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {t.admin.notifEmptyDesc}
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
                      <Badge tone="gray">{t.admin.handledBadge}</Badge>
                    ) : (
                      <Badge tone="amber">{t.admin.unhandledBadge}</Badge>
                    )}
                    {target?.school && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${
                          SCHOOL_BADGE_COLOR[target.school as School]
                        }`}
                      >
                        {t.schools.short[target.school] ?? target.school}
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
                          {t.admin.copyId}
                        </button>
                        {instagramUrl && (
                          <a
                            href={instagramUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                          >
                            <ExternalLink size={12} strokeWidth={2} />
                            {t.admin.instagramLink}
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">{t.admin.targetMissing}</p>
                  )}
                </div>

                {/* 매칭 성사: 단체방 개설용 양 팀 명단 + 연락처 */}
                {n.type === 'match_accepted' && (
                  <RosterPanel
                    roster={rosterOf(n)}
                    onCopyAll={() => void onCopyRoster(n)}
                    copiedAll={copiedRosterId === n.id}
                  />
                )}

                {/* 비밀번호 재설정: 임시 비밀번호 입력 */}
                {n.type === 'password_reset' && (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                    <p className="text-xs font-semibold text-amber-800">
                      {t.admin.pwBoxNote}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="input flex-1 py-2 font-mono text-sm"
                        placeholder={t.admin.tempPasswordPlaceholder}
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
                        {t.admin.generate}
                      </button>
                    </div>
                  </div>
                )}

                {/* 발송 문구 */}
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-zinc-500">{t.admin.messageLabel}</p>
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
                      <><Check size={15} strokeWidth={2.4} /> {t.common.copied}</>
                    ) : (
                      <><Copy size={15} strokeWidth={2} /> {t.admin.copyMessage}</>
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
                      <><RotateCcw size={15} strokeWidth={2} /> {t.admin.markUnhandled}</>
                    ) : (
                      <><Check size={15} strokeWidth={2.4} /> {t.admin.markHandled}</>
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
