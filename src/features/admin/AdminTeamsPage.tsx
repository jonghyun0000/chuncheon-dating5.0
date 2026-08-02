import { useEffect, useState } from 'react';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import { deleteTeamAdmin, listTeamsAdmin, setTeamStatus, type TeamRowAdmin } from './admin.api';
import { koMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';

export default function AdminTeamsPage() {
  const [rows, setRows] = useState<TeamRowAdmin[] | null>(null);

  const load = () => listTeamsAdmin().then(setRows).catch((e) => alert(koMessage(e)));
  useEffect(() => { void load(); }, []);

  if (!rows) return <Loading />;

  const cycleStatus = async (t: TeamRowAdmin) => {
    const next: 'active' | 'hidden' = t.status === 'active' ? 'hidden' : 'active';
    if (t.status === 'matched') return alert('매칭된 팀의 상태는 수동 변경할 수 없습니다.');
    try { await setTeamStatus(t.id, next); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  const onDelete = async (t: TeamRowAdmin) => {
    if (!confirm(`"${t.intro}" 팀을 삭제할까요? 팀원 정보도 함께 삭제됩니다.`)) return;
    try { await deleteTeamAdmin(t.id); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">팀관리</h1>
      <p className="mt-1 text-sm text-zinc-500">총 {rows.length}팀</p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {rows.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={t.gender === 'male' ? 'sky' : 'pink'}>{t.gender === 'male' ? '남자팀' : '여자팀'}</Badge>
                  <Badge tone="amber">{t.team_size} : {t.team_size}</Badge>
                  <Badge tone={t.status === 'active' ? 'green' : t.status === 'matched' ? 'pink' : 'gray'}>{t.status}</Badge>
                </div>
                <p className="mt-2 font-display text-lg leading-snug">“{t.intro}”</p>
                <p className="mt-1 text-xs text-zinc-500">등록자: {t.owner_name} · {formatDate(t.created_at)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => cycleStatus(t)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">
                  {t.status === 'active' ? '숨김 처리' : t.status === 'hidden' ? '활성화' : '매칭됨'}
                </button>
                <button onClick={() => onDelete(t)} className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100">
                  삭제
                </button>
              </div>
            </div>
            <ul className={`mt-3 grid gap-2 text-xs grid-cols-${Math.min(t.members.length, 4)}`}>
              {t.members.map((m) => (
                <li key={m.id} className="rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-100">
                  <p className="font-semibold">{m.nickname}</p>
                  <p className="text-zinc-500">{m.school}</p>
                  <p className="text-zinc-500">{m.department}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}