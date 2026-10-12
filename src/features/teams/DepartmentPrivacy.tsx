import { useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

/** Stored independently of the team form, so it also protects saved drafts. */
export default function DepartmentPrivacy() {
  const { profile } = useAuth();
  const id = useId();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setSaved(false);
    if (!profile?.id) return;
    supabase.from('department_privacy_preferences').select('enabled').eq('user_id', profile.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(true);
        else { setEnabled(data?.enabled === true); setLoading(false); }
      }, () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [profile?.id, retry]);
  async function change(value: boolean) {
    setSaving(true); setSaved(false); setError(false);
    try {
      const { data, error } = await supabase.rpc('set_department_privacy', { p_enabled: value });
      if (error || data !== value) throw error ?? new Error('Unexpected setting response');
      setEnabled(value); setSaved(true);
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  return <section className="card mb-4 space-y-2 p-5" aria-labelledby={`${id}-title`}>
    <label className="flex cursor-pointer items-start gap-3" htmlFor={id}>
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={enabled}
        disabled={loading || saving || error} onChange={e => void change(e.target.checked)} aria-describedby={`${id}-help`} />
      <span id={`${id}-title`} className="font-semibold">같은 학교·학과 지인 피하기 <span className="text-xs font-normal text-zinc-500">(선택)</span></span>
    </label>
    <p id={`${id}-help`} className="text-sm text-zinc-600">한쪽만 켜도 양쪽 팀원 중 학교와 학과가 모두 같은 사람이 한 명이라도 있으면 팀 전체를 서로 숨겨요. 다른 학교의 같은 학과는 보여요.</p>
    <p className="text-xs text-zinc-500">저장된 팀·임시저장 팀의 정보를 기준으로 적용돼요. 팀이 없으면 먼저 팀 정보를 저장해주세요. 학과는 띄어쓰기를 제외한 입력명이 같아야 하므로 공식 학과명을 입력해주세요. 켜면 볼 수 있는 팀이 줄어들고 기존 신청·매칭 상대도 숨겨질 수 있어요. 이미 확인한 정보나 사진까지 회수되지는 않아요.</p>
    {loading && !error && <p role="status" className="text-sm">설정 불러오는 중…</p>}
    {saving && <p role="status" className="text-sm">저장 중…</p>}
    {saved && <p role="status" className="text-sm text-emerald-700">{enabled ? '지인 피하기를 켰어요.' : '지인 피하기를 껐어요.'}</p>}
    {error && <div role="alert" className="text-sm text-red-700">설정을 확인하지 못했어요. 다시 불러와 상태를 확인해주세요. <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>다시 불러오기</button></div>}
  </section>;
}
