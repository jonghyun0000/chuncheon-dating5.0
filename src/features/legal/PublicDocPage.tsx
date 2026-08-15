import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getTermsDoc, type TermsDoc } from '@/lib/terms';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useI18n } from '@/i18n';

/**
 * 로그인 없이 열리는 약관/정책 공개 페이지.
 * 플레이스토어는 개인정보처리방침 등을 "누구나 접근 가능한 URL"로 요구합니다.
 * 약관 전문은 이미 4개 언어로 번역돼 있어 그대로 렌더링합니다.
 */
export default function PublicDocPage({ docKey }: { docKey: TermsDoc['key'] }) {
  const { t } = useI18n();
  const doc = getTermsDoc(docKey);

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            {t.legal.backHome}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="font-display text-2xl font-bold text-zinc-900">{doc.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{doc.summary}</p>

        <div className="mt-8 space-y-7">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-base font-bold text-zinc-900">{s.heading}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-zinc-600">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-zinc-100 pt-6 text-xs text-zinc-400">
          춘천과팅 · Chuncheon Gating
        </div>
      </main>
    </div>
  );
}
