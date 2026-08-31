import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, Copy, Download, Smartphone, TriangleAlert,
} from 'lucide-react';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useI18n } from '@/i18n';
import { detectPlatform, isInAppBrowser, usePwaInstall } from './usePwaInstall';

type Tab = 'ios' | 'android';

/** 홈 화면에 아이콘이 놓이는 순간 (히어로 일러스트) */
function PhoneArt() {
  const { t } = useI18n();
  return (
    <svg
      viewBox="0 0 200 300"
      fill="none"
      role="img"
      aria-label={t.install.heroAlt}
      className="h-auto w-[168px] drop-shadow-[0_18px_30px_rgba(233,78,133,0.18)]"
    >
      <rect x="8" y="8" width="184" height="284" rx="26" fill="#fff" stroke="#3f3f46" strokeWidth="2.5" />
      <rect x="72" y="16" width="56" height="8" rx="4" fill="#3f3f46" opacity=".12" />
      <g fill="#ffe4ec">
        <rect x="30" y="52" width="34" height="34" rx="10" />
        <rect x="83" y="52" width="34" height="34" rx="10" />
        <rect x="136" y="52" width="34" height="34" rx="10" />
        <rect x="30" y="104" width="34" height="34" rx="10" />
        <rect x="136" y="104" width="34" height="34" rx="10" />
        <rect x="30" y="156" width="34" height="34" rx="10" />
        <rect x="83" y="156" width="34" height="34" rx="10" />
        <rect x="136" y="156" width="34" height="34" rx="10" />
      </g>
      <g className="origin-center animate-fade-up [transform-box:fill-box]">
        <rect x="83" y="104" width="34" height="34" rx="10" fill="#e94e85" />
        <g fill="#fff" transform="translate(100,121)">
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={deg}
              transform={deg ? `rotate(${deg})` : undefined}
              d="M0 -10 c3.2 0 5.4 2.6 5.4 5.4 C5.4 -1.6 3 0 0 0 c-3 0 -5.4 -1.6 -5.4 -4.6 C-5.4 -7.4 -3.2 -10 0 -10Z"
            />
          ))}
        </g>
        <rect x="86" y="143" width="28" height="4" rx="2" fill="#3f3f46" opacity=".25" />
      </g>
      <rect x="30" y="238" width="140" height="42" rx="16" fill="#fff5f7" />
      <rect x="66" y="284" width="68" height="3" rx="1.5" fill="#3f3f46" opacity=".3" />
    </svg>
  );
}

interface Step { text: string; hint?: string }

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-4 list-none space-y-0 p-0">
      {steps.map((s, i) => (
        <li key={i} className="relative pl-9 pb-4 last:pb-0">
          <span className="absolute left-0 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-sakura-500 text-xs font-bold text-white">
            {i + 1}
          </span>
          {i < steps.length - 1 && (
            <span className="absolute left-[11px] top-7 bottom-1 w-px bg-zinc-100" aria-hidden="true" />
          )}
          <p className="text-[15px] leading-relaxed text-zinc-800">{s.text}</p>
          {s.hint && <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{s.hint}</p>}
        </li>
      ))}
    </ol>
  );
}

function GuideCard({
  badge, title, sub, steps, tip, defaultOpen,
}: {
  badge: string; title: string; sub: string; steps: Step[]; tip?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <article className="card mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-zinc-50"
      >
        <span className="shrink-0 rounded-lg bg-sakura-50 px-2 py-1 font-display text-[11px] font-bold text-sakura-700">
          {badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-zinc-900">{title}</span>
          <span className="mt-0.5 block text-xs text-zinc-400">{sub}</span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`shrink-0 text-zinc-300 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-1">
          <StepList steps={steps} />
          {tip && (
            <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-[13px] leading-relaxed text-zinc-600">
              {tip}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function InstallGuidePage() {
  const { t } = useI18n();
  const L = t.install;
  const { canInstall, installed, install } = usePwaInstall();

  const platform = useMemo(() => detectPlatform(), []);
  const inApp = useMemo(() => isInAppBrowser(), []);
  const [tab, setTab] = useState<Tab>(platform === 'android' ? 'android' : 'ios');
  const [copied, setCopied] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);

  // 주소를 코드에 박아두면 도메인을 바꿨을 때 안내가 틀려집니다.
  const host = typeof window === 'undefined' ? '' : window.location.host;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const onCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(origin);
      } else {
        const ta = document.createElement('textarea');
        ta.value = origin;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const onInstall = async () => {
    const r = await install();
    if (r === 'dismissed') setInstallMsg(L.installDismissed);
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800">
            <ArrowLeft size={16} strokeWidth={2} />
            {t.legal.backHome}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-16 pt-7">
        {/* 이미 홈 화면에서 실행 중이면 안내가 필요 없습니다 */}
        {installed ? (
          <section className="card p-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={28} strokeWidth={2} />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-zinc-900">{L.alreadyTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{L.alreadyDesc}</p>
            <Link to="/" className="btn-primary mt-5 w-full">{t.common.goHome}</Link>
          </section>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sakura-600">
              {L.eyebrow}
            </p>
            <h1 className="mt-3 font-display text-[28px] font-bold leading-snug text-zinc-900">
              {L.title1}
              <br />
              <em className="not-italic text-sakura-600">{L.title2}</em>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">{L.lead}</p>

            <div className="mt-6 flex justify-center">
              <PhoneArt />
            </div>

            {/* 안드로이드 크롬이면 안내를 읽을 필요 없이 버튼 한 번으로 끝납니다 */}
            {canInstall && (
              <div className="mt-6">
                <button type="button" onClick={() => void onInstall()} className="btn-primary w-full gap-2">
                  <Download size={18} strokeWidth={2} />
                  {L.installNow}
                </button>
                <p className="mt-2 text-center text-xs text-zinc-400">{L.installNowHint}</p>
                {installMsg && (
                  <p className="mt-2 text-center text-xs text-amber-700">{installMsg}</p>
                )}
              </div>
            )}

            {/* 주소 복사 */}
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 shadow-card ring-1 ring-zinc-100">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-700">{host}</code>
              <button
                type="button"
                onClick={() => void onCopy()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-zinc-800"
              >
                {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
                {copied ? t.common.copied : L.copyUrl}
              </button>
            </div>

            {/* 인앱 브라우저 경고 */}
            {inApp && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-200">
                <TriangleAlert size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-amber-700" />
                <p className="text-sm leading-relaxed text-amber-900">
                  <strong className="mb-0.5 block font-semibold">{L.inAppTitle}</strong>
                  {L.inAppDesc}
                </p>
              </div>
            )}

            {/* 기기 선택 */}
            <div className="mt-7 flex gap-1.5 rounded-2xl bg-zinc-100 p-1.5" role="tablist" aria-label={L.pickDevice}>
              {(['ios', 'android'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
                    tab === k ? 'bg-white text-zinc-900 shadow-soft' : 'text-zinc-500'
                  }`}
                >
                  <Smartphone size={15} strokeWidth={2} />
                  {k === 'ios' ? L.tabIos : L.tabAndroid}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === 'ios' ? (
                <>
                  <GuideCard
                    defaultOpen
                    badge={L.ios26Badge}
                    title={L.safari}
                    sub={L.ios26Sub}
                    steps={L.ios26Steps}
                    tip={L.ios26Tip}
                  />
                  <GuideCard
                    badge={L.ios18Badge}
                    title={L.safari}
                    sub={L.ios18Sub}
                    steps={L.ios18Steps}
                    tip={L.ios18Tip}
                  />
                  <GuideCard
                    badge={L.chromeBadge}
                    title={L.iosChrome}
                    sub={L.iosChromeSub}
                    steps={L.iosChromeSteps}
                    tip={L.iosChromeTip}
                  />
                </>
              ) : (
                <>
                  <GuideCard
                    defaultOpen
                    badge={L.chromeBadge}
                    title={L.androidChrome}
                    sub={L.androidChromeSub}
                    steps={L.androidChromeSteps}
                    tip={L.androidChromeTip}
                  />
                  <GuideCard
                    badge={L.samsungBadge}
                    title={L.samsung}
                    sub={L.samsungSub}
                    steps={L.samsungSteps}
                  />
                  <GuideCard
                    badge={L.etcBadge}
                    title={L.etc}
                    sub={L.etcSub}
                    steps={L.etcSteps}
                    tip={L.etcTip}
                  />
                </>
              )}
            </div>
          </>
        )}

        <div className="mt-9 space-y-1 text-center text-[13px] text-zinc-400">
          <p>{L.footNote}</p>
          <p>{L.footHelp}</p>
        </div>
      </main>
    </div>
  );
}
