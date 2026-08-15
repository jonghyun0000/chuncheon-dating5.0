/* 춘천과팅 서비스 워커 — 매우 보수적(네트워크 우선) 정책
 *
 * 목적
 *  - PWA 설치 가능 조건을 충족(플레이스토어 TWA/PWABuilder용).
 *  - 오프라인일 때 마지막으로 본 화면 정도만 보여줌.
 *
 * 안전 원칙 (운영 중인 웹앱을 깨뜨리지 않기 위함)
 *  - HTML(내비게이션)은 항상 네트워크 먼저 → 최신 코드가 늘 우선.
 *    오래된 JS를 캐시로 잘못 내려서 흰 화면이 뜨는 사고를 막는다.
 *  - 파일명에 해시가 붙는 정적 자원(/assets/*)만 캐시-우선.
 *  - Supabase API, 폰트 CDN 등 외부(cross-origin) 요청은 절대 건드리지 않음.
 *  - 버전(CACHE)을 올리면 이전 캐시는 전부 삭제된다.
 */

const CACHE = 'ccg-v1';
const OFFLINE_INDEX = '/index.html';

self.addEventListener('install', (event) => {
  // 새 워커를 즉시 활성화 (대기하지 않음)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_INDEX)).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 이전 버전 캐시 정리
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
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
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE).then((c) => c.put(req, res.clone()));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
  // 그 외 요청은 관여하지 않음 (기본 네트워크 동작)
});
