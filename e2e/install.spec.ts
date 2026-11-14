import { test, expect } from '@playwright/test';

test.describe('Android install guide and offline branding', () => {
  test.use({
    serviceWorkers: 'allow',
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
    viewport: { width: 360, height: 780 },
    isMobile: true,
  });

  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test.beforeEach(async ({ context }) => {
    // Installation checks never use member data or write to the backend.
    await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:5181'
      ? route.continue() : route.abort());
  });

  test('uses the current Chrome menu and preserves the iPhone instructions', async ({ page }) => {
    await page.goto('/install');
    await expect(page.getByRole('tab', { name: '안드로이드' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('[설치 및 바로가기 만들기]를 누릅니다.', { exact: true })).toBeVisible();
    await expect(page.getByText(/주소창에 \[오프라인\]/)).toBeVisible();
    await expect(page.getByText(/회색 V 또는 예전 아이콘/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('tab', { name: /아이폰/ }).click();
    await expect(page.getByText('목록을 아래로 내려 [홈 화면에 추가]를 선택합니다.').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/install-iphone.png', fullPage: true });
    await page.getByRole('tab', { name: '안드로이드' }).click();
    await expect(page.getByRole('tab', { name: '안드로이드' })).toHaveAttribute('aria-selected', 'true');
    await page.screenshot({ path: 'test-results/install-android.png', fullPage: true, animations: 'disabled' });
  });

  test('manifest and all logo sizes load online and offline without visiting each icon', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/install');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    });
    const manifestPath = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestPath).toBeTruthy();
    const cdp = await context.newCDPSession(page);
    const parsed = await cdp.send('Page.getAppManifest');
    expect(parsed.errors).toEqual([]);
    const manifest = JSON.parse(parsed.data!);
    expect(manifest.start_url).toBe('/?source=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512', '192x192', '512x512']);
    const linkedIcons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(links => links.map(link => link.getAttribute('href')!));
    const paths = [...new Set([manifestPath!, ...linkedIcons, ...manifest.icons.map((icon: { src: string }) => icon.src)])];
    await expect.poll(() => page.evaluate(async paths => {
      const cache = await caches.open('ccg-branding-20261115');
      return (await Promise.all(paths.map(path => cache.match(path)))).every(Boolean);
    }, paths)).toBe(true);
    // Reload under worker control to cache the app shell, without opening icon URLs.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Fetch only after offline, proving installation warmed otherwise unvisited assets.
    await context.setOffline(true);
    const results = await page.evaluate(async paths => Promise.all(paths.map(async path => {
      const response = await fetch(path);
      const type = response.headers.get('content-type')!;
      if (type.includes('json')) return { path, status: response.status, name: (await response.json()).name };
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
      const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let opaque = true;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) opaque = false;
      return { path, status: response.status, width: bitmap.width, height: bitmap.height, opaque };
    })), paths);
    for (const result of results) {
      expect(result.status).toBe(200);
      if ('name' in result) expect(result.name).toBe('춘천과팅');
      else {
        const expectedSize = result.path.includes('apple-touch') ? 180 : Number(result.path.match(/-(\d+)\.png/)![1]);
        expect(result.width).toBe(expectedSize);
        expect(result.height).toBe(expectedSize);
        if (result.path.includes('maskable') || result.path.includes('apple-touch')) expect(result.opaque).toBe(true);
      }
    }
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('한 번에 열립니다.');
    expect(errors).toEqual([]);
  });
});
