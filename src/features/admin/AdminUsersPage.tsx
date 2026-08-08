import { useEffect, useState } from 'react';
import AdminTable from '@/components/admin/AdminTable';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import { listUsers, setUserStatus, deleteUser } from './admin.api';
import type { Profile } from '@/types/database.types';
import { formatDate } from '@/utils/format';
import { labelContact, labelGender, labelUserStatus, schoolLabel } from '@/lib/constants';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const load = () => listUsers().then(setRows).catch((e) => alert(koMessage(e)));
  useEffect(() => { void load(); }, []);

  if (!rows) return <Loading />;

  const onToggle = async (u: Profile) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    if (!confirm(t.admin.toggleConfirm(next === 'active'))) return;
    try { await setUserStatus(u.id, next); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  const onDelete = async (u: Profile) => {
    if (!confirm(t.admin.deleteUserConfirm)) return;
    try { await deleteUser(u.id); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">{t.admin.usersTitle}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t.admin.usersTotal(rows.length)}</p>

      <div className="mt-5">
        <AdminTable headers={t.admin.usersHeaders}>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 font-medium text-zinc-800">{u.name} <span className="text-xs text-zinc-400">@{u.username}</span></td>
              <td className="px-4 py-3">{labelGender(u.gender)}</td>
              <td className="px-4 py-3">{schoolLabel(u.school)}</td>
              <td className="px-4 py-3 text-xs text-zinc-500">{labelContact(u.contact_type)} · {u.contact_id}</td>
              <td className="px-4 py-3">
                {u.is_verified ? <Badge tone="green">{t.admin.verifiedBadge}</Badge> : <Badge tone="gray">{t.admin.unverifiedBadge}</Badge>}
              </td>
              <td className="px-4 py-3">
                <Badge tone={u.status === 'active' ? 'green' : 'gray'}>{labelUserStatus(u.status)}</Badge>
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(u.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onToggle(u)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">
                    {u.status === 'active' ? t.admin.deactivate : t.admin.activate}
                  </button>
                  <button onClick={() => onDelete(u)} className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100">
                    {t.common.delete}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </div>
  );
}
