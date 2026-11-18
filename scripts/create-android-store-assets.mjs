import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const output = 'release-candidates/android/store-assets';
await mkdir(output, { recursive: true });
await copyFile('public/icons/icon-512.png', `${output}/play-icon-512.png`);
const logo = (await readFile('public/icons/icon-512.png')).toString('base64');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#fdfaf6;color:#2f2030;font-family:Arial,'Apple SD Gothic Neo',sans-serif}
    main{height:500px;padding:62px 68px;position:relative;overflow:hidden;background:linear-gradient(120deg,#fffaf5 35%,#ffe2ec)}
    .circle{position:absolute;border:1px solid #efb2c6;border-radius:50%;width:520px;height:520px;right:-180px;top:120px}
    .circle.two{width:420px;height:420px;right:-130px;top:170px}
    img{position:absolute;right:93px;top:143px;width:180px;height:180px;border-radius:42px;box-shadow:0 18px 55px #ce799c30}
    .tag{font-size:20px;color:#9e4064;letter-spacing:.04em;margin:0 0 25px}
    h1{font-size:76px;line-height:1.08;letter-spacing:-5px;margin:0 0 24px;font-weight:800}
    .copy{font-size:33px;line-height:1.48;letter-spacing:-1.4px;margin:0;font-weight:500}
    .brand{color:#d73d77}
  </style><main><div class="circle"></div><div class="circle two"></div><p class="tag">춘천 대학생을 위한 팀 과팅</p>
  <h1 class="brand">춘천과팅</h1><p class="copy">친구와 함께,<br>새로운 만남을 시작해요</p><img alt="춘천과팅 꽃 로고" src="data:image/png;base64,${logo}"></main></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/feature-graphic-1024x500.png` });
} finally { await browser.close(); }
console.log('Created 512px store icon and 1024x500 promotional graphic. Actual app screenshots must be captured separately on a working device.');
