# Android installation and shortcut branding — 2026-11-15

## Finding
The production manifest and six PNG icons returned HTTP 200 with correct types and dimensions. In a fresh Chrome session, the existing worker cached only the HTML shell before installation. Going offline made the manifest and unvisited maskable icon requests fail. This is consistent with the user's screenshots showing Chrome's Offline page, but does not prove the cause of the individual handset's gray V shortcut. Chrome downloaded pages can also have different installation behavior from the live origin.

## Change
- Use Chrome's current “설치 및 바로가기 만들기” menu name in all four languages, retaining older labels as a version-dependent fallback. Explain install vs shortcut, offline saved pages, removing/recreating stale icons, and the normal Chrome badge.
- Keep the existing flower brand, PNG dimensions, manifest start URL and scope. Version manifest/icon references, add the 512px HTML icon and preload 192px. Export the existing opaque flower artwork at 180px for Apple Touch Icon.
- Precache the manifest and all logo sizes in an independent branding cache, with validated content types and network-first updates. Individual download failures do not prevent worker installation. Preserve current app resources and unrelated caches.
- Fix the existing static-resource cache race: clone and finish cache writes before returning the response; keep background updates alive with waitUntil. This was exposed by an offline reload test.
- No database, authorization, member-data, billing, or matching changes.

## Verification
- Typecheck, 105 unit tests and Vite build pass.
- Existing 43 browser regression scenarios passed with synthetic/mocked backend data (signup, verification, teams, profile photos, acquaintance avoidance, matching UI, admin and advertising).
- Two new Android-emulated Chrome checks pass: current menu and iOS instructions; valid manifest/start URL/scope; all linked icons decode at expected sizes offline, opaque maskable/Apple images; offline install guide reload without a page error.
- Real Samsung launcher installation cannot be exercised from desktop emulation. Final handset confirmation needs a fresh online tab and a newly created shortcut. Existing OS shortcut artwork is not forcibly replaceable by website JavaScript.

## Recovery and rollback
Remove the old gray shortcut only (do not clear account/browser storage), open the live URL in a new Chrome tab with an internet connection, and use Install and create shortcut. Check the flower icon before confirming.
Revert this commit to restore the prior guide and worker. The application shell cache and original unversioned icon URLs remain compatible. No database rollback is needed.

## References
- https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid
- https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid
- https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest
