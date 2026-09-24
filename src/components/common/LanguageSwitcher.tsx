import { Globe } from 'lucide-react';
import { LANG_OPTIONS, useI18n } from '@/i18n';
interface Props { variant?: 'pill' | 'row'; className?: string; }

export default function LanguageSwitcher({ variant = 'pill', className = '' }: Props) {
  const { lang, setLang, t, pendingLang, languageError, languageLoadingMessage } = useI18n();
  const pill = variant === 'pill';
  return (
    <div className={className}>
      <div role="group" aria-label={t.common.language} aria-busy={!!pendingLang}
        className={pill
          ? 'inline-flex flex-wrap items-center gap-1 rounded-full bg-white/80 p-1 shadow-soft ring-1 ring-white backdrop-blur'
          : 'flex flex-wrap items-center gap-1.5'}>
        {pill && <Globe aria-hidden="true" size={14} strokeWidth={2} className="ml-1.5 shrink-0 text-sakura-500" />}
        {LANG_OPTIONS.map((option) => (
          <button key={option.value} type="button" lang={option.value === 'zh' ? 'zh-CN' : option.value}
            aria-pressed={lang === option.value} onClick={() => setLang(option.value)}
            className={`min-h-8 rounded-full px-3 py-1.5 text-xs transition ${lang === option.value
              ? 'bg-sakura-500 font-semibold text-white'
              : 'bg-white/80 text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50'}`}>
            {option.label}
          </button>
        ))}
      </div>
      {pendingLang && <p role="status" className="mt-1 text-xs text-zinc-600">{languageLoadingMessage}</p>}
      {languageError && (
        <div role="alert" className="mt-1 max-w-sm text-xs text-rose-700">
          <p>{languageError}</p>
          <button type="button" className="mt-1 rounded px-2 py-1 underline" onClick={() => window.location.reload()}>
            {t.common.refresh}
          </button>
        </div>
      )}
    </div>
  );
}
