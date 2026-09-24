import type { Lang } from '@/i18n';

const ko = {
  title: '관리자 계정 보안', enable: '인증 앱 연결', enabled: '2단계 인증 사용 중',
  intro: '인증 앱을 연결하면 비밀번호가 유출돼도 추가 인증 없이 관리자 정보에 접근할 수 없습니다.',
  setup: '인증 앱으로 QR 코드를 스캔하고, 앱에 표시된 6자리 코드를 입력하세요.',
  challenge: '관리자 정보를 보호하기 위해 인증 앱의 6자리 코드가 필요합니다.',
  code: '인증 코드', verify: '인증하기', cancel: '연결 취소', loading: '계정 보안 확인 중',
  error: '보안 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.',
  invalid: '코드를 확인해주세요. 만료됐다면 인증 앱에 표시된 새 코드를 입력하세요.',
  ready: '이 기기에서 추가 인증이 완료되었습니다.', factor: '인증 앱 선택', remove: '연결 해제',
  removeConfirm: '이 인증 앱의 연결을 해제할까요? 마지막 인증 앱을 해제하면 2단계 인증 보호가 중단됩니다.',
  pending: '완료하지 않은 연결', discard: '미완료 연결 삭제', manual: 'QR 코드 대신 수동으로 입력할 키',
  caution: '등록을 완료하면 다른 기기의 로그인은 종료됩니다. 인증 앱을 안전하게 보관하세요. 앱을 잃어버린 경우 Supabase 관리자 콘솔을 통한 계정 복구가 필요합니다.',
  recovery: '인증 앱을 사용할 수 없다면 Supabase 관리자 콘솔에서 계정을 복구하세요. 다른 회원 계정으로는 우회할 수 없습니다.',
  back: '관리자 홈', securityLink: '계정 보안',
};
type Copy = { [K in keyof typeof ko]: string };
const en: Copy = {
  title: 'Admin account security', enable: 'Connect authenticator', enabled: 'Two-step verification enabled',
  intro: 'An authenticator prevents access to admin data with a password alone.',
  setup: 'Scan the QR code in your authenticator app and enter its six-digit code.',
  challenge: 'Enter the six-digit authenticator code to access administrator data.',
  code: 'Verification code', verify: 'Verify', cancel: 'Cancel setup', loading: 'Checking account security',
  error: 'Unable to check account security. Check your connection and try again.',
  invalid: 'Check the code. If it expired, enter the new code from your authenticator.',
  ready: 'Additional verification is complete on this device.', factor: 'Choose authenticator', remove: 'Disconnect',
  removeConfirm: 'Disconnect this authenticator? Removing the last one disables two-step protection.',
  pending: 'Incomplete setup', discard: 'Remove incomplete setup', manual: 'Manual setup key instead of QR code',
  caution: 'Completing setup signs out other devices. Keep your authenticator safe. Losing access requires account recovery through the Supabase admin console.',
  recovery: 'If you cannot access your authenticator, recover the account through the Supabase admin console. Another member account cannot bypass this check.',
  back: 'Admin home', securityLink: 'Account security',
};
const ja: Copy = {
  title: '管理者アカウントの保護', enable: '認証アプリを連携', enabled: '2段階認証が有効です',
  intro: '認証アプリを連携すると、パスワードだけでは管理者情報にアクセスできなくなります。',
  setup: '認証アプリでQRコードを読み取り、表示された6桁のコードを入力してください。',
  challenge: '管理者情報にアクセスするには認証アプリの6桁のコードが必要です。',
  code: '認証コード', verify: '認証する', cancel: '連携を中止', loading: 'アカウントの保護を確認中',
  error: '確認できませんでした。接続を確認して再試行してください。', invalid: 'コードを確認してください。期限切れの場合は新しいコードを入力してください。',
  ready: 'この端末での追加認証は完了しています。', factor: '認証アプリを選択', remove: '連携解除',
  removeConfirm: '連携を解除しますか？最後のアプリを解除すると2段階認証の保護が無効になります。',
  pending: '未完了の連携', discard: '未完了の連携を削除', manual: 'QRコードの代わりに入力するキー',
  caution: '登録完了時に他の端末はログアウトされます。認証アプリを安全に保管してください。紛失時はSupabase管理コンソールで復旧が必要です。',
  recovery: '認証アプリを利用できない場合はSupabase管理コンソールで復旧してください。他の会員アカウントでは回避できません。',
  back: '管理者ホーム', securityLink: 'アカウント保護',
};
const zh: Copy = {
  title: '管理员账户安全', enable: '连接验证器', enabled: '已启用两步验证',
  intro: '连接验证器后，仅凭密码无法访问管理员数据。',
  setup: '用验证器扫描二维码，然后输入显示的六位验证码。', challenge: '请输入验证器的六位验证码以访问管理员数据。',
  code: '验证码', verify: '验证', cancel: '取消连接', loading: '正在检查账户安全',
  error: '无法检查账户安全。请检查网络后重试。', invalid: '请检查验证码。如果已过期，请输入验证器中的新代码。',
  ready: '此设备已完成额外验证。', factor: '选择验证器', remove: '断开连接',
  removeConfirm: '断开此验证器？移除最后一个验证器会关闭两步验证保护。',
  pending: '未完成的连接', discard: '删除未完成的连接', manual: '代替二维码手动输入的密钥',
  caution: '完成注册会退出其他设备。请妥善保管验证器。丢失访问权限时，需要通过Supabase管理控制台恢复账户。',
  recovery: '无法使用验证器时，请通过Supabase管理控制台恢复账户。其他会员账户无法绕过此检查。',
  back: '管理员首页', securityLink: '账户安全',
};
export const adminMfaCopy = (lang: Lang): Copy => ({ ko, en, ja, zh })[lang];
