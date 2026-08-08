import { useEffect, useState } from 'react';
import AdminTable from '@/components/admin/AdminTable';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import Stars from '@/components/common/Stars';
import { deleteReviewAdmin, listAllReviews, setReviewStatus } from './admin.api';
import type { Review } from '@/types/database.types';
import { formatDate } from '@/utils/format';
import { koMessage } from '@/utils/errors';
import { labelReviewStatus, schoolLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';

export default function AdminReviewsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Review[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = () => listAllReviews().then(setRows).catch((e) => alert(koMessage(e)));
  useEffect(() => { void load(); }, []);

  if (!rows) return <Loading />;

  const visible = rows.filter((r) => filter === 'all' ? true : r.status === filter);

  const setStatus = async (r: Review, s: 'approved' | 'rejected' | 'pending') => {
    try { await setReviewStatus(r.id, s); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  const onDelete = async (r: Review) => {
    if (!confirm(t.admin.reviewDeleteConfirm)) return;
    try { await deleteReviewAdmin(r.id); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">{t.admin.reviewsTitle}</h1>

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
      </div>

      <AdminTable headers={t.admin.reviewsHeaders}>
        {visible.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3 font-medium">{r.nickname}</td>
            <td className="px-4 py-3">{schoolLabel(r.school)}</td>
            <td className="px-4 py-3"><Stars rating={r.rating} size={12} /></td>
            <td className="px-4 py-3 max-w-xs"><p className="line-clamp-2 text-zinc-700">{r.content}</p></td>
            <td className="px-4 py-3"><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'gray' : 'amber'}>{labelReviewStatus(r.status)}</Badge></td>
            <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(r.created_at)}</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1">
                {r.status !== 'approved' && <button onClick={() => setStatus(r, 'approved')} className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100">{t.admin.approve}</button>}
                {r.status !== 'rejected' && <button onClick={() => setStatus(r, 'rejected')} className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">{t.admin.rejectBtn}</button>}
                <button onClick={() => onDelete(r)} className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100">{t.common.delete}</button>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      {visible.length === 0 && <p className="mt-10 text-center text-sm text-zinc-400">{t.admin.reviewsEmpty}</p>}
    </div>
  );
}
