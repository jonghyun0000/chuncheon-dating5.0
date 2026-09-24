import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';

export const SITE = 'https://chuncheon-dating5-0.vercel.app';
export const PROJECT = 'https://slddnhyvstfvobxxcazt.supabase.co';
const PROJECT_REF = 'slddnhyvstfvobxxcazt';
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_ORIGINS = new Set([SITE, PROJECT, 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
const STATS_PATH = '/rest/v1/rpc/get_home_stats';
const JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const safeMessage = (value) => String(value).replace(JWT, '[redacted key]').replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[redacted key]').slice(0, 2000);

/** No auth, storage, unknown RPC, arbitrary origin, or write can leave the browser. */
export function browserRequestAllowed(method, rawUrl, body = null) {
  const url = new URL(rawUrl);
  if (!PUBLIC_ORIGINS.has(url.origin)) return false;
  if (url.origin === PROJECT) {
    if (url.pathname !== STATS_PATH) return false;
    if (READ_METHODS.has(method)) return true;
    if (method !== 'POST') return false;
    try {
      const data = JSON.parse(body ?? '{}');
      return data !== null && !Array.isArray(data) && typeof data === 'object' && Object.keys(data).length === 0;
    } catch { return false; }
  }
  return READ_METHODS.has(method);
}

export function extractPublicConfiguration(source) {
  assert.ok(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(source), 'A secret API key appears in a public asset');
  const projects = new Set(source.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/g) ?? []);
  assert.deepEqual([...projects], [PROJECT], 'Public assets must use only the expected Supabase project');
  const anonKeys = new Set();
  for (const key of source.match(JWT) ?? []) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { continue; }
    assert.notEqual(payload.role, 'service_role', 'A privileged key appears in a public asset');
    if (payload.role === 'anon' && (!payload.ref || payload.ref === PROJECT_REF)) anonKeys.add(key);
  }
  const publishableKeys = new Set(source.match(/sb_publishable_[A-Za-z0-9_-]{10,}/g) ?? []);
  const keys = publishableKeys.size ? publishableKeys : anonKeys;
  assert.equal(keys.size, 1, 'Expected exactly one public Supabase key in initial assets');
  const key = [...keys][0];
  return { project: PROJECT, headers: { apikey: key, ...(publishableKeys.size ? {} : { Authorization: `Bearer ${key}` }) } };
}

async function read(url, options = {}) {
  assert.ok([SITE, PROJECT].includes(new URL(url).origin), 'Node reads are restricted to the fixed site and project');
  assert.ok(['GET', 'HEAD'].includes(options.method ?? 'GET'), 'Node smoke checks cannot issue writes');
  return fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000), ...options });
}

function releaseUrl(path, commit) {
  const url = new URL(path, SITE);
  url.searchParams.set('__smoke_commit', commit);
  return url;
}

async function readMarker(expected, timeout = 15000) {
  const url = releaseUrl('/build-info.json', expected);
  url.searchParams.set('_', String(Date.now()));
  const response = await read(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(timeout) });
  if (response.status !== 200) throw new Error(`Build marker returned HTTP ${response.status}`);
  const marker = await response.json();
  assert.ok(typeof marker.commit === 'string' && /^[a-f0-9]{40}$/.test(marker.commit), 'Build marker has no full release commit');
  assert.ok(Number.isFinite(Date.parse(marker.builtAt)), 'Build marker has no valid build timestamp');
  return marker;
}

async function waitForRelease(expected) {
  const deadline = Date.now() + 180000;
  let detail = 'not available';
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const marker = await readMarker(expected, Math.max(1, Math.min(15000, deadline - Date.now())));
      if (marker.commit === expected) return marker;
      detail = `alias still serves ${marker.commit}`;
    } catch (error) { detail = safeMessage(error.message); }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    console.log(`Waiting for the expected production release (attempt ${attempt}; ${detail}).`);
    await sleep(Math.min(10000, remaining));
  }
  throw new Error(`Expected commit did not reach the fixed production alias within 3 minutes: ${detail}`);
}

function verifyHeaders(response) {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy is required');
  const directives = new Map(csp.split(';').map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
  for (const name of ['default-src', 'script-src', 'base-uri', 'form-action']) assert.deepEqual(directives.get(name), ["'self'"], `${name} must remain restricted`);
  for (const name of ['frame-ancestors', 'object-src']) assert.deepEqual(directives.get(name), ["'none'"], `${name} must remain blocked`);
}

async function initialAssets(html) {
  const queue = [];
  const sources = [];
  const visited = new Set();
  const add = (path, base = SITE) => {
    const url = new URL(path, base);
    assert.equal(url.origin, SITE, 'Initial JavaScript must be hosted on the fixed production site');
    assert.match(url.pathname, /^\/assets\/[A-Za-z0-9_.-]+\.js$/, 'Unexpected initial JavaScript path');
    if (!visited.has(url.href) && !queue.includes(url.href)) queue.push(url.href);
  };
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/g) ?? []) {
    if (!/\b(?:type="module"|rel="modulepreload")/.test(tag)) continue;
    const path = tag.match(/\b(?:src|href)="([^"]+)"/)?.[1];
    if (path) add(path);
  }
  assert.ok(queue.length, 'No initial JavaScript assets found');
  let totalBytes = 0;
  while (queue.length) {
    assert.ok(visited.size < 32, 'Unexpectedly many initial JavaScript assets');
    const url = queue.shift();
    visited.add(url);
    const response = await read(url);
    assert.equal(response.status, 200, 'Initial JavaScript failed to load');
    const source = await response.text();
    totalBytes += Buffer.byteLength(source);
    assert.ok(totalBytes <= 8 * 1024 * 1024, 'Initial JavaScript exceeds the smoke inspection limit');
    sources.push(source);
    // Follow static imports only; lazy routes and language chunks are exercised in the browser.
    for (const match of source.matchAll(/\b(?:import|export)\s*(?:[^;()]{0,500}?\bfrom\s*)?["']([^"']+\.js)["']/g)) add(match[1], url);
  }
  return { source: sources.join('\n'), count: visited.size };
}

async function anonymousChecks(headers) {
  const response = await read(`${PROJECT}${STATS_PATH}`, { headers });
  assert.equal(response.status, 200, 'Public aggregate statistics must remain available');
  const stats = await response.json();
  for (const field of ['total_teams', 'matched_count', 'total_users']) assert.ok(Number.isInteger(stats[field]) && stats[field] >= 0, `Invalid public statistic: ${field}`);
  const profiles = await read(`${PROJECT}/rest/v1/profiles?select=id&limit=1`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } });
  const profileDenied = [401, 403].includes(profiles.status);
  assert.ok(profileDenied || (profiles.status === 200 && profiles.headers.get('content-range')?.endsWith('/0')), 'Anonymous profiles must be denied or expose zero rows');
  const roster = await read(`${PROJECT}/rest/v1/team_members_public?select=id&limit=1`, { method: 'HEAD', headers });
  assert.ok([401, 403].includes(roster.status), 'Anonymous roster access must be denied');
  const home = await read(`${PROJECT}/rest/v1/rpc/get_home_teams`, { headers });
  assert.ok([401, 403].includes(home.status), 'Anonymous private home RPC must be denied');
  return { stats, profiles: profileDenied ? 'denied' : 'zero rows', rosterStatus: roster.status, homeStatus: home.status };
}

export async function runProductionSmoke() {
  const reportDir = resolve(process.env.CC_VALIDATION_REPORT_DIR || 'test-results/production-smoke');
  await mkdir(reportDir, { recursive: true });
  const report = { passed: false, startedAt: new Date().toISOString(), url: SITE, expectedCommit: /^[a-f0-9]{40}$/.test(process.env.EXPECTED_COMMIT ?? '') ? process.env.EXPECTED_COMMIT : null, checks: {} };
  let browser;
  try {
    const expected = process.env.EXPECTED_COMMIT;
    assert.ok(expected && /^[a-f0-9]{40}$/.test(expected), 'EXPECTED_COMMIT must be the exact 40-character trusted main SHA before any network request');
    report.build = await waitForRelease(expected);
    const documentResponse = await read(releaseUrl('/', expected), { headers: { 'Cache-Control': 'no-cache' } });
    assert.equal(documentResponse.status, 200, 'Production document must return HTTP 200');
    verifyHeaders(documentResponse);
    report.checks.securityHeaders = true;
    const assets = await initialAssets(await documentResponse.text());
    const { headers } = extractPublicConfiguration(assets.source);
    report.checks.publicConfiguration = { project: PROJECT, initialAssetCount: assets.count };
    report.checks.anonymous = await anonymousChecks(headers);

    browser = await chromium.launch({ headless: true, ...(process.env.CI ? {} : { channel: 'chrome' }) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: false });
    const blocked = [];
    const pageErrors = [];
    const cspErrors = [];
    report.checks.browser = { blockedRequests: blocked, pageErrors, cspErrors };
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (browserRequestAllowed(request.method(), request.url(), request.postData())) return route.continue();
      const url = new URL(request.url());
      blocked.push({ method: request.method(), origin: url.origin, path: url.pathname });
      return route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', (socket) => {
      blocked.push({ method: 'WEBSOCKET', origin: new URL(socket.url()).origin, path: new URL(socket.url()).pathname });
      socket.close();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', (error) => pageErrors.push(safeMessage(error.message)));
    page.on('console', (message) => {
      if (message.type() === 'error' && /content security policy|violat.*directive|refused to .*because/i.test(message.text())) cspErrors.push(safeMessage(message.text()));
    });
    const goto = async (path) => {
      const response = await page.goto(releaseUrl(path, expected).href, { waitUntil: 'domcontentloaded' });
      assert.equal(response?.status(), 200, `Public route ${path} failed`);
    };
    await goto('/');
    await expect(page.getByRole('link', { name: '지금 시작하기', exact: true })).toBeVisible();
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 5000))]));
    const cta = await page.getByRole('link', { name: '지금 시작하기', exact: true }).boundingBox();
    assert.ok(cta && cta.y >= 0 && cta.y + cta.height <= 844, 'Mobile registration CTA must be above the fold');
    assert.ok(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), 'Mobile landing page overflows horizontally');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:[.,\s]|$)/i.test(viewport ?? ''), 'Mobile zoom must remain enabled');
    await page.screenshot({ path: join(reportDir, 'production-mobile.png'), fullPage: true });
    report.checks.mobile = { ctaAboveFold: true, horizontalOverflow: false, zoomEnabled: true };

    const languages = [
      ['English', 'en', 'Get started'], ['中文', 'zh-CN', '立即开始'],
      ['日本語', 'ja', '今すぐ始める'], ['한국어', 'ko', '지금 시작하기'],
    ];
    for (const [label, lang, ctaLabel] of languages) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('link', { name: ctaLabel, exact: true })).toBeVisible();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('link', { name: ctaLabel, exact: true })).toBeVisible();
    }
    report.checks.languages = languages.map(([, lang]) => lang);
    await page.getByRole('link', { name: '1분 둘러보기', exact: true }).click();
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeVisible();
    const routes = ['/login', '/register', '/find-username', '/reset-password-request', '/privacy', '/terms-of-service', '/disclaimer', '/account-deletion', '/install'];
    for (const path of routes) {
      await goto(path);
      if (path === '/login' || path === '/register') await expect(page.getByLabel('아이디', { exact: true })).toBeVisible();
      else await expect(page.locator('h1').first()).toBeVisible();
    }
    report.checks.publicRoutes = ['/tour', ...routes];
    await goto('/admin/users');
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    assert.equal(new URL(page.url()).pathname, '/login', 'Unauthenticated admin route must redirect to login');
    report.checks.adminRedirect = '/login';
    await page.setViewportSize({ width: 1440, height: 900 });
    await goto('/');
    await expect(page.getByRole('link', { name: '지금 시작하기', exact: true })).toBeVisible();
    await page.screenshot({ path: join(reportDir, 'production-desktop.png'), fullPage: true });
    assert.deepEqual(blocked, [], 'A public route attempted a disallowed request; it was blocked before reaching production');
    assert.deepEqual(pageErrors, [], 'The live browser reported uncaught errors');
    assert.deepEqual(cspErrors, [], 'The live browser reported CSP violations');
    assert.equal((await readMarker(expected)).commit, expected, 'Production changed during verification; this result cannot certify the expected release');
    report.passed = true;
  } catch (error) {
    report.error = safeMessage(error?.message ?? error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    report.finishedAt = new Date().toISOString();
    await writeFile(join(reportDir, 'production-smoke.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, expectedCommit: report.expectedCommit, report: join(reportDir, 'production-smoke.json'), ...(report.error ? { error: report.error } : {}) }));
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runProductionSmoke();
