import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';



// Leave dirty forms explicitly so native beforeunload dialogs cannot strand browser teardown.
test.afterEach(async ({ page }) => {
  page.removeAllListeners('dialog');
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  if (!page.isClosed()) await page.goto('about:blank', {timeout:5000});
});

const uid = '00000000-0000-4000-8000-000000000001';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@chuncheongating.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const profile = { id: uid, username: 'fixture', name: '가상회원', gender: 'male', school: '강원대', contact_type: 'phone', contact_id: '01000000000', role: 'user', status: 'active', is_verified: true, verification_status: 'approved', terms_version: 'v5.1' };
const opponent = { id: '00000000-0000-4000-8000-000000000002', owner_id: '00000000-0000-4000-8000-000000000003', gender: 'female', intro: '가상 상대 팀', status: 'active', team_size: 1, owner_verified: true, created_at: '2026-01-01T00:00:00Z', members: [{ id: 'm1', member_order: 1, nickname: '가상팀원', school: '한림대', department: '경영학과', student_number: '26', smoking: false, taste_tags: ['산책'], want_tags: [] }] };

async function mockApi(page: Page, options: { signedIn?: boolean; missingProfile?: boolean; homeFails?: boolean; admin?: boolean; mfa?: boolean; unverified?: boolean; submitted?: boolean; rejected?: boolean; draft?: boolean; signup?: boolean; photos?: boolean; uploadFails?: boolean; matching?: boolean; privacyReadFails?: boolean; privacySaveFails?: boolean; } = {}) {
  // No request can reach a real Supabase project, even if the build accidentally points to one.
  await page.route('**/*.supabase.co/**', route => route.abort());
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: uid, aud: 'authenticated', role: 'authenticated', aal: 'aal1', exp })).toString('base64url'), 'fixture'].join('.');
  const fixtureUser = { ...user, factors: options.mfa ? [{ id: 'fixture-factor', friendly_name: 'Test authenticator', factor_type: 'totp', status: 'verified', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] : [] };
  const session = { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: fixtureUser };
  if (options.signedIn) await page.addInitScript(value => localStorage.setItem('cc-gating-auth', JSON.stringify(value)), session);
  let privacy = false;
  let privacyReadFails = options.privacyReadFails ?? false;
  let failHome = options.homeFails ?? false;
  let currentProfile = { ...profile, role: options.admin ? 'admin' : 'user', is_verified: !options.unverified, verification_status: options.rejected ? 'rejected' : options.unverified ? 'pending' : 'approved', verification_restricted: !!options.rejected, student_id_image_path: (options.submitted || options.rejected ? uid+'/student.jpg' : null) as string | null };
  let registered = !options.signup;
  let currentDraft: any = options.draft ? { id: 'draft-fixture', owner_id: uid, gender: 'male', intro: '비공개 가상 팀', team_size: 1, members: [{ school: '강원대', department: '컴퓨터공학과', student_number: '20260001', nickname: '가상팀원', smoking: false, contact_type: 'phone', contact_id: '01000000000', taste_tags: ['cafe'], want_tags: [] }], members_consent_confirmed: true, members_consent_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' } : null;
  if (options.photos && currentDraft) {
    currentDraft.team_size = 3;
    currentDraft.members = [1,2,3].map(n => ({ ...currentDraft.members[0], nickname: '사진팀원'+n }));
  }
  let photoCounter=0;
  const storedPhotos: any[]=[];
  let published: any = null;
  const writes: string[] = [];
  let matchStatus = 'pending';
  let matchSent = false;
  await page.route((process.env.CC_TEST_API_ORIGIN ?? 'https://test.invalid') + '/**', async route => {
    if (!/\/(auth|rest|storage)\/v1\//.test(new URL(route.request().url()).pathname)) { await route.continue(); return; }
    const url = new URL(route.request().url());
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': route.request().headers()['access-control-request-headers'] ?? 'authorization,apikey,x-client-info,content-type,prefer,x-supabase-api-version,accept-profile,content-profile,range,range-unit', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' } }); return; }
    let body: unknown = [];
    let status = 200;
    if (url.pathname.endsWith('/auth/v1/token') || url.pathname.endsWith('/auth/v1/signup')) body = session;
    else if (url.pathname.endsWith('/auth/v1/user')) body = fixtureUser;
    else if (url.pathname.endsWith('/profiles')) {
      if (route.request().method() === 'POST') { registered = true; currentProfile = { ...currentProfile, ...route.request().postDataJSON() }; body = null; }
      else body = options.missingProfile || !registered ? [] : [currentProfile];
    }
    else if(url.pathname.endsWith('/department_privacy_preferences')) {
      if(privacyReadFails){status=400;body={message:'Synthetic failure'};privacyReadFails=false;}
      else body={enabled:privacy};
    }
    else if(url.pathname.endsWith('/rpc/set_department_privacy')) {
      if(options.privacySaveFails){status=400;body={message:'Synthetic save failure'};}
      else {privacy=route.request().postDataJSON().p_enabled;body=privacy;writes.push('privacy:'+privacy);}
    }
    else if (url.pathname.endsWith('/team_drafts')) body = currentDraft ? [currentDraft] : [];
    else if (url.pathname.endsWith('/teams')) body = options.matching && url.searchParams.get('id') === `eq.${opponent.id}` ? [opponent] : published && url.searchParams.get('status') !== 'eq.matched' ? [published] : [];
    else if (options.matching && url.pathname.endsWith('/match_requests')) {
      if (route.request().method() === 'POST') { matchSent = true; writes.push('match'); body = null; }
      else body = matchSent && !url.searchParams.has('to_team_id') ? [{id:'request-fixture',from_team_id:published.id,to_team_id:opponent.id,status:matchStatus,created_at:'2026-10-12T00:00:00Z',from_team:published,to_team:opponent}] : [];
    }
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
    else if (url.pathname.endsWith('/rpc/submit_student_id')) { currentProfile.student_id_image_path = route.request().postDataJSON().p_path; currentProfile.verification_status = 'pending'; body = null; }
    else if (url.pathname.endsWith('/rpc/reserve_member_photo')) {
      photoCounter++;
      body={id:'photo-'+photoCounter,path:uid+'/photo-'+photoCounter+'.jpg'};
      storedPhotos.push(body);
    }
    else if (url.pathname.endsWith('/rpc/get_member_photos')) {
      if (currentDraft) body=currentDraft.members.flatMap((m: any,i: number)=>m.photo_id ? [{...storedPhotos.find(p=>p.id===m.photo_id),member_order:i+1}] : []);
      else body=options.photos ? [{id:'public-photo',path:uid+'/public-photo.jpg',member_order:1}] : [];
    }
    else if (url.pathname.endsWith('/member_photos')) body=options.photos ? [{id:'archive-photo',path:uid+'/archive.jpg',member_order:1,school:'강원대',department:'컴퓨터공학과',student_number:'20260001',gender:'male',display_name:'사진팀원',nickname:'사진팀원',created_at:'2026-10-12T00:00:00Z',archived_at:'2026-10-12T00:00:00Z',expires_at:'2027-01-10T00:00:00Z'}] : [];
    else if (url.pathname.includes('/storage/v1/object/') && url.pathname.includes('member-photos')) {
      if (route.request().method()==='GET') { await route.fulfill({ status:200,contentType:'image/jpeg',headers:{'access-control-allow-origin':'*'},body:readFileSync(new URL('./fixtures/member-photo.jpg',import.meta.url)) }); return; }
      if(options.uploadFails) {status=503;body={message:'Synthetic upload failure'};}
      else body={Key:'synthetic-photo-upload'};
    }
    else if (url.pathname.includes('/storage/v1/object/')) body = { Key: 'synthetic-upload' };
    else if (url.pathname.endsWith('/rpc/get_home_stats')) body = { total_teams: 1, matched_count: 0, total_users: 2 };
    else if (url.pathname.endsWith('/rpc/get_home_teams')) {
      if (failHome) { status = 503; body = { message: 'Fixture outage' }; }
      else body = options.admin ? [opponent, { ...opponent, id: '00000000-0000-4000-8000-000000000004', gender: 'male', intro: '가상 남자 팀', members: [{ ...opponent.members[0], id: 'm2', nickname: '남자팀원' }] }] : [opponent];
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,apikey,x-client-info,content-type,prefer,x-supabase-api-version,accept-profile,content-profile,range,range-unit', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' }, body: JSON.stringify(body) });
  });
  return { restoreHome: () => { failHome = false; }, approve: () => { currentProfile.is_verified = true; currentProfile.verification_status = 'approved'; currentProfile.verification_restricted = false; }, acceptMatch: () => { matchStatus = 'accepted'; }, writes };
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
  let matchStatus = 'pending';
  let matchSent = false;
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


test('signup requires an image then grants initial access before verification', async ({ page }) => {
  await mockApi(page, { signup: true, unverified: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/register');
  await expect(page.getByRole('button', { name: /학생증 사진 등록하기/ })).toBeVisible();
  await page.getByLabel('아이디', { exact: true }).fill('fixture');
  await page.getByRole('button', { name: '중복확인', exact: true }).click();
  await expect(page.getByText('사용할 수 있는 아이디예요.', { exact: true })).toBeVisible();
  await page.getByLabel('비밀번호', { exact: true }).fill('Fixture123!');
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('Fixture123!');
  await page.getByLabel('이름', { exact: true }).fill('가상회원');
  await page.getByLabel('학교', { exact: true }).selectOption('송곡대');
  await page.getByLabel('학번', { exact: true }).fill('20260001');
  await page.getByLabel('전화번호', { exact: true }).fill('01000000000');
  await page.getByRole('checkbox', { name: '약관에 모두 동의합니다' }).check();
  await page.getByRole('button', { name: '가입하기', exact: true }).click();
  await expect(page.getByText('학생증 사진을 선택해주세요.', { exact: true })).toBeVisible();
  await page.locator('#register-student-id').setInputFiles({ name: 'ordinary-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff,0xd8,0xff,0xe0]) });
  const profileSave = page.waitForRequest(request => request.url().endsWith('/rest/v1/profiles') && request.method() === 'POST');
  await page.getByRole('button', { name: '가입하기', exact: true }).click();
  expect((await profileSave).postDataJSON().school).toBe('송곡대');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('지금 바로 이용할 수 있어요', { exact: true })).toBeVisible();
  await expect(page.getByText('가상 상대 팀', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '신청하기', exact: true })).toBeEnabled();
});

test('legacy missing-photo member can edit and reload a private draft but must submit to publish', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, draft: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await expect(page.getByText('비공개 초안', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '학생증 사진 제출 필요', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '팀 수정', exact: true }).click();
  await page.getByRole('combobox', { name: '학교', exact: true }).selectOption('송곡대');
  await page.getByLabel('팀 한줄소개', { exact: true }).fill('수정된 비공개 가상 팀');
  await page.getByRole('button', { name: '팀 초안 저장', exact: true }).click();
  await expect(page.getByText('수정된 비공개 가상 팀', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('수정된 비공개 가상 팀', { exact: false })).toBeVisible();
  await expect(page.getByText('송곡대', { exact: true })).toBeVisible();
  expect(api.writes).toEqual(['draft']);
});

test('admin-approved owner explicitly publishes the saved draft', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, draft: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await expect(page.getByRole('button', { name: '학생증 사진 제출 필요', exact: true })).toBeDisabled();
  api.approve(); await page.reload();
  await page.getByRole('button', { name: '팀 공개하기', exact: true }).click();
  await expect(page.getByText('활성', { exact: true })).toBeVisible();
  expect(api.writes).toEqual(['publish']);
});

test('first student ID submission opens team publication without admin review', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, draft: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/me/verification');
  await expect(page.getByText('학생증 미제출', { exact: true })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /학생증 사진 등록하기/ }).click();
  await (await chooser).setFiles({ name: 'student.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff,0xd8,0xff,0xe0]) });
  await expect(page.getByRole('button', { name: /학생증 사진 변경하기/ })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('student.jpg');
  await page.screenshot({path:'/tmp/cc-student-upload.png',fullPage:true});
  await page.getByRole('button', { name: '학생증 제출', exact: true }).click();
  await expect(page.getByText('지금 바로 이용할 수 있어요', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('학생증 사진이 제출되었어요.');
  await page.getByRole('link', { name: '팀 등록하기', exact: true }).click();
  await page.getByRole('button', { name: '팀 공개하기', exact: true }).click();
  await expect(page.getByText('활성', { exact: true })).toBeVisible();
  expect(api.writes).toEqual(['publish']);
});


test('patched build compiler preserves mobile and desktop signup styles', async ({ page }) => {
  await mockApi(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/register');
    await expect(page.getByRole('button', { name: '가입하기', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    const styles = () => page.evaluate(() => {
      const properties = ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'borderRadius', 'paddingTop', 'paddingLeft', 'width'];
      return ['.card', '.input', '.btn-primary', 'h1'].map(selector => {
        const element = document.querySelector(selector)!;
        const computed = getComputedStyle(element);
        return Object.fromEntries(properties.map(property => [property, computed[property as keyof CSSStyleDeclaration]]));
      });
    });
    const updated = await styles();
    await page.locator('link[rel=stylesheet][href*="/assets/"]').evaluateAll(links => links.forEach(link => (link as HTMLLinkElement).disabled = true));
    await page.addStyleTag({ content: readFileSync('e2e/fixtures/legacy-ui.css', 'utf8') });
    const previous = await styles();
    for (let i = 0; i < previous.length; i++) {
      // Font and flex calculations can differ by less than one CSS pixel across engines.
      expect(Math.abs(parseFloat(updated[i].width as string) - parseFloat(previous[i].width as string))).toBeLessThan(1);
      const { width: oldWidth, ...oldStyle } = previous[i];
      const { width: newWidth, ...newStyle } = updated[i];
      expect(newStyle).toEqual(oldStyle);
    }
  }
});


test('three optional member photos survive draft save and reload', async ({ page }) => {
  await mockApi(page, { signedIn: true, unverified: true, draft: true, photos: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await page.getByRole('button', { name: '팀 수정', exact: true }).click();
  const files=page.locator('input[type=file]');
  await expect(files).toHaveCount(3);
  await expect(files.first()).toBeEnabled();
  await expect(page.getByRole('button', {name:'사진 추가',exact:true})).toHaveCount(3);
  let reservations = 0;
  page.on('request', request => { if (request.url().includes('/rpc/reserve_member_photo')) reservations++; });
  for(let i=0;i<3;i++) {
    if (i === 0) {
      const chooserPromise = page.waitForEvent('filechooser');
      await page.getByRole('button', {name:'사진 추가',exact:true}).first().click();
      await (await chooserPromise).setFiles('e2e/fixtures/member-photo.jpg');
    } else await files.nth(i).setInputFiles('e2e/fixtures/member-photo.jpg');
    await expect(page.getByRole('img', {name:`사진팀원${i+1} 사진 선택`,exact:true})).toBeVisible();
  }
  if(process.env.CC_PHOTO_SCREENSHOTS) { mkdirSync('docs/validation/photo-upload-ux',{recursive:true}); await page.screenshot({path:'docs/validation/photo-upload-ux/selection.png',fullPage:true}); }
  await expect(page.getByRole('button', {name:'사진 변경하기',exact:true})).toHaveCount(3);
  await expect(page.getByRole('button', {name:'사진 삭제하기',exact:true})).toHaveCount(3);
  const replacement = page.waitForEvent('filechooser');
  await page.getByRole('button', {name:'사진 변경하기',exact:true}).first().click();
  await (await replacement).setFiles('e2e/fixtures/member-photo.jpg');
  await expect(page.getByRole('button', {name:'사진 변경하기',exact:true}).first()).toBeEnabled();
  await page.screenshot({path:'/tmp/cc-member-upload.png',fullPage:true});
  expect(reservations).toBe(0);
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByText('사진을 등록하려면 아래 사진 공개·보관 동의를 확인해주세요.')).toBeVisible();
  expect(reservations).toBe(0);
  await page.getByRole('checkbox', {name:/사진 속 당사자/}).check();
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByRole('button', {name:/사진팀원[123] 사진 확대/})).toHaveCount(3);
  expect(reservations).toBe(3);
  await page.reload();
  await expect(page.getByRole('button', {name:/사진팀원[123] 사진 확대/})).toHaveCount(3);
  if(process.env.CC_PHOTO_SCREENSHOTS) { mkdirSync('docs/validation/member-photos',{recursive:true}); await page.screenshot({path:'docs/validation/member-photos/draft-three-photos.png',fullPage:true}); }
  await page.getByRole('button', {name:'팀 수정',exact:true}).click();
  await page.getByRole('button',{name:'사진 삭제하기'}).nth(1).click();
  await page.getByRole('checkbox', {name:/사진 속 당사자/}).check();
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByRole('button', {name:/사진팀원[123] 사진 확대/})).toHaveCount(2);
});

test('photo failure does not block saving a team without a photo', async ({ page }) => {
  await mockApi(page, { signedIn:true, unverified:true, draft:true, uploadFails:true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await page.getByRole('button', {name:'팀 수정',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/member-photo.jpg');
  await page.getByRole('checkbox', {name:/사진 속 당사자/}).check();
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('사진 없이 저장');
  await page.getByRole('button',{name:'사진 삭제하기'}).click();
  await expect(page.getByRole('checkbox', {name:/사진 속 당사자/})).toHaveCount(0);
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByText('비공개 초안', {exact:true})).toBeVisible();
});

test('partial photo upload retries keep completed photos without duplicate reservations', async ({ page }) => {
  await mockApi(page, { signedIn:true, unverified:true, draft:true, photos:true });
  page.on('dialog', dialog => dialog.accept());
  let uploads = 0;
  let reservations = 0;
  page.on('request', request => { if (request.url().includes('/rpc/reserve_member_photo')) reservations++; });
  await page.route('**/storage/v1/object/member-photos/**', async route => {
    if (route.request().method() === 'POST' && ++uploads === 2) {
      return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'temporary upload failure'})});
    }
    await route.fallback();
  });
  await page.goto('/team');
  await page.getByRole('button', {name:'팀 수정',exact:true}).click();
  for(let i=0;i<3;i++) {
    await page.locator('input[type=file]').nth(i).setInputFiles('e2e/fixtures/member-photo.jpg');
    await expect(page.getByRole('img', {name:`사진팀원${i+1} 사진 선택`,exact:true})).toBeVisible();
  }
  await page.getByRole('checkbox', {name:/사진 속 당사자/}).check();
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('사진 없이 저장');
  expect(reservations).toBe(2);
  await page.getByRole('button', {name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByRole('button', {name:/사진팀원[123] 사진 확대/})).toHaveCount(3);
  await expect(page.getByRole('button', {name:'팀 수정',exact:true})).toBeVisible();
  expect(reservations).toBe(4);
});

test('team profile photo is circular and opens an accessible preview', async ({ page }) => {
  await mockApi(page, { signedIn:true, photos:true });
  await page.goto('/');
  const button = page.getByRole('button', { name: '가상팀원 사진 확대', exact: true });
  await expect(button).toBeVisible();
  const placement = await button.evaluate(avatar => ({
    school: avatar.previousElementSibling?.textContent?.trim(),
    nickname: avatar.nextElementSibling?.firstElementChild?.textContent,
    circular: parseFloat(getComputedStyle(avatar).borderTopLeftRadius) >= avatar.getBoundingClientRect().width / 2,
    size: avatar.getBoundingClientRect().width,
  }));
  expect(placement).toEqual({ school: '한림대', nickname: '가상팀원', circular: true, size: 44 });
  await button.click();
  const dialog = page.getByRole('dialog', { name: '가상팀원 프로필 사진' });
  await expect(dialog).toBeVisible();
  const enlarged = await dialog.getByRole('img').boundingBox();
  expect(enlarged?.width).toBeGreaterThan(placement.size);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('administrator can search and inspect deleted-team photo archive', async ({ page }) => {
  await mockApi(page, {signedIn:true,admin:true,photos:true});
  await page.goto('/admin/photos');
  await expect(page.getByRole('heading',{name:'팀원 사진 보관함'})).toBeVisible();
  await expect(page.getByText('강원대 / 컴퓨터공학과 / 20260001 / 남자 / 사진팀원 / 사진팀원',{exact:true})).toBeVisible();
  const request=page.waitForRequest(r=>r.url().includes('/member_photos?') && new URL(r.url()).searchParams.get('gender')==='eq.male');
  await page.getByRole('textbox').fill('남자');
  await request;
  await expect(page.getByText(/삭제된 팀/)).toBeVisible();
  if(process.env.CC_PHOTO_SCREENSHOTS) { mkdirSync('docs/validation/member-photos',{recursive:true}); await page.screenshot({path:'docs/validation/member-photos/admin-archive.png',fullPage:true}); }
  await page.getByRole('button',{name:'사진팀원 사진 확대',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});


test('unsaved team entries survive cancelled navigation and cancel editing', async ({ page }) => {
  await mockApi(page, {signedIn:true,unverified:true,draft:true});
  await page.goto('/team');
  await page.getByRole('button',{name:'팀 수정',exact:true}).click();
  await page.locator('#team-intro').fill('저장 전 가상 소개글');
  await page.locator('nav').getByRole('link',{name:'홈',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('저장하지 않고 나가면');
  if(process.env.CC_ONBOARDING_SCREENSHOTS) { mkdirSync('docs/validation/onboarding',{recursive:true}); await page.screenshot({path:'docs/validation/onboarding/unsaved.png',animations:'disabled'}); }
  await page.getByRole('button',{name:'계속 작성하기',exact:true}).click();
  await expect(page.locator('#team-intro')).toHaveValue('저장 전 가상 소개글');
  const prevented = await page.evaluate(() => { const event=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(event); return event.defaultPrevented; });
  expect(prevented).toBe(true);
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await page.getByRole('button',{name:'계속 작성하기',exact:true}).click();
  await expect(page.locator('#team-intro')).toHaveValue('저장 전 가상 소개글');
  await page.locator('nav').getByRole('link',{name:'홈',exact:true}).click();
  await page.getByRole('button',{name:'저장하지 않고 나가기',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
});

test('invalid member input is explained inline and receives focus', async ({ page }) => {
  await mockApi(page, {signedIn:true,unverified:true,draft:true});
  await page.goto('/team');
  await page.getByRole('button',{name:'팀 수정',exact:true}).click();
  await page.locator('#member-1-student_number').fill('abc');
  await page.getByRole('button',{name:'팀 초안 저장',exact:true}).click();
  await expect(page.locator('#member-1-student_number')).toBeFocused();
  await expect(page.locator('#member-1-student_number')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#member-1-student_number-description')).toBeVisible();
  if(process.env.CC_ONBOARDING_SCREENSHOTS) { mkdirSync('docs/validation/onboarding',{recursive:true}); await page.screenshot({path:'docs/validation/onboarding/inline-error.png',animations:'disabled'}); }
  await page.locator('#member-1-student_number').fill('20260001');
  await expect(page.locator('#member-1-student_number')).not.toHaveAttribute('aria-invalid','true');
  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'팀 초안 저장',exact:true}).click();
  await expect(page.getByText('비공개 초안',{exact:true})).toBeVisible();
  await page.locator('nav').getByRole('link',{name:'홈',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('pending verification points to review status and approved draft explains publication', async ({ page }) => {
  const api=await mockApi(page,{signedIn:true,unverified:true,draft:true});
  await page.goto('/me/verification');
  await page.getByLabel('학생증 사진').setInputFiles({name:'student.jpg',mimeType:'image/jpeg',buffer:Buffer.from([0xff,0xd8,0xff,0xe0])});
  await page.getByRole('button',{name:'학생증 제출',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('학생증 사진이 제출');
  await page.goto('/team');
  await expect(page.getByRole('link',{name:/심사 상태 확인/})).toBeVisible();
  await expect(page.getByRole('link',{name:/학생증 다시 제출/})).toHaveCount(0);
  api.approve(); await page.reload();
  await expect(page.getByRole('region',{name:'현재 단계'})).toContainText('팀 공개하기');
  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'팀 공개하기',exact:true}).click();
  await expect(page.getByRole('region',{name:'현재 단계'})).toContainText('팀이 공개되었어요');
  await expect(page.getByRole('button',{name:'상대 팀 둘러보기',exact:true})).toBeVisible();
});


test('approved draft proceeds to first request and result without exposing contacts', async ({ page }) => {
  const api=await mockApi(page,{signedIn:true,unverified:true,draft:true,matching:true});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/team');
  await expect(page.getByRole('button',{name:'학생증 사진 제출 필요',exact:true})).toBeDisabled();
  api.approve(); await page.reload();
  await page.getByRole('button',{name:'팀 공개하기',exact:true}).click();
  await page.getByRole('button',{name:'상대 팀 둘러보기',exact:true}).click();
  await page.getByRole('button',{name:'신청하기',exact:true}).click();
  await expect.poll(()=>api.writes).toContain('match');
  await page.goto('/requests');
  await page.getByRole('button',{name:/보낸 신청/}).click();
  await expect(page.getByText('대기 중',{exact:true})).toBeVisible();
  await expect(page.getByText('01000000000',{exact:true})).toHaveCount(0);
  api.acceptMatch(); await page.reload();
  await page.getByRole('button',{name:/매칭완료/}).click();
  await expect(page.getByText('가상 상대 팀',{exact:false})).toBeVisible();
});

test('browser back keeps unsaved team after staying and continues after discard', async ({ page }) => {
  await mockApi(page,{signedIn:true,unverified:true,draft:true});
  await page.goto('/');
  await page.locator('nav').getByRole('link',{name:'팀등록',exact:true}).click();
  await page.getByRole('button',{name:'팀 수정',exact:true}).click();
  await page.locator('#team-intro').fill('뒤로가기 보존 확인');
  await page.evaluate(()=>history.back());
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'계속 작성하기',exact:true}).click();
  await expect(page.locator('#team-intro')).toHaveValue('뒤로가기 보존 확인');
  await page.evaluate(()=>history.back());
  await page.getByRole('button',{name:'저장하지 않고 나가기',exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
});

test('department privacy is optional, persists and is available on team registration',async({page})=>{
 const api=await mockApi(page,{signedIn:true});await page.goto('/me');
 const option=page.getByRole('checkbox',{name:/같은 학교·학과 지인 피하기/});
 await expect(option).toBeEnabled();await expect(option).not.toBeChecked();
 await option.click();await expect(page.getByRole('status')).toContainText('지인 피하기를 켰어요');
 await page.reload();await expect(option).toBeChecked();
 if(process.env.CC_PRIVACY_SCREENSHOT){mkdirSync('docs/validation/department-privacy',{recursive:true});await page.getByRole('region',{name:/같은 학교·학과 지인 피하기/}).screenshot({path:'docs/validation/department-privacy/setting.png'});}
 await page.goto('/team');
 await expect(option).toBeChecked();await option.click();
 await expect(page.getByRole('status')).toContainText('지인 피하기를 껐어요');
 expect(api.writes).toEqual(['privacy:true','privacy:false']);
});

test('department privacy load failure disables edits until retry',async({page})=>{
 await mockApi(page,{signedIn:true,privacyReadFails:true});await page.goto('/me');
 const option=page.getByRole('checkbox',{name:/같은 학교·학과 지인 피하기/});
 await expect(page.getByRole('alert')).toContainText('설정을 확인하지 못했어요');await expect(option).toBeDisabled();
 await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await expect(option).toBeEnabled();
});

test('department privacy failed save never claims protection enabled',async({page})=>{
 const api=await mockApi(page,{signedIn:true,privacySaveFails:true});await page.goto('/me');
 const option=page.getByRole('checkbox',{name:/같은 학교·학과 지인 피하기/});
 await expect(option).toBeEnabled();await option.click();
 await expect(page.getByRole('alert')).toContainText('설정을 확인하지 못했어요');await expect(option).not.toBeChecked();
 await expect(option).toBeDisabled();expect(api.writes).toEqual([]);
});


test('pending uploaded member publishes a team before administrator approval', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, submitted: true, draft: true });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/team');
  await expect(page.getByText('지금 바로 이용할 수 있어요', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '팀 공개하기', exact: true }).click();
  await expect(page.getByText('활성', { exact: true })).toBeVisible();
  expect(api.writes).toEqual(['publish']);
});

test('rejection routes to MyPage; resubmission stays restricted until approval', async ({ page }) => {
  const api = await mockApi(page, { signedIn: true, unverified: true, rejected: true });
  await page.goto('/team');
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole('link', { name: /학생증 사진을 다시 확인해주세요/ })).toBeVisible();
  await page.getByRole('link', { name: /학생증 사진을 다시 확인해주세요/ }).click();
  await page.getByLabel('학생증 사진', { exact: true }).setInputFiles({ name: 'retry.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff,0xd8,0xff,0xe0]) });
  await page.getByRole('button', { name: '학생증 다시 제출', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('재승인 후 이용 제한이 해제');
  await page.goto('/team');
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByRole('link', { name: /재승인 후 이용 제한이 해제/ })).toBeVisible();
  api.approve(); await page.reload();
  await page.goto('/team');
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByText('학생증 사진을 다시 확인해주세요', { exact: true })).toHaveCount(0);
});


test('same-gender examples are read-only and do not fetch photos or contacts', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.route('**/rest/v1/rpc/get_same_gender_team_examples', route => route.fulfill({
    json: [{ id: 'example-team', intro: '주말에는 함께 카페 가요', team_size: 2, owner_verified: true,
      members: [{ member_order: 1, school: '한림대', department: '경영학과', smoking: false, taste_tags: ['cafe'], want_tags: [] }] }],
    headers: { 'access-control-allow-origin': '*' },
  }));
  await page.goto('/');
  await page.getByRole('link', { name: '같은 성별 팀 구경하기' }).click();
  await expect(page.getByRole('heading', { name: '같은 성별 팀 구경하기' })).toBeVisible();
  const requests: string[] = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.reload();
  await expect(page.getByText('주말에는 함께 카페 가요')).toBeVisible();
  await expect(page.getByTestId('team-example').locator('img')).toHaveCount(0);
  await expect(page.getByTestId('team-example').getByRole('button')).toHaveCount(0);
  await expect(page.getByText('팀원 1', {exact:true})).toBeVisible();
  expect(requests.some(path => /get_member_photos|storage\/v1|team_members|match_requests/.test(path))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'docs/validation/team-examples/mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'docs/validation/team-examples/desktop.png',fullPage:true});
  await page.getByRole('link', { name: '우리 팀도 작성하기' }).click();
  await expect(page).toHaveURL(/\/team$/);
});

test('same-gender examples retry failure and show empty state', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  let fail = true;
  await page.route('**/rest/v1/rpc/get_same_gender_team_examples', route => route.fulfill({
    status: fail ? 503 : 200, json: fail ? {message:'Synthetic outage'} : [], headers: {'access-control-allow-origin':'*'},
  }));
  await page.goto('/team-examples');
  await expect(page.getByRole('alert')).toBeVisible();
  fail = false;
  await page.getByRole('button',{name:'다시 시도'}).click();
  await expect(page.getByText('지금 구경할 수 있는 같은 성별 팀이 없어요.')).toBeVisible();
});

test('same-gender examples require login', async ({ page }) => {
  await mockApi(page);
  await page.goto('/team-examples');
  await expect(page).toHaveURL(/\/login$/);
});

const testAd = {
  id: 'a0000000-0000-4000-8000-000000000001',
  advertiser: '가상 카페',
  headline: '학생증 제시하면 음료 할인',
  description: '가상 학생 할인 안내',
  destination_url: 'https://offer.invalid/benefit',
  image_path: null,
  ends_at: null,
};

function mockAdTeams(amount: number) {
  return Array.from({ length: amount }, (_, index) => ({
    ...opponent, id: 'ad-fixture-team-' + index, intro: '광고 위치 테스트 팀 ' + (index + 1),
    members: [{ ...opponent.members[0], school: index < 2 ? '한림대' : '강원대' }],
  }));
}

async function stubRpc(page: Page, name: string, handle: (input: any) => { body: unknown; status?: number }) {
  const origin = process.env.CC_TEST_API_ORIGIN ?? 'https://test.invalid';
  await page.route(origin + '/rest/v1/rpc/' + name, async route => {
    if (route.request().method() === 'OPTIONS') { await route.fallback(); return; }
    const { body, status } = handle(route.request().postDataJSON());
    await route.fulfill({ status: status ?? 200, json: body, headers: { 'access-control-allow-origin': '*' } });
  });
}

test('home shows one marked banner after the third team and counts exposure only in view', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  const events: boolean[] = [];
  let homeLoads = 0;
  await stubRpc(page, 'get_home_teams', () => ({ body: mockAdTeams(5) }));
  await stubRpc(page, 'get_home_advertising', () => {
    homeLoads++;
    return { body: { day: '2026-11-12', banner: testAd } };
  });
  await stubRpc(page, 'record_home_ad_event', input => {
    events.push(input.p_clicked);
    return { body: true };
  });
  await page.context().route('https://offer.invalid/**', route => route.fulfill({ status: 200, body: 'Synthetic offer' }));
  await page.goto('/');
  const banner = page.getByTestId('home-ad-banner');
  await expect(banner).toHaveCount(1);
  await expect(banner.getByText('광고', { exact: true })).toBeVisible();
  const order = await banner.evaluate(element => ({
    before: element.previousElementSibling?.textContent,
    after: element.nextElementSibling?.textContent,
  }));
  expect(order.before).toContain('광고 위치 테스트 팀 3');
  expect(order.after).toContain('광고 위치 테스트 팀 4');
  await expect(banner).not.toBeInViewport();
  expect(events).toEqual([]);
  const beforeScroll = Date.now();
  await banner.scrollIntoViewIfNeeded();
  await expect.poll(() => events).toEqual([false]);
  expect(Date.now() - beforeScroll).toBeGreaterThanOrEqual(950);
  const popupPromise = page.waitForEvent('popup');
  await banner.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://offer.invalid/benefit');
  await popup.close();
  await expect.poll(() => events).toEqual([false, true]);
  await page.getByRole('button', { name: '한림대', exact: true }).click();
  await expect(page.getByText('광고 위치 테스트 팀 2', { exact: false })).toBeVisible();
  await expect(banner).toHaveCount(0);
  expect(homeLoads).toBe(1);
});

test('a failed advertising request does not block existing team browsing', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await stubRpc(page, 'get_home_teams', () => ({ body: mockAdTeams(5) }));
  await stubRpc(page, 'get_home_advertising', () => ({ status: 503, body: { message: 'Synthetic ad outage' } }));
  await page.goto('/');
  await expect(page.getByText('광고 위치 테스트 팀 5', { exact: false })).toBeVisible();
  await expect(page.getByTestId('home-ad-banner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '신청하기', exact: true })).toHaveCount(5);
});

test('administrator can register, edit, start and pause a banner', async ({ page }) => {
  await mockApi(page, { signedIn: true, admin: true });
  let banners: any[] = [];
  let registration: any;
  await stubRpc(page, 'get_admin_home_ad_banners', () => ({ body: banners }));
  await stubRpc(page, 'get_admin_home_ad_metrics', input => {
    expect(input.p_banner).toBeNull();
    return { body: [
      { day: input.p_through, visitors: 100, viewers: 60, clickers: 6, tracked: true },
      { day: input.p_from, visitors: 0, viewers: 0, clickers: 0, tracked: false },
    ] };
  });
  await stubRpc(page, 'create_home_ad_banner', input => {
    registration = input;
    banners = [{
      ...testAd, id: input.p_id, advertiser: input.p_advertiser, headline: input.p_headline,
      starts_at: new Date(Date.now() - 60000).toISOString(), enabled: false, image_path: input.p_image_path,
    }];
    return { body: null };
  });
  await stubRpc(page, 'edit_home_ad_banner', input => {
    expect(input.p_id).toBe(registration.p_id);
    expect(input.p_replace_image).toBe(true);
    expect(input.p_image_path).toBeNull();
    banners = banners.map(banner => ({ ...banner, headline: input.p_headline, image_path: null }));
    return { body: null };
  });
  await stubRpc(page, 'set_home_ad_enabled', input => {
    banners = banners.map(banner => ({ ...banner, enabled: input.p_enabled }));
    return { body: null };
  });
  await page.goto('/admin/ads');
  await expect(page.getByRole('heading', { name: '광고 관리', exact: true })).toBeVisible();
  const metrics = page.getByRole('table', { name: '광고 일별 성과' });
  await expect(metrics.getByRole('cell', { name: '10.0%' })).toBeVisible();
  await expect(metrics.getByRole('cell', { name: '100', exact: true })).toBeVisible();
  await expect(metrics.getByRole('cell', { name: '—', exact: true })).toHaveCount(4);
  await page.getByLabel('광고주', { exact: true }).fill('가상 카페');
  await page.getByLabel('제목', { exact: true }).fill('가상 학생 할인');
  await page.getByLabel('광고 링크', { exact: true }).fill('https://offer.invalid/benefit');
  await page.getByLabel('배너 이미지 (선택)', { exact: true }).setInputFiles('e2e/fixtures/member-photo.jpg');
  await page.getByRole('button', { name: '배너 등록하기', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '배너를 등록했습니다' })).toBeVisible();
  expect(registration.p_image_path).toBe(uid + '/' + registration.p_id + '.jpg');
  await page.getByRole('button', { name: '노출 시작', exact: true }).click();
  await expect(page.getByText('노출 중', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '수정하기', exact: true }).click();
  const editor = page.getByRole('region', { name: '배너 수정' });
  await expect(editor.getByLabel('제목', { exact: true })).toHaveValue('가상 학생 할인');
  await editor.getByLabel('제목', { exact: true }).fill('수정된 학생 할인');
  await editor.getByLabel('기존 이미지 제거').check();
  await editor.getByRole('button', { name: '수정 저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '배너를 수정했습니다' })).toBeVisible();
  await expect(page.getByText('수정된 학생 할인', { exact: true })).toBeVisible();
  await expect(page.getByText('노출 중', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '일시 중지', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '배너를 일시 중지했습니다' })).toBeVisible();
  await expect(metrics.getByRole('cell', { name: '10.0%' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('banner performance shows its own daily counts without changing overall performance', async ({ page }) => {
  await mockApi(page, { signedIn: true, admin: true });
  const first = { ...testAd, headline: '첫 번째 성과 배너', starts_at: '2026-01-01T00:00:00Z', enabled: true };
  const second = {
    ...first, id: 'second-performance-banner', headline: '종료된 성과 배너',
    ends_at: '2026-01-02T00:00:00Z', enabled: false,
  };
  const requests: { p_from: string; p_through: string; p_banner: string | null }[] = [];
  await stubRpc(page, 'get_admin_home_ad_banners', () => ({ body: [first, second] }));
  await stubRpc(page, 'get_admin_home_ad_metrics', input => {
    requests.push(input);
    const [viewers, clickers] = input.p_banner === first.id ? [20, 5]
      : input.p_banner === second.id ? [8, 1] : [26, 5];
    return { body: [{ day: input.p_through, visitors: 100, viewers, clickers, tracked: true }] };
  });

  await page.goto('/admin/ads');
  const overall = page.getByRole('region', { name: '전체 성과' });
  const table = overall.getByRole('table');
  await expect(table.getByRole('cell', { name: '100', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: '26', exact: true })).toBeVisible();
  expect(requests.every(request => request.p_banner === null)).toBe(true);

  const firstCard = page.getByRole('article').filter({ hasText: first.headline });
  await firstCard.getByRole('button', { name: '성과 보기' }).click();
  const firstReport = firstCard.getByRole('region', { name: '배너 성과' });
  await expect(firstReport.getByRole('cell', { name: '25.0%' })).toBeVisible();
  await expect(firstReport.getByRole('columnheader', { name: '방문' })).toHaveCount(0);
  expect(requests.at(-1)?.p_banner).toBe(first.id);
  await expect(table.getByRole('cell', { name: '26', exact: true })).toBeVisible();

  const secondCard = page.getByRole('article').filter({ hasText: second.headline });
  await secondCard.getByRole('button', { name: '성과 보기' }).click();
  await expect(firstReport).toHaveCount(0);
  const secondReport = secondCard.getByRole('region', { name: '배너 성과' });
  await expect(secondReport.getByRole('cell', { name: '12.5%' })).toBeVisible();
  expect(requests.at(-1)?.p_banner).toBe(second.id);

  const originalStart = await overall.getByLabel('시작 날짜').inputValue();
  const newStart = new Date(Date.parse(originalStart) - 86400000).toISOString().slice(0, 10);
  await secondReport.getByLabel('시작 날짜').fill(newStart);
  await expect.poll(() => requests.at(-1)).toMatchObject({ p_from: newStart, p_banner: second.id });
  await expect(overall.getByLabel('시작 날짜')).toHaveValue(originalStart);
  await expect(table.getByRole('cell', { name: '26', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('advertising management is protected by the administrator route', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/rpc/get_admin_home_ad')) requests.push(request.url()); });
  await page.goto('/admin/ads');
  await expect(page.getByRole('heading', { name: '광고 관리', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /권한/ })).toBeVisible();
  expect(requests).toEqual([]);
});

test('home school filter includes Songgok teams', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await stubRpc(page, 'get_home_teams', () => ({ body: [
    opponent,
    {
      ...opponent,
      id: 'songgok-team-fixture',
      intro: '가상 송곡대 팀',
      members: [{ ...opponent.members[0], school: '송곡대' }],
    },
  ] }));
  await page.goto('/');
  await expect(page.getByText('가상 상대 팀', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '송곡대', exact: true }).click();
  await expect(page.getByText('가상 송곡대 팀', { exact: false })).toBeVisible();
  await expect(page.getByText('가상 상대 팀', { exact: false })).toHaveCount(0);
});

for (const admin of [false, true]) {
  test(`${admin ? 'administrator' : 'member'} sees different banners after every third team`, async ({ page }) => {
    await mockApi(page, { signedIn: true, admin });
    const events: unknown[] = [];
    const secondAd = { ...testAd, id: 'second-ad-fixture', headline: '두 번째 테스트 광고' };
    await stubRpc(page, 'get_home_teams', () => ({ body: mockAdTeams(7) }));
    await stubRpc(page, 'get_home_advertising', () => ({
      body: { day: '2026-11-12', banners: [testAd, secondAd] },
    }));
    await stubRpc(page, 'record_home_ad_event', input => {
      events.push(input);
      return { body: true };
    });
    await page.context().route('https://offer.invalid/**', route => route.fulfill({ status: 200, body: 'Synthetic offer' }));
    await page.goto('/');
    const banners = page.getByTestId('home-ad-banner');
    await expect(banners).toHaveCount(2);
    await expect(banners.nth(1)).toContainText(secondAd.headline);
    const precedingCards = await banners.evaluateAll(elements =>
      elements.map(element => element.previousElementSibling?.textContent),
    );
    expect(precedingCards[0]).toContain('광고 위치 테스트 팀 3');
    expect(precedingCards[1]).toContain('광고 위치 테스트 팀 6');
    const popupPromise = page.waitForEvent('popup');
    await banners.nth(1).click();
    await (await popupPromise).close();
    if (admin) expect(events).toEqual([]);
    else await expect.poll(() => events).toContainEqual({ p_banner: secondAd.id, p_clicked: true });
    await page.goto('/me');
    await expect(page.getByRole('link', { name: '광고 문의', exact: true })).toHaveAttribute('href', /^mailto:.+\?subject=/);
  });
}
