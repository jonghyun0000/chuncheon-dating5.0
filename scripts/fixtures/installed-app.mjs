/** Synthetic, local-only API. No real credentials or member records. */
export const fixtureId = '00000000-0000-4000-8000-000000000001';
export const matchPath = '/matches/00000000-0000-4000-8000-000000000099';
export function account(role) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: fixtureId, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, factors: [], created_at: '2026-01-01T00:00:00Z' };
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({sub: fixtureId, aud:'authenticated', role:'authenticated', aal:'aal1', exp})).toString('base64url'), 'fixture'].join('.');
  const session = { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
  const profile = { id: fixtureId, username: 'fixture', name: '가상회원', gender: 'male', school: '강원대', contact_type: 'phone', contact_id: '01000000000', role, status: 'active', is_verified: true, verification_status: 'approved', verification_restricted: false, terms_version: 'v5.1' };
  return { user, session, profile };
}
const opponent = {
  id: '00000000-0000-4000-8000-000000000002', owner_id: '00000000-0000-4000-8000-000000000003', gender: 'female', intro: '가상 상대 팀', status: 'active', team_size: 1, owner_verified: true, created_at: '2026-01-01T00:00:00Z',
  members: [{id:'m1', member_order:1, nickname:'가상팀원', school:'한림대', department:'경영학과', student_number:'26', smoking:false, taste_tags:['산책'], want_tags:[]}],
};
const readRpcs = new Set(['get_home_stats', 'get_home_teams', 'get_member_photos', 'get_home_advertising', 'unhandled_notification_count']);
export function fixtureResponse(path, method, fixture) {
  if (method === 'OPTIONS') return { status: 204 };
  if (method !== 'GET' && !(method === 'POST' && path.includes('/rpc/') && readRpcs.has(path.split('/').at(-1)))) {
    return { status: 405, data: {message:'Writes are disabled in the upgrade fixture'} };
  }
  let data = [];
  if (path.endsWith('/auth/v1/user')) data = fixture.user;
  else if (path.endsWith('/profiles')) data = [fixture.profile];
  else if (path.endsWith('/department_privacy_preferences')) data = {enabled:false};
  else if (path.endsWith('/rpc/get_home_stats')) data = {total_teams:1, matched_count:0, total_users:2};
  else if (path.endsWith('/rpc/unhandled_notification_count')) data = 0;
  else if (path.endsWith('/rpc/get_home_advertising')) data = null;
  else if (path.endsWith('/rpc/get_home_teams')) data = [opponent];
  return { status: 200, data };
}
export const scenarios = [
  { role: 'user', name:'member-team', path:'/team', check:'team' },
  { role: 'user', name:'member-match', path:matchPath, check:'match' },
  { role: 'admin', name:'admin-reports', path:'/admin/reports', check:'reports' },
  { role: 'admin', name:'admin-reviews', path:'/admin/reviews', check:'reviews' },
  { role: 'admin', name:'admin-match', path:matchPath, check:'match' },
];
