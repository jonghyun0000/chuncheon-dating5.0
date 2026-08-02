import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import { SCHOOLS } from '@/lib/constants';
import { studentNumberHint, studentNumberPlaceholder } from '@/utils/validators';
import type { MemberInput } from '@/features/teams/teams.types';

interface Props {
  index: number;
  value: MemberInput;
  onChange: (v: MemberInput) => void;
}

export default function MemberForm({ index, value, onChange }: Props) {
  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-display text-lg text-sakura-600">팀원 {index}</h3>
      <Select label="학교" value={value.school} onChange={(e) => set('school', e.target.value as MemberInput['school'])}>
        {SCHOOLS.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="학과" value={value.department} onChange={(e) => set('department', e.target.value)} />
        <Input
          label="학번"
          placeholder={studentNumberPlaceholder}
          inputMode="numeric"
          maxLength={14}
          value={value.student_number}
          onChange={(e) => set('student_number', e.target.value)}
        />
      </div>
      <p className="-mt-1 text-xs text-zinc-400">{studentNumberHint} 다른 팀에는 입학년도만 공개됩니다.</p>
      <Input label="닉네임" value={value.nickname} onChange={(e) => set('nickname', e.target.value)} />
      <Select label="흡연 여부" value={value.smoking ? '1' : '0'} onChange={(e) => set('smoking', e.target.value === '1')}>
        <option value="0">비흡연</option>
        <option value="1">흡연</option>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Select label="연락수단" value={value.contact_type} onChange={(e) => set('contact_type', e.target.value as 'kakao' | 'instagram')}>
          <option value="kakao">카카오톡</option>
          <option value="instagram">인스타</option>
        </Select>
        <div>
          <Input
            label="연락 ID"
            placeholder={value.contact_type === 'kakao' ? 'KakaoTalk ID' : 'Instagram ID'}
            value={value.contact_id}
            onChange={(e) => set('contact_id', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
