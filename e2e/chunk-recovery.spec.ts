import { test, expect } from '@playwright/test';

test('a stale route chunk reloads once and retains browser data', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {localStorage.setItem('recovery-draft', 'keep me'); sessionStorage.setItem('recovery-preference', 'keep me too');});
  let failed = false;
  await page.route('**/assets/InstallGuidePage-*.js', async route => {
    if (!failed) { failed = true; await route.fulfill({ status: 200, contentType: 'text/html', headers: { 'cache-control': 'no-store' }, body: '<!doctype html><title>Old fallback</title>' }); }
    else await route.continue();
  });
  await page.goto('/install');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('한 번에 열립니다.');
  expect(failed).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('recovery-draft'))).toBe('keep me');
  expect(await page.evaluate(() => sessionStorage.getItem('recovery-preference'))).toBe('keep me too');
  expect(await page.evaluate(() => sessionStorage.getItem('cc-chunk-reload-at'))).toBeTruthy();
});

test('persistent chunk failure shows a retry screen without a reload loop or developer details', async ({ page }) => {
  let navigations = 0;
  page.on('request', request => {if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;});
  await page.route('**/assets/InstallGuidePage-*.js', route => route.fulfill({status:404, contentType:'text/plain', body:'missing'}));
  await page.goto('/install');
  await expect(page.getByRole('heading', {name:'화면을 불러오지 못했어요'})).toBeVisible();
  await expect(page.getByRole('button', {name:'다시 불러오기'})).toBeVisible();
  await expect(page.getByText('Unexpected Application Error!', {exact:true})).toHaveCount(0);
  expect(navigations).toBe(2);
});
