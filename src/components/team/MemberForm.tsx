import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import TagPicker from '@/components/common/TagPicker';
import {
  CONTACT_TYPES, MAX_TAGS_PER_GROUP, SCHOOLS, TASTE_TAGS, WANT_TAGS,
  labelContact, labelTasteTag, labelWantTag, schoolLabel,
} from '@/lib/constants';
import { useI18n } from '@/i18n';
import type { MemberInput } from '@/features/teams/teams.types';

interface Props {
  index: number;
  value: MemberInput;
  onChange: (v: MemberInput) => void;
}

export default function MemberForm({ index, value, onChange }: Props) {
  const { t } = useI18n();
  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-display text-lg text-sakura-600">{t.memberForm.title(index)}</h3>
      <Select label={t.memberForm.school} value={value.school} onChange={(e) => set('school', e.target.value as MemberInput['school'])}>
        {SCHOOLS.map((s) => <option key={s} value={s}>{schoolLabel(s)}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t.memberForm.department} value={value.department} onChange={(e) => set('department', e.target.value)} />
        <Input
          label={t.memberForm.studentNumber}
          placeholder={t.validators.studentNumberPlaceholder}
          inputMode="numeric"
          maxLength={14}
          value={value.student_number}
          onChange={(e) => set('student_number', e.target.value)}
        />
      </div>
      <p className="-mt-1 text-xs text-zinc-400">{t.validators.studentNumberHint} {t.memberForm.publicNote}</p>
      <Input label={t.memberForm.nickname} value={value.nickname} onChange={(e) => set('nickname', e.target.value)} />
      <Select label={t.memberForm.smoking} value={value.smoking ? '1' : '0'} onChange={(e) => set('smoking', e.target.value === '1')}>
        <option value="0">{t.memberForm.smokingNo}</option>
        <option value="1">{t.memberForm.smokingYes}</option>
      </Select>

      {/* 태그 — 카드에 공개되는 정보입니다 */}
      <TagPicker
        label={t.memberForm.tasteTags}
        options={TASTE_TAGS}
        renderLabel={labelTasteTag}
        value={value.taste_tags}
        onChange={(v) => set('taste_tags', v)}
        max={MAX_TAGS_PER_GROUP}
        required
        hint={t.memberForm.tasteTagsHint}
      />
      <TagPicker
        label={t.memberForm.wantTags}
        options={WANT_TAGS}
        renderLabel={labelWantTag}
        value={value.want_tags}
        onChange={(v) => set('want_tags', v)}
        max={MAX_TAGS_PER_GROUP}
        hint={t.memberForm.wantTagsHint}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select label={t.memberForm.contactType} value={value.contact_type} onChange={(e) => set('contact_type', e.target.value as 'kakao' | 'phone')}>
          {CONTACT_TYPES.map((v) => (
            <option key={v} value={v}>{labelContact(v)}</option>
          ))}
        </Select>
        <div>
          <Input
            label={value.contact_type === 'phone' ? t.register.phone : t.register.kakaoId}
            placeholder={value.contact_type === 'phone' ? t.validators.phonePlaceholder : t.register.kakaoId}
            inputMode={value.contact_type === 'phone' ? 'tel' : undefined}
            value={value.contact_id}
            onChange={(e) => set('contact_id', e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-zinc-400">
        {t.memberForm.contactNote}
      </p>
    </div>
  );
}
