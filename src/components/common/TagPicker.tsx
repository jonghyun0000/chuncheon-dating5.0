import { Check } from 'lucide-react';

interface Props {
  label: string;
  /** 선택 가능한 태그 키 목록 */
  options: readonly string[];
  /** 키 → 화면 라벨 변환 */
  renderLabel: (key: string) => string;
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  required?: boolean;
  hint?: string;
}

/**
 * 칩(chip) 형태의 다중 선택.
 * 자유 텍스트 대신 고정 목록에서 고르게 해서
 *  - 입력 부담을 줄이고 (탭 몇 번이면 끝)
 *  - 4개 언어 번역이 자동으로 되고
 *  - 연락처를 적어 넣는 우회를 원천 차단합니다.
 */
export default function TagPicker({
  label, options, renderLabel, value, onChange, max, required, hint,
}: Props) {
  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
      return;
    }
    if (value.length >= max) return; // 최대 개수 초과 시 무시
    onChange([...value, key]);
  };

  const full = value.length >= max;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="label mb-0">
          {label}
          {required && <span className="ml-1 text-sakura-500">*</span>}
        </label>
        <span className={`text-xs tabular-nums ${full ? 'text-sakura-500' : 'text-zinc-400'}`}>
          {value.length} / {max}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((key) => {
          const on = value.includes(key);
          const disabled = !on && full;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                on
                  ? 'bg-sakura-500 text-white ring-sakura-500'
                  : disabled
                    ? 'cursor-not-allowed bg-white text-zinc-300 ring-zinc-100'
                    : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-sakura-50 hover:text-sakura-600'
              }`}
            >
              {on && <Check size={12} strokeWidth={3} />}
              {renderLabel(key)}
            </button>
          );
        })}
      </div>

      {hint && <p className="mt-1.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
