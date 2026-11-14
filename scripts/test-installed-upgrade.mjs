import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, appendFile, symlink, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices, expect } from '@playwright/test';
import { account, fixtureResponse, scenarios } from './fixtures/installed-app.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = process.argv[2] || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'Use chromium or webkit');
const reportDir = resolve(process.env.CC_UPGRADE_REPORT_DIR || join(root, 'test-results/installed-app-upgrade', engine));
await mkdir(reportDir, {recursive:true});
await writeFile(join(reportDir, 'build.log'), '');
const scratch = await mkdtemp(join(tmpdir(), 'cc-installed-upgrade-'));
const oldSource = join(scratch, 'base');
const oldDist = join(oldSource, 'dist');
const newDist = join(scratch, 'candidate');
const report = { engine, passed: false, scenarios: [], limitations: ['Browser-engine and standalone emulation; not native iPhone/Android launcher installation.'] };
let serving = oldDist;
let fixture = account('user');
let missing = [];
let apiWrites = [];
let browser;
let activeContext;

function json(response, status, value) {
  response.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
  response.end(status === 204 ? '' : JSON.stringify(value));
}
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (/\/(auth|rest|storage)\/v1\//.test(path)) {
      const reply = fixtureResponse(path, request.method, fixture);
      if (reply.status === 405) apiWrites.push(path);
      json(response, reply.status, reply.data); return;
    }
    const file = resolve(serving, '.' + path);
    if (file !== serving && !file.startsWith(serving + '/')) { response.writeHead(400); response.end(); return; }
    let body;
    let type = ({'.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json', '.json':'application/json', '.svg':'image/svg+xml'})[extname(path)] || 'text/html';
    try { body = await readFile(file); }
    catch {
      if (path.startsWith('/assets/')) {
        missing.push(path);
        response.writeHead(404, {'Content-Type':'text/plain', 'Cache-Control':'no-store'}); response.end('Missing previous-release asset'); return;
      }
      body = await readFile(join(serving, 'index.html')); type = 'text/html';
    }
    response.writeHead(200, {'Content-Type':type, 'Cache-Control':'no-cache'}); response.end(body);
  } catch { response.writeHead(500); response.end('Fixture server failed'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function command(name, args, cwd, env = process.env) {
  const {stdout, stderr} = await exec(name, args, {cwd, env, maxBuffer:10 * 1024 * 1024, timeout:300000});
  await appendFile(join(reportDir, 'build.log'), stdout + stderr);
}
async function bounded(promise, label, ms = 30000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);})]); }
  finally {clearTimeout(timer);}
}
async function checkScreen(page, check) {
  if (check === 'team') await expect(page.getByLabel('팀 한줄소개', {exact:true})).toBeVisible();
  if (check === 'match') await expect(page.getByText('매칭 정보를 찾을 수 없어요', {exact:true})).toBeVisible();
  if (check === 'reports') await expect(page.getByRole('heading', {name:'신고', exact:true})).toBeVisible();
  if (check === 'reviews') await expect(page.getByRole('heading', {name:'후기관리', exact:true})).toBeVisible();
  await expect(page.getByText('Unexpected Application Error!', {exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'화면을 불러오지 못했어요'})).toHaveCount(0);
}
try {
  // PRs compare their actual base commit; pushes compare the previous main commit.
  // Local runs default to HEAD. Only a resolved commit is passed to git archive.
  const baseInput = process.env.CC_UPGRADE_BASE_REF || 'HEAD';
  assert.match(baseInput, /^(HEAD|[a-f0-9]{40})$/);
  const base = (await exec('git', ['rev-parse', '--verify', `${baseInput}^{commit}`], {cwd:root})).stdout.trim();
  assert.match(base, /^[a-f0-9]{40}$/); report.baseCommit = base;
  await mkdir(oldSource);
  await command('git', ['archive', '--format=tar', '--output=' + join(scratch,'base.tar'), base], root);
  await command('tar', ['-xf',join(scratch,'base.tar'),'-C',oldSource], root);
  // Reuse dependencies only if the complete lockfiles match. Otherwise install
  // the real previous dependency tree, without repository credentials or secrets.
  if ((await readFile(join(oldSource,'package-lock.json'))).equals(await readFile(join(root,'package-lock.json')))) {
    await symlink(await realpath(join(root,'node_modules')), join(oldSource,'node_modules'), 'dir');
  } else await command('npm', ['ci','--no-audit','--no-fund'], oldSource);
  // Guarantee different hashed chunks even for a documentation-only release.
  // This modifies only the temporary previous build, never application sources.
  const entry = join(oldSource,'src/main.tsx');
  await writeFile(entry, `document.documentElement.setAttribute('data-upgrade-fixture', 'previous');\n` + await readFile(entry,'utf8'));
  await appendFile(join(oldSource,'public/sw.js'), '\n// Isolated previous-release worker fixture.\n');
  const env = {...process.env, VITE_SUPABASE_URL:origin, VITE_SUPABASE_ANON_KEY:'test-only-key', VERCEL_GIT_COMMIT_SHA:base};
  await command(process.execPath, [join(oldSource,'node_modules/vite/bin/vite.js'),'build'], oldSource, env);
  await command(process.execPath, [join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',newDist], root, {...env, VERCEL_GIT_COMMIT_SHA:'candidate-upgrade-test'});
  const beforeManifest = JSON.parse(await readFile(join(oldDist,'manifest.webmanifest'),'utf8'));
  const afterManifest = JSON.parse(await readFile(join(newDist,'manifest.webmanifest'),'utf8'));
  for (const key of ['name','start_url','scope','display']) assert.equal(afterManifest[key], beforeManifest[key], `Installed app identity changed: ${key}`);
  assert.equal(afterManifest.id ?? afterManifest.start_url, beforeManifest.id ?? beforeManifest.start_url, 'Installed app id changed');
  const routing = JSON.parse(await readFile(join(root,'vercel.json'),'utf8'));
  for (const rewrite of routing.rewrites || []) {
    if (rewrite.destination === '/' || rewrite.destination === '/index.html') {
      assert.equal(new RegExp('^' + rewrite.source + '$').test('/assets/missing.js'), false, 'SPA rewrite must exclude missing JS');
      assert.equal(new RegExp('^' + rewrite.source + '$').test('/admin/reports'), true, 'Admin navigation must retain the SPA fallback');
    }
  }
  browser = await ({chromium,webkit}[engine]).launch(engine === 'chromium' && !process.env.CI ? {channel:'chrome'} : {});
  report.browserVersion = browser.version();
  for (const scenario of scenarios) {
    serving = oldDist; fixture = account(scenario.role); missing = []; apiWrites = [];
    const context = activeContext = await browser.newContext({
      ...(engine === 'webkit' ? devices['iPhone 13'] : devices['Pixel 5']), serviceWorkers:'allow',
      storageState:{cookies:[],origins:[{origin,localStorage:[{name:'cc-gating-auth',value:JSON.stringify(fixture.session)}]}]},
    });
    context.setDefaultTimeout(10000);
    await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', {value:true, configurable:true}));
    // No browser request, including a misconfigured app build, can use production APIs.
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    let navigations = 0;
    page.on('request', request => {if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;});
    try {
      await page.goto(origin+'/install');
      await expect(page.getByRole('heading',{name:'이미 홈 화면에 있어요'})).toBeVisible();
      await bounded(page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
      }), 'previous worker activation');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-upgrade-fixture','previous');
      await page.evaluate(async () => {
        localStorage.setItem('upgrade-draft','preserve-local'); sessionStorage.setItem('upgrade-tab','preserve-tab');
        const db = await new Promise((resolve,reject) => {const r=indexedDB.open('upgrade-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('values');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        await new Promise((resolve,reject)=>{const tx=db.transaction('values','readwrite');tx.objectStore('values').put('preserve-idb','marker');tx.oncomplete=resolve;tx.onerror=reject;});db.close();
        const cache=await caches.open('ccg-v1');
        await cache.put('/assets/valid-old-fixture.js',new Response('export const retained = true',{headers:{'Content-Type':'text/javascript'}}));
        await cache.put('/assets/poisoned-fixture.js',new Response('<!doctype html>',{headers:{'Content-Type':'text/html'}}));
        await(await caches.open('unrelated-fixture')).put('/preserve',new Response('keep'));
      });
      serving = newDist;
      await bounded(page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
        await registration.update(); await changed;
        const active = registration.active;
        if (active.state !== 'activated') await new Promise((resolve, reject) => active.addEventListener('statechange', () => {
          if (active.state === 'activated') resolve();
          if (active.state === 'redundant') reject(new Error('Candidate worker became redundant'));
        }));
      }), 'candidate worker activation');
      const migrated = await page.evaluate(async () => {
        const cache=await caches.open('ccg-v1');return {valid:!!await cache.match('/assets/valid-old-fixture.js'),poisoned:!!await cache.match('/assets/poisoned-fixture.js'),unrelated:!!await(await caches.open('unrelated-fixture')).match('/preserve')};
      });
      assert.deepEqual(migrated,{valid:true,poisoned:false,unrelated:true});
      const beforeNavigation = navigations;
      await page.evaluate(path => {history.pushState(null,'',path);dispatchEvent(new PopStateEvent('popstate'));}, scenario.path);
      await checkScreen(page, scenario.check);
      await expect(page.locator('html')).not.toHaveAttribute('data-upgrade-fixture','previous');
      assert.ok(missing.length > 0, 'Test must encounter missing previous-release chunks');
      assert.equal(navigations - beforeNavigation, 1, 'Exactly one recovery navigation, no reload loop');
      const retained = await page.evaluate(async () => {
        const session=JSON.parse(localStorage.getItem('cc-gating-auth'));
        const db=await new Promise(resolve=>{const r=indexedDB.open('upgrade-fixture');r.onsuccess=()=>resolve(r.result);});
        const idb=await new Promise(resolve=>{const r=db.transaction('values').objectStore('values').get('marker');r.onsuccess=()=>resolve(r.result);});db.close();
        return {user:session.user.id,access:session.access_token,refresh:session.refresh_token,draft:localStorage.getItem('upgrade-draft'),tab:sessionStorage.getItem('upgrade-tab'),idb};
      });
      assert.equal(retained.user,fixture.user.id);assert.equal(retained.access,fixture.session.access_token);assert.equal(retained.refresh,fixture.session.refresh_token);
      assert.equal(retained.draft,'preserve-local');assert.equal(retained.tab,'preserve-tab');assert.equal(retained.idb,'preserve-idb');
      // Reopen the same installed URL using the updated worker and verify again.
      await page.reload(); await checkScreen(page,scenario.check);
      const icon = await page.evaluate(async () => {
        const url=document.querySelector('link[rel="apple-touch-icon"]').href;
        const response=await fetch(url);const image=new Image();image.src=URL.createObjectURL(await response.blob());await image.decode();URL.revokeObjectURL(image.src);
        return {status:response.status,type:response.headers.get('content-type'),width:image.naturalWidth,height:image.naturalHeight};
      });
      assert.deepEqual(icon,{status:200,type:'image/png',width:180,height:180});
      if (scenario.role === 'user') {
        await page.goto(origin+'/admin/reports');
        await expect(page.getByText('관리자만 접근할 수 있는 페이지입니다.',{exact:true})).toBeVisible();
        await expect(page.getByRole('heading',{name:'신고',exact:true})).toHaveCount(0);
      }
      await page.goto(origin+'/');await expect(page.getByText('가상 상대 팀',{exact:false})).toBeVisible();
      // The candidate must retain its own recovery listener for the next release.
      // Expire only the fixture's recovery timer; never clear account storage.
      const beforeCandidateRecovery = navigations;
      await page.evaluate(() => sessionStorage.setItem('cc-chunk-reload-at', String(Date.now() - 300001)));
      await Promise.all([
        page.waitForNavigation({waitUntil:'load'}),
        page.evaluate(() => dispatchEvent(new Event('vite:preloadError'))),
      ]);
      await expect(page.getByText('가상 상대 팀',{exact:false})).toBeVisible();
      assert.equal(navigations - beforeCandidateRecovery, 1, 'Candidate must retain its recovery listener');
      await page.evaluate(() => dispatchEvent(new Event('vite:preloadError')));
      await page.waitForTimeout(500);
      assert.equal(navigations - beforeCandidateRecovery, 1, 'A repeated failure must not cause a reload loop');
      assert.deepEqual(apiWrites,[], 'The fixture must never accept account/team/advertising mutations');
      report.scenarios.push({name:scenario.name,role:scenario.role,passed:true,missingChunks:missing.length,automaticReloads:1,sessionPreserved:true,storagePreserved:true,cacheMigration:true,reopen:true,icon:true,candidateRecovery:true,reloadLoopBlocked:true,memberAdminBlocked:scenario.role==='user'});
      console.log(`PASS ${engine}: ${scenario.name}`);
    } catch (error) {
      await page.screenshot({path:join(reportDir,scenario.name+'.png'),fullPage:true}).catch(()=>{});
      report.scenarios.push({name:scenario.name,role:scenario.role,passed:false,error:String(error.message)});
      throw error;
    } finally {await context.close();activeContext=null;}
  }
  report.passed=true;
} catch (error) {
  report.error=String(error.message);process.exitCode=1;console.error(report.error);
} finally {
  if(activeContext) await activeContext.close().catch(()=>{});
  if(browser) await browser.close();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await writeFile(join(reportDir,'report.json'),JSON.stringify(report,null,2));
  await rm(scratch,{recursive:true,force:true});
  console.log(`Installed-app upgrade report: ${reportDir}/report.json`);
}
