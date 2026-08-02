import { useEffect, useState } from 'react';
import AdminTable from '@/components/admin/AdminTable';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import { listUsers, setUserStatus, deleteUser } from './admin.api';
import type { Profile } from '@/types/database.types';
import { formatDate } from '@/utils/format';
import { labelContact, labelGender } from '@/lib/constants';
import { koMessage } from '@/utils/errors';

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Profile[] | null>(null);
  const load = () => listUsers().then(setRows).catch((e) => alert(koMessage(e)));
  useEffect(() => { void load(); }, []);

  if (!rows) return <Loading />;

  const onToggle = async (u: Profile) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    if (!confirm(`이 회원을 ${next === 'active' ? '활성화' : '비활성화'} 할까요?`)) return;
    try { await setUserStatus(u.id, next); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  const onDelete = async (u: Profile) => {
    if (!confirm('이 회원을 삭제 처리할까요? (status=deleted)')) return;
    try { await deleteUser(u.id); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">회원현황</h1>
      <p className="mt-1 text-sm text-zinc-500">총 {rows.length}명</p>

      <div className="mt-5">
        <AdminTable headers={['이름', '성별', '학교', '연락', '인증', '상태', '가입일', '관리']}>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 font-medium text-zinc-800">{u.name} <span className="text-xs text-zinc-400">@{u.username}</span></td>
              <td className="px-4 py-3">{labelGender(u.gender)}</td>
              <td className="px-4 py-3">{u.school}</td>
              <td className="px-4 py-3 text-xs text-zinc-500">{labelContact(u.contact_type)} · {u.contact_id}</td>
              <td className="px-4 py-3">
                {u.is_verified ? <Badge tone="green">인증</Badge> : <Badge tone="gray">미인증</Badge>}
              </td>
              <td className="px-4 py-3">
                <Badge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status}</Badge>
              </td>
              <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(u.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button onClick={() => onToggle(u)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">
                    {u.status === 'active' ? '비활성' : '활성'}
                  </button>
                  <button onClick={() => onDelete(u)} className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100">
                    삭제
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
