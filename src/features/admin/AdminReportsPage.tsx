import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, MessageSquareWarning, ShieldOff, X } from 'lucide-react';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import {
  SCHOOL_BADGE_COLOR,
  labelContact,
  labelReportCategory,
  labelReportStatus,
  schoolLabel,
} from '@/lib/constants';
import { useI18n, type Dict } from '@/i18n';
import type { ReportStatus, ReportWithPeople, School } from '@/types/database.types';
import { formatDateTime } from '@/utils/format';
import { koMessage } from '@/utils/errors';
import { listReportsAdmin, setReportStatus } from '@/features/reports/reports.api';
import { copyToClipboard } from './notifications.api';
import { setUserStatus } from './admin.api';

type Filter = 'all' | ReportStatus;

const FILTERS: { key: Filter; label: (t: Dict) => string }[] = [
  { key: 'pending', label: (t) => t.labels.reportStatus.pending },
  { key: 'reviewing', label: (t) => t.labels.reportStatus.reviewing },
  { key: 'resolved', label: (t) => t.labels.reportStatus.resolved },
  { key: 'dismissed', label: (t) => t.labels.reportStatus.dismissed },
  { key: 'all', label: (t) => t.common.all },
];

const tone = (s: string) =>
  s === 'resolved' ? 'green' : s === 'dismissed' ? 'gray' : s === 'reviewing' ? 'sky' : 'amber';

export default function AdminReportsPage() {
  const { t } = useI18n();
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
    if (!confirm(t.admin.suspendConfirm(r.target.name))) return;
    setBusyId(r.id);
    try {
      await setUserStatus(r.target.id, 'inactive');
      await setReportStatus(r.id, 'resolved', memos[r.id] ?? t.admin.suspendDefaultMemo);
      await load();
      alert(t.admin.suspendDone);
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
        {t.admin.reportsTitle}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {t.admin.reportsSubtitle}
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
            {f.label(t)}
          </button>
        ))}
      </div>

      {!rows ? (
        <Loading label={t.admin.reportsLoading} />
      ) : rows.length === 0 ? (
        <div className="card mt-5 flex flex-col items-center justify-center py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold text-zinc-700">{t.admin.reportsEmpty}</p>
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
                  <p className="text-[11px] font-medium text-zinc-400">{t.admin.reporter}</p>
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
                          {schoolLabel(r.reporter.school)}
                        </span>
                        {labelContact(r.reporter.contact_type)} · {r.reporter.contact_id}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">{t.admin.withdrawn}</p>
                  )}
                </div>

                <div className="rounded-2xl bg-rose-50/70 px-4 py-3 ring-1 ring-rose-100">
                  <p className="text-[11px] font-medium text-rose-400">{t.admin.reportTarget}</p>
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
                          {schoolLabel(r.target.school)}
                        </span>
                        {labelContact(r.target.contact_type)} · {r.target.contact_id}
                      </p>
                    </>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">{t.admin.noTarget}</p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">{t.admin.reportDetail}</p>
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-white px-4 py-3 text-[13px] leading-relaxed text-zinc-700 ring-1 ring-zinc-200">
{r.detail}
                </pre>
              </div>

              <div className="mt-3">
                <label className="label text-xs">{t.admin.memoLabel}</label>
                <input
                  className="input py-2 text-sm"
                  placeholder={t.admin.memoPlaceholder}
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
                  {t.admin.toReviewing}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void update(r.id, 'resolved')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Check size={15} strokeWidth={2.4} />
                  {t.admin.resolve}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void update(r.id, 'dismissed')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  <X size={15} strokeWidth={2.2} />
                  {t.admin.dismiss}
                </button>
                {r.target?.id && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void suspend(r)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
                  >
                    <ShieldOff size={15} strokeWidth={2} />
                    {t.admin.suspendTarget}
                  </button>
                )}
                {r.reporter?.contact_id && (
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(r.reporter!.contact_id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 text-xs text-zinc-600 transition hover:bg-zinc-200"
                  >
                    <Copy size={13} strokeWidth={2} />
                    {t.admin.copyReporterContact}
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
