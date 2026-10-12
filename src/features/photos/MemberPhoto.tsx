import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { photoCopy } from './photoCopy';
import Modal from '@/components/common/Modal';
import { photoBlob } from './photos.api';

export default function MemberPhoto({ path, nickname }: { path: string; nickname: string }) {
  const { lang } = useI18n();
  const copy = photoCopy(lang);
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let localUrl: string | undefined;
    setUrl(null); setOpen(false); setFailed(false);
    photoBlob(path).then(blob => {
      if (cancelled) return;
      localUrl = URL.createObjectURL(blob); setUrl(localUrl);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [path]);
  if (!url) return <span className="text-xs text-zinc-400">{failed ? copy.failed : copy.loading}</span>;
  return <>
    <button type="button" onClick={(event) => { event.currentTarget.focus(); setOpen(true); }} aria-label={`${nickname} ${copy.expand}`} className="my-2 block overflow-hidden rounded-xl">
      <img src={url} alt={`${nickname} 사진`} className="h-32 w-32 object-cover" loading="lazy" />
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title={`${nickname} 사진`}>
      <img src={url} alt={`${nickname} ${copy.expand}`} className="max-h-[65dvh] w-full object-contain" />
      <button type="button" className="btn-ghost mt-3" onClick={() => setOpen(false)}>{copy.close}</button>
    </Modal>
  </>;
}
