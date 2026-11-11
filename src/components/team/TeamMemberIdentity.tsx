import MemberPhoto from '@/features/photos/MemberPhoto';
import { SCHOOL_BADGE_COLOR, schoolLabel } from '@/lib/constants';
import type { TeamMemberPublic } from '@/types/database.types';
import { admissionLabel } from '@/utils/format';

type Member = Pick<TeamMemberPublic, 'school' | 'nickname' | 'department' | 'student_number'>;

export default function TeamMemberIdentity({ member, photoPath }: { member: Member; photoPath?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-medium ring-1 ${SCHOOL_BADGE_COLOR[member.school]}`}>
        {schoolLabel(member.school)}
      </span>
      <MemberPhoto key={photoPath} path={photoPath} nickname={member.nickname} avatar />
      <div className="min-w-0">
        <p className="truncate font-semibold leading-tight text-zinc-900">{member.nickname}</p>
        <p className="truncate text-xs text-zinc-500">{member.department} · {admissionLabel(member.student_number)}</p>
      </div>
    </div>
  );
}
