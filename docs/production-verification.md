# Production verification

`scripts/smoke-production.mjs` verifies the fixed public site, `https://chuncheon-dating5-0.vercel.app`, after a release. It never deploys, signs in, registers a user, changes a record, sends a message, or runs on a schedule.

## Exact release first

`EXPECTED_COMMIT` must contain the complete, trusted 40-character `main` commit. Before any application or database inspection, the script waits for `/build-info.json` on the production alias to report that exact commit. Requests bypass cached marker responses. The wait is limited to three minutes with ten-second intervals and bounded request timeouts; an old deployment or a missing marker fails. The marker is checked again after the browser checks, so a deployment changing during the run cannot produce a passing result for the wrong release.

The production workflow runs on Vercel's successful `deployment_status` or a manual dispatch from `main`. Actual repository metadata uses case-sensitive `Production`, `vercel[bot]`, and a full SHA as the deployment ref. Vercel currently sets `production_environment: false` even for these Production records, so this boolean is deliberately not used as a filter.

Before checkout, the workflow reads the current `main` SHA from GitHub and compares it with the deployment SHA, or the dispatch SHA. Other repositories, preview/PR deployments, non-Vercel deployment events, and superseded commits are skipped. Checkout uses the verified immutable SHA with persisted credentials disabled. A second main-head check after dependency installation skips releases superseded during setup. The workflow has only `contents: read` permission; no Supabase or Vercel secret is required.

## Read-only checks

- The deployed document must have the expected CSP, anti-framing, MIME-sniffing, and referrer headers.
- Initial JavaScript is inspected as text for the fixed Supabase project and one public `anon` or publishable key. Privileged keys fail the check; keys are never written to reports or logs.
- Public aggregate statistics are read with GET. Anonymous profile access must be denied or expose zero rows; roster HEAD and the private home RPC GET must return 401/403. No private row content is retrieved.
- A new, empty browser context opens mobile/desktop landing pages and public routes, checks that the mobile CTA is visible without scrolling, verifies all four languages including reload persistence, and confirms that an unauthenticated admin visit redirects to login. It does not fill or submit login, registration, lookup, or recovery forms.
- Service workers are blocked. A network allowlist blocks all browser writes, auth/storage access, unknown RPCs, other origins, and WebSockets before they leave the browser. The only permitted POST is the existing argument-free `get_home_stats` read RPC. Any attempted disallowed request fails the check.
- Uncaught browser errors and CSP violations fail the check. Screenshots contain only public, signed-out pages.

## Run after the release is live

Use Node 22 and the repository's installed dependencies (`npm ci`). CI uses Playwright Chromium; a local run uses installed Chrome, matching the existing browser-test setup.

```sh
EXPECTED_COMMIT=<full-trusted-main-sha> \
CC_VALIDATION_REPORT_DIR=/absolute/path/to/verification-report \
node scripts/smoke-production.mjs
```

`CC_VALIDATION_REPORT_DIR` defaults to `test-results/production-smoke`. The script writes `production-smoke.json` on success or failure and captures public mobile/desktop screenshots when those stages succeed. GitHub retains the evidence artifact for 14 days. Failure exits nonzero; skipping an obsolete deployment is distinct from running a passing verification.

This smoke check confirms deployed public behavior and anonymous-access boundaries. Authenticated writes, full signup/matching flows, database concurrency, and restore recovery remain the responsibility of isolated test environments. It does not certify those flows against real user data or alter the service to test them.

References: [GitHub deployment status events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#deployment_status), [GitHub workflow security](https://docs.github.com/en/actions/reference/security/secure-use), and [Supabase RPC reads](https://supabase.com/docs/reference/javascript/rpc).
