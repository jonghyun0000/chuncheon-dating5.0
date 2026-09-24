import { useI18n } from '@/i18n';

const copy = {
  ko: ['정보를 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요.', '다시 시도'],
  en: ['Could not load the information. Check your connection and try again.', 'Try again'],
  ja: ['情報を読み込めませんでした。接続を確認して再試行してください。', '再試行'],
  zh: ['无法加载信息。请检查网络连接并重试。', '重试'],
};

export default function LoadError({ retry }: { retry: () => void }) {
  const { lang } = useI18n();
  return (
    <div role="alert" className="card my-4 space-y-3 border border-rose-200 p-5 text-sm text-rose-800">
      <p>{copy[lang][0]}</p>
      <button type="button" onClick={retry} className="rounded-full bg-white px-4 py-2 font-semibold ring-1 ring-rose-200">
        {copy[lang][1]}
      </button>
    </div>
  );
}
