import { useCallback, useEffect, useState } from 'react';
import { NOTIFICATION_POLL_MS } from '@/lib/constants';
import { countUnhandledNotifications } from '@/features/admin/notifications.api';

/**
 * 미처리 알림 건수를 30초마다 폴링합니다. (관리자 사이드바 배지용)
 * 관리자가 아니면 RPC 가 항상 0을 반환합니다.
 */
export function useUnhandledNotifications(enabled = true) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try { setCount(await countUnhandledNotifications()); } catch { /* Keep last confirmed count. */ }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let alive = true;

    const tick = async () => {
      try {
        const n = await countUnhandledNotifications();
        if (alive) setCount(n);
      } catch { /* Notification page shows the retryable error; never turn a failure into zero. */ }
    };

    void tick();
    const id = window.setInterval(() => void tick(), NOTIFICATION_POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { count, refresh };
}
