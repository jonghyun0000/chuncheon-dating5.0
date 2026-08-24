import { labelTasteTag, labelWantTag } from '@/lib/constants';
import { useI18n } from '@/i18n';

interface Props {
  taste?: string[] | null;
  want?: string[] | null;
  /** 좁은 카드에서는 라벨 줄을 생략하고 칩만 보여줍니다. */
  compact?: boolean;
}

/** 팀원 카드에 붙는 태그 줄. 연락처와 무관한 공개 정보만 표시합니다. */
export default function MemberTags({ taste, want, compact }: Props) {
  const { t } = useI18n();
  const tasteList = taste ?? [];
  const wantList = want ?? [];
  if (tasteList.length === 0 && wantList.length === 0) return null;

  return (
    <div className={compact ? 'mt-1.5 flex flex-wrap gap-1' : 'mt-2 space-y-1.5'}>
      {tasteList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {!compact && (
            <span className="mr-0.5 text-[11px] font-medium text-zinc-400">{t.memberForm.tasteTags}</span>
          )}
          {tasteList.map((k) => (
            <span
              key={k}
              className="rounded-full bg-sakura-50 px-2 py-0.5 text-[11px] font-medium text-sakura-600 ring-1 ring-sakura-100"
            >
              {labelTasteTag(k)}
            </span>
          ))}
        </div>
      )}

      {wantList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {!compact && (
            <span className="mr-0.5 text-[11px] font-medium text-zinc-400">{t.memberForm.wantTags}</span>
          )}
          {wantList.map((k) => (
            <span
              key={k}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
            >
              {labelWantTag(k)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
