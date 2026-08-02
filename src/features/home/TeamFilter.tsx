import { Leaf } from 'lucide-react';
import type { FilterSchool, FilterTeamSize } from '@/types/common.types';

interface Props {
  school: FilterSchool;
  noSmoke: boolean;
  size: FilterTeamSize;
  onSchool: (s: FilterSchool) => void;
  onNoSmoke: (v: boolean) => void;
  onSize: (s: FilterTeamSize) => void;
}

const schoolOptions: FilterSchool[] = ['전체', '강원대', '한림대', '성심대', '춘교대'];
const sizeOptions: FilterTeamSize[] = ['전체', 1, 2, 3, 4];

export default function TeamFilter({ school, noSmoke, size, onSchool, onNoSmoke, onSize }: Props) {
  return (
    <div className="space-y-2">
      {/* 학교 + 비흡연 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {schoolOptions.map((s) => (
          <button
            key={s}
            onClick={() => onSchool(s)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ring-1 transition ${
              school === s
                ? 'bg-sakura-500 text-white ring-sakura-500'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => onNoSmoke(!noSmoke)}
          className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm ring-1 transition ${
            noSmoke
              ? 'bg-emerald-500 text-white ring-emerald-500'
              : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Leaf size={14} strokeWidth={2} />
          비흡연만
        </button>
      </div>

      {/* 팀 사이즈 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sizeOptions.map((s) => (
          <button
            key={s}
            onClick={() => onSize(s)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ring-1 transition ${
              size === s
                ? 'bg-sakura-500 text-white ring-sakura-500'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {s === '전체' ? '모든 사이즈' : `${s} : ${s}`}
          </button>
        ))}
      </div>
    </div>
  );
}
