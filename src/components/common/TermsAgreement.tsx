import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { TERMS_DOCS, type TermsDoc } from '@/lib/terms';
import TermsModal from './TermsModal';

export interface TermsAgreementState {
  privacy: boolean;
  service: boolean;
  disclaimer: boolean;
}

export const EMPTY_TERMS_AGREEMENT: TermsAgreementState = {
  privacy: false,
  service: false,
  disclaimer: false,
};

export const isAllAgreed = (s: TermsAgreementState) => s.privacy && s.service && s.disclaimer;

interface Props {
  value: TermsAgreementState;
  onChange: (next: TermsAgreementState) => void;
}

export default function TermsAgreement({ value, onChange }: Props) {
  const [opened, setOpened] = useState<TermsDoc | null>(null);
  const all = isAllAgreed(value);

  const toggleAll = (checked: boolean) =>
    onChange({ privacy: checked, service: checked, disclaimer: checked });

  return (
    <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
      <label className="flex cursor-pointer items-center gap-2 rounded-xl px-1 py-1.5">
        <input
          type="checkbox"
          className="h-4 w-4 accent-sakura-500"
          checked={all}
          onChange={(e) => toggleAll(e.target.checked)}
        />
        <span className="text-sm font-semibold text-zinc-800">약관에 모두 동의합니다</span>
      </label>

      <div className="mt-1 space-y-0.5 border-t border-zinc-200 pt-1">
        {TERMS_DOCS.map((doc) => (
          <div key={doc.key} className="flex items-center justify-between gap-2 px-1 py-1">
            <label className="flex flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-sakura-500"
                checked={value[doc.key]}
                onChange={(e) => onChange({ ...value, [doc.key]: e.target.checked })}
              />
              <span className="text-[13px] text-zinc-600">
                <span className="text-sakura-600">(필수)</span> {doc.label}
              </span>
            </label>
            <button
              type="button"
              onClick={() => setOpened(doc)}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[12px] text-zinc-500 transition hover:bg-white hover:text-zinc-800"
            >
              전문 보기
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <TermsModal doc={opened} onClose={() => setOpened(null)} />
    </div>
  );
}
