import { useEffect, useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import Loading from '@/components/common/Loading';
import Modal from '@/components/common/Modal';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Stars from '@/components/common/Stars';
import { PenLine, Sparkles } from 'lucide-react';
import { SCHOOL_BADGE_COLOR, SCHOOLS, schoolLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';
import { createReview, fetchApprovedReviews, fetchMyReviews } from './reviews.api';
import type { Review } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';

export default function ReviewsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Review[]>([]);
  const [mine, setMine] = useState<Review[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nickname: '',
    school: '강원대' as (typeof SCHOOLS)[number],
    rating: 5,
    content: '',
  });
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([fetchApprovedReviews(), fetchMyReviews()]);
      setList(a);
      setMine(m);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    setErr(null);
    if (form.nickname.trim().length < 2) return setErr(t.reviews.errNickname);
    if (form.content.trim().length < 10) return setErr(t.reviews.errContent);
    setSubmitting(true);
    try {
      await createReview(form);
      alert(t.reviews.submittedAlert);
      setOpen(false);
      setForm({ nickname: '', school: '강원대', rating: 5, content: '' });
      await load();
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout subtitle={t.reviews.subtitle}>
      <div className="mb-3 flex justify-end">
        <Button className="gap-1.5" onClick={() => setOpen(true)}>
          <PenLine size={16} strokeWidth={2} />
          {t.reviews.write}
        </Button>
      </div>

      {/* 내 후기 (대기/거절 포함) */}
      {mine.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-zinc-500">{t.reviews.mySection}</h3>
          <div className="space-y-2">
            {mine.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'gray' : 'amber'}>
                    {r.status === 'approved' ? t.reviews.statusApproved : r.status === 'rejected' ? t.reviews.statusRejected : t.reviews.statusPending}
                  </Badge>
                  <span className="text-xs text-zinc-400">{formatDate(r.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 승인된 후기 목록 */}
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-sakura-50 text-sakura-500">
            <Sparkles size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold text-zinc-700">{t.reviews.emptyTitle}</p>
          <p className="mt-1 text-sm text-zinc-400">{t.reviews.emptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <article key={r.id} className="card relative overflow-hidden p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`badge ring-1 ${SCHOOL_BADGE_COLOR[r.school]}`}>{schoolLabel(r.school)}</span>
                  <span className="font-semibold text-zinc-900">{r.nickname}</span>
                </div>
                <Stars rating={r.rating} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">{r.content}</p>
              <p className="mt-3 text-[11px] text-zinc-400">{formatDate(r.created_at)}</p>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t.reviews.modalTitle}>
        <div className="space-y-3">
          <Input label={t.reviews.nickname} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
          <Select label={t.reviews.school} value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value as any })}>
            {SCHOOLS.map((s) => <option key={s} value={s}>{schoolLabel(s)}</option>)}
          </Select>
          <Select label={t.reviews.rating} value={String(form.rating)} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{t.reviews.ratingOption(n)}</option>)}
          </Select>
          <div>
            <label className="label">{t.reviews.contentLabel}</label>
            <textarea
              className="input min-h-[120px] resize-none"
              maxLength={500}
              placeholder={t.reviews.contentPlaceholder}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          {err && <p className="text-sm text-rose-500">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={submit} loading={submitting}>{t.common.submit}</Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
