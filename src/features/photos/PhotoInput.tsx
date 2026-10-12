import { useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import { photoCopy } from './photoCopy';
import MemberPhoto from './MemberPhoto';
import { uploadMemberPhoto, type MemberPhoto as Photo } from './photos.api';

export default function PhotoInput({ photo, nickname, onChange, onBusy }: {
  photo?: Photo; nickname: string; onChange: (photo: Photo | undefined) => void; onBusy: (busy: boolean) => void;
}) {
  const { lang } = useI18n();
  const copy = photoCopy(lang);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); onBusy(true); setError('');
    try { changeRef.current(await uploadMemberPhoto(file)); }
    catch (e) { setError(e instanceof Error ? e.message : '사진 업로드를 다시 시도해주세요.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <fieldset className="rounded-xl bg-zinc-50 p-3" disabled={busy}>
    <legend className="text-sm font-semibold">{copy.title}</legend>
    {photo && <MemberPhoto path={photo.path} nickname={nickname || '팀원'} />}
    <p className="text-xs text-zinc-600">{copy.notice}</p>
    <label className="my-2 flex gap-2 text-xs">
      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
      {copy.consent}
    </label>
    <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${nickname || '팀원'} ${copy.choose}`} disabled={!consent || busy}
      onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} className="w-full text-xs" />
    <p className="mt-1 text-xs text-zinc-500">{copy.hint}</p>
    {busy && <p role="status" className="text-xs">{copy.busy}</p>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    {photo && <button type="button" className="mt-2 text-xs text-rose-600" onClick={() => onChange(undefined)}>{copy.remove}</button>}
  </fieldset>;
}
