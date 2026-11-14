/* 춘천과팅 서비스 워커 — 매우 보수적(네트워크 우선) 정책
 *
 * 목적
 *  - PWA 설치 가능 조건을 충족(플레이스토어 TWA/PWABuilder용).
 *  - 오프라인일 때 마지막으로 본 화면 정도만 보여줌.
 *
 * 안전 원칙 (운영 중인 웹앱을 깨뜨리지 않기 위함)
 *  - HTML(내비게이션)은 항상 네트워크 먼저 → 최신 코드가 늘 우선.
 *    오래된 JS를 캐시로 잘못 내려서 흰 화면이 뜨는 사고를 막는다.
 *  - 정적 자원은 캐시-우선, 설치 정보·로고는 미리 저장하고 네트워크 우선.
 *  - Supabase API, 폰트 CDN 등 외부(cross-origin) 요청은 절대 건드리지 않음.
 *  - 로고 캐시만 별도 교체해 기존 화면과 다른 캐시는 보존한다.
 */

const CACHE = 'ccg-v1';
const OFFLINE_INDEX = '/index.html';
// Keep branding independent of the app shell so an icon update cannot discard
// resources still needed by an open page. Versioned URLs also refresh browser caches.
const BRAND_CACHE = 'ccg-branding-20261115';
const BRAND_ASSETS = [
  '/manifest.webmanifest', '/favicon-32.png', '/apple-touch-icon.png',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/maskable-192.png', '/icons/maskable-512.png',
];
const BRAND_URLS = BRAND_ASSETS.flatMap((path) => [path, `${path}?v=20261115`]);

function isBrandResponse(path, response) {
  const type = response.headers.get('content-type') || '';
  return response.ok && (path.endsWith('.webmanifest')
    ? /application\/(manifest\+json|json)/i.test(type)
    : type.startsWith('image/png'));
}

self.addEventListener('install', (event) => {
  // 새 워커를 즉시 활성화 (대기하지 않음)
  self.skipWaiting();
  event.waitUntil(
    Promise.allSettled([
      caches.open(CACHE).then((c) => c.add(OFFLINE_INDEX)),
      ...BRAND_URLS.map(async (path) => {
        const response = await fetch(path, { cache: 'reload' });
        if (isBrandResponse(path.split('?')[0], response)) {
          const cache = await caches.open(BRAND_CACHE);
          await cache.put(path, response);
        }
      }),
    ])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Do not delete another application's caches or the current app shell.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('ccg-branding-') && k !== BRAND_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 같은 출처만 처리 (Supabase·폰트 등 외부는 브라우저 기본 동작에 맡김)
  if (url.origin !== self.location.origin) return;

  // Cache the manifest and every icon before the user opens the install menu.
  // Prefer fresh branding online, with a PNG/JSON fallback if the network fails.
  if (BRAND_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(BRAND_CACHE);
      try {
        const fresh = await fetch(req);
        if (isBrandResponse(url.pathname, fresh)) {
          await cache.put(req, fresh.clone()).catch(() => undefined);
          return fresh;
        }
        return (await cache.match(req)) || fresh;
      } catch {
        return (await cache.match(req)) || (await cache.match(url.pathname)) || Response.error();
      }
    })());
    return;
  }

  // 1) 페이지 이동(HTML) → 네트워크 우선, 실패 시 캐시 index 폴백
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // 마지막으로 성공한 index를 오프라인 폴백용으로 갱신
          const cache = await caches.open(CACHE);
          cache.put(OFFLINE_INDEX, fresh.clone()).catch(() => undefined);
          return fresh;
        } catch {
          const cached = await caches.match(OFFLINE_INDEX);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 2) 해시가 붙은 정적 자원(/assets/…, /icons/…) → 캐시 우선 + 백그라운드 갱신
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    const network = fetch(req).then(async (res) => {
      if (res.status === 200) {
        // Clone before handing the body to the page, and finish cache writes
        // before ending the worker event (including cached-response refreshes).
        const copy = res.clone();
        await caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
      }
      return res;
    }).catch(() => undefined);
    event.waitUntil(network.then(() => undefined));
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        return cached || (await network) || Response.error();
      })()
    );
  }
  // 그 외 요청은 관여하지 않음 (기본 네트워크 동작)
});
