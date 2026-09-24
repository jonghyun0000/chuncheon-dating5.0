import { X } from 'lucide-react';
import { useId } from 'react';
import type { TermsDoc } from '@/lib/terms';
import { useI18n } from '@/i18n';
import Dialog from './Dialog';

interface Props {
  doc: TermsDoc | null;
  onClose: () => void;
}

export default function TermsModal({ doc, onClose }: Props) {
  const { t } = useI18n();
  const titleId = useId();

  return (
    <Dialog open={!!doc} onClose={onClose} labelledBy={titleId} className="px-0 sm:px-4">
      {doc && <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 id={titleId} className="font-display text-lg font-bold text-zinc-900">{doc.title}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{doc.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="shrink-0 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h4 className="text-sm font-bold text-zinc-900">{s.heading}</h4>
              <div className="mt-1.5 space-y-1.5">
                {s.body.map((line, i) => (
                  <p key={i} className="text-[13px] leading-relaxed text-zinc-600">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t border-zinc-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="btn-ghost w-full">
            {t.common.close}
          </button>
        </footer>
      </div>}
    </Dialog>
  );
}
