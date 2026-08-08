interface Props {
  title?: string;
  subtitle?: string;
}

import { useI18n } from '@/i18n';

export default function Header({ title, subtitle }: Props) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-sakura-600">{title ?? t.common.appName}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-widest text-zinc-400">CHUNCHEON</p>
          <p className="text-[10px] tracking-widest text-zinc-400">UNIVERSITY MATCH</p>
        </div>
      </div>
    </header>
  );
}
