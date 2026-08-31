import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Smartphone, X } from 'lucide-react';
import { detectPlatform, isStandalone } from '@/features/install/usePwaInstall';
import { useI18n } from '@/i18n';

const DISMISS_KEY = 'cg_install_dismissed';

/**
 * 홈 화면 추가 안내 배너.
 * 한 번 닫으면 다시 뜨지 않습니다. 이미 홈 화면에서 실행 중이거나
 * PC 로 보고 있으면 처음부터 뜨지 않습니다.
 */
export default function InstallBanner() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (detectPlatform() === 'desktop') return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // 저장소를 못 쓰는 환경이면 그냥 보여줍니다
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* 무시 */ }
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sakura-50 to-white px-4 py-3 ring-1 ring-sakura-100">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sakura-500 shadow-soft">
        <Smartphone size={17} strokeWidth={1.9} />
      </span>
      <Link to="/install" className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-800">{t.install.bannerTitle}</p>
        <p className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium text-sakura-600">
          {t.install.bannerAction}
          <ChevronRight size={13} strokeWidth={2.4} />
        </p>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.install.bannerClose}
        className="shrink-0 rounded-full p-1.5 text-zinc-400 transition hover:bg-white hover:text-zinc-600"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
