import { Link } from 'react-router-dom';
import { GraduationCap, MessagesSquare, School, UsersRound } from 'lucide-react';
import { SCHOOLS, schoolFullLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sakura-100 via-sakura-50 to-amber-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="petal animate-fall"
            style={{
              left: `${(i * 7.3) % 100}%`,
              animationDuration: `${9 + (i % 5)}s`,
              animationDelay: `${(i * 0.7) % 7}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        {/* 언어 선택 — 시작화면 최상단 */}
        <div className="flex justify-center">
          <LanguageSwitcher />
        </div>

        <div className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-sakura-600 shadow-soft backdrop-blur">
            {t.landing.badge}
          </span>
        </div>

        <div className="mt-8 text-center">
          <h2 className="bg-gradient-to-br from-sakura-500 to-violet-400 bg-clip-text font-display text-7xl font-bold leading-[0.95] text-transparent">
            {t.landing.heroLine1}<br />{t.landing.heroLine2}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-zinc-500">
            {t.common.tagline}<br />
            <span className="font-semibold text-zinc-700">{t.common.taglineService}</span>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SCHOOLS.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1.5 text-sm text-zinc-700 shadow-soft ring-1 ring-white backdrop-blur"
            >
              <School size={14} strokeWidth={1.8} className="text-sakura-500" />
              {schoolFullLabel(s)}
            </span>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-soft ring-1 ring-white backdrop-blur">
            <GraduationCap size={22} strokeWidth={1.8} className="shrink-0 text-sakura-500" />
            <p className="text-sm font-medium text-zinc-700">{t.landing.feature1}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-soft ring-1 ring-white backdrop-blur">
            <UsersRound size={22} strokeWidth={1.8} className="shrink-0 text-sakura-500" />
            <p className="text-sm font-medium text-zinc-700">{t.landing.feature2}</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-soft ring-1 ring-white backdrop-blur">
            <MessagesSquare size={22} strokeWidth={1.8} className="shrink-0 text-sakura-500" />
            <p className="text-sm font-medium text-zinc-700">{t.landing.feature3}</p>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm font-medium text-zinc-400">{t.landing.howTitle}</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-white backdrop-blur">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sakura-500 text-sm font-bold text-white">1</span>
              <div>
                <p className="text-sm font-bold text-zinc-900">{t.landing.step1Title}</p>
                <p className="text-xs text-zinc-500">{t.landing.step1Desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-white backdrop-blur">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sakura-500 text-sm font-bold text-white">2</span>
              <div>
                <p className="text-sm font-bold text-zinc-900">{t.landing.step2Title}</p>
                <p className="text-xs text-zinc-500">{t.landing.step2Desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-white backdrop-blur">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sakura-500 text-sm font-bold text-white">3</span>
              <div>
                <p className="text-sm font-bold text-zinc-900">{t.landing.step3Title}</p>
                <p className="text-xs text-zinc-500">{t.landing.step3Desc}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-sakura-50 to-amber-50 p-4 ring-1 ring-sakura-200">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sakura-200 text-sakura-700">
                  <MessagesSquare size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-bold text-sakura-600">{t.landing.step4Title}</p>
                  <p className="text-xs text-zinc-500">{t.landing.step4Desc}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 pb-6">
          <Link
            to="/register"
            className="block w-full rounded-full bg-gradient-to-r from-sakura-500 to-sakura-400 py-4 text-center font-bold text-white shadow-soft transition active:scale-[0.98]"
          >
            {t.landing.ctaStart}
          </Link>
          <Link
            to="/login"
            className="block w-full rounded-full bg-white py-4 text-center font-semibold text-zinc-700 ring-1 ring-zinc-200"
          >
            {t.landing.ctaHaveAccount}
          </Link>
        </div>
      </div>
    </div>
  );
}
