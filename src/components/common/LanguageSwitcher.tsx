import { Globe } from 'lucide-react';
import { LANG_OPTIONS, useI18n } from '@/i18n';

interface Props {
  /**
   * pill  : 시작화면·로그인용 — 알약 버튼 4개 (기본)
   * row   : 마이페이지용 — 설정 리스트 안에서 쓰는 가로 배치
   */
  variant?: 'pill' | 'row';
  className?: string;
}

export default function LanguageSwitcher({ variant = 'pill', className = '' }: Props) {
  const { lang, setLang } = useI18n();

  if (variant === 'row') {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {LANG_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setLang(o.value)}
            className={`rounded-full px-3 py-1.5 text-xs ring-1 transition ${
              lang === o.value
                ? 'bg-sakura-500 font-semibold text-white ring-sakura-500'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full bg-white/80 p-1 shadow-soft ring-1 ring-white backdrop-blur ${className}`}
    >
      <Globe size={14} strokeWidth={2} className="ml-1.5 shrink-0 text-sakura-500" />
      {LANG_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          className={`rounded-full px-2.5 py-1 text-[11px] transition ${
            lang === o.value
              ? 'bg-sakura-500 font-semibold text-white'
              : 'text-zinc-500 hover:text-zinc-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
