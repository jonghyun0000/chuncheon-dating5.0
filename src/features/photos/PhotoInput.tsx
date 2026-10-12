import { useEffect, useRef, useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import { useI18n } from '@/i18n';
import { photoCopy } from './photoCopy';
import MemberPhoto from './MemberPhoto';
import { prepareMemberPhoto, type MemberPhoto as Photo } from './photos.api';

export default function PhotoInput({ photo, pending, nickname, onChange, onBusy }: {
  photo?: Photo; pending?: Blob; nickname: string; onChange: (photo: Blob | undefined) => void; onBusy: (busy: boolean) => void;
}) {
  const { lang } = useI18n();
  const copy = photoCopy(lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!pending) { setPreview(''); return; }
    const url = URL.createObjectURL(pending);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);
  async function select(file?: File) {
    if (!file) return;
    setBusy(true); onBusy(true); setError('');
    try { changeRef.current(await prepareMemberPhoto(file)); }
    catch (e) { setError(e instanceof Error ? e.message : copy.failed); }
    finally { setBusy(false); onBusy(false); }
  }
  return <fieldset className="rounded-xl border border-sakura-100 bg-sakura-50/50 p-3" disabled={busy}>
    <legend className="text-sm font-semibold">{copy.title}</legend>
    <p className="mb-3 text-sm font-medium text-sakura-700">{copy.encourage}</p>
    {preview ? <img src={preview} alt={`${nickname || '팀원'} ${copy.choose}`} className="mb-3 h-32 w-32 rounded-xl object-cover" />
      : photo && <MemberPhoto path={photo.path} nickname={nickname || '팀원'} />}
    <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sakura-300 bg-white p-3 text-sm font-semibold text-sakura-700 hover:bg-sakura-50 focus-visible:outline focus-visible:outline-2">
      <Camera size={20} aria-hidden="true" /><Plus size={16} aria-hidden="true" />{copy.add}
    </button>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${nickname || '팀원'} ${copy.choose}`}
      onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void select(file); }} className="sr-only" tabIndex={-1} />
    <p className="mt-2 text-xs text-zinc-500">{copy.hint}</p>
    <p className="mt-1 text-xs text-zinc-500">{copy.pending}</p>
    {busy && <p role="status" className="text-xs">{copy.loading}</p>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    {(photo || pending) && <button type="button" className="mt-2 text-xs text-rose-600" onClick={() => onChange(undefined)}>{copy.remove}</button>}
  </fieldset>;
}
