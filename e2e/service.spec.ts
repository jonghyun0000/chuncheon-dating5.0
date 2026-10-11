import { test, expect, type Page } from '@playwright/test';

const uid = '00000000-0000-4000-8000-000000000001';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@chuncheongating.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const profile = { id: uid, username: 'fixture', name: '가상회원', gender: 'male', school: '강원대', contact_type: 'phone', contact_id: '01000000000', role: 'user', status: 'active', is_verified: true, verification_status: 'approved', terms_version: 'v5.1' };
const opponent = { id: '00000000-0000-4000-8000-000000000002', owner_id: '00000000-0000-4000-8000-000000000003', gender: 'female', intro: '가상 상대 팀', status: 'active', team_size: 1, owner_verified: true, created_at: '2026-01-01T00:00:00Z', members: [{ id: 'm1', nickname: '가상팀원', school: '한림대', department: '경영학과', student_number: '26', smoking: false, taste_tags: ['산책'], want_tags: [] }] };

async function mockApi(page: Page, options: { signedIn?: boolean; missingProfile?: boolean; homeFails?: boolean; admin?: boolean; mfa?: boolean; unverified?: boolean; draft?: boolean; signup?: boolean } = {}) {
  // No request can reach a real Supabase project, even if the build accidentally points to one.
  await page.route('**/*.supabase.co/**', route => route.abort());
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', role: 'authenticated', aal: 'aal1', exp })).toString('base64url'), 'fixture'].join('.');
  const fixtureUser = { ...user, factors: options.mfa ? [{ id: 'fixture-factor', friendly_name: 'Test authenticator', factor_type: 'totp', status: 'verified', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] : [] };
  const session = { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: fixtureUser };
  if (options.signedIn) await page.addInitScript(value => localStorage.setItem('cc-gating-auth', JSON.stringify(value)), session);
  let failHome = options.homeFails ?? false;
  let currentProfile = { ...profile, role: options.admin ? 'admin' : 'user', is_verified: !options.unverified, verification_status: options.unverified ? 'pending' : 'approved', student_id_image_path: null as string | null };
  let registered = !options.signup;
  let currentDraft: any = options.draft ? { id: 'draft-fixture', owner_id: uid, gender: 'male', intro: '비공개 가상 팀', team_size: 1, members: [{ school: '강원대', department: '컴퓨터공학과', student_number: '20260001', nickname: '가상팀원', smoking: false, contact_type: 'phone', contact_id: '01000000000', taste_tags: ['cafe'], want_tags: [] }], members_consent_confirmed: true, members_consent_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' } : null;
  let published: any = null;
  const writes: string[] = [];
  await page.route('https://test.invalid/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = [];
    let status = 200;
    if (url.pathname.endsWith('/auth/v1/token') || url.pathname.endsWith('/auth/v1/signup')) body = session;
    else if (url.pathname.endsWith('/auth/v1/user')) body = fixtureUser;
    else if (url.pathname.endsWith('/profiles')) {
      if (route.request().method() === 'POST') { registered = true; currentProfile = { ...currentProfile, ...route.request().postDataJSON() }; body = null; }
      else body = options.missingProfile || !registered ? [] : [currentProfile];
    }
    else if (url.pathname.endsWith('/team_drafts')) body = currentDraft ? [currentDraft] : [];
    else if (url.pathname.endsWith('/teams')) body = published && url.searchParams.get('status') !== 'eq.matched' ? [published] : [];
    else if (url.pathname.endsWith('/team_members')) body = published ? published.members ?? [] : [];
    else if (url.pathname.endsWith('/rpc/is_username_available')) body = true;
    else if (url.pathname.endsWith('/rpc/save_my_team_draft')) {
      writes.push('draft');
      const input = route.request().postDataJSON();
      currentDraft = { id: 'draft-fixture', owner_id: uid, gender: 'male', intro: input.p_intro, team_size: input.p_team_size, members: input.p_members, members_consent_confirmed: true, members_consent_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }; body = currentDraft;
    }
    else if (url.pathname.endsWith('/rpc/publish_my_team_draft')) {
      writes.push('publish');
      published = { ...currentDraft, status: 'active', matched_at: null }; currentDraft = null; body = published;
    }
    else if (url.pathname.endsWith('/rpc/submit_student_id')) { currentProfile.student_id_image_path = route.request().postDataJSON().p_path; body = null; }
    else if (url.pathname.includes('/storage/v1/object/')) body = { Key: 'synthetic-upload' };
    else if (url.pathname.endsWith('/rpc/get_home_stats')) body = { total_teams: 1, matched_count: 0, total_users: 2 };
    else if (url.pathname.endsWith('/rpc/get_home_teams')) {
      if (failHome) { status = 503; body = { message: 'Fixture outage' }; }
      else body = options.admin ? [opponent, { ...opponent, id: '00000000-0000-4000-8000-000000000004', gender: 'male', intro: '가상 남자 팀', members: [{ ...opponent.members[0], id: 'm2', nickname: '남자팀원' }] }] : [opponent];
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { restoreHome: () => { failHome = false; }, approve: () => { currentProfile.is_verified = true; currentProfile.verification_status = 'approved'; }, writes };
}

test('mobile landing exposes its first action and navigation works', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  const start = page.getByRole('link', { name: '지금 시작하기' });
  await expect(start).toBeInViewport();
  await page.getByRole('link', { name: '1분 둘러보기' }).click();
  await expect(page).toHaveURL(/\/tour$/);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.getByText('예시 화면', { exact: true })).toBeVisible();
});

test('signup labels and consent modal remain usable', async ({ page }) => {
  await mockApi(page);
  await page.goto('/register');
  await expect(page.getByLabel('아이디', { exact: true })).toBeVisible();
  await expect(page.getByLabel('비밀번호', { exact: true })).toBeVisible();
  await expect(page.getByLabel('학교', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '전문 보기' }).first().click();
  await expect(page.getByText('개인정보 수집 및 이용 동의서', { exact: true })).toBeVisible();
});

test('normal sign-in loads verified opponent cards without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockApi(page);
  await page.goto('/login');
  await page.getByLabel('아이디', { exact: true }).fill('fixture');
  await page.getByLabel('비밀번호', { exact: true }).fill('Fixture123');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('가상 상대 팀', { exact: false })).toBeVisible();
  await expect(page.getByText('가상팀원', { exact: true })).toBeVisible();
  await expect(page.getByText('인증완료', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('ordinary member cannot enter administrator pages', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/admin/users');
  await expect(page.getByText('관리자만 접근할 수 있는 페이지입니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '회원 관리' })).toHaveCount(0);
});

test('incomplete signup has an explicit recovery path rather than blank home', async ({ page }) => {
  await mockApi(page, { signedIn: true, missingProfile: true });
  await page.goto('/');
  await expect(page.getByRole('link', { name: /가입 이어/ })).toBeVisible();
  await page.getByRole('link', { name: /가입 이어/ }).click();
  await expect(page).toHaveURL(/\/register\?resume=1$/);
  await expect(page.getByRole('checkbox', { name: '이전 가입 이어하기' })).toBeChecked();
});

test('home outage displays retry and recovers without a fake empty list', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, homeFails: true });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('정보를 불러오지 못했어요');
  api.restoreHome();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('가상팀원', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('male administrator sees both genders and can narrow each independently', async ({ page }) => {
  await mockApi(page, { signedIn: true, admin: true });
  await page.goto('/');
  await expect(page.getByText('가상팀원', { exact: true })).toBeVisible();
  await expect(page.getByText('남자팀원', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '남자 팀', exact: true }).click();
  await expect(page.getByText('남자팀원', { exact: true })).toBeVisible();
  await expect(page.getByText('가상팀원', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '같은 성별 팀', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '여자 팀', exact: true }).click();
  await expect(page.getByText('가상팀원', { exact: true })).toBeVisible();
  await expect(page.getByText('남자팀원', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '남녀 전체', exact: true }).click();
  await expect(page.getByText('남자팀원', { exact: true })).toBeVisible();
});

test('enrolled administrator must verify before viewing admin content', async ({ page }) => {
  await mockApi(page, { signedIn: true, admin: true, mfa: true });
  await page.goto('/admin/users');
  await expect(page.getByLabel('인증 코드', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '회원 관리' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '인증하기' })).toBeDisabled();
});

test('administrator can open optional authenticator setup without changing enrollment', async ({ page }) => {
  await mockApi(page, { signedIn: true, admin: true });
  const writes: string[] = [];
  page.on('request', request => { if (request.url().includes('/auth/v1/factors') && request.method() !== 'GET') writes.push(request.url()); });
  await page.goto('/admin/security');
  await expect(page.getByRole('button', { name: '인증 앱 연결', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('all four languages load and the saved choice survives reload', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  for (const [name, language] of [['English', 'en'], ['中文', 'zh-CN'], ['日本語', 'ja'], ['한국어', 'ko']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('consent dialog traps keyboard focus and returns focus on Escape', async ({ page }) => {
  await mockApi(page);
  await page.goto('/register');
  const trigger = page.getByRole('button', { name: '전문 보기' }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let step = 0; step < 5; step++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('mobile zoom is enabled and reduced-motion preference is respected', async ({ page }) => {
  await mockApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toContain('user-scalable=no');
  expect(viewport).not.toContain('maximum-scale=1');
  const duration = await page.locator('.petal').first().evaluate(el => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
});


test('photo-free signup enters browsing with unverified matching guidance', async ({ page }) => {
  await mockApi(page, { signup: true, unverified: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/register');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.getByLabel('아이디', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: '중복확인', exact: true }).click();
  await expect(page.getByText('사용할 수 있는 아이디예요.', { exact: true })).toBeVisible();
  await page.getByLabel('비밀번호', { exact: true }).fill('Fixture123!');
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('Fixture123!');
  await page.getByLabel('이름', { exact: true }).fill('가상회원');
  await page.getByLabel('학번', { exact: true }).fill('20260001');
  await page.getByLabel('전화번호', { exact: true }).fill('01000000000');
  await page.getByRole('checkbox', { name: '약관에 모두 동의합니다' }).check();
  await page.getByRole('button', { name: '가입하기', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('학생증 미제출', { exact: true })).toBeVisible();
  await expect(page.getByText('가상 상대 팀', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '관리자 승인 후 가능', exact: true }).click();
  await expect(page).toHaveURL(/\/me\/verification$/);
});

test('pending member can edit and reload a private draft but cannot publish', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, draft: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await expect(page.getByText('비공개 초안', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '관리자 승인 후 가능', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '팀 수정', exact: true }).click();
  await page.getByLabel('팀 한줄소개', { exact: true }).fill('수정된 비공개 가상 팀');
  await page.getByRole('button', { name: '팀 초안 저장', exact: true }).click();
  await expect(page.getByText('수정된 비공개 가상 팀', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('수정된 비공개 가상 팀', { exact: false })).toBeVisible();
  expect(api.writes).toEqual(['draft']);
});

test('admin-approved owner explicitly publishes the saved draft', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, draft: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await expect(page.getByRole('button', { name: '관리자 승인 후 가능', exact: true })).toBeDisabled();
  api.approve(); await page.reload();
  await page.getByRole('button', { name: '팀 공개하기', exact: true }).click();
  await expect(page.getByText('활성', { exact: true })).toBeVisible();
  expect(api.writes).toEqual(['publish']);
});

test('deferred verification submits a photo and displays pending review', async ({ page }) => {
  await mockApi(page, { signedIn: true, unverified: true });
  await page.goto('/me/verification');
  await expect(page.getByText('학생증 미제출', { exact: true })).toBeVisible();
  await page.getByLabel('학생증 사진').setInputFiles({ name: 'student.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff,0xd8,0xff,0xe0]) });
  await page.getByRole('button', { name: '학생증 제출', exact: true }).click();
  await expect(page.getByText('관리자 심사 중', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('학생증이 제출되었어요.');
});
