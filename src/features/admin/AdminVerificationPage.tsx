import { useEffect, useMemo, useState } from 'react';
import Loading from '@/components/common/Loading';
import LoadError from '@/components/common/LoadError';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { Check, Expand, ExternalLink, Maximize2, Search, X } from 'lucide-react';
import { approveVerification, getStudentSignedUrl, listVerificationQueue, rejectVerification } from './admin.api';
import type { Profile } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';
import { labelVerificationStatus, schoolLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';

export default function AdminVerificationPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  /** 이름 · 학번 · 아이디 검색어 */
  const [q, setQ] = useState('');
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  /** 학생증 사진 보기 방식 — 기본은 잘리지 않는 [전체 보기] */
  const [fill, setFill] = useState(false);

  const [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoadError(false);
    try {
      const list = await listVerificationQueue();
      setRows(list);
      // signed URL 일괄 발급
      const u: Record<string, string | null> = {};
      await Promise.all(list.map(async (p) => {
        u[p.id] = await getStudentSignedUrl(p.student_id_image_path);
      }));
      setUrls(u);
    } catch { setLoadError(true); }
  };

  useEffect(() => { void load(); }, []);

  /**
   * 상태 필터와 검색어를 함께 적용합니다.
   * 검색은 이름 · 학번 · 아이디를 대소문자 구분 없이 부분 일치로 찾습니다.
   * (Hook 이므로 아래 조기 반환보다 위에 있어야 합니다.)
   */
  const visible = useMemo(() => {
    const list = rows ?? [];
    const needle = q.trim().toLowerCase();

    return list.filter((p) => {
      if (filter !== 'all' && p.verification_status !== filter) return false;
      if (!needle) return true;
      return (
        (p.name ?? '').toLowerCase().includes(needle) ||
        (p.student_number ?? '').toLowerCase().includes(needle) ||
        (p.username ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, q]);

  if (!rows) return loadError ? <LoadError retry={() => void load()} /> : <Loading />;

  return (
    <div>
      {loadError && <LoadError retry={() => void load()} />}
      <h1 className="font-display text-2xl font-bold text-zinc-900">{t.admin.verifyTitle}</h1>

      {/* 이름 · 학번 · 아이디 검색 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[210px] flex-1">
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.admin.verifySearchPlaceholder}
            className="w-full rounded-full bg-white py-2 pl-9 pr-9 text-sm text-zinc-700 ring-1 ring-zinc-200 outline-none transition focus:ring-2 focus:ring-sakura-200"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label={t.common.close}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-500">
          {t.admin.verifyCount(visible.length, rows.length)}
        </span>
      </div>

      <div className="mt-3 mb-5 flex gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs ring-1 ${
              filter === k ? 'bg-sakura-500 text-white ring-sakura-500' : 'bg-white text-zinc-600 ring-zinc-200'
            }`}
          >
            {k === 'pending' ? t.admin.filterPending : k === 'approved' ? t.admin.filterApproved : k === 'rejected' ? t.admin.filterRejected : t.common.all}
          </button>
        ))}

        <span className="mx-1 h-6 w-px self-center bg-zinc-200" />

        {/* 학생증 사진 보기 방식 */}
        <button
          type="button"
          onClick={() => setFill((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
        >
          {fill ? <Expand size={13} strokeWidth={2} /> : <Maximize2 size={13} strokeWidth={2} />}
          {fill ? t.admin.studentIdFit : t.admin.studentIdFill}
        </button>
      </div>

      {/* 사진이 잘리지 않도록 카드 폭을 넓히고 전체 보기를 기본으로 합니다. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((p) => (
          <div key={p.id} className="card overflow-hidden">
            <div className="relative h-72 bg-zinc-800 sm:h-80">
              {urls[p.id] ? (
                <>
                  <img
                    src={urls[p.id]!}
                    alt={t.admin.studentIdAlt}
                    className={`h-full w-full ${fill ? 'object-cover' : 'object-contain'}`}
                  />
                  <a
                    href={urls[p.id]!}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 shadow-soft backdrop-blur transition hover:bg-white"
                  >
                    <ExternalLink size={12} strokeWidth={2} />
                    {t.admin.studentIdOpen}
                  </a>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400">{t.admin.noStudentId}</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                <Badge tone={p.verification_status === 'approved' ? 'green' : p.verification_status === 'rejected' ? 'gray' : 'amber'}>
                  {labelVerificationStatus(p.verification_status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {schoolLabel(p.school)}{p.student_number ? ` · ${t.admin.studentNumberPrefix(p.student_number)}` : ''} · {t.admin.joinedPrefix(formatDate(p.created_at))}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => { try { await rejectVerification(p.id); await load(); } catch (e) { alert(koMessage(e)); } }}
                >
                  {t.admin.rejectBtn}
                </Button>
                <Button
                  className="gap-1.5"
                  onClick={async () => { try { await approveVerification(p.id); await load(); } catch (e) { alert(koMessage(e)); } }}
                >
                  <Check size={16} strokeWidth={2.4} />
                  {t.admin.approve}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-400">{t.admin.verifyEmpty}</p>
      )}
    </div>
  );
}
