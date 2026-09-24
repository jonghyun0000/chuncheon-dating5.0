import { getLang, type Lang } from '@/i18n';

const messages = {
  ko: {
    unavailable: '계정 정보를 확인하지 못했어요',
    unavailableBody: '일시적인 연결 문제일 수 있어요. 다시 확인한 뒤 이용해 주세요.',
    incomplete: '회원가입을 마무리해 주세요',
    incompleteBody: '아이디는 만들어졌지만 회원 정보 등록이 완료되지 않았어요. 같은 아이디와 비밀번호로 가입을 이어갈 수 있어요.',
    retry: '다시 확인', resume: '가입 이어하기',
    resumeHint: '이전에 가입이 중단됐다면 같은 아이디와 비밀번호를 입력하고 가입을 이어가세요.',
    resumeMode: '이전 가입 이어하기',
    formats: 'JPG, PNG, WebP, HEIC 또는 HEIF 사진만 등록할 수 있어요. (최대 5MB)',
    invalidImage: '사진 파일을 확인할 수 없어요. JPG, PNG, WebP, HEIC 또는 HEIF 사진을 다시 선택해 주세요.',
    existing: '이미 가입된 계정이에요. 로그인 화면에서 이용해 주세요.',
    verifyPassword: '이전 가입을 확인하지 못했어요. 같은 아이디와 비밀번호를 확인해 주세요.',
  },
  en: {
    unavailable: 'We could not check your account', unavailableBody: 'There may be a connection problem. Please retry before continuing.',
    incomplete: 'Finish creating your account', incompleteBody: 'Your login exists, but registration is incomplete. Continue with the same username and password.',
    retry: 'Retry', resume: 'Continue registration', resumeHint: 'If registration was interrupted, use the same username and password to continue.', resumeMode: 'Continue an interrupted registration',
    formats: 'Use a JPG, PNG, WebP, HEIC or HEIF photo, up to 5MB.', invalidImage: 'We could not read this photo. Choose a JPG, PNG, WebP, HEIC or HEIF photo.',
    existing: 'This account is already registered. Please use the login page.', verifyPassword: 'We could not verify the earlier registration. Check the original username and password.',
  },
  ja: {
    unavailable: 'アカウント情報を確認できませんでした', unavailableBody: '接続に問題がある可能性があります。再確認してからご利用ください。',
    incomplete: '会員登録を完了してください', incompleteBody: 'ログイン情報は作成済みですが、登録は未完了です。同じIDとパスワードで続けられます。',
    retry: '再確認', resume: '登録を続ける', resumeHint: '登録が中断した場合は、同じIDとパスワードで続けてください。', resumeMode: '中断した登録を続ける',
    formats: 'JPG、PNG、WebP、HEIC、HEIF形式の写真（5MB以下）を選択してください。', invalidImage: '写真を確認できません。JPG、PNG、WebP、HEIC、HEIF形式の写真を選び直してください。',
    existing: '登録済みのアカウントです。ログイン画面をご利用ください。', verifyPassword: '以前の登録を確認できませんでした。同じIDとパスワードをご確認ください。',
  },
  zh: {
    unavailable: '无法确认账户信息', unavailableBody: '可能出现了连接问题，请重试后继续。',
    incomplete: '请完成注册', incompleteBody: '登录账户已创建，但资料尚未提交完成。请使用相同的用户名和密码继续。',
    retry: '重试', resume: '继续注册', resumeHint: '如果之前注册中断，请使用相同的用户名和密码继续。', resumeMode: '继续之前中断的注册',
    formats: '请选择不超过5MB的JPG、PNG、WebP、HEIC或HEIF照片。', invalidImage: '无法读取照片，请重新选择JPG、PNG、WebP、HEIC或HEIF照片。',
    existing: '该账户已完成注册，请前往登录页面。', verifyPassword: '无法确认之前的注册，请检查原用户名和密码。',
  },
} satisfies Record<Lang, Record<string, string>>;
export const authMessages = (lang: Lang = getLang()) => messages[lang];
