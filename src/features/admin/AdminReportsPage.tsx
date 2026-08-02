import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, MessageSquareWarning, ShieldOff, X } from 'lucide-react';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import {
  SCHOOL_BADGE_COLOR,
  labelContact,
  labelReportCategory,
  labelReportStatus,
} from '@/lib/constants';
import type { ReportStatus, ReportWithPeople, School } from '@/types/database.types';
import { formatDateTime } from '@/utils/format';
import { koMessage } from '@/utils/errors';
import { listReportsAdmin, setReportStatus } from '@/features/reports/reports.api';
import { copyToClipboard } from './notifications.api';
import { setUserStatus } from './admin.api';

type Filter = 'all' | ReportStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: '접수' },
  { key: 'reviewing', label: '확인 중' },
  { key: 'resolved', label: '처리 완료' },
  { key: 'dismissed', label: '반려' },
  { key: 'all', label: '전체' },
];

const tone = (s: string) =>
  s === 'resolved' ? 'green' : s === 'dismissed' ? 'gray' : s === 'reviewing' ? 'sky' : 'amber';

export default function AdminReportsPage() {
  const [rows, setRows] = useState<ReportWithPeople[] | null>(null);
  const [filter, setFilter] = useState<Filter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setRows(null);
    setRows(await listReportsAdmin(filter));
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, status: ReportStatus) => {
    setBusyId(id);
    try {
      await setReportStatus(id, status, memos[id]);
      await load();
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const suspend = async (r: ReportWithPeople) => {
    if (!r.target?.id) return;
    if (!confirm(`${r.target.name} 회원의 이용을 정지할까요?\n정지되면 로그인해도 서비스를 이용할 수 없습니다.`)) return;
    setBusyId(r.id);
    try {
      await setUserStatus(r.target.id, 'inactive');
      await setReportStatus(r.id, 'resolved', memos[r.id] ?? '신고 대상 계정 이용 정지 처리');
      await load();
      alert('해당 회원을 정지 처리했습니다.');
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-zinc-900">
        <MessageSquareWarning size={22} strokeWidth={1.8} className="text-rose-500" />
        신고
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        앱에서 접수된 신고입니다. 처리 결과는 알림 화면의 문구로 신고자에게 전달하세요.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm ring-1 transition ${
              filter === f.key
                ? 'bg-sakura-500 text-white ring-sakura-500'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!rows ? (
        <Loading label="신고를 불러오고 있어요" />
      ) : rows.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center justify-center py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold text-zinc-700">해당 조건의 신고가 없습니다</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="pink">{labelReportCategory(r.category)}</Badge>
                  <Badge tone={tone(r.status)}>{labelReportStatus(r.status)}</Badge>
                </div>
                <span className="text-[11px] text-zinc-400">{formatDateTime(r.created_at)}</span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-zinc-50/70 px-4 py-3 ring-1 ring-zinc-100">
                  <p className="text-[11px] font-medium text-zinc-400">신고한 회원</p>
                  {r.reporter ? (
                    <>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                        {r.reporter.name}
                        <span className="ml-1.5 font-mono text-xs font-normal text-zinc-400">
                          @{r.reporter.username}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ring-1 ${SCHOOL_BADGE_COLOR[r.reporter.school as School]}`}>
                          {r.reporter.school}
                        </span>
                        {labelContact(r.reporter.contact_type)} · {r.reporter.contact_id}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">(탈퇴)</p>
                  )}
                </div>

                <div className="rounded-2xl bg-rose-50/70 px-4 py-3 ring-1 ring-rose-100">
                  <p className="text-[11px] font-medium text-rose-400">신고 대상</p>
                  {r.target ? (
                    <>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                        {r.target.name}
                        <span className="ml-1.5 font-mono text-xs font-normal text-zinc-400">
                          @{r.target.username}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ring-1 ${SCHOOL_BADGE_COLOR[r.target.school as School]}`}>
                          {r.target.school}
                        </span>
                        {labelContact(r.target.contact_type)} · {r.target.contact_id}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">지정되지 않음 (또는 탈퇴)</p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">신고 내용</p>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-white px-4 py-3 text-[13px] leading-relaxed text-zinc-700 ring-1 ring-zinc-200">
{r.detail}
                </pre>
              </div>

              <div className="mt-3">
                <label className="label text-xs">처리 메모 (신고자에게 답변으로 보입니다)</label>
                <input
                  className="input py-2 text-sm"
                  placeholder="예: 상대 회원에게 경고 조치했습니다."
                  value={memos[r.id] ?? r.admin_memo ?? ''}
                  onChange={(e) => setMemos((s) => ({ ...s, [r.id]: e.target.value }))}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void update(r.id, 'reviewing')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 disabled:opacity-50"
                >
                  확인 중으로
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void update(r.id, 'resolved')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Check size={15} strokeWidth={2.4} />
                  처리 완료
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void update(r.id, 'dismissed')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  <X size={15} strokeWidth={2.2} />
                  반려
                </button>
                {r.target?.id && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void suspend(r)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
                  >
                    <ShieldOff size={15} strokeWidth={2} />
                    대상 회원 정지
                  </button>
                )}
                {r.reporter?.contact_id && (
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(r.reporter!.contact_id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 text-xs text-zinc-600 transition hover:bg-zinc-200"
                  >
                    <Copy size={13} strokeWidth={2} />
                    신고자 연락처 복사
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
