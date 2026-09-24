import { Component, type ReactNode } from 'react';
import { getLang } from '@/i18n';

const copy = {
  ko: ['화면을 불러오지 못했어요', '연결을 확인한 뒤 다시 불러와주세요.', '다시 불러오기'],
  en: ['This page could not load', 'Check your connection, then reload.', 'Reload'],
  ja: ['画面を読み込めませんでした', '接続を確認して再読み込みしてください。', '再読み込み'],
  zh: ['页面加载失败', '请检查网络连接并重新加载。', '重新加载'],
};

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const text = copy[getLang()];
    return (
      <main role="alert" className="mx-auto max-w-md space-y-4 px-6 py-16 text-center">
        <h1 className="text-xl font-bold">{text[0]}</h1>
        <p>{text[1]}</p>
        <button type="button" className="rounded-full bg-sakura-500 px-5 py-3 font-semibold text-white" onClick={() => window.location.reload()}>{text[2]}</button>
      </main>
    );
  }
}
