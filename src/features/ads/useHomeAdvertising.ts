import { useEffect, useState } from 'react';
import { fetchHomeAdvertising, type HomeAdvertising } from './ads.api';

const REFRESH_MS = 60_000;

export function useHomeAdvertising(memberId: string | undefined): HomeAdvertising | null {
  const [result, setResult] = useState<{ memberId: string; data: HomeAdvertising | null } | null>(null);

  useEffect(() => {
    if (!memberId) return;
    let disposed = false;
    let loading = false;
    let timer: number | undefined;

    async function refresh() {
      window.clearTimeout(timer);
      if (disposed || loading || document.visibilityState !== 'visible') return;
      loading = true;
      try {
        const data = await fetchHomeAdvertising();
        if (disposed || !memberId) return;
        setResult({ memberId, data });
        if (document.visibilityState === 'visible') {
          const expiries = (data?.banners ?? []).flatMap(banner =>
            banner.ends_at ? [Date.parse(banner.ends_at) - Date.now()] : [],
          );
          timer = window.setTimeout(refresh, Math.max(1000, Math.min(REFRESH_MS, ...expiries)));
        }
      } catch {
        if (!disposed && memberId) setResult({ memberId, data: null });
      } finally {
        loading = false;
      }
    }

    void refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [memberId]);

  return result?.memberId === memberId ? result?.data ?? null : null;
}
