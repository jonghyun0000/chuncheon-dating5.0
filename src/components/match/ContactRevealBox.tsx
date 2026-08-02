import { labelContact } from '@/lib/constants';
import type { TeamMember } from '@/types/database.types';
import Badge from '@/components/common/Badge';

interface Props {
  members: TeamMember[];
  title?: string;
}

export default function ContactRevealBox({ members, title = '상대팀 연락처가 공개되었어요' }: Props) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sakura-50 to-white p-4 ring-1 ring-sakura-100">
      <p className="text-sm font-semibold text-sakura-700">{title}</p>
      <ul className="mt-3 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 ring-1 ring-zinc-100">
            <div>
              <p className="font-semibold text-zinc-900">{m.nickname}</p>
              <p className="text-xs text-zinc-500">{m.school} · {m.department}</p>
            </div>
            <div className="text-right">
              <Badge tone={m.contact_type === 'kakao' ? 'amber' : 'pink'}>
                {labelContact(m.contact_type)}
              </Badge>
              <p className="mt-1 select-all font-mono text-sm text-zinc-700">{m.contact_id}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-zinc-500">
        * 연락처는 양 팀 모두에게만 공개되며, 외부에 공유하지 않도록 주의해주세요.
      </p>
    </div>
  );
}
