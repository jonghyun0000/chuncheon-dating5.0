import type { Lang } from '@/i18n';
const copy = {
  ko: { title: '같은 성별 팀 구경하기', hint: '다른 팀은 어떻게 소개했을까?', note: '팀 작성 참고용이에요. 사진·연락처는 표시하지 않으며, 매칭 신청은 할 수 없어요.', privacy: '같은 학교·학과 지인 피하기가 적용됩니다.', empty: '지금 구경할 수 있는 같은 성별 팀이 없어요.', create: '우리 팀도 작성하기', back: '홈으로', more: '더 보기', member: '팀원', people: '명' },
  en: { title: 'Browse same-gender teams', hint: 'How do other teams introduce themselves?', note: 'For inspiration only. Photos and contact details are hidden, and match requests are unavailable.', privacy: 'Same-school and department privacy applies.', empty: 'No same-gender teams are available right now.', create: 'Write our team profile', back: 'Home', more: 'Show more', member: 'Member', people: ' members' },
  ja: { title: '同性のチームを見てみる', hint: '他のチームはどう紹介している？', note: 'チーム紹介の参考用です。写真・連絡先は表示されず、マッチング申請はできません。', privacy: '同じ学校・学科の知り合いを避ける設定が適用されます。', empty: '現在、表示できる同性のチームはありません。', create: '自分たちのチームを書く', back: 'ホーム', more: 'もっと見る', member: 'メンバー', people: '人' },
  zh: { title: '看看同性队伍', hint: '其他队伍如何介绍自己？', note: '仅供填写队伍介绍时参考。不显示照片和联系方式，无法申请匹配。', privacy: '同校同专业熟人回避设置依然有效。', empty: '目前没有可以浏览的同性队伍。', create: '填写我们的队伍', back: '首页', more: '查看更多', member: '成员', people: '人' },
};
export const teamExamplesCopy = (lang: Lang) => copy[lang];
