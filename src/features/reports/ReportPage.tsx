import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Phone, ShieldAlert } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { REPORT_CATEGORIES, labelReportCategory, labelReportStatus } from '@/lib/constants';
import type { Report, ReportCategory } from '@/types/database.types';
import { createReport, fetchMyReports } from './reports.api';
import { formatDateTime } from '@/utils/format';
import { koMessage } from '@/utils/errors';

export default function ReportPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const targetUserId = params.get('user');
  const targetTeamId = params.get('team');

  const [category, setCategory] = useState<ReportCategory>('inappropriate');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState<Report[]>([]);

  const load = async () => setMine(await fetchMyReports());
  useEffect(() => { void load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSending(true);
    try {
      await createReport({
        category,
        detail,
        target_user_id: targetUserId,
        target_team_id: targetTeamId,
      });
      setDone(true);
      setDetail('');
      await load();
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSending(false);
    }
  };

  const tone = (s: string) =>
    s === 'resolved' ? 'green' : s === 'dismissed' ? 'gray' : s === 'reviewing' ? 'sky' : 'amber';

  return (
    <PageLayout subtitle="신고하기" hideNav>
      <button
        type="button"
        onClick={() => nav(-1)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        뒤로
      </button>

      {/* 위급 상황 안내 */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 px-4 py-3.5 ring-1 ring-rose-100">
        <Phone size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />
        <p className="text-xs leading-relaxed text-rose-700">
          지금 위험하거나 범죄 피해가 의심되는 상황이라면 <strong>먼저 112에 신고</strong>해주세요.
          이 화면은 서비스 내 조치(이용 제한 등)를 위한 접수 창구입니다.
        </p>
      </div>

      {done && (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3.5 ring-1 ring-emerald-100">
          <CircleCheck size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-800">
            신고가 접수되었습니다. 관리자가 확인 후 가입하신 연락수단으로 결과를 알려드립니다.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="card mt-4 space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-900">무슨 일이 있었나요?</h2>
            <p className="text-xs text-zinc-500">접수 내용은 관리자만 볼 수 있습니다.</p>
          </div>
        </div>

        <div>
          <label className="label">신고 유형</label>
          <div className="space-y-1.5">
            {REPORT_CATEGORIES.map((c) => (
              <label
                key={c.key}
                className={`flex cursor-pointer items-start gap-2.5 rounded-2xl px-4 py-3 ring-1 transition ${
                  category === c.key
                    ? 'bg-sakura-50 ring-sakura-200'
                    : 'bg-white ring-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  className="mt-0.5 h-4 w-4 accent-sakura-500"
                  checked={category === c.key}
                  onChange={() => setCategory(c.key)}
                />
                <span>
                  <span className={`block text-sm font-medium ${category === c.key ? 'text-sakura-700' : 'text-zinc-800'}`}>
                    {c.label}
                  </span>
                  <span className="block text-[11px] leading-relaxed text-zinc-400">{c.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">상세 내용</label>
          <textarea
            className="input min-h-[140px] resize-none"
            maxLength={1000}
            placeholder={
              '언제, 어디서, 어떤 일이 있었는지 적어주세요.\n' +
              '상대 닉네임이나 팀 소개글을 함께 적어주시면 확인이 빠릅니다.'
            }
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-400">{detail.length} / 1000자</p>
        </div>

        {err && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
        )}

        <Button type="submit" loading={sending} className="w-full">신고 접수하기</Button>

        <p className="text-xs leading-relaxed text-zinc-400">
          허위 신고나 악의적인 반복 신고는 신고하신 분의 이용이 제한될 수 있습니다.
        </p>
      </form>

      {mine.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-500">내가 접수한 신고</h3>
          <div className="space-y-2">
            {mine.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge tone="gray">{labelReportCategory(r.category)}</Badge>
                    <Badge tone={tone(r.status)}>{labelReportStatus(r.status)}</Badge>
                  </div>
                  <span className="text-[11px] text-zinc-400">{formatDateTime(r.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{r.detail}</p>
                {r.admin_memo && (
                  <p className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
                    관리자 답변: {r.admin_memo}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </PageLayout>
  );
}
