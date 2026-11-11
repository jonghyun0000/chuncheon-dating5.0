import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import { useI18n } from '@/i18n';
import { downloadAdImage, recordAdEvent, safeAdUrl, type AdBanner } from './ads.api';

const labels = {
  ko: { ad: '광고', action: '혜택 보기' },
  en: { ad: 'Ad', action: 'See offer' },
  ja: { ad: '広告', action: '特典を見る' },
  zh: { ad: '广告', action: '查看优惠' },
};

export function AdBannerContent({ advertiser, headline, description, imageUrl }: {
  advertiser: string;
  headline: string;
  description: string;
  imageUrl?: string;
}) {
  const { lang } = useI18n();
  const copy = labels[lang];
  return (
    <>
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-sakura-50 text-sakura-600">
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <Megaphone size={24} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="shrink-0 rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-semibold text-zinc-700">{copy.ad}</span>
          <span className="truncate">{advertiser}</span>
        </span>
        <strong className="mt-1 block break-words text-sm text-zinc-900">{headline}</strong>
        {description && <span className="mt-0.5 block break-words text-xs leading-relaxed text-zinc-600">{description}</span>}
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sakura-700">
          {copy.action}<ArrowUpRight size={13} aria-hidden="true" />
        </span>
      </span>
    </>
  );
}

export const adCardClass = 'card flex w-full items-center gap-3 border border-zinc-200 bg-white p-3 text-left';

function useAdImage(path: string | null) {
  const [image, setImage] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let disposed = false;
    let url: string | undefined;
    downloadAdImage(path).then(blob => {
      if (disposed) return;
      url = URL.createObjectURL(blob);
      setImage({ path, url });
    }).catch(() => {});
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return image?.path === path ? image?.url : undefined;
}

export function AdBannerPreview({ banner }: { banner: AdBanner }) {
  const imageUrl = useAdImage(banner.image_path);
  return <div className={adCardClass}><AdBannerContent {...banner} imageUrl={imageUrl} /></div>;
}

export default function HomeAdBanner({ banner, track }: { banner: AdBanner; track: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const clickRecorded = useRef(false);
  const imageUrl = useAdImage(banner.image_path);
  const href = safeAdUrl(banner.destination_url);

  useEffect(() => {
    const element = ref.current;
    if (!track || !element || !('IntersectionObserver' in window)) return;
    let inView = false;
    let timer: number | undefined;
    let recorded = false;
    function checkVisibility() {
      window.clearTimeout(timer);
      if (recorded || !inView || document.visibilityState !== 'visible') return;
      timer = window.setTimeout(() => {
        if (!inView || document.visibilityState !== 'visible') return;
        recorded = true;
        void recordAdEvent(banner.id, false).catch(() => {});
      }, 1000);
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      checkVisibility();
    }, { threshold: [0, 0.5] });
    observer.observe(element);
    document.addEventListener('visibilitychange', checkVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', checkVisibility);
      window.clearTimeout(timer);
    };
  }, [banner.id, href, track]);

  if (!href) return null;
  function recordClick() {
    if (!track || clickRecorded.current) return;
    clickRecorded.current = true;
    void recordAdEvent(banner.id, true).then(ok => {
      if (!ok) clickRecorded.current = false;
    }).catch(() => { clickRecorded.current = false; });
  }

  return (
    <a
      ref={ref}
      data-testid="home-ad-banner"
      className={adCardClass + ' hover:border-sakura-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sakura-600'}
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={recordClick}
      onAuxClick={event => { if (event.button === 1) recordClick(); }}
    >
      <AdBannerContent {...banner} imageUrl={imageUrl} />
    </a>
  );
}
