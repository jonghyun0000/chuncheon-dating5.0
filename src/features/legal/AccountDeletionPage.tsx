import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Trash2, ShieldCheck, Archive } from 'lucide-react';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { ADMIN_EMAIL } from '@/lib/constants';
import { useI18n } from '@/i18n';

/**
 * 계정·데이터 삭제 안내 (로그인 불필요).
 * Google Play 정책: 계정 생성이 가능한 앱은 앱 내 삭제 + 웹에서 삭제 요청 경로를
 * 모두 제공해야 합니다. 이 페이지가 그 "웹 경로" 역할을 합니다.
 */
export default function AccountDeletionPage() {
  const { t } = useI18n();
  const L = t.legal;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            {L.backHome}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="font-display text-2xl font-bold text-zinc-900">{L.delTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{L.delIntro}</p>

        {/* 1. 앱 내 삭제 */}
        <section className="mt-7 rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600">
              <Trash2 size={15} strokeWidth={2} />
            </span>
            {L.delInAppTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{L.delInAppDesc}</p>
        </section>

        {/* 2. 로그인 못 할 때: 이메일 요청 */}
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-600">
              <Mail size={15} strokeWidth={2} />
            </span>
            {L.delRequestTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{L.delRequestDesc}</p>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(L.delMailSubject)}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 font-mono text-sm text-zinc-700 transition hover:bg-zinc-200"
          >
            <Mail size={14} strokeWidth={1.8} />
            {ADMIN_EMAIL}
          </a>
        </section>

        {/* 3. 삭제되는 데이터 */}
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600">
              <ShieldCheck size={15} strokeWidth={2} />
            </span>
            {L.delDeletedTitle}
          </h2>
          <ul className="mt-3 space-y-1.5">
            {L.delDeletedList.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-zinc-600">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-300" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* 4. 보관되는 데이터 */}
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-zinc-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Archive size={15} strokeWidth={2} />
            </span>
            {L.delKeptTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{L.delKeptDesc}</p>
        </section>

        <div className="mt-12 border-t border-zinc-100 pt-6 text-xs text-zinc-400">
          춘천과팅 · Chuncheon Gating
        </div>
      </main>
    </div>
  );
}
