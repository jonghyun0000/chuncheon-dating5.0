import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function KakaoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (import.meta.env.VITE_KAKAO_LOGIN_ENABLED !== 'true') return null;

  async function start() {
    setBusy(true);
    setError(false);
    try {
      const result = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: { redirectTo: window.location.origin + '/auth/kakao' },
      });
      if (result.error) throw result.error;
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={start}
      className="w-full rounded-2xl bg-[#FEE500] px-4 py-3 font-semibold text-black">
      {busy ? '카카오로 이동 중…' : '카카오로 계속하기'}
    </button>
    {error && <p role="alert">카카오 로그인을 시작하지 못했어요. 다시 시도해주세요.</p>}
  </div>;
}
