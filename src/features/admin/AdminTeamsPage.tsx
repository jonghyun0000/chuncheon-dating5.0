import { useEffect, useState } from 'react';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import { deleteTeamAdmin, listTeamsAdmin, setTeamStatus, type TeamRowAdmin } from './admin.api';
import { koMessage } from '@/utils/errors';
import { formatDate } from '@/utils/format';
import { labelTeamGender, labelTeamStatus, schoolLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';

export default function AdminTeamsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<TeamRowAdmin[] | null>(null);

  const load = () => listTeamsAdmin().then(setRows).catch((e) => alert(koMessage(e)));
  useEffect(() => { void load(); }, []);

  if (!rows) return <Loading />;

  const cycleStatus = async (row: TeamRowAdmin) => {
    const next: 'active' | 'hidden' = row.status === 'active' ? 'hidden' : 'active';
    if (row.status === 'matched') return alert(t.admin.matchedTeamAlert);
    try { await setTeamStatus(row.id, next); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  const onDelete = async (row: TeamRowAdmin) => {
    if (!confirm(t.admin.deleteTeamConfirm(row.intro))) return;
    try { await deleteTeamAdmin(row.id); await load(); }
    catch (e) { alert(koMessage(e)); }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">{t.admin.teamsTitle}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t.admin.teamsTotal(rows.length)}</p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={row.gender === 'male' ? 'sky' : 'pink'}>{labelTeamGender(row.gender)}</Badge>
                  <Badge tone="amber">{row.team_size} : {row.team_size}</Badge>
                  <Badge tone={row.status === 'active' ? 'green' : row.status === 'matched' ? 'pink' : 'gray'}>{labelTeamStatus(row.status)}</Badge>
                </div>
                <p className="mt-2 font-display text-lg leading-snug">“{row.intro}”</p>
                <p className="mt-1 text-xs text-zinc-500">{t.admin.ownerPrefix(row.owner_name)} · {formatDate(row.created_at)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => cycleStatus(row)} className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">
                  {row.status === 'active' ? t.admin.hideTeam : row.status === 'hidden' ? t.admin.activateTeam : t.admin.matchedTeam}
                </button>
                <button onClick={() => onDelete(row)} className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100">
                  {t.common.delete}
                </button>
              </div>
            </div>
            <ul className={`mt-3 grid gap-2 text-xs grid-cols-${Math.min(row.members.length, 4)}`}>
              {row.members.map((m) => (
                <li key={m.id} className="rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-100">
                  <p className="font-semibold">{m.nickname}</p>
                  <p className="text-zinc-500">{schoolLabel(m.school)}</p>
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