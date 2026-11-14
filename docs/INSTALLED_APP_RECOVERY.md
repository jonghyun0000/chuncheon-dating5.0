# Installed app / iPhone recovery — 2026-11-15

## Confirmed incident
The three asset URLs in the user's screenshots returned HTTP 200 with `text/html` on production. The catch-all SPA rewrite served index.html for deleted deployment chunks. An older open tab/home-screen app still imported those chunk names. The old worker also accepted any status-200 response into the asset cache, so the HTML could persist under a JavaScript URL. React Router caught the error before the outer React boundary and displayed its default developer error screen.

This is a deployment/cache issue, not an administrator authorization rejection. It can affect any lazy route. Initial online brand/route checks did not exercise the old-to-new deployment transition; they were insufficient to rule this out.

## Fix
- Exclude `/assets/` from the SPA rewrite; missing static files return 404. Revalidate HTML instead of retaining an old entry point.
- Validate JavaScript/CSS MIME types before serving/storing them in the worker. On activation remove only invalid asset entries. Preserve normal cached older chunks, the app shell, unrelated caches, localStorage, sessionStorage and IndexedDB.
- Handle Vite preload errors with one automatic reload per five minutes, only online and when a persistent session guard can be saved. Never clear authentication storage. Continued failures get a localized route error boundary with a retry button and close/reopen guidance instead of the developer screen.
- App start URL/scope, Apple Touch Icon, backend, permissions and member records remain unchanged.

## Evidence
- 112 unit tests and typecheck/build passed, including poisoned-cache migration and bounded recovery.
- Chromium: 50 browser cases passed, including the 3 named administrator/matching routes with injected stale chunks; CI verifies the full run before release.
- WebKit 26 with iPhone viewport: production Apple Touch Icon is HTTP 200 image/png, 180×180, fully opaque; current and legacy icon URLs work, iPhone guide is selected, simulated standalone mode detected.
- WebKit actual old/new builds served sequentially on the same origin: old chunk requests fail, reload opens the new install guide and all three reported admin/match pages. Synthetic admin session remains intact. See JSON evidence under docs/validation/installed-app-recovery.
- Actual old service worker updated in place: synthetic auth/draft/tab/IndexedDB markers and valid older files survive; a poisoned JS cache entry is removed; a further missing module is not cached; the updated app reopens online.

## Limits and user recovery
No physical iPhone SpringBoard or native Add to Home Screen sheet was controlled. The tests cover WebKit and website responses; they do not prove automatic iOS launcher-icon replacement. Already-installed users need not delete their app or site data. If an old error screen remains open, fully close and reopen the app online (or reload in Safari) to load the fix. Existing pre-fix JavaScript cannot gain a new error handler without loading the new entry point.

WebKit may retain a failed module for the same unchanged URL within its process, even after a reload. A repeated same-build transient-MIME injection therefore recovered only to the safe retry screen in WebKit; the actual deployment test with changed hashes recovered successfully. If failure persists, close/reopen rather than repeatedly reload. An offline navigation automation check hit a WebKit internal error; online migration and offline icon access are separately covered, not a physical-device offline-use guarantee.

## Sources
- https://vite.dev/guide/build#load-error-handling
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
