import type { Lang } from '@/i18n';

const copy = {
  ko: { title: '관리자 보기', note: '모집 중인 남녀 팀을 모두 표시합니다.', all: '남녀 전체', male: '남자 팀', female: '여자 팀', manage: '전체 팀 관리', sameGender: '같은 성별 팀' },
  en: { title: 'Admin view', note: 'Showing open teams of both genders.', all: 'All genders', male: 'Male teams', female: 'Female teams', manage: 'Manage all teams', sameGender: 'Same-gender team' },
  ja: { title: '管理者ビュー', note: '募集中の男女両方のチームを表示します。', all: 'すべて', male: '男性チーム', female: '女性チーム', manage: '全チームの管理', sameGender: '同性のチーム' },
  zh: { title: '管理员视图', note: '显示正在招募的男女双方队伍。', all: '全部性别', male: '男生队伍', female: '女生队伍', manage: '管理所有队伍', sameGender: '同性队伍' },
};
export const adminHomeCopy = (lang: Lang) => copy[lang];
