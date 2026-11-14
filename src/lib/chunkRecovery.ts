const RELOAD_KEY = 'cc-chunk-reload-at';
const RETRY_WINDOW = 5 * 60 * 1000;

/** Recover a stale deployment once, without clearing authentication or form storage.
 * Offline failures and unavailable storage stay on the route's manual retry UI.
 * Keep the timestamp across reloads so a persistent failure cannot reload forever.
 */
export function recoverChunkLoad({
  online = navigator.onLine,
  now = Date.now(),
  storage = () => window.sessionStorage,
  reload = () => window.location.reload(),
}: {
  online?: boolean;
  now?: number;
  storage?: () => Pick<Storage, 'getItem' | 'setItem'>;
  reload?: () => void;
} = {}): boolean {
  if (!online) return false;
  try {
    const session = storage();
    const last = Number(session.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RETRY_WINDOW) return false;
    session.setItem(RELOAD_KEY, String(now));
    reload();
    return true;
  } catch {
    return false;
  }
}

export function installChunkRecovery() {
  window.addEventListener('vite:preloadError', () => {
    // Let the router show its retry screen if navigation is declined or blocked.
    recoverChunkLoad();
  });
}
