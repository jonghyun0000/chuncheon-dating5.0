import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Search, UserMinus } from 'lucide-react';
import AdminTable from '@/components/admin/AdminTable';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import { approveAccountDeletion, deleteUser, listUsers, setUserStatus } from './admin.api';
import type { Profile } from '@/types/database.types';
import { formatDate } from '@/utils/format';
import {
  SCHOOLS, labelContact, labelGender, labelUserStatus, schoolLabel,
} from '@/lib/constants';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted';
type SortKey = 'newest' | 'oldest' | 'name' | 'school';

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 편의 기능 — 검색 / 학교 / 상태 / 정렬
  const [q, setQ] = useState('');
  const [school, setSchool] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [sort, setSort] = useState<SortKey>('newest');

  const load = () => listUsers().then(setRows).catch((e) => alert(koMessage(e)));
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const list = rows ?? [];
    const needle = q.trim().toLowerCase();

    const filtered = list.filter((u) => {
      if (school !== 'all' && u.school !== school) return false;
      if (status !== 'all' && u.status !== status) return false;
      if (!needle) return true;
      return (
        u.name.toLowerCase().includes(needle) ||
        u.username.toLowerCase().includes(needle) ||
        (u.contact_id ?? '').toLowerCase().includes(needle)
      );
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'ko');
      if (sort === 'school') {
        const s = a.school.localeCompare(b.school, 'ko');
        return s !== 0 ? s : a.name.localeCompare(b.name, 'ko');
      }
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      return sort === 'oldest' ? at - bt : bt - at;
    });
    return sorted;
  }, [rows, q, school, status, sort]);

  /**
   * 탈퇴 요청 상태 = 본인이 탈퇴했지만 아직 관리자가 승인하지 않은 회원.
   * 승인(purge_user_content)이 끝나면 contact_id 가 반드시 '' 로 비워지므로,
   * status='deleted' 인데 연락처가 남아 있으면 아직 처리 전입니다.
   */
  const isWithdrawalPending = (u: Profile) =>
    u.status === 'deleted' && (u.contact_id ?? '') !== '';

  if (!rows) return <Loading />;

  const run = async (uid: string, fn: () => Promise<void>, doneMsg?: string) => {
    setBusyId(uid);
    try {
      await fn();
      await load();
      if (doneMsg) alert(doneMsg);
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const onToggle = (u: Profile) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    if (!confirm(t.admin.toggleConfirm(next === 'active'))) return;
    void run(u.id, () => setUserStatus(u.id, next));
  };

  const onDelete = (u: Profile) => {
    if (!confirm(t.admin.deleteUserConfirm)) return;
    void run(u.id, () => deleteUser(u.id), t.admin.deleteUserDone);
  };

  const onApproveWithdrawal = (u: Profile) => {
    if (!confirm(t.admin.withdrawalApproveConfirm(u.name))) return;
    void run(u.id, () => approveAccountDeletion(u.id), t.admin.withdrawalApproveDone);
  };

  const resetFilters = () => {
    setQ(''); setSchool('all'); setStatus('active'); setSort('newest');
  };

  const pendingWithdrawals = rows.filter(isWithdrawalPending).length;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">{t.admin.usersTitle}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {t.admin.usersFiltered(visible.length, rows.length)}
      </p>

      {/* 탈퇴 요청 안내 */}
      {pendingWithdrawals > 0 && status !== 'deleted' && (
        <button
          type="button"
          onClick={() => setStatus('deleted')}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
          <UserMinus size={15} strokeWidth={2} />
          {t.admin.withdrawalPending} {pendingWithdrawals}
        </button>
      )}

      {/* 편의 기능: 검색 · 학교 · 상태 · 정렬 */}
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
            placeholder={t.admin.usersSearchPlaceholder}
            className="w-full rounded-full bg-white py-2 pl-9 pr-4 text-sm text-zinc-700 ring-1 ring-zinc-200 outline-none transition focus:ring-2 focus:ring-sakura-200"
          />
        </div>

        <select
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          className="rounded-full bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200 outline-none"
        >
          <option value="all">{t.admin.filterSchoolAll}</option>
          {SCHOOLS.map((s) => <option key={s} value={s}>{schoolLabel(s)}</option>)}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-full bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200 outline-none"
        >
          <option value="all">{t.admin.filterStatusAll}</option>
          <option value="active">{t.labels.userStatus.active}</option>
          <option value="inactive">{t.labels.userStatus.inactive}</option>
          <option value="deleted">{t.labels.userStatus.deleted}</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200 outline-none"
        >
          <option value="newest">{t.admin.sortNewest}</option>
          <option value="oldest">{t.admin.sortOldest}</option>
          <option value="name">{t.admin.sortName}</option>
          <option value="school">{t.admin.sortSchool}</option>
        </select>

        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-200"
        >
          <RotateCcw size={14} strokeWidth={2} />
          {t.admin.resetFilters}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-400">{t.admin.usersEmpty}</p>
      ) : (
        <div className="mt-5">
          <AdminTable headers={t.admin.usersHeaders}>
            {visible.map((u) => {
              const pending = isWithdrawalPending(u);
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className={pending ? 'bg-amber-50/50' : undefined}>
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    {u.name} <span className="text-xs text-zinc-400">@{u.username}</span>
                  </td>
                  <td className="px-4 py-3">{labelGender(u.gender)}</td>
                  <td className="px-4 py-3">{schoolLabel(u.school)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.contact_id ? `${labelContact(u.contact_type)} · ${u.contact_id}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_verified
                      ? <Badge tone="green">{t.admin.verifiedBadge}</Badge>
                      : <Badge tone="gray">{t.admin.unverifiedBadge}</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {pending ? (
                      <Badge tone="amber">{t.admin.withdrawalPending}</Badge>
                    ) : (
                      <Badge tone={u.status === 'active' ? 'green' : 'gray'}>
                        {labelUserStatus(u.status)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {pending ? (
                        <button
                          disabled={busy}
                          onClick={() => onApproveWithdrawal(u)}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
                        >
                          {t.admin.withdrawalApprove}
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={busy || u.status === 'deleted'}
                            onClick={() => onToggle(u)}
                            className="rounded-md bg-zinc-100 px-2 py-1 text-xs transition hover:bg-zinc-200 disabled:opacity-40"
                          >
                            {u.status === 'active' ? t.admin.deactivate : t.admin.activate}
                          </button>
                          <button
                            disabled={busy || u.status === 'deleted'}
                            onClick={() => onDelete(u)}
                            className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
                          >
                            {t.common.delete}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </div>
      )}
    </div>
  );
}
