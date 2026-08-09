import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Check,
  Eye,
  IdCard,
  Lock,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import Badge from '@/components/common/Badge';
import { useI18n } from '@/i18n';

/**
 * 가입 전 둘러보기 (온보딩 튜토리얼).
 *
 * 문제: 이 앱은 가입 단계에서 실명·학번·연락처·학생증 사진을 요구하는데,
 *      그 대가로 무엇을 얻는지는 가입하고 승인까지 하루를 기다린 뒤에야 보입니다.
 * 해결: 가입을 결정하기 전에 실제 화면과 매칭 흐름을 먼저 보여줍니다.
 *
 * - 시작 화면의 [1분 둘러보기] 버튼으로만 진입합니다. (자동 노출 안 함)
 * - 좌우 스와이프 / 버튼 / 키보드 화살표로 넘길 수 있습니다.
 * - 팀 카드는 실제 회원이 아니라 예시이며, 화면에 '예시 화면' 표시를 답니다.
 */

const TOTAL = 6;
const SWIPE_THRESHOLD = 48;

export default function TourPage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setStep((cur) => Math.min(TOTAL - 1, Math.max(0, next ?? cur)));
  }, []);

  const exit = useCallback(() => nav('/', { replace: true }), [nav]);

  // 키보드 좌우 화살표 (데스크톱)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep((s) => Math.min(TOTAL - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx <= -SWIPE_THRESHOLD) setStep((s) => Math.min(TOTAL - 1, s + 1));
    if (dx >= SWIPE_THRESHOLD) setStep((s) => Math.max(0, s - 1));
  };

  const isLast = step === TOTAL - 1;

  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-b from-sakura-50 via-cream to-cream"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-4">
        {/* 진행 표시 + 건너뛰기 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-5 bg-sakura-500' : 'w-1.5 bg-sakura-200'
                }`}
              />
            ))}
          </div>
          {!isLast && (
            <button
              type="button"
              onClick={exit}
              className="text-xs text-zinc-400 transition hover:text-zinc-600"
            >
              {t.tour.skip}
            </button>
          )}
        </div>

        {/* 본문 */}
        {/* 카드마다 내용 길이가 달라, 짧은 카드는 세로 가운데로 모읍니다 */}
        <div key={step} className="flex flex-1 flex-col justify-center animate-fade-up">
          {step === 0 && <Card1 />}
          {step === 1 && <Card2 />}
          {step === 2 && <Card3 />}
          {step === 3 && <Card4 />}
          {step === 4 && <Card5 />}
          {step === 5 && <Card6 />}
        </div>

        {/* 하단 버튼 */}
        {isLast ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => nav('/register')}
              className="w-full rounded-full bg-gradient-to-r from-sakura-500 to-sakura-400 py-4 text-center text-sm font-bold text-white shadow-soft transition active:scale-[0.98]"
            >
              {t.tour.c6.cta}
            </button>
            <button
              type="button"
              onClick={exit}
              className="w-full py-2 text-center text-xs text-zinc-400 transition hover:text-zinc-600"
            >
              {t.tour.c6.later}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-zinc-600 ring-1 ring-zinc-200 transition active:scale-[0.98]"
              >
                {t.tour.prev}
              </button>
            )}
            <button
              type="button"
              onClick={() => go(step + 1)}
              className="flex-1 rounded-full bg-sakura-500 py-3.5 text-sm font-bold text-white shadow-soft transition hover:bg-sakura-600 active:scale-[0.98]"
            >
              {t.tour.next}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- 공통 조각 ----------------------------- */

function Head({ tag, line1, line2, sub }: { tag: string; line1: string; line2: string; sub: string }) {
  return (
    <div className="pt-5">
      <p className="text-[11px] font-bold tracking-wide text-sakura-600">{tag}</p>
      <h1 className="mt-1.5 font-display text-2xl font-bold leading-snug text-zinc-900">
        {line1}
        <br />
        <span className="text-sakura-600">{line2}</span>
      </h1>
      <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-zinc-600">{sub}</p>
    </div>
  );
}

function Panel({ children, tone = 'white' }: { children: React.ReactNode; tone?: 'white' | 'pink' | 'sky' }) {
  const cls =
    tone === 'pink'
      ? 'bg-sakura-50 ring-sakura-100'
      : tone === 'sky'
      ? 'bg-sky-50 ring-sky-100'
      : 'bg-white ring-zinc-100';
  return <div className={`rounded-2xl p-4 shadow-card ring-1 ${cls}`}>{children}</div>;
}

function StepRow({
  n, title, desc, dashed, last,
}: { n: number; title: string; desc: string; dashed?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-2.5 ${last ? '' : 'border-b border-zinc-100'}`}>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
          dashed
            ? 'border border-dashed border-sakura-300 bg-white text-sakura-500'
            : 'bg-sakura-500 text-white'
        }`}
      >
        {n}
      </span>
      <div>
        <p className="text-[12.5px] font-bold text-zinc-800">{title}</p>
        <p className="text-[10.5px] leading-snug text-zinc-500">{desc}</p>
      </div>
    </div>
  );
}

/* ------------------------------ 카드 1 ------------------------------ */

function Card1() {
  const { t } = useI18n();
  const c = t.tour.c1;
  const schools: { key: string; cls: string }[] = [
    { key: '강원대', cls: 'bg-blue-100 text-blue-700' },
    { key: '한림대', cls: 'bg-emerald-100 text-emerald-700' },
    { key: '성심대', cls: 'bg-violet-100 text-violet-700' },
    { key: '춘교대', cls: 'bg-orange-100 text-orange-700' },
  ];
  return (
    <>
      <Head tag={c.tag} line1={c.line1} line2={c.line2} sub={c.sub} />
      <div className="mt-5 space-y-2.5">
        <Panel>
          <div className="flex flex-wrap justify-center gap-1.5">
            {schools.map((s) => (
              <span key={s.key} className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${s.cls}`}>
                {t.schools.short[s.key] ?? s.key}
              </span>
            ))}
          </div>
          <div className="mt-4 grid place-items-center text-sakura-400">
            <UsersRound size={28} strokeWidth={1.6} />
          </div>
          <p className="mt-2 text-center text-[12.5px] leading-relaxed text-zinc-600">
            <strong className="text-zinc-900">{c.sizes}</strong>
            <br />
            {c.sizesDesc}
          </p>
        </Panel>
        <Panel tone="pink">
          <p className="whitespace-pre-line text-center text-[11.5px] leading-relaxed text-sakura-700">
            {c.note}
          </p>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------ 카드 2 ------------------------------ */

function Card2() {
  const { t } = useI18n();
  const c = t.tour.c2;
  const members = [
    { name: c.m1Name, dept: c.m1Dept, year: '23', smoking: false },
    { name: c.m2Name, dept: c.m2Dept, year: '23', smoking: false },
    { name: c.m3Name, dept: c.m3Dept, year: '22', smoking: true },
  ];
  return (
    <>
      <Head tag={c.tag} line1={c.line1} line2={c.line2} sub={c.sub} />
      <div className="relative mt-5 space-y-2.5">
        <span className="absolute -top-2 right-2 z-10 rounded-full bg-zinc-900/65 px-2.5 py-1 text-[10px] font-bold text-white">
          {t.tour.sampleTag}
        </span>
        <Panel>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="pink" className="gap-1">
              <BadgeCheck size={11} strokeWidth={2.2} />
              {t.teamCard.verified}
            </Badge>
            <Badge tone="sky">{t.labels.teamGender.male}</Badge>
            <Badge tone="amber">3 : 3</Badge>
          </div>
          <p className="mt-2 font-display text-base leading-snug text-zinc-900">“{c.intro}”</p>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl bg-zinc-50/70 px-3 ring-1 ring-zinc-100">
            {members.map((m) => (
              <li key={m.name} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[12px] font-bold text-zinc-900">{m.name}</p>
                  <p className="text-[10px] text-zinc-400">
                    {m.dept} · {t.labels.admissionLabel(m.year)}
                  </p>
                </div>
                <Badge tone={m.smoking ? 'amber' : 'green'}>{t.labels.smoking(m.smoking)}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <span className="rounded-full bg-sakura-500 px-4 py-2 text-[11.5px] font-bold text-white">
              {c.apply}
            </span>
          </div>
        </Panel>
        <Panel tone="pink">
          <p className="whitespace-pre-line text-[11px] leading-relaxed text-sakura-700">
            {c.privacyNote}
          </p>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------ 카드 3 ------------------------------ */

function Card3() {
  const { t } = useI18n();
  const c = t.tour.c3;
  return (
    <>
      <Head tag={c.tag} line1={c.line1} line2={c.line2} sub={c.sub} />
      <div className="mt-5 space-y-2">
        <Panel>
          <div className="flex items-center justify-between">
            <Badge tone="amber">{t.requestCard.statusPending}</Badge>
            <span className="text-[10px] text-zinc-400">{c.justNow}</span>
          </div>
          <p className="mt-2 font-display text-base leading-snug text-zinc-900">“{c.intro}”</p>
          <p className="mt-1 text-[10.5px] text-zinc-500">{c.incomingLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="rounded-full bg-white py-2 text-center text-[11.5px] font-bold text-zinc-600 ring-1 ring-zinc-200">
              {t.requestCard.reject}
            </span>
            <span className="rounded-full bg-sakura-500 py-2 text-center text-[11.5px] font-bold text-white">
              {t.requestCard.accept}
            </span>
          </div>
        </Panel>

        <div className="grid place-items-center py-0.5 text-sakura-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-sakura-50 to-white p-4 shadow-card ring-1 ring-sakura-100">
          <Badge tone="pink">{t.requestCard.statusAccepted}</Badge>
          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-600">{c.matchedNote}</p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------ 카드 4 ------------------------------ */

function Card4() {
  const { t } = useI18n();
  const c = t.tour.c4;
  return (
    <>
      <Head tag={c.tag} line1={c.line1} line2={c.line2} sub={c.sub} />
      <div className="mt-5 space-y-2.5">
        <Panel>
          <StepRow n={1} title={c.s1t} desc={c.s1d} />
          <StepRow n={2} title={c.s2t} desc={c.s2d} />
          <StepRow n={3} title={c.s3t} desc={c.s3d} last />
        </Panel>
        <Panel tone="pink">
          <div className="flex items-start gap-2">
            <Lock size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-sakura-600" />
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-sakura-700">
              {c.privacyNote}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------ 카드 5 ------------------------------ */

function Card5() {
  const { t } = useI18n();
  const c = t.tour.c5;
  const items = [
    { Icon: IdCard, title: c.i1t, desc: c.i1d },
    { Icon: Lock, title: c.i2t, desc: c.i2d },
    { Icon: ShieldAlert, title: c.i3t, desc: c.i3d },
  ];
  return (
    <>
      <Head tag={c.tag} line1={c.line1} line2={c.line2} sub={c.sub} />
      <div className="mt-5">
        <Panel>
          {items.map(({ Icon, title, desc }, i) => (
            <div
              key={title}
              className={`flex items-start gap-2.5 py-3 ${i === 0 ? '' : 'border-t border-zinc-100'}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sakura-50 text-sakura-600">
                <Icon size={15} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[12.5px] font-bold text-zinc-800">{title}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-zinc-500">{desc}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------ 카드 6 ------------------------------ */

function Card6() {
  const { t } = useI18n();
  const c = t.tour.c6;
  return (
    <>
      <Head tag={c.tag} line1={c.line1} line2={c.line2} sub={c.sub} />
      <div className="mt-5 space-y-2.5">
        <Panel>
          <StepRow n={1} title={c.s1t} desc={c.s1d} />
          <StepRow n={2} title={c.s2t} desc={c.s2d} />
          <StepRow n={3} title={c.s3t} desc={c.s3d} dashed />
          <StepRow n={4} title={c.s4t} desc={c.s4d} last />
        </Panel>

        {/* 승인 대기 중에도 둘러볼 수 있다는 안내 — 하루 대기의 체감을 줄입니다 */}
        <Panel tone="pink">
          <div className="flex items-start gap-2">
            <Eye size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-sakura-600" />
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-sakura-700">
              {c.browseNote}
            </p>
          </div>
        </Panel>

        <Panel tone="sky">
          <div className="flex items-start gap-2">
            <Check size={15} strokeWidth={2.2} className="mt-0.5 shrink-0 text-sky-600" />
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-sky-800">
              {c.teamLaterNote}
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
